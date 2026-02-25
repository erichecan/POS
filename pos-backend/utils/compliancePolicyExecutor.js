const CompliancePolicyPack = require("../models/compliancePolicyPackModel");
const HighRiskApprovalPolicy = require("../models/highRiskApprovalPolicyModel");

const toTrimmed = (value) => `${value || ""}`.trim();
const toUpper = (value) => toTrimmed(value).toUpperCase();

const normalizeHighRiskRules = (rules) => {
  if (!Array.isArray(rules)) {
    return [];
  }

  return rules
    .map((rule) => {
      const policyCode = toUpper(rule?.policyCode);
      const actionType = toUpper(rule?.actionType);
      const name = toTrimmed(rule?.name);

      if (!policyCode || !actionType || !name) {
        return null;
      }

      const thresholdAmount =
        rule?.thresholdAmount === undefined ? undefined : Number(rule.thresholdAmount);
      const requiredApprovals = Math.max(1, Number(rule?.requiredApprovals || 2));
      const allowedRoles = Array.isArray(rule?.allowedRoles)
        ? rule.allowedRoles.map((role) => toTrimmed(role)).filter(Boolean)
        : ["Admin"];

      return {
        policyCode,
        actionType,
        name,
        resourceType: toTrimmed(rule?.resourceType),
        thresholdAmount: Number.isFinite(thresholdAmount) ? thresholdAmount : undefined,
        requiredApprovals,
        allowedRoles,
        enabled: rule?.enabled !== undefined ? Boolean(rule.enabled) : true,
        metadata: rule?.metadata,
      };
    })
    .filter(Boolean);
};

const resolveActivePolicyPack = async (countryCode) => {
  const normalizedCountryCode = toUpper(countryCode);
  if (!normalizedCountryCode) {
    return null;
  }

  return CompliancePolicyPack.findOne({
    countryCode: normalizedCountryCode,
    status: "ACTIVE",
  })
    .sort({ updatedAt: -1 })
    .lean();
};

const applyPolicyPackToLocation = async ({ policyPack, locationId }) => {
  const normalizedLocationId = toTrimmed(locationId) || "default";
  const highRiskRules = normalizeHighRiskRules(policyPack?.rules?.highRiskPolicies);

  const appliedPolicies = [];
  for (const rule of highRiskRules) {
    const policy = await HighRiskApprovalPolicy.findOneAndUpdate(
      { locationId: normalizedLocationId, policyCode: rule.policyCode },
      {
        $set: {
          locationId: normalizedLocationId,
          policyCode: rule.policyCode,
          actionType: rule.actionType,
          name: rule.name,
          resourceType: rule.resourceType,
          thresholdAmount: rule.thresholdAmount,
          requiredApprovals: rule.requiredApprovals,
          allowedRoles: rule.allowedRoles,
          enabled: rule.enabled,
          metadata: {
            ...(rule.metadata || {}),
            sourceType: "COMPLIANCE_POLICY_PACK",
            sourcePackId: `${policyPack?._id || ""}`,
            sourcePackVersion: policyPack?.version,
          },
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    appliedPolicies.push(policy);
  }

  return {
    appliedCount: appliedPolicies.length,
    policyCodes: appliedPolicies.map((policy) => policy.policyCode),
    locationId: normalizedLocationId,
  };
};

const applyActivePolicyPackToLocation = async ({ countryCode, locationId }) => {
  const policyPack = await resolveActivePolicyPack(countryCode);
  if (!policyPack) {
    return {
      matched: false,
      reason: "NO_ACTIVE_POLICY_PACK",
      appliedCount: 0,
      policyCodes: [],
      locationId: toTrimmed(locationId) || "default",
    };
  }

  const applied = await applyPolicyPackToLocation({
    policyPack,
    locationId,
  });

  return {
    matched: true,
    policyPackId: `${policyPack._id}`,
    policyPackVersion: policyPack.version,
    countryCode: policyPack.countryCode,
    ...applied,
  };
};

module.exports = {
  normalizeHighRiskRules,
  resolveActivePolicyPack,
  applyPolicyPackToLocation,
  applyActivePolicyPackToLocation,
};
