const createHttpError = require("http-errors");
const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const { logAuditEvent } = require("../utils/auditLogger");
const {
    buildSessionFingerprint,
    logSessionSecurityEvent,
} = require("../utils/sessionSecurityService");

const STAFF_ROLES = ["Waiter", "Cashier"];

const sanitizeUser = (user) => ({
    _id: user._id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
});

const register = async (req, res, next) => {
    try {

        const { name, phone, email, password, role } = req.body;

        if(!name || !phone || !email || !password || !role){
            const error = createHttpError(400, "All fields are required!");
            return next(error);
        }

        if (!STAFF_ROLES.includes(role)) {
            const error = createHttpError(403, "Only staff roles can be self-registered.");
            return next(error);
        }

        const isUserPresent = await User.findOne({email});
        if(isUserPresent){
            const error = createHttpError(400, "User already exist!");
            return next(error);
        }


        const user = { name, phone, email, password, role };
        const newUser = User(user);
        await newUser.save();

        await logAuditEvent({
            req,
            action: "USER_REGISTERED",
            resourceType: "User",
            resourceId: newUser._id,
            statusCode: 201,
            metadata: {
                role: newUser.role
            }
        });

        res.status(201).json({success: true, message: "New user created!", data: sanitizeUser(newUser)});


    } catch (error) {
        next(error);
    }
}


const login = async (req, res, next) => {

    try {
        
        const { email, password } = req.body;

        if(!email || !password) {
            const error = createHttpError(400, "All fields are required!");
            return next(error);
        }

        const isUserPresent = await User.findOne({email}).select("+password");
        if(!isUserPresent){
            const error = createHttpError(401, "Invalid Credentials");
            return next(error);
        }

        const isMatch = await bcrypt.compare(password, isUserPresent.password);
        if(!isMatch){
            const error = createHttpError(401, "Invalid Credentials");
            return next(error);
        }

        const accessToken = jwt.sign({_id: isUserPresent._id}, config.accessTokenSecret, {
            expiresIn : '1d'
        });

        const isProduction = config.nodeEnv === "production";

        res.cookie('accessToken', accessToken, {
            maxAge: 1000 * 60 * 60 *24 * 30,
            httpOnly: true,
            sameSite: isProduction ? "none" : "lax",
            secure: isProduction
        })

        const safeUser = sanitizeUser(isUserPresent);

        const nextFingerprint = buildSessionFingerprint(req);
        const previousFingerprint = `${isUserPresent.lastSessionFingerprint || ""}`.trim();
        const fingerprintChanged =
            Boolean(previousFingerprint) && previousFingerprint !== nextFingerprint;

        if (fingerprintChanged) {
            await logSessionSecurityEvent({
                req,
                userId: isUserPresent._id,
                type: "LOGIN_FINGERPRINT_CHANGED",
                details: {
                    previousFingerprint,
                    nextFingerprint,
                },
            });
        }

        await logSessionSecurityEvent({
            req,
            userId: isUserPresent._id,
            type: "LOGIN_SUCCESS",
            details: {
                role: isUserPresent.role,
                fingerprintChanged,
            },
        });

        isUserPresent.lastLoginAt = new Date();
        isUserPresent.lastSessionFingerprint = nextFingerprint;
        await isUserPresent.save();

        req.user = isUserPresent;
        await logAuditEvent({
            req,
            action: "USER_LOGGED_IN",
            resourceType: "User",
            resourceId: isUserPresent._id,
            statusCode: 200
        });

        res.status(200).json({success: true, message: "User login successfully!", 
            data: safeUser
        });


    } catch (error) {
        next(error);
    }

}

const getUserData = async (req, res, next) => {
    try {
        
        const user = await User.findById(req.user._id);
        if (!user) {
            return next(createHttpError(404, "User not found"));
        }

        res.status(200).json({success: true, data: sanitizeUser(user)});

    } catch (error) {
        next(error);
    }
}

const logout = async (req, res, next) => {
    try {
        
        const isProduction = config.nodeEnv === "production";

        res.clearCookie('accessToken', {
            httpOnly: true,
            sameSite: isProduction ? "none" : "lax",
            secure: isProduction
        });

        await logAuditEvent({
            req,
            action: "USER_LOGGED_OUT",
            resourceType: "User",
            resourceId: req.user?._id,
            statusCode: 200
        });

        res.status(200).json({success: true, message: "User logout successfully!"});

    } catch (error) {
        next(error);
    }
}




module.exports = { register, login, getUserData, logout }
