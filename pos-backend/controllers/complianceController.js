const createHttpError = require("http-errors");
const mongoose = require("mongoose");
const AuditLog = require("../models/auditLogModel");
const ComplianceExportRequest = require("../models/complianceExportRequestModel");
const MemberAccount = require("../models/memberAccountModel");
const HighRiskApprovalPolicy = require("../models/highRiskApprovalPolicyModel");
const HighRiskApprovalRequest = require("../models/highRiskApprovalRequestModel");
const CompliancePolicyPack = require("../models/compliancePolicyPackModel");
const { logAuditEvent } = require("../utils/auditLogger");
const { maskSensitiveMember } = require("../utils/complianceMasking");
const { applyPolicyPackToLocation } = require("../utils/compliancePolicyExecutor");

const normalizeLocationId = (value) => `${value || ""}`.trim() || "default";

const parsePagination = (req) => {
  const rawLimit = Number(req.query.limit || 50);
  const rawOffset = Number(req.query.offset || 0);

  return {
    limit: Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 50,
    offset: Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0,
  };
};

const listAuditLogs = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = {};

    if (req.query.action) {
      query.action = `${req.query.action}`.trim();
    }

    if (req.query.actorId) {
      query.actorId = req.query.actorId;
    }

    if (req.query.resourceType) {
      query.resourceType = `${req.query.resourceType}`.trim();
    }

    if (req.query.success === "true") {
      query.success = true;
    } else if (req.query.success === "false") {
      query.success = false;
    }

    const [rows, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("actorId", "name role"),
      AuditLog.countDocuments(query),
    ]);

    return res.status(200).json({ success: true, data: rows, pagination: { limit, offset, total } });
  } catch (error) {
    return next(error);
  }
};

const createComplianceExportRequest = async (req, res, next) => {
  try {
    const requestType = `${req.body.requestType || ""}`.trim().toUpperCase();
    const subjectType = `${req.body.subjectType || "OTHER"}`.trim().toUpperCase();

    if (!requestType) {
      return next(createHttpError(400, "requestType is required."));
    }

    const request = await ComplianceExportRequest.create({
      locationId: normalizeLocationId(req.body.locationId),
      requestType,
      subjectType,
      subjectId: `${req.body.subjectId || ""}`.trim(),
      reason: `${req.body.reason || ""}`.trim(),
      notes: `${req.body.notes || ""}`.trim(),
      metadata: req.body.metadata,
      requestedBy: req.user?._id,
    });

    await logAuditEvent({
      req,
      action: "COMPLIANCE_EXPORT_REQUEST_CREATED",
      resourceType: "ComplianceExportRequest",
      resourceId: request._id,
      statusCode: 201,
      metadata: {
        requestType,
        subjectType,
      },
    });

    return res.status(201).json({ success: true, data: request });
  } catch (error) {
    return next(error);
  }
};

const listComplianceExportRequests = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = {};

    if (req.query.locationId) {
      query.locationId = normalizeLocationId(req.query.locationId);
    }

    if (req.query.status) {
      query.status = `${req.query.status}`.trim().toUpperCase();
    }

    if (req.query.requestType) {
      query.requestType = `${req.query.requestType}`.trim().toUpperCase();
    }

    const [rows, total] = await Promise.all([
      ComplianceExportRequest.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("requestedBy approvedBy", "name role"),
      ComplianceExportRequest.countDocuments(query),
    ]);

    return res.status(200).json({ success: true, data: rows, pagination: { limit, offset, total } });
  } catch (error) {
    return next(error);
  }
};

const updateComplianceExportRequestStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid request id."));
    }

    const request = await ComplianceExportRequest.findById(id);
    if (!request) {
      return next(createHttpError(404, "Compliance request not found."));
    }

    const nextStatus = `${req.body.status || ""}`.trim().toUpperCase();
    if (!["REQUESTED", "APPROVED", "REJECTED", "COMPLETED"].includes(nextStatus)) {
      return next(createHttpError(400, "Invalid status."));
    }

    request.status = nextStatus;
    request.notes = `${req.body.notes || request.notes || ""}`.trim();

    if (nextStatus === "APPROVED") {
      request.approvedBy = req.user?._id;
      request.approvedAt = new Date();
    }

    if (nextStatus === "COMPLETED") {
      request.completedAt = new Date();
    }

    await request.save();

    return res.status(200).json({ success: true, data: request });
  } catch (error) {
    return next(error);
  }
};

const getMaskedMemberProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid member id."));
    }

    const member = await MemberAccount.findById(id).lean();
    if (!member) {
      return next(createHttpError(404, "Member not found."));
    }

    return res.status(200).json({ success: true, data: maskSensitiveMember(member) });
  } catch (error) {
    return next(error);
  }
};

