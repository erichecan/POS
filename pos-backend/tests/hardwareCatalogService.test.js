const test = require("node:test");
const assert = require("node:assert/strict");

const {
  listHardwareCatalog,
  validateHardwareSelection,
  findCatalogDevice,
  suggestHardwareSelections,
} = require("../utils/hardwareCatalogService");

test("hardware catalog: filter by country/provider/capability", () => {
  const rows = listHardwareCatalog({
    countryCode: "US",
    providerCode: "TOAST",
    capability: "KDS_PRODUCTION",
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].providerCode, "TOAST");
  assert.equal(rows[0].devices.length >= 1, true);
  assert.equal(
    rows[0].devices.some((device) => (device.capabilityTags || []).includes("KDS_PRODUCTION")),
    true
  );
});

test("hardware catalog: findCatalogDevice resolves provider and model", () => {
  const matched = findCatalogDevice({
    providerCode: "square",
    modelCode: "square_terminal",
  });

  assert.ok(matched);
  assert.equal(matched.provider.providerCode, "SQUARE");
  assert.equal(matched.device.modelCode, "SQUARE_TERMINAL");
});

test("hardware catalog: validate selection rejects unsupported country model", () => {
  const result = validateHardwareSelection({
    countryCode: "FR",
    selections: [
      {
        roleKey: "COUNTER_1",
        providerCode: "TOAST",
        modelCode: "TOAST_FLEX_3_WEDGE",
        quantity: 1,
      },
    ],
  });

  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].reason, /not supported/i);
});

test("hardware catalog: validate selection returns warnings when payment/receipt are absent", () => {
  const result = validateHardwareSelection({
    countryCode: "US",
    selections: [
      {
        roleKey: "DISPLAY_1",
        providerCode: "CUSTOM",
        modelCode: "WEB_DIGITAL_SIGNAGE",
        quantity: 1,
      },
    ],
  });

  assert.equal(result.errors.length, 0);
  assert.equal(result.resolvedSelections.length, 1);
  assert.equal(result.warnings.length >= 1, true);
});

test("hardware catalog: validate selection resolves capabilities for valid bundle", () => {
  const result = validateHardwareSelection({
    countryCode: "US",
    selections: [
      {
        roleKey: "COUNTER_POS",
        providerCode: "SQUARE",
        modelCode: "SQUARE_REGISTER",
        quantity: 1,
      },
      {
        roleKey: "PAYMENT",
        providerCode: "SQUARE",
        modelCode: "SQUARE_TERMINAL",
        quantity: 1,
      },
      {
        roleKey: "RECEIPT",
        providerCode: "SQUARE",
        modelCode: "SQUARE_RECEIPT_PRINTER",
        quantity: 1,
      },
    ],
  });

  assert.equal(result.errors.length, 0);
  assert.equal(result.coveredCapabilities.includes("EMV_NFC_PAYMENT"), true);
  assert.equal(result.coveredCapabilities.includes("FRONT_RECEIPT_PRINT"), true);
});

test("hardware catalog: suggest selections honors provider priority", () => {
  const result = suggestHardwareSelections({
    countryCode: "US",
    providerPriority: ["SQUARE", "TOAST"],
    capabilityTargets: ["EMV_NFC_PAYMENT", "FRONT_RECEIPT_PRINT"],
  });

  assert.equal(result.selections.length >= 1, true);
  assert.equal(result.unmatchedCapabilities.length, 0);
  assert.equal(result.selections.every((item) => item.providerCode === "SQUARE"), true);
});

test("hardware catalog: suggest selections returns missing capability warnings", () => {
  const result = suggestHardwareSelections({
    countryCode: "US",
    capabilityTargets: ["NON_EXISTING_CAPABILITY"],
  });

  assert.equal(result.selections.length, 0);
  assert.deepEqual(result.unmatchedCapabilities, ["NON_EXISTING_CAPABILITY"]);
  assert.equal(result.warnings.length, 1);
});
