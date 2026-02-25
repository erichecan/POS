const createHttpError = require("http-errors");
const mongoose = require("mongoose");
const config = require("../config/config");
const HighRiskApprovalPolicy = require("../models/highRiskApprovalPolicyModel");
const HighRiskApprovalRequest = require("../models/highRiskApprovalRequestModel");
const { extractCandidateLocationId, normalizeLocationId } = require("../utils/accessControlService");
const { logAuditEvent } = require("../utils/auditLogger");

const APPROVAL_REQUIRED_CODE = "HIGH_RISK_APPROVAL_REQUIRED";

const escapeRegex = (value) => `${value}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toTrimmed = (value) => `${value || ""}`.trim();

const parsePositiveNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const resolveMaybeAsync = async (valueOrFactory, req) => {
  if (typeof valueOrFactory === "function") {
    return valueOrFactory(req);
  }
  return valueOrFactory;
};

const resolveHighRiskRequestId = (req) =>
  toTrimmed(
    req.headers["x-high-risk-request-id"] ||
      req.body?.highRiskRequestId ||
      req.query?.highRiskRequestId
  );

const resolveHighRiskPolicyCode = (req) =>
  toTrimmed(
    req.headers["x-high-risk-policy-code"] ||
      req.body?.highRiskPolicyCode ||
      req.query?.highRiskPolicyCode
  ).toUpperCase();

const resolveGuardLocationId = async (req, locationResolver) =>
  normalizeLocationId(
    await resolveMaybeAsync(
      locationResolver || ((request) => extractCandidateLocationId(request)),
      req
    )
  );

const resolveGuardAmount = async (req, amountResolver) => {
  if (!amountResolver) {
    return parsePositiveNumber(req.body?.amount);
  }
  return parsePositiveNumber(await resolveMaybeAsync(amountResolver, req));
};

const requireHighRiskApproval = (options = {}) => async (req, res, next) => {
  try {
    if (!config.highRiskApprovalEnforced) {
      return next();
    }

    if (!req.user) {
      return next(createHttpError(401, "Unauthorized"));
    }

    const actionType = toTrimmed(options.actionType).toUpperCase();
    if (!actionType) {
      return next(createHttpError(500, "High-risk guard misconfigured: actionType is required."));
    }

    const locationId = await resolveGuardLocationId(req, options.locationResolver);
    const policyCodeFromRequest = resolveHighRiskPolicyCode(req);
    const policyCode = toTrimmed(options.policyCode || policyCodeFromRequest).toUpperCase();
    const requirePolicy = options.requirePolicy !== false;

    const policySelector = {
      locationId,
      enabled: true,
      actionType: { $regex: new RegExp(`^${escapeRegex(actionType)}$`, "i") },
    };
    if (policyCode) {
      policySelector.policyCode = policyCode;
    }

    const policy = await HighRiskApprovalPolicy.findOne(policySelector);
    if (!policy) {
      if (!requirePolicy) {
        return next();
      }

      const error = createHttpError(403, "High-risk approval policy is required for this action.");
      error.code = APPROVAL_REQUIRED_CODE;
      error.detail = { actionType, locationId, policyCode: policyCode || undefined };
      return next(error);
    }

    const actorRole = toTrimmed(req.user?.role);
    const allowedRoles = Array.isArray(policy.allowedRoles)
      ? policy.allowedRoles.map((role) => toTrimmed(role)).filter(Boolean)
      : [];
    if (allowedRoles.length > 0 && !allowedRoles.includes(actorRole)) {
      return next(createHttpError(403, "Current role is not allowed by high-risk policy."));
    }

    const amount = await resolveGuardAmount(req, options.amountResolver);
    const threshold = parsePositiveNumber(policy.thresholdAmount);
    const isAboveThreshold =
      threshold === undefined
        ? true
        : Number.isFinite(amount)
          ? amount + 0.0001 >= threshold
          : options.requireApprovalWhenAmountUnknown === true;

    if (!isAboveThreshold) {
      return next();
    }

    const highRiskRequestId = resolveHighRiskRequestId(req);
    if (!highRiskRequestId) {
      const error = createHttpError(403, "High-risk approval is required for this action.");
      error.code = APPROVAL_REQUIRED_CODE;
      error.detail = {
        actionType,
        locationId,
        policyCode: policy.policyCode,
        thresholdAmount: threshold,
      };
      return next(error);
    }

    if (!mongoose.Types.ObjectId.isValid(highRiskRequestId)) {
      return next(createHttpError(400, "Invalid highRiskRequestId."));
    }

    const resourceType = toTrimmed(
      await resolveMaybeAsync(options.resourceTypeResolver || options.resourceType, req)
    );
    const resourceId = toTrimmed(
      await resolveMaybeAsync(
        options.resourceIdResolver || ((request) => request.params?.id || request.body?.resourceId),
        req
      )
    );

    const approval = await HighRiskApprovalRequest.findOne({
      _id: highRiskRequestId,
      policyId: policy._id,
      locationId,
      status: "APPROVED",
      actionType: { $regex: new RegExp(`^${escapeRegex(actionType)}$`, "i") },
    });

    if (!approval) {
      return next(createHttpError(404, "Approved high-risk request not found."));
    }

    if (approval.consumedAt) {
      return next(createHttpError(409, "High-risk request has already been consumed."));
    }

    if (approval.resourceType && resourceType && toTrimmed(approval.resourceType) !== resourceType) {
      return next(createHttpError(409, "High-risk request resourceType mismatch."));
    }

    if (approval.resourceId && resourceId && toTrimmed(approval.resourceId) !== resourceId) {
      return next(createHttpError(409, "High-risk request resourceId mismatch."));
    }

    if (Number.isFinite(amount) && Number.isFinite(Number(approval.amount))) {
      if (amount - Number(approval.amount) > 0.0001) {
        return next(createHttpError(409, "Approved amount does not cover current action amount."));
      }
    }

    const maxAgeMinutes = Math.max(
      1,
      Number(options.maxAgeMinutes || config.highRiskApprovalMaxAgeMinutes || 1440)
    );
    if (approval.approvedAt) {
      const ageMs = Date.now() - approval.approvedAt.getTime();
      if (ageMs > maxAgeMinutes * 60 * 1000) {
        return next(createHttpError(409, "High-risk request approval has expired."));
      }
    }

    const consumed = await HighRiskApprovalRequest.findOneAndUpdate(
      {
        _id: approval._id,
        status: "APPROVED",
        consumedAt: null,
      },
      {
        $set: {
          consumedAt: new Date(),
          consumedBy: req.user?._id,
          consumedByRole: actorRole,
          consumedActionType: actionType,
          consumedResourceType: resourceType || toTrimmed(approval.resourceType),
          consumedResourceId: resourceId || toTrimmed(approval.resourceId),
          consumedRoute: (req.originalUrl || req.url || "").split("?")[0],
        },
      },
      { new: true }
    );

    if (!consumed) {
      return next(createHttpError(409, "High-risk request has already been consumed."));
    }

    req.highRiskApproval = {
      requestId: `${consumed._id}`,
      policyId: `${policy._id}`,
      policyCode: policy.policyCode,
      actionType,
      locationId,
      resourceType: consumed.consumedResourceType || toTrimmed(approval.resourceType),
      resourceId: consumed.consumedResourceId || toTrimmed(approval.resourceId),
      amount,
    };

    await logAuditEvent({
      req,
      action: "HIGH_RISK_APPROVAL_CONSUMED",
      resourceType: "HighRiskApprovalRequest",
      resourceId: consumed._id,
      statusCode: 200,
      metadata: {
        actionType,
        locationId,
        policyCode: policy.policyCode,
        thresholdAmount: threshold,
        requestId: `${consumed._id}`,
      },
    });

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  requireHighRiskApproval,
  __testables: {
    resolveHighRiskRequestId,
    resolveHighRiskPolicyCode,
    resolveGuardAmount,
    resolveGuardLocationId,
  },
};
