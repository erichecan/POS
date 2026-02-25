const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { maskPhone, maskEmail, maskSensitiveMember } = require("../utils/complianceMasking");

test("compliance masking: masks phone and email", () => {
  assert.equal(maskPhone("13800138000"), "13*******00");
  assert.equal(maskEmail("alice@example.com"), "a***e@example.com");
});

test("compliance masking: masks member object", () => {
  const masked = maskSensitiveMember({
    name: "Alice",
    phone: "13800138000",
    email: "alice@example.com",
  });

  assert.equal(masked.phone, "13*******00");
  assert.equal(masked.email, "a***e@example.com");
  assert.equal(masked.name, "Alice");
});
