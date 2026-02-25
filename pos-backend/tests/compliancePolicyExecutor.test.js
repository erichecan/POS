const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const CompliancePolicyPack = require("../models/compliancePolicyPackModel");
const HighRiskApprovalPolicy = require("../models/highRiskApprovalPolicyModel");
const {
  normalizeHighRiskRules,
  applyPolicyPackToLocation,
  applyActivePolicyPackToLocation,
} = require("../utils/compliancePolicyExecutor");

test("compliance policy executor: normalizeHighRiskRules filters invalid entries", () => {
  const rules = normalizeHighRiskRules([
    {
      policyCode: " refund_high ",
      actionType: "payment_refund_execute",
      name: "High value refund",
      requiredApprovals: 3,
      allowedRoles: ["Admin", " Cashier "],
    },
    {
      policyCode: "",
      actionType: "X",
      name: "invalid",
    },
  ]);

  assert.equal(rules.length, 1);
  assert.equal(rules[0].policyCode, "REFUND_HIGH");
  assert.equal(rules[0].actionType, "PAYMENT_REFUND_EXECUTE");
  assert.equal(rules[0].requiredApprovals, 3);
  assert.deepEqual(rules[0].allowedRoles, ["Admin", "Cashier"]);
});

test("compliance policy executor: applyPolicyPackToLocation upserts high-risk policies", async () => {
  const originalUpsert = HighRiskApprovalPolicy.findOneAndUpdate;
  try {
    let callCount = 0;
    HighRiskApprovalPolicy.findOneAndUpdate = async (selector) => {
      callCount += 1;
      return {
        _id: `${callCount}`,
        policyCode: selector.policyCode,
      };
    };

    const result = await applyPolicyPackToLocation({
      policyPack: {
        _id: "pack-1",
        version: "2026.02",
        rules: {
          highRiskPolicies: [
            {
              policyCode: "COMPLIANCE_EXPORT_REQUEST",
              actionType: "COMPLIANCE_EXPORT_REQUEST",
              name: "Compliance Export Gate",
            },
          ],
        },
      },
      locationId: "store-01",
    });

    assert.equal(result.appliedCount, 1);
    assert.deepEqual(result.policyCodes, ["COMPLIANCE_EXPORT_REQUEST"]);
    assert.equal(result.locationId, "store-01");
  } finally {
    HighRiskApprovalPolicy.findOneAndUpdate = originalUpsert;
  }
});

test("compliance policy executor: applyActivePolicyPackToLocation handles missing active pack", async () => {
  const originalFindOne = CompliancePolicyPack.findOne;
  try {
    CompliancePolicyPack.findOne = () => ({
      sort: () => ({
        lean: async () => null,
      }),
    });

    const result = await applyActivePolicyPackToLocation({
      countryCode: "US",
      locationId: "store-01",
    });

    assert.equal(result.matched, false);
    assert.equal(result.reason, "NO_ACTIVE_POLICY_PACK");
    assert.equal(result.appliedCount, 0);
  } finally {
    CompliancePolicyPack.findOne = originalFindOne;
  }
});
