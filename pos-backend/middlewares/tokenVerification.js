const createHttpError = require("http-errors");
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const User = require("../models/userModel");
const {
    assertPermission,
    assertScope,
    extractCandidateLocationId,
    normalizeLocationId,
} = require("../utils/accessControlService");
const { logSessionSecurityEvent } = require("../utils/sessionSecurityService");


const isVerifiedUser = async (req, res, next) => {
    try{

        const { accessToken } = req.cookies;
        
        if(!accessToken){
            await logSessionSecurityEvent({
                req,
                type: "TOKEN_MISSING",
                details: { path: req.originalUrl || req.url },
            });
            const error = createHttpError(401, "Please provide token!");
            return next(error);
        }

        const decodeToken = jwt.verify(accessToken, config.accessTokenSecret);

        const user = await User.findById(decodeToken._id);
        if(!user){
            await logSessionSecurityEvent({
                req,
                type: "TOKEN_INVALID",
                details: { reason: "user_not_found" },
            });
            const error = createHttpError(401, "User not exist!");
            return next(error);
        }

        req.user = user;
        next();

    }catch (error) {
        await logSessionSecurityEvent({
            req,
            type: "TOKEN_INVALID",
            details: { reason: "jwt_verify_failed" },
        });
        const err = createHttpError(401, "Invalid Token!");
        next(err);
    }
}

const requireRoles = (...allowedRoles) => (req, res, next) => {
    if (!req.user) {
        return next(createHttpError(401, "Unauthorized"));
    }

    if (!allowedRoles.includes(req.user.role)) {
        return next(createHttpError(403, "Forbidden: insufficient role"));
    }

    return next();
};

const requirePermission = (resource, action) => async (req, res, next) => {
    try {
        if (!req.user) {
            return next(createHttpError(401, "Unauthorized"));
        }

        await assertPermission({
            role: req.user.role,
            resource,
            action,
        });

        return next();
    } catch (error) {
        await logSessionSecurityEvent({
            req,
            userId: req.user?._id,
            type: "PERMISSION_DENIED",
            details: {
                resource,
                action,
                role: req.user?.role,
            },
        });
        return next(error);
    }
};

const requireDataScope = (resource, locationResolver) => async (req, res, next) => {
    try {
        if (!req.user) {
            return next(createHttpError(401, "Unauthorized"));
        }

        const resolvedLocationId = normalizeLocationId(
            typeof locationResolver === "function"
                ? locationResolver(req)
                : extractCandidateLocationId(req)
        );

        await assertScope({
            userId: req.user._id,
            role: req.user.role,
            resource,
            locationId: resolvedLocationId,
        });

        req.resolvedLocationId = resolvedLocationId;
        return next();
    } catch (error) {
        await logSessionSecurityEvent({
            req,
            userId: req.user?._id,
            type: "SCOPE_DENIED",
            details: {
                resource,
                locationId: req.resolvedLocationId || extractCandidateLocationId(req),
                role: req.user?.role,
            },
        });
        return next(error);
    }
};

module.exports = {
    isVerifiedUser,
    requireRoles,
    requirePermission,
    requireDataScope,
};
