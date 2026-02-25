const createHttpError = require("http-errors");
const mongoose = require("mongoose");
const RolePermission = require("../models/rolePermissionModel");
const DataScopePolicy = require("../models/dataScopePolicyModel");
const SessionSecurityEvent = require("../models/sessionSecurityEventModel");
const FieldAccessPolicy = require("../models/fieldAccessPolicyModel");
const { logAuditEvent } = require("../utils/auditLogger");

const parsePagination = (req) => {
  const rawLimit = Number(req.query.limit || 50);
  const rawOffset = Number(req.query.offset || 0);

  return {
    limit: Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 50,
    offset: Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0,
  };
};

const normalizeRole = (role) => `${role || ""}`.trim();
const normalizeResource = (resource) => `${resource || ""}`.trim();

const upsertRolePermission = async (req, res, next) => {
  try {
    const role = normalizeRole(req.body.role);
    const resource = normalizeResource(req.body.resource);
    const actions = Array.isArray(req.body.actions)
      ? req.body.actions.map((action) => `${action}`.trim().toLowerCase()).filter(Boolean)
      : [];

    if (!role || !resource || actions.length === 0) {
      return next(createHttpError(400, "role, resource and non-empty actions are required."));
    }

    const permission = await RolePermission.findOneAndUpdate(
      { role, resource },
      {
        $set: {
          role,
          resource,
          actions,
          effect: `${req.body.effect || "allow"}`.trim().toLowerCase(),
          metadata: req.body.metadata,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    await logAuditEvent({
      req,
      action: "ROLE_PERMISSION_UPSERTED",
      resourceType: "RolePermission",
      resourceId: permission._id,
      statusCode: 200,
      metadata: { role, resource, actions },
    });

    return res.status(200).json({ success: true, data: permission });
  } catch (error) {
    return next(error);
  }
};

const listRolePermissions = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.role) {
      query.role = normalizeRole(req.query.role);
    }
    if (req.query.resource) {
      query.resource = normalizeResource(req.query.resource);
    }

    const rows = await RolePermission.find(query).sort({ role: 1, resource: 1 });
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
};

const upsertDataScopePolicy = async (req, res, next) => {
  try {
    const subjectType = `${req.body.subjectType || ""}`.trim().toUpperCase();
    const subjectId = `${req.body.subjectId || ""}`.trim();
    const role = normalizeRole(req.body.role);
    const resource = normalizeResource(req.body.resource);
    const allowedLocationIds = Array.isArray(req.body.allowedLocationIds)
      ? req.body.allowedLocationIds.map((value) => `${value}`.trim()).filter(Boolean)
      : [];

    if (!["USER", "ROLE"].includes(subjectType)) {
      return next(createHttpError(400, "subjectType must be USER or ROLE."));
    }

    if (!resource || allowedLocationIds.length === 0) {
      return next(createHttpError(400, "resource and allowedLocationIds are required."));
    }

    if (subjectType === "USER" && !mongoose.Types.ObjectId.isValid(subjectId)) {
      return next(createHttpError(400, "Valid subjectId is required for USER scope."));
    }

    if (subjectType === "ROLE" && !role) {
      return next(createHttpError(400, "role is required for ROLE scope."));
    }

    const selector = {
      subjectType,
      resource,
      subjectId: subjectType === "USER" ? subjectId : undefined,
      role: subjectType === "ROLE" ? role : undefined,
    };

    const policy = await DataScopePolicy.findOneAndUpdate(
      selector,
      {
        $set: {
          ...selector,
          allowedLocationIds,
          effect: `${req.body.effect || "allow"}`.trim().toLowerCase(),
          metadata: req.body.metadata,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    await logAuditEvent({
      req,
      action: "DATA_SCOPE_POLICY_UPSERTED",
      resourceType: "DataScopePolicy",
      resourceId: policy._id,
      statusCode: 200,
      metadata: {
        subjectType,
        subjectId: selector.subjectId,
        role: selector.role,
        resource,
      },
    });

    return res.status(200).json({ success: true, data: policy });
  } catch (error) {
    return next(error);
  }
};

const listDataScopePolicies = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.subjectType) {
      query.subjectType = `${req.query.subjectType}`.trim().toUpperCase();
    }
    if (req.query.role) {
      query.role = normalizeRole(req.query.role);
    }
    if (req.query.resource) {
      query.resource = normalizeResource(req.query.resource);
    }

    const rows = await DataScopePolicy.find(query).sort({ updatedAt: -1 });
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
};

const listSessionSecurityEvents = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = {};

    if (req.query.userId) {
      query.userId = req.query.userId;
    }
    if (req.query.type) {
      query.type = `${req.query.type}`.trim().toUpperCase();
    }

    const [rows, total] = await Promise.all([
      SessionSecurityEvent.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("userId", "name role email"),
      SessionSecurityEvent.countDocuments(query),
    ]);

    return res.status(200).json({ success: true, data: rows, pagination: { limit, offset, total } });
  } catch (error) {
    return next(error);
  }
};

const upsertFieldAccessPolicy = async (req, res, next) => {
  try {
    const role = normalizeRole(req.body.role);
    const resource = normalizeResource(req.body.resource).toLowerCase();
    const readableFields = Array.isArray(req.body.readableFields)
      ? req.body.readableFields.map((field) => `${field}`.trim()).filter(Boolean)
      : [];
    const writableFields = Array.isArray(req.body.writableFields)
      ? req.body.writableFields.map((field) => `${field}`.trim()).filter(Boolean)
      : [];
    const maskedFields = Array.isArray(req.body.maskedFields)
      ? req.body.maskedFields.map((field) => `${field}`.trim()).filter(Boolean)
      : [];

    if (!role || !resource) {
      return next(createHttpError(400, "role and resource are required."));
    }

    const policy = await FieldAccessPolicy.findOneAndUpdate(
      { role, resource },
      {
        $set: {
          role,
          resource,
          readableFields: readableFields.length > 0 ? readableFields : ["*"],
          writableFields,
          maskedFields,
          metadata: req.body.metadata,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    await logAuditEvent({
      req,
      action: "FIELD_ACCESS_POLICY_UPSERTED",
      resourceType: "FieldAccessPolicy",
      resourceId: policy._id,
      statusCode: 200,
      metadata: { role, resource },
    });

    return res.status(200).json({ success: true, data: policy });
  } catch (error) {
    return next(error);
  }
};

const listFieldAccessPolicies = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.role) {
      query.role = normalizeRole(req.query.role);
    }
    if (req.query.resource) {
      query.resource = normalizeResource(req.query.resource).toLowerCase();
    }

    const rows = await FieldAccessPolicy.find(query).sort({ role: 1, resource: 1 });
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  upsertRolePermission,
  listRolePermissions,
  upsertDataScopePolicy,
  listDataScopePolicies,
  listSessionSecurityEvents,
  upsertFieldAccessPolicy,
  listFieldAccessPolicies,
};