const upsertHighRiskApprovalPolicy = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.body.locationId);
    const policyCode = `${req.body.policyCode || ""}`.trim().toUpperCase();
    const actionType = `${req.body.actionType || ""}`.trim().toUpperCase();
    const name = `${req.body.name || ""}`.trim();

    if (!policyCode || !actionType || !name) {
      return next(createHttpError(400, "policyCode, actionType and name are required."));
    }

    const policy = await HighRiskApprovalPolicy.findOneAndUpdate(
      { locationId, policyCode },
      {
        $set: {
          locationId,
          policyCode,
          actionType,
          name,
          resourceType: `${req.body.resourceType || ""}`.trim(),
          thresholdAmount:
            req.body.thresholdAmount === undefined ? undefined : Number(req.body.thresholdAmount),
          requiredApprovals: Math.max(Number(req.body.requiredApprovals || 2), 1),
          allowedRoles: Array.isArray(req.body.allowedRoles)
            ? req.body.allowedRoles.map((role) => `${role}`.trim()).filter(Boolean)
            : ["Admin"],
          enabled: req.body.enabled !== undefined ? Boolean(req.body.enabled) : true,
          metadata: req.body.metadata,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    return res.status(200).json({ success: true, data: policy });
  } catch (error) {
    return next(error);
  }
};

const listHighRiskApprovalPolicies = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.locationId) {
      query.locationId = normalizeLocationId(req.query.locationId);
    }
    if (req.query.enabled !== undefined) {
      query.enabled = `${req.query.enabled}` === "true";
    }
    if (req.query.actionType) {
      query.actionType = `${req.query.actionType}`.trim().toUpperCase();
    }

    const rows = await HighRiskApprovalPolicy.find(query).sort({ updatedAt: -1 });
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
};

const createHighRiskApprovalRequest = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.body.locationId);
    const policyCode = `${req.body.policyCode || ""}`.trim().toUpperCase();
    const amount = req.body.amount === undefined ? undefined : Number(req.body.amount);

    if (!policyCode) {
      return next(createHttpError(400, "policyCode is required."));
    }

    const policy = await HighRiskApprovalPolicy.findOne({
      locationId,
      policyCode,
      enabled: true,
    });
    if (!policy) {
      return next(createHttpError(404, "Enabled high-risk approval policy not found."));
    }

    if (policy.thresholdAmount !== undefined && Number.isFinite(Number(policy.thresholdAmount))) {
      if (!Number.isFinite(amount) || amount < Number(policy.thresholdAmount)) {
        return next(
          createHttpError(
            400,
            `amount must be >= policy threshold (${Number(policy.thresholdAmount)}).`
          )
        );
      }
    }

    const request = await HighRiskApprovalRequest.create({
      policyId: policy._id,
      locationId,
      actionType: policy.actionType,
      resourceType: `${req.body.resourceType || policy.resourceType || ""}`.trim(),
      resourceId: `${req.body.resourceId || ""}`.trim(),
      amount,
      status: "PENDING",
      requestedBy: req.user?._id,
      requestedRole: req.user?.role,
      requiredApprovals: Math.max(Number(policy.requiredApprovals || 2), 1),
      payload: req.body.payload,
      metadata: req.body.metadata,
    });

    await logAuditEvent({
      req,
      action: "HIGH_RISK_APPROVAL_REQUEST_CREATED",
      resourceType: "HighRiskApprovalRequest",
      resourceId: request._id,
      statusCode: 201,
      metadata: {
        policyCode: policy.policyCode,
        actionType: policy.actionType,
      },
    });

    return res.status(201).json({ success: true, data: request });
  } catch (error) {
    return next(error);
  }
};

const listHighRiskApprovalRequests = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = {};
    if (req.query.locationId) {
      query.locationId = normalizeLocationId(req.query.locationId);
    }
    if (req.query.status) {
      query.status = `${req.query.status}`.trim().toUpperCase();
    }
    if (req.query.actionType) {
      query.actionType = `${req.query.actionType}`.trim().toUpperCase();
    }

    const [rows, total] = await Promise.all([
      HighRiskApprovalRequest.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("policyId", "policyCode name actionType requiredApprovals")
        .populate("requestedBy rejectedBy approvals.approverId", "name role"),
      HighRiskApprovalRequest.countDocuments(query),
    ]);

    return res.status(200).json({ success: true, data: rows, pagination: { limit, offset, total } });
  } catch (error) {
    return next(error);
  }
};

const approveHighRiskApprovalRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid high-risk request id."));
    }

    const request = await HighRiskApprovalRequest.findById(id).populate(
      "policyId",
      "policyCode allowedRoles requiredApprovals"
    );
    if (!request) {
      return next(createHttpError(404, "High-risk request not found."));
    }

    if (request.status !== "PENDING") {
      return next(createHttpError(409, "Only pending requests can be approved."));
    }

    if (`${request.requestedBy}` === `${req.user?._id}`) {
      return next(createHttpError(409, "Requester cannot self-approve."));
    }

    const allowedRoles = Array.isArray(request.policyId?.allowedRoles)
      ? request.policyId.allowedRoles.map((role) => `${role}`.trim()).filter(Boolean)
      : [];
    if (allowedRoles.length > 0 && !allowedRoles.includes(`${req.user?.role || ""}`.trim())) {
      return next(createHttpError(403, "Current role is not allowed to approve this request."));
    }

    const alreadyApproved = (request.approvals || []).some(
      (entry) => `${entry.approverId}` === `${req.user?._id}`
    );
    if (alreadyApproved) {
      return next(createHttpError(409, "Current approver already approved this request."));
    }

    request.approvals.push({
      approverId: req.user?._id,
      approverRole: req.user?.role,
      note: `${req.body.note || ""}`.trim(),
      approvedAt: new Date(),
    });

    if (request.approvals.length >= Number(request.requiredApprovals || 1)) {
      request.status = "APPROVED";
      request.approvedAt = new Date();
    }

    await request.save();

    return res.status(200).json({ success: true, data: request });
  } catch (error) {
    return next(error);
  }
};

const rejectHighRiskApprovalRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid high-risk request id."));
    }

    const request = await HighRiskApprovalRequest.findById(id);
    if (!request) {
      return next(createHttpError(404, "High-risk request not found."));
    }

    if (request.status !== "PENDING") {
      return next(createHttpError(409, "Only pending requests can be rejected."));
    }

    request.status = "REJECTED";
    request.rejectedBy = req.user?._id;
    request.rejectedAt = new Date();
    request.rejectionReason = `${req.body.reason || ""}`.trim();
    await request.save();

    return res.status(200).json({ success: true, data: request });
  } catch (error) {
    return next(error);
  }
};

const upsertCompliancePolicyPack = async (req, res, next) => {
  try {
    const countryCode = `${req.body.countryCode || ""}`.trim().toUpperCase();
    const version = `${req.body.version || ""}`.trim();
    const name = `${req.body.name || ""}`.trim();

    if (!countryCode || !version || !name) {
      return next(createHttpError(400, "countryCode, version and name are required."));
    }

    const pack = await CompliancePolicyPack.findOneAndUpdate(
      { countryCode, version },
      {
        $set: {
          countryCode,
          version,
          name,
          status: `${req.body.status || "DRAFT"}`.trim().toUpperCase(),
          rules: req.body.rules || {},
          metadata: req.body.metadata,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    return res.status(200).json({ success: true, data: pack });
  } catch (error) {
    return next(error);
  }
};

const listCompliancePolicyPacks = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.countryCode) {
      query.countryCode = `${req.query.countryCode}`.trim().toUpperCase();
    }
    if (req.query.status) {
      query.status = `${req.query.status}`.trim().toUpperCase();
    }

    const rows = await CompliancePolicyPack.find(query).sort({ updatedAt: -1 });
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
};

const executeCompliancePolicyPack = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid policy pack id."));
    }

    const pack = await CompliancePolicyPack.findById(id).lean();
    if (!pack) {
      return next(createHttpError(404, "Compliance policy pack not found."));
    }

    const locationIds = Array.isArray(req.body.locationIds)
      ? req.body.locationIds.map((value) => normalizeLocationId(value)).filter(Boolean)
      : [];
    const singleLocationId = `${req.body.locationId || ""}`.trim();
    if (singleLocationId) {
      locationIds.push(normalizeLocationId(singleLocationId));
    }

    const uniqueLocationIds = Array.from(new Set(locationIds));
    if (uniqueLocationIds.length === 0) {
      return next(createHttpError(400, "locationId or locationIds is required."));
    }

    const executionRows = [];
    for (const locationId of uniqueLocationIds) {
      const applied = await applyPolicyPackToLocation({
        policyPack: pack,
        locationId,
      });

      executionRows.push(applied);
    }

    await logAuditEvent({
      req,
      action: "COMPLIANCE_POLICY_PACK_EXECUTED",
      resourceType: "CompliancePolicyPack",
      resourceId: pack._id,
      statusCode: 200,
      metadata: {
        locationIds: uniqueLocationIds,
        executionCount: executionRows.length,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        policyPackId: `${pack._id}`,
        version: pack.version,
        countryCode: pack.countryCode,
        executions: executionRows,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listAuditLogs,
  createComplianceExportRequest,
  listComplianceExportRequests,
  updateComplianceExportRequestStatus,
  getMaskedMemberProfile,
  upsertHighRiskApprovalPolicy,
  listHighRiskApprovalPolicies,
  createHighRiskApprovalRequest,
  listHighRiskApprovalRequests,
  approveHighRiskApprovalRequest,
  rejectHighRiskApprovalRequest,
  upsertCompliancePolicyPack,
  listCompliancePolicyPacks,
  executeCompliancePolicyPack,
};
