const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
mongoose.set("bufferCommands", false);

const HighRiskApprovalPolicy = require("../models/highRiskApprovalPolicyModel");
const HighRiskApprovalRequest = require("../models/highRiskApprovalRequestModel");
const { requireHighRiskApproval } = require("../middlewares/highRiskApprovalGuard");

const baseReq = () => ({
  user: { _id: new mongoose.Types.ObjectId(), role: "Admin" },
  headers: {},
  body: {},
  query: {},
  params: {},
  originalUrl: "/api/test",
  url: "/api/test",
});

const runGuard = async (guard, req) => {
  let nextArg;
  await guard(req, {}, (error) => {
    nextArg = error;
  });
  return nextArg;
};

test("high-risk guard: allows action when policy missing and requirePolicy=false", async () => {
  const originalFindOnePolicy = HighRiskApprovalPolicy.findOne;
  const originalFindOneRequest = HighRiskApprovalRequest.findOne;
  const originalFindOneAndUpdate = HighRiskApprovalRequest.findOneAndUpdate;
  try {
    HighRiskApprovalPolicy.findOne = async () => null;
    HighRiskApprovalRequest.findOne = async () => null;
    HighRiskApprovalRequest.findOneAndUpdate = async () => null;

    const guard = requireHighRiskApproval({
      actionType: "ORG_STRUCTURE_MUTATION",
      requirePolicy: false,
    });

    const req = baseReq();
    const err = await runGuard(guard, req);
    assert.equal(err, undefined);
  } finally {
    HighRiskApprovalPolicy.findOne = originalFindOnePolicy;
    HighRiskApprovalRequest.findOne = originalFindOneRequest;
    HighRiskApprovalRequest.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("high-risk guard: returns explicit approval-required error when missing request id", async () => {
  const originalFindOnePolicy = HighRiskApprovalPolicy.findOne;
  const originalFindOneRequest = HighRiskApprovalRequest.findOne;
  const originalFindOneAndUpdate = HighRiskApprovalRequest.findOneAndUpdate;
  try {
    HighRiskApprovalPolicy.findOne = async () => ({
      _id: new mongoose.Types.ObjectId(),
      policyCode: "PAYMENT_REFUND_EXECUTE",
      thresholdAmount: 100,
      allowedRoles: ["Admin", "Cashier"],
    });
    HighRiskApprovalRequest.findOne = async () => null;
    HighRiskApprovalRequest.findOneAndUpdate = async () => null;

    const guard = requireHighRiskApproval({
      actionType: "PAYMENT_REFUND_EXECUTE",
      policyCode: "PAYMENT_REFUND_EXECUTE",
      requirePolicy: true,
      amountResolver: () => 120,
    });

    const req = baseReq();
    const err = await runGuard(guard, req);
    assert.equal(err.statusCode, 403);
    assert.equal(err.code, "HIGH_RISK_APPROVAL_REQUIRED");
  } finally {
    HighRiskApprovalPolicy.findOne = originalFindOnePolicy;
    HighRiskApprovalRequest.findOne = originalFindOneRequest;
    HighRiskApprovalRequest.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("high-risk guard: consumes approved request once and injects context", async () => {
  const originalFindOnePolicy = HighRiskApprovalPolicy.findOne;
  const originalFindOneRequest = HighRiskApprovalRequest.findOne;
  const originalFindOneAndUpdate = HighRiskApprovalRequest.findOneAndUpdate;
  try {
    const policyId = new mongoose.Types.ObjectId();
    const approvalId = new mongoose.Types.ObjectId();

    HighRiskApprovalPolicy.findOne = async () => ({
      _id: policyId,
      policyCode: "PAYMENT_REFUND_EXECUTE",
      thresholdAmount: 100,
      allowedRoles: ["Admin"],
    });
    HighRiskApprovalRequest.findOne = async () => ({
      _id: approvalId,
      policyId,
      locationId: "default",
      actionType: "PAYMENT_REFUND_EXECUTE",
      status: "APPROVED",
      approvedAt: new Date(Date.now() - 60 * 1000),
      amount: 200,
      resourceType: "Payment",
      resourceId: "pi_abc",
    });
    HighRiskApprovalRequest.findOneAndUpdate = async () => ({
      _id: approvalId,
      consumedResourceType: "Payment",
      consumedResourceId: "pi_abc",
    });

    const guard = requireHighRiskApproval({
      actionType: "PAYMENT_REFUND_EXECUTE",
      policyCode: "PAYMENT_REFUND_EXECUTE",
      requirePolicy: true,
      resourceType: "Payment",
      resourceIdResolver: () => "pi_abc",
      amountResolver: () => 120,
    });

    const req = baseReq();
    req.headers["x-high-risk-request-id"] = `${approvalId}`;
    const err = await runGuard(guard, req);

    assert.equal(err, undefined);
    assert.equal(req.highRiskApproval.policyCode, "PAYMENT_REFUND_EXECUTE");
    assert.equal(req.highRiskApproval.requestId, `${approvalId}`);
    assert.equal(req.highRiskApproval.resourceId, "pi_abc");
  } finally {
    HighRiskApprovalPolicy.findOne = originalFindOnePolicy;
    HighRiskApprovalRequest.findOne = originalFindOneRequest;
    HighRiskApprovalRequest.findOneAndUpdate = originalFindOneAndUpdate;
  }
});
