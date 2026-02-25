const normalizeCode = (value) => `${value || ""}`.trim().toUpperCase();

const categorizeFailureCode = (failureCode, failureMessage) => {
  const code = normalizeCode(failureCode);
  const message = normalizeCode(failureMessage);
  const text = `${code} ${message}`.trim();

  if (!text) {
    return "UNKNOWN";
  }
  if (text.includes("SIGNATURE") || text.includes("WEBHOOK_SECRET")) {
    return "SIGNATURE";
  }
  if (text.includes("QUOTA") || text.includes("RATE_LIMIT") || text.includes("429")) {
    return "THROTTLE";
  }
  if (text.includes("AUTH") || text.includes("TOKEN") || text.includes("401") || text.includes("403")) {
    return "AUTH";
  }
  if (text.includes("INVALID") || text.includes("REQUIRED") || text.includes("VALIDATION") || text.includes("400")) {
    return "VALIDATION";
  }
  if (text.includes("MAPPING")) {
    return "MAPPING";
  }
  if (text.includes("INVENTORY") || text.includes("STOCK")) {
    return "INVENTORY";
  }
  if (text.includes("PAYMENT")) {
    return "PAYMENT";
  }
  if (text.includes("DUPLICATE") || text.includes("11000") || text.includes("CONFLICT") || text.includes("409")) {
    return "DUPLICATE";
  }
  if (text.includes("TIMEOUT") || text.includes("UPSTREAM") || text.includes("GATEWAY") || text.includes("503")) {
    return "UPSTREAM";
  }
  return "UNKNOWN";
};

const resolveRetryPolicy = (connection) => {
  const maxRetriesRaw = Number(connection?.retryPolicy?.maxRetries);
  const baseDelayMsRaw = Number(connection?.retryPolicy?.baseDelayMs);
  return {
    maxRetries: Number.isFinite(maxRetriesRaw) ? Math.max(0, Math.min(maxRetriesRaw, 20)) : 5,
    baseDelayMs: Number.isFinite(baseDelayMsRaw) ? Math.max(100, Math.min(baseDelayMsRaw, 60000)) : 1000,
  };
};

const buildRetryWindow = ({ deadLetter, retryPolicy, now = new Date() }) => {
  const safeNow = now instanceof Date ? now : new Date(now);
  const replayCount = Math.max(Number(deadLetter?.replayCount || 0), 0);
  const policy = resolveRetryPolicy({ retryPolicy });
  const attemptsRemaining = Math.max(policy.maxRetries - replayCount, 0);
  const retryableByStatus = `${deadLetter?.status || ""}`.trim().toUpperCase() !== "DISCARDED";
  const retryable = retryableByStatus && attemptsRemaining > 0;

  const anchorDate = deadLetter?.lastReplayAt || deadLetter?.createdAt || safeNow;
  const delayFactor = Math.pow(2, Math.max(replayCount, 0));
  const delayMs = policy.baseDelayMs * delayFactor;
  const nextRetryAt = new Date(new Date(anchorDate).getTime() + delayMs);
  const windowOpen = retryable && safeNow.getTime() >= nextRetryAt.getTime();
  const waitSeconds = retryable && !windowOpen ? Math.ceil((nextRetryAt.getTime() - safeNow.getTime()) / 1000) : 0;

  return {
    retryable,
    attemptsRemaining,
    maxRetries: policy.maxRetries,
    replayCount,
    nextRetryAt,
    windowOpen,
    waitSeconds,
  };
};

const summarizeDeadLetters = ({ rows, connectionByKey, now = new Date() }) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const byCategory = {};
  const byStatus = {};
  const byProvider = {};
  let retryWindowOpenCount = 0;
  let retryBlockedCount = 0;

  for (const row of safeRows) {
    const providerCode = normalizeCode(row.providerCode);
    const locationId = `${row.locationId || ""}`.trim();
    const key = `${locationId}::${providerCode}`;
    const connection = connectionByKey.get(key);

    const category = categorizeFailureCode(row.failureCode, row.failureMessage);
    const status = normalizeCode(row.status || "OPEN");
    const retryWindow = buildRetryWindow({
      deadLetter: row,
      retryPolicy: connection?.retryPolicy,
      now,
    });

    byCategory[category] = Number(byCategory[category] || 0) + 1;
    byStatus[status] = Number(byStatus[status] || 0) + 1;
    byProvider[providerCode] = Number(byProvider[providerCode] || 0) + 1;

    if (retryWindow.retryable && retryWindow.windowOpen) {
      retryWindowOpenCount += 1;
    }
    if (retryWindow.retryable && !retryWindow.windowOpen) {
      retryBlockedCount += 1;
    }
  }

  return {
    total: safeRows.length,
    byCategory,
    byStatus,
    byProvider,
    retryWindowOpenCount,
    retryBlockedCount,
  };
};

module.exports = {
  categorizeFailureCode,
  resolveRetryPolicy,
  buildRetryWindow,
  summarizeDeadLetters,
};
