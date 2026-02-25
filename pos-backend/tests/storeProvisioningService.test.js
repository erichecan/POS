const test = require("node:test");
const assert = require("node:assert/strict");

const { buildStoreProvisioningPlan } = require("../utils/storeProvisioningService");

test("store provisioning: builds template + hardware drafts with auto-selection", () => {
  const plan = buildStoreProvisioningPlan({
    locationId: "loc-preview-001",
    defaultCountryCode: "US",
    provisioning: {
      verticalTemplateCode: "MILK_TEA",
      providerPriority: ["SQUARE", "TOAST"],
    },
  });

  assert.equal(plan.enabled, true);
  assert.equal(plan.verticalProfileDraft.templateCode, "MILK_TEA");
  assert.equal(plan.verticalProfileDraft.countryCode, "US");
  assert.ok(plan.hardwareProfileDraft);
  assert.equal(plan.hardwareProfileDraft.providerPriority[0], "SQUARE");
  assert.equal(plan.hardwareProfileDraft.capabilityTargets.includes("COUNTER_CHECKOUT"), true);
  assert.equal(plan.hardwareProfileDraft.selections.length >= 1, true);
  assert.equal(plan.summary.hardware.autoSelected, true);
});

test("store provisioning: rejects unsupported template by country", () => {
  assert.throws(
    () =>
      buildStoreProvisioningPlan({
        locationId: "loc-preview-002",
        defaultCountryCode: "FR",
        provisioning: {
          verticalTemplateCode: "MILK_TEA",
        },
      }),
    (error) => error.status === 400 && /not supported/i.test(error.message)
  );
});

test("store provisioning: rejects invalid explicit hardware selections", () => {
  assert.throws(
    () =>
      buildStoreProvisioningPlan({
        locationId: "loc-preview-003",
        defaultCountryCode: "US",
        provisioning: {
          autoCreateHardwareProfile: true,
          hardwareSelections: [
            {
              roleKey: "COUNTER",
              providerCode: "TOAST",
              modelCode: "UNKNOWN_MODEL",
              quantity: 1,
            },
          ],
        },
      }),
    (error) => error.status === 400 && Array.isArray(error.details) && error.details.length > 0
  );
});

test("store provisioning: returns disabled plan when provisioning payload is empty", () => {
  const plan = buildStoreProvisioningPlan({
    locationId: "loc-preview-004",
    defaultCountryCode: "US",
    provisioning: {},
  });

  assert.equal(plan.enabled, false);
  assert.equal(plan.verticalProfileDraft, null);
  assert.equal(plan.hardwareProfileDraft, null);
});
