const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const {
  generatePlainApiKey,
  hashApiKey,
  deriveKeyPrefix,
  parseScopes,
  hasScope,
  signWebhookPayload,
  encryptWebhookSecret,
  decryptWebhookSecret,
} = require("../utils/developerAuthService");

test("developer auth service: key generation/hash/prefix", () => {
  const key = generatePlainApiKey();
  assert.equal(key.startsWith("pos_live_"), true);

  const hash = hashApiKey(key);
  assert.equal(hash.length, 64);
  assert.equal(deriveKeyPrefix(key), key.slice(0, 12));
});

test("developer auth service: scope parsing and checks", () => {
  const scopes = parseScopes([" orders:read ", "orders:write", "orders:read"]);
  assert.deepEqual(scopes, ["orders:read", "orders:write"]);
  assert.equal(hasScope({ apiKeyScopes: scopes, requiredScope: "orders:read" }), true);
  assert.equal(hasScope({ apiKeyScopes: scopes, requiredScope: "inventory:read" }), false);
});

test("developer auth service: webhook payload signing stable", () => {
  const signatureA = signWebhookPayload({ secret: "x", payload: { a: 1 } });
  const signatureB = signWebhookPayload({ secret: "x", payload: { a: 1 } });
  assert.equal(signatureA, signatureB);
});

test("developer auth service: webhook secret encrypt/decrypt roundtrip", () => {
  const secret = "whsec_example_123";
  const encrypted = encryptWebhookSecret(secret);
  assert.notEqual(encrypted, secret);
  assert.equal(decryptWebhookSecret(encrypted), secret);
});
