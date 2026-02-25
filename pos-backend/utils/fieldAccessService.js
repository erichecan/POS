const createHttpError = require("http-errors");
const FieldAccessPolicy = require("../models/fieldAccessPolicyModel");
const { maskPhone, maskEmail } = require("./complianceMasking");

const normalizeResource = (resource) => `${resource || ""}`.trim().toLowerCase();

const normalizeFieldList = (fields = []) =>
  Array.from(new Set(fields.map((field) => `${field}`.trim()).filter(Boolean)));

const normalizePolicy = (policy = {}) => ({
  readableFields: normalizeFieldList(policy.readableFields || ["*"]),
  writableFields: normalizeFieldList(policy.writableFields || []),
  maskedFields: normalizeFieldList(policy.maskedFields || []),
});

const DEFAULT_FIELD_ACCESS_MATRIX = Object.freeze({
  Admin: {
    "*": {
      readableFields: ["*"],
      writableFields: ["*"],
      maskedFields: [],
    },
  },
  Cashier: {
    member: {
      readableFields: ["*"],
      writableFields: [
        "memberCode",
        "locationId",
        "name",
        "phone",
        "email",
        "status",
        "tags",
        "metadata",
        "type",
        "pointsDelta",
        "walletDelta",
        "lifetimeSpendDelta",
        "orderAmount",
        "orderId",
        "reference",
        "reason",
        "pointsToRedeem",
      ],
      maskedFields: [],
    },
  },
  Waiter: {
    member: {
      readableFields: [
        "memberCode",
        "locationId",
        "name",
        "phone",
        "email",
        "tier",
        "status",
        "tags",
        "createdAt",
        "updatedAt",
      ],
      writableFields: [],
      maskedFields: ["phone", "email"],
    },
  },
});

const GLOBAL_WRITE_BYPASS_FIELDS = new Set([
  "idempotency_key",
  "highRiskRequestId",
  "highRiskPolicyCode",
]);

const resolveDefaultFieldPolicy = ({ role, resource }) => {
  const rolePolicies = DEFAULT_FIELD_ACCESS_MATRIX[`${role || ""}`.trim()] || {};
  const resourcePolicy = rolePolicies[normalizeResource(resource)] || rolePolicies["*"];
  return normalizePolicy(resourcePolicy || { readableFields: ["*"], writableFields: [], maskedFields: [] });
};

const resolveFieldPolicy = async ({ role, resource }) => {
  const normalizedResource = normalizeResource(resource);
  if (!normalizedResource) {
    return resolveDefaultFieldPolicy({ role, resource });
  }

  try {
    const stored = await FieldAccessPolicy.findOne({
      role: `${role || ""}`.trim(),
      resource: normalizedResource,
    }).lean();

    if (!stored) {
      return resolveDefaultFieldPolicy({ role, resource: normalizedResource });
    }

    return normalizePolicy(stored);
  } catch (error) {
    return resolveDefaultFieldPolicy({ role, resource: normalizedResource });
  }
};

const maskFieldValue = (field, value) => {
  if (value === undefined || value === null) {
    return value;
  }

  if (field === "phone") {
    return maskPhone(value);
  }
  if (field === "email") {
    return maskEmail(value);
  }

  if (typeof value === "number") {
    return 0;
  }
  if (typeof value === "boolean") {
    return false;
  }
  if (Array.isArray(value)) {
    return [];
  }
  if (typeof value === "object") {
    return {};
  }
  return "***";
};

const applyReadFieldPolicy = ({ document, policy }) => {
  const normalizedPolicy = normalizePolicy(policy);
  const source = document && typeof document.toObject === "function" ? document.toObject() : document || {};
  const readable = normalizedPolicy.readableFields;
  const masked = new Set(normalizedPolicy.maskedFields);

  const result = {};
  if (readable.includes("*")) {
    for (const [key, value] of Object.entries(source)) {
      result[key] = masked.has(key) ? maskFieldValue(key, value) : value;
    }
  } else {
    if (source._id !== undefined) {
      result._id = source._id;
    }
    for (const field of readable) {
      if (source[field] === undefined) {
        continue;
      }
      result[field] = masked.has(field) ? maskFieldValue(field, source[field]) : source[field];
    }
  }

  return result;
};

const sanitizeRowsByFieldPolicy = ({ rows, policy }) =>
  Array.isArray(rows)
    ? rows.map((row) => applyReadFieldPolicy({ document: row, policy }))
    : [];

const assertWritableFields = ({ payload, policy }) => {
  const normalizedPolicy = normalizePolicy(policy);
  const writable = normalizedPolicy.writableFields;
  if (writable.includes("*")) {
    return;
  }

  const blockedFields = Object.keys(payload || {}).filter(
    (field) => !writable.includes(field) && !GLOBAL_WRITE_BYPASS_FIELDS.has(field)
  );

  if (blockedFields.length > 0) {
    throw createHttpError(403, `Forbidden write fields: ${blockedFields.join(", ")}`);
  }
};

module.exports = {
  normalizeResource,
  normalizeFieldList,
  normalizePolicy,
  DEFAULT_FIELD_ACCESS_MATRIX,
  GLOBAL_WRITE_BYPASS_FIELDS,
  resolveDefaultFieldPolicy,
  resolveFieldPolicy,
  maskFieldValue,
  applyReadFieldPolicy,
  sanitizeRowsByFieldPolicy,
  assertWritableFields,
};
