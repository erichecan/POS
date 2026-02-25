const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const FieldAccessPolicy = require("../models/fieldAccessPolicyModel");
const {
  resolveDefaultFieldPolicy,
  resolveFieldPolicy,
  applyReadFieldPolicy,
  assertWritableFields,
} = require("../utils/fieldAccessService");

test("field access: waiter default policy reads limited member fields and masks pii", () => {
  const policy = resolveDefaultFieldPolicy({ role: "Waiter", resource: "member" });
  assert.equal(policy.readableFields.includes("name"), true);
  assert.equal(policy.readableFields.includes("pointsBalance"), false);
  assert.equal(policy.maskedFields.includes("phone"), true);
  assert.equal(policy.maskedFields.includes("email"), true);
});

test("field access: applyReadFieldPolicy masks configured fields and keeps allowed fields", () => {
  const document = {
    _id: "m1",
    memberCode: "MBR01",
    name: "Alice",
    phone: "+1234567890",
    email: "alice@example.com",
    pointsBalance: 88,
  };
  const policy = {
    readableFields: ["memberCode", "name", "phone", "email"],
    maskedFields: ["phone", "email"],
    writableFields: [],
  };

  const result = applyReadFieldPolicy({ document, policy });
  assert.equal(result._id, "m1");
  assert.equal(result.memberCode, "MBR01");
  assert.equal(result.name, "Alice");
  assert.notEqual(result.phone, "+1234567890");
  assert.notEqual(result.email, "alice@example.com");
  assert.equal(result.pointsBalance, undefined);
});

test("field access: assertWritableFields blocks unknown fields", () => {
  assert.throws(
    () =>
      assertWritableFields({
        payload: { name: "A", pointsBalance: 10 },
        policy: { readableFields: ["*"], writableFields: ["name"], maskedFields: [] },
      }),
    (error) => /Forbidden write fields/i.test(error.message)
  );
});

test("field access: resolveFieldPolicy prefers stored policy", async () => {
  const originalFindOne = FieldAccessPolicy.findOne;
  try {
    FieldAccessPolicy.findOne = () => ({
      lean: async () => ({
        role: "Cashier",
        resource: "member",
        readableFields: ["name"],
        writableFields: ["name"],
        maskedFields: [],
      }),
    });

    const policy = await resolveFieldPolicy({ role: "Cashier", resource: "member" });
    assert.deepEqual(policy.readableFields, ["name"]);
    assert.deepEqual(policy.writableFields, ["name"]);
  } finally {
    FieldAccessPolicy.findOne = originalFindOne;
  }
});
