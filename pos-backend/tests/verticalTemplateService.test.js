const test = require("node:test");
const assert = require("node:assert/strict");

const {
  listVerticalTemplates,
  getVerticalTemplateByCode,
  resolveVerticalTemplateConfig,
} = require("../utils/verticalTemplateService");

test("vertical templates: list by country and keyword", () => {
  const rows = listVerticalTemplates({
    countryCode: "US",
    keyword: "奶茶",
  });

  assert.equal(rows.length >= 1, true);
  assert.equal(rows.some((row) => row.templateCode === "MILK_TEA"), true);
});

test("vertical templates: type group filtering", () => {
  const rows = listVerticalTemplates({
    countryCode: "US",
    typeGroup: "SERVICE",
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].templateCode, "NAIL_SALON");
});

test("vertical templates: get by code is case-insensitive", () => {
  const row = getVerticalTemplateByCode("hotpot");
  assert.ok(row);
  assert.equal(row.templateCode, "HOTPOT");
});

test("vertical templates: resolve config merges overrides deeply", () => {
  const resolved = resolveVerticalTemplateConfig({
    templateCode: "MILK_TEA",
    overrides: {
      tableServiceProfile: {
        enabled: true,
        supportsSeatSplit: false,
      },
      menuOptionProfile: {
        highFrequencyEdits: false,
      },
    },
  });

  assert.ok(resolved);
  assert.equal(resolved.templateCode, "MILK_TEA");
  assert.equal(resolved.tableServiceProfile.enabled, true);
  assert.equal(resolved.tableServiceProfile.supportsSeatSplit, false);
  assert.equal(resolved.menuOptionProfile.highFrequencyEdits, false);
});
