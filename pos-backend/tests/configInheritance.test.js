const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { isPlainObject, deepMerge, resolveStoreSettings } = require("../utils/configInheritance");

test("config inheritance: isPlainObject identifies plain objects", () => {
  assert.equal(isPlainObject({}), true);
  assert.equal(isPlainObject([]), false);
  assert.equal(isPlainObject(null), false);
  assert.equal(isPlainObject("x"), false);
});

test("config inheritance: deepMerge and resolveStoreSettings merge nested configs", () => {
  const org = { taxes: { rate: 5, inclusive: false }, channels: { defaultEnabled: true } };
  const region = { taxes: { rate: 8 }, kitchen: { slaMinutes: 18 } };
  const store = { kitchen: { slaMinutes: 12 }, channels: { defaultEnabled: false } };

  const merged = deepMerge(org, region);
  assert.equal(merged.taxes.rate, 8);
  assert.equal(merged.taxes.inclusive, false);

  const resolved = resolveStoreSettings({
    organizationDefaults: org,
    regionDefaults: region,
    storeOverrides: store,
  });

  assert.equal(resolved.taxes.rate, 8);
  assert.equal(resolved.kitchen.slaMinutes, 12);
  assert.equal(resolved.channels.defaultEnabled, false);
});
