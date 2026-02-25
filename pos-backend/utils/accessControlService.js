const createHttpError = require("http-errors");
const RolePermission = require("../models/rolePermissionModel");
const DataScopePolicy = require("../models/dataScopePolicyModel");

const normalizeAction = (action) => `${action || ""}`.trim().toLowerCase();
const normalizeResource = (resource) => `${resource || ""}`.trim();
const normalizeLocationId = (locationId) => `${locationId || ""}`.trim() || "default";

const hasWildcard = (values = []) => values.includes("*");

const LEGACY_ROLE_PERMISSION_MATRIX = Object.freeze({
  Admin: {
    "*": ["*"],
  },
  Cashier: {
    access_control: [],
    analytics: ["read", "export"],
    cash: ["read", "write"],
    channel_config: [],
    compliance: ["read", "write"],
    developer: [],
    device: ["read", "write"],
    finance: ["read", "write", "export"],
    high_risk: ["read", "write"],
    inventory: ["read", "write"],
    kitchen: ["read", "write"],
    member: ["read", "write"],
    menu: ["read", "write"],
    offline: ["read", "write"],
    ops: ["read", "write"],
    order_workflow: ["read", "write"],
    orders: ["read", "write"],
    organization: ["read"],
    payments: ["read", "write", "refund", "verify", "reconcile", "stats"],
    promotion: ["read", "write", "preview"],
    self_order: ["read", "write"],
    tables: ["read", "write"],
    workforce: ["read", "write"],
  },
  Waiter: {
    access_control: [],
    analytics: [],
    cash: [],
    channel_config: [],
    compliance: [],
    developer: [],
    device: ["read", "write"],
    finance: [],
    high_risk: [],
    inventory: ["read"],
    kitchen: ["read", "write"],
    member: ["read"],
    menu: ["read"],
    offline: [],
    ops: [],
    order_workflow: ["read"],
    orders: ["read", "write"],
    organization: ["read"],
    payments: [],
    promotion: ["read", "preview"],
    self_order: ["read", "write"],
    tables: ["read", "write"],
    workforce: ["write"],
  },
});

const hasLegacyPermission = ({ role, resource, action }) => {
  const normalizedRole = `${role || ""}`.trim();
  const normalizedResource = normalizeResource(resource);
  const normalizedAction = normalizeAction(action);
  if (!normalizedRole || !normalizedResource || !normalizedAction) {
    return false;
  }

  const roleMatrix = LEGACY_ROLE_PERMISSION_MATRIX[normalizedRole];
  if (!roleMatrix) {
    return false;
  }

  const wildcardActions = Array.isArray(roleMatrix["*"]) ? roleMatrix["*"] : [];
  if (wildcardActions.includes("*") || wildcardActions.includes(normalizedAction)) {
    return true;
  }

  const actions = Array.isArray(roleMatrix[normalizedResource])
    ? roleMatrix[normalizedResource]
    : [];
  return actions.includes("*") || actions.includes(normalizedAction);
};

const evaluatePermissionRows = ({ rows = [], action }) => {
  const normalizedAction = normalizeAction(action);
  let allowed = false;

  for (const row of rows) {
    const actions = Array.isArray(row.actions)
      ? row.actions.map((value) => normalizeAction(value))
      : [];

    if (!actions.includes(normalizedAction) && !actions.includes("*")) {
      continue;
    }

    if (`${row.effect || "allow"}` === "deny") {
      return false;
    }

    allowed = true;
  }

  return allowed;
};

const resolvePermissionDecision = async ({ role, resource, action }) => {
  const normalizedRole = `${role || ""}`.trim();
  const normalizedResource = normalizeResource(resource);

  if (!normalizedRole || !normalizedResource) {
    return false;
  }

  const rows = await RolePermission.find({
    role: normalizedRole,
    resource: normalizedResource,
  }).lean();

  if (!rows.length) {
    return hasLegacyPermission({ role: normalizedRole, resource: normalizedResource, action });
  }

  return evaluatePermissionRows({ rows, action });
};

const extractCandidateLocationId = (req, fallbackValue = "default") => {
  const candidates = [
    req.body?.locationId,
    req.query?.locationId,
    req.params?.locationId,
    req.body?.storeId,
    req.query?.storeId,
    fallbackValue,
  ];

  const picked = candidates.find((value) => `${value || ""}`.trim());
  return normalizeLocationId(picked);
};

const resolveScopeRows = async ({ userId, role, resource }) => {
  const normalizedResource = normalizeResource(resource);
  if (!normalizedResource) {
    return [];
  }

  const roleRowsPromise = DataScopePolicy.find({
    subjectType: "ROLE",
    role,
    resource: normalizedResource,
  }).lean();

  const userRowsPromise = userId
    ? DataScopePolicy.find({
        subjectType: "USER",
        subjectId: userId,
        resource: normalizedResource,
      }).lean()
    : Promise.resolve([]);

  const [roleRows, userRows] = await Promise.all([roleRowsPromise, userRowsPromise]);
  return [...roleRows, ...userRows];
};

const mergeAllowedLocations = (rows = []) => {
  const denyRows = rows.filter((row) => `${row.effect || "allow"}` === "deny");
  const allowRows = rows.filter((row) => `${row.effect || "allow"}` !== "deny");

  const denied = new Set();
  for (const row of denyRows) {
    const values = Array.isArray(row.allowedLocationIds) ? row.allowedLocationIds : [];
    if (hasWildcard(values)) {
      denied.add("*");
      continue;
    }
    values.forEach((value) => denied.add(value));
  }

  let allowed = new Set();
  if (!allowRows.length) {
    allowed = new Set(["*"]);
  } else {
    for (const row of allowRows) {
      const values = Array.isArray(row.allowedLocationIds) ? row.allowedLocationIds : [];
      values.forEach((value) => allowed.add(value));
    }
  }

  return {
    denied,
    allowed,
  };
};

const isLocationAllowed = ({ locationId, allowedSet, deniedSet }) => {
  const normalizedLocationId = normalizeLocationId(locationId);

  if (deniedSet.has("*")) {
    return false;
  }

  if (deniedSet.has(normalizedLocationId)) {
    return false;
  }

  if (allowedSet.has("*")) {
    return true;
  }

  return allowedSet.has(normalizedLocationId);
};

const resolveScopeDecision = async ({ userId, role, resource, locationId }) => {
  if (!role) {
    return false;
  }

  if (role === "Admin") {
    return true;
  }

  const rows = await resolveScopeRows({ userId, role, resource });
  if (!rows.length) {
    return true;
  }

  const { denied, allowed } = mergeAllowedLocations(rows);
  return isLocationAllowed({
    locationId,
    allowedSet: allowed,
    deniedSet: denied,
  });
};

const assertPermission = async ({ role, resource, action }) => {
  const allowed = await resolvePermissionDecision({ role, resource, action });
  if (!allowed) {
    throw createHttpError(403, `Forbidden: missing permission ${resource}:${action}`);
  }
};

const assertScope = async ({ userId, role, resource, locationId }) => {
  const allowed = await resolveScopeDecision({ userId, role, resource, locationId });
  if (!allowed) {
    throw createHttpError(403, "Forbidden: location data scope denied.");
  }
};

module.exports = {
  normalizeAction,
  normalizeResource,
  normalizeLocationId,
  LEGACY_ROLE_PERMISSION_MATRIX,
  hasLegacyPermission,
  evaluatePermissionRows,
  resolvePermissionDecision,
  extractCandidateLocationId,
  resolveScopeRows,
  mergeAllowedLocations,
  isLocationAllowed,
  resolveScopeDecision,
  assertPermission,
  assertScope,
};
