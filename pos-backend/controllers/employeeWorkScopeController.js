/**
 * 员工工作范围 API - 团队管理 Phase 2
 * 2026-02-28
 */
const User = require("../models/userModel");
const Position = require("../models/positionModel");
const EmployeeProfile = require("../models/employeeProfileModel");
const EmployeeWorkScope = require("../models/employeeWorkScopeModel");
const createHttpError = require("http-errors");
const mongoose = require("mongoose");

const SCOPE_TYPES = ["TABLES", "BAR", "KITCHEN", "RUNNER", "TAKEOUT", "CASHIER", "MANAGER"];

const listEmployeesWithScopes = async (req, res, next) => {
  try {
    const locationId = req.query.locationId || "default";
    const users = await User.find({}).select("name email role");
    const profiles = await EmployeeProfile.find({ locationId }).populate("positionId");
    const scopes = await EmployeeWorkScope.find({ locationId }).populate("positionId");
    const profileByUser = new Map(profiles.map((p) => [`${p.userId}`, p]));
    const scopesByUser = new Map();
    for (const s of scopes) {
      const k = `${s.userId}`;
      if (!scopesByUser.has(k)) scopesByUser.set(k, []);
      scopesByUser.get(k).push(s);
    }
    const list = users.map((u) => {
      const profile = profileByUser.get(`${u._id}`);
      const userScopes = scopesByUser.get(`${u._id}`) || [];
      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        positionId: profile?.positionId?._id,
        position: profile?.positionId
          ? { name: profile.positionId.name, scopeType: profile.positionId.scopeType }
          : null,
        workScopes: userScopes.map((s) => ({
          _id: s._id,
          scopeType: s.scopeType,
          scopeConfig: s.scopeConfig,
        })),
      };
    });
    return res.status(200).json({ success: true, data: list });
  } catch (error) {
    return next(error);
  }
};

const getWorkScope = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return next(createHttpError(400, "Invalid user id."));
    }
    const locationId = req.query.locationId || "default";
    const scopes = await EmployeeWorkScope.find({ userId, locationId })
      .populate("positionId")
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: scopes });
  } catch (error) {
    return next(error);
  }
};

const upsertWorkScope = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return next(createHttpError(400, "Invalid user id."));
    }
    const user = await User.findById(userId);
    if (!user) return next(createHttpError(404, "User not found."));
    const { positionId, scopeType, scopeConfig } = req.body;
    const locationId = req.body.locationId || "default";
    if (!scopeType && !positionId) {
      return next(createHttpError(400, "scopeType or positionId required."));
    }
    if (scopeType && !SCOPE_TYPES.includes(scopeType)) {
      return next(createHttpError(400, `scopeType must be one of: ${SCOPE_TYPES.join(", ")}`));
    }
    let position = null;
    if (positionId) {
      position = await Position.findById(positionId);
      if (!position) return next(createHttpError(404, "Position not found."));
    }
    let scope = await EmployeeWorkScope.findOne({ userId, locationId });
    if (scope) {
      if (positionId !== undefined) scope.positionId = positionId;
      if (scopeType !== undefined) scope.scopeType = scopeType;
      if (scopeConfig !== undefined) scope.scopeConfig = scopeConfig || {};
      await scope.save();
    } else {
      scope = await EmployeeWorkScope.create({
        userId,
        positionId: positionId || position?._id,
        locationId,
        scopeType: scopeType || position?.scopeType,
        scopeConfig: scopeConfig || position?.scopeConfig || {},
      });
    }
    await scope.populate("positionId");
    return res.status(200).json({ success: true, data: scope });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listEmployeesWithScopes,
  getWorkScope,
  upsertWorkScope,
};
