const createHttpError = require("http-errors");

const ORDER_STATUSES = ["In Progress", "Ready", "Completed", "Cancelled"];

const ORDER_TRANSITIONS = {
  "In Progress": ["Ready", "Cancelled"],
  Ready: ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

const isFinalStatus = (status) => ["Completed", "Cancelled"].includes(`${status || ""}`.trim());

const canTransition = (fromStatus, toStatus) => {
  const from = `${fromStatus || ""}`.trim();
  const to = `${toStatus || ""}`.trim();

  if (!ORDER_STATUSES.includes(from) || !ORDER_STATUSES.includes(to)) {
    return false;
  }

  if (from === to) {
    return true;
  }

  return (ORDER_TRANSITIONS[from] || []).includes(to);
};

const assertTransitionAllowed = ({ fromStatus, toStatus }) => {
  if (!ORDER_STATUSES.includes(`${toStatus || ""}`.trim())) {
    throw createHttpError(400, "Invalid order status.");
  }

  if (!canTransition(fromStatus, toStatus)) {
    throw createHttpError(409, `Invalid order transition: ${fromStatus} -> ${toStatus}`);
  }
};

const resolveTransitionConflict = ({ fromStatus, toStatus, expectedVersion, actualVersion }) => {
  if (expectedVersion !== undefined && Number(expectedVersion) !== Number(actualVersion)) {
    return {
      type: "VERSION_MISMATCH",
      detail: `Expected version ${expectedVersion}, actual version ${actualVersion}`,
    };
  }

  if (isFinalStatus(fromStatus) && fromStatus !== toStatus) {
    return {
      type: "ALREADY_FINAL",
      detail: `Order is already final in status ${fromStatus}`,
    };
  }

  if (!canTransition(fromStatus, toStatus)) {
    return {
      type: "INVALID_TRANSITION",
      detail: `Transition ${fromStatus} -> ${toStatus} is not allowed`,
    };
  }

  return {
    type: "NONE",
    detail: "",
  };
};

module.exports = {
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  isFinalStatus,
  canTransition,
  assertTransitionAllowed,
  resolveTransitionConflict,
};
