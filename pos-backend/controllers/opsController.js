const createHttpError = require("http-errors");
const mongoose = require("mongoose");
const config = require("../config/config");
const InventoryItem = require("../models/inventoryItemModel");
const KitchenTicket = require("../models/kitchenTicketModel");
const Payment = require("../models/paymentModel");
const CashShift = require("../models/cashShiftModel");
const OpsIncident = require("../models/opsIncidentModel");
const { logAuditEvent } = require("../utils/auditLogger");

const ACTIVE_INCIDENT_STATUSES = ["OPEN", "ACKED"];
const ALL_INCIDENT_STATUSES = ["OPEN", "ACKED", "RESOLVED"];
const ALLOWED_ROLES = new Set(["Admin", "Cashier", "Waiter"]);

const normalizeLocationId = (locationId) => {
  const value = `${locationId || ""}`.trim();
  return value || "default";
};

const parseWindowMinutes = (rawValue) => {
  const value = Number(rawValue ?? 240);
  if (!Number.isFinite(value)) {
    throw createHttpError(400, "windowMinutes must be a number.");
  }
  return Math.min(Math.max(Math.round(value), 5), 24 * 60);
};

const parsePagination = (req) => {
  const rawLimit = Number(req.query.limit || 50);
  const rawOffset = Number(req.query.offset || 0);

  return {
    limit: Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 50,
    offset: Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0,
  };
};

const safeRate = (numerator, denominator) => {
  const num = Number(numerator || 0);
  const den = Number(denominator || 0);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) {
    return 0;
  }
  return Number(((num / den) * 100).toFixed(2));
};

const toDateSafe = (value, fallback = new Date()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return date;
};

const normalizeRole = (role, fallback = "Admin") => {
  const value = `${role || ""}`.trim();
  if (ALLOWED_ROLES.has(value)) {
    return value;
  }
  return fallback;
};

const resolveEscalationPolicy = () => {
  const level2Raw = Number(config.opsEscalationLevel2Minutes || 15);
  const level3Raw = Number(config.opsEscalationLevel3Minutes || 30);

  const level2Minutes = Math.max(1, Number.isFinite(level2Raw) ? level2Raw : 15);
  const level3Minutes = Math.max(level2Minutes + 1, Number.isFinite(level3Raw) ? level3Raw : 30);

  return {
    level2Minutes,
    level3Minutes,
    levelRoles: {
      1: normalizeRole(config.opsEscalationLevel1Role, "Cashier"),
      2: normalizeRole(config.opsEscalationLevel2Role, "Admin"),
      3: normalizeRole(config.opsEscalationLevel3Role, "Admin"),
    },
  };
};

const resolveEscalationTargetRole = (policy, level) => {
  const safeLevel = Math.min(Math.max(Number(level || 1), 1), 3);
  return policy?.levelRoles?.[safeLevel] || "Admin";
};

const deriveEscalationLevel = ({ openMinutes = 0, severity = "WARN", policy }) => {
  const isCritical = `${severity || ""}`.toUpperCase() === "CRITICAL";
  const multiplier = isCritical ? 0.5 : 1;
  const level2Threshold = Math.max(1, Number(policy?.level2Minutes || 15) * multiplier);
  const level3Threshold = Math.max(
    level2Threshold + 1,
    Number(policy?.level3Minutes || 30) * multiplier
  );

  if (openMinutes >= level3Threshold) {
    return 3;
  }
  if (openMinutes >= level2Threshold) {
    return 2;
  }
  return 1;
};

const computeKitchenSlaBuckets = (openTickets = [], now = new Date()) => {
  let overdueCount = 0;
  let warningCount = 0;
  let onTrackCount = 0;

  for (const ticket of openTickets) {
    const firedAt = toDateSafe(ticket.firedAt || ticket.createdAt || now, now);
    const slaMinutesRaw = Number(ticket.slaMinutes || config.kitchenSlaNormalMinutes || 20);
    const slaMinutes = Number.isFinite(slaMinutesRaw) && slaMinutesRaw > 0 ? slaMinutesRaw : 20;
    const targetReadyAt = ticket.targetReadyAt
      ? toDateSafe(ticket.targetReadyAt, new Date(firedAt.getTime() + slaMinutes * 60 * 1000))
      : new Date(firedAt.getTime() + slaMinutes * 60 * 1000);

    const remainingMinutes = Math.ceil((targetReadyAt.getTime() - now.getTime()) / 60000);
    const warningThreshold = Math.max(Math.ceil(slaMinutes * 0.25), 2);

    if (remainingMinutes <= 0) {
      overdueCount += 1;
      continue;
    }
    if (remainingMinutes <= warningThreshold) {
      warningCount += 1;
      continue;
    }
    onTrackCount += 1;
  }

  return {
    openTickets: openTickets.length,
    overdueCount,
    warningCount,
    onTrackCount,
  };
};

const buildSloAlerts = ({ inventory, kitchen, payment, cash, thresholds }) => {
  const alerts = [];

  if (inventory.outOfStockCount >= thresholds.inventoryOutOfStockWarnCount) {
    alerts.push({
      code: "INVENTORY_OUT_OF_STOCK",
      category: "inventory",
      severity:
        inventory.outOfStockCount >= thresholds.inventoryOutOfStockWarnCount * 3
          ? "CRITICAL"
          : "WARN",
      title: "Out of stock items detected",
      message: `${inventory.outOfStockCount} item(s) are out of stock.`,
      value: inventory.outOfStockCount,
      threshold: thresholds.inventoryOutOfStockWarnCount,
    });
  }

  if (inventory.lowStockRate >= thresholds.inventoryLowRateWarnPercent) {
    alerts.push({
      code: "INVENTORY_LOW_STOCK_RATE_HIGH",
      category: "inventory",
      severity:
        inventory.lowStockRate >= Math.min(100, thresholds.inventoryLowRateWarnPercent * 2)
          ? "CRITICAL"
          : "WARN",
      title: "Low stock ratio is high",
      message: `Low stock ratio ${inventory.lowStockRate}% exceeded threshold ${thresholds.inventoryLowRateWarnPercent}%.`,
      value: inventory.lowStockRate,
      threshold: thresholds.inventoryLowRateWarnPercent,
      unit: "%",
    });
  }

  if (kitchen.overdueCount >= thresholds.kitchenOverdueWarnCount) {
    alerts.push({
      code: "KITCHEN_OVERDUE_TICKETS",
      category: "kitchen",
      severity:
        kitchen.overdueCount >= thresholds.kitchenOverdueWarnCount * 2 ? "CRITICAL" : "WARN",
      title: "Kitchen overdue tickets",
      message: `${kitchen.overdueCount} open ticket(s) are overdue.`,
      value: kitchen.overdueCount,
      threshold: thresholds.kitchenOverdueWarnCount,
    });
  }

  if (kitchen.avgReadyMinutes >= thresholds.kitchenAvgReadyWarnMinutes) {
    alerts.push({
      code: "KITCHEN_AVG_READY_HIGH",
      category: "kitchen",
      severity:
        kitchen.avgReadyMinutes >= thresholds.kitchenAvgReadyWarnMinutes * 1.5
          ? "CRITICAL"
          : "WARN",
      title: "Kitchen ready time degraded",
      message: `Average ready time ${kitchen.avgReadyMinutes}m exceeded threshold ${thresholds.kitchenAvgReadyWarnMinutes}m.`,
      value: kitchen.avgReadyMinutes,
      threshold: thresholds.kitchenAvgReadyWarnMinutes,
      unit: "min",
    });
  }

  if (payment.failureRate >= thresholds.paymentFailureRateWarnPercent) {
    alerts.push({
      code: "PAYMENT_FAILURE_RATE_HIGH",
      category: "payment",
      severity:
        payment.failureRate >= Math.min(100, thresholds.paymentFailureRateWarnPercent * 2)
          ? "CRITICAL"
          : "WARN",
      title: "Payment failure rate high",
      message: `Payment failure rate ${payment.failureRate}% exceeded threshold ${thresholds.paymentFailureRateWarnPercent}%.`,
      value: payment.failureRate,
      threshold: thresholds.paymentFailureRateWarnPercent,
      unit: "%",
    });
  }

  if (payment.unverifiedAgingCount >= thresholds.paymentUnverifiedWarnCount) {
    alerts.push({
      code: "PAYMENT_UNVERIFIED_AGING",
      category: "payment",
      severity:
        payment.unverifiedAgingCount >= thresholds.paymentUnverifiedWarnCount * 2
          ? "CRITICAL"
          : "WARN",
      title: "Unverified payments aging",
      message: `${payment.unverifiedAgingCount} payment(s) remain unverified beyond grace period.`,
      value: payment.unverifiedAgingCount,
      threshold: thresholds.paymentUnverifiedWarnCount,
    });
  }

  if (payment.pendingRefundApprovals >= thresholds.pendingRefundApprovalWarnCount) {
    alerts.push({
      code: "PAYMENT_PENDING_REFUND_APPROVALS",
      category: "payment",
      severity:
        payment.pendingRefundApprovals >= thresholds.pendingRefundApprovalWarnCount * 2
          ? "CRITICAL"
          : "WARN",
      title: "Refund approvals backlog",
      message: `${payment.pendingRefundApprovals} pending refund approval(s).`,
      value: payment.pendingRefundApprovals,
      threshold: thresholds.pendingRefundApprovalWarnCount,
    });
  }

  if (cash.highVarianceShiftCount >= thresholds.cashVarianceWarnCount) {
    alerts.push({
      code: "CASH_SHIFT_VARIANCE",
      category: "cash",
      severity:
        cash.highVarianceShiftCount >= thresholds.cashVarianceWarnCount * 2 ? "CRITICAL" : "WARN",
      title: "Cash variance exceeded threshold",
      message: `${cash.highVarianceShiftCount} closed shift(s) exceeded variance threshold.`,
      value: cash.highVarianceShiftCount,
      threshold: thresholds.cashVarianceWarnCount,
    });
  }

  return alerts;
};

const deriveOpsHealthStatus = (alerts = []) => {
  if (alerts.some((alert) => alert.severity === "CRITICAL")) {
    return "CRITICAL";
  }
  if (alerts.some((alert) => alert.severity === "WARN")) {
    return "WARN";
  }
  return "OK";
};

const buildSloSnapshotData = async ({ locationId, windowMinutes }) => {
  const now = new Date();
  const windowFrom = new Date(now.getTime() - windowMinutes * 60 * 1000);

  const thresholds = {
    inventoryLowRateWarnPercent: Number(config.opsSloInventoryLowRateWarnPercent || 20),
    inventoryOutOfStockWarnCount: Number(config.opsSloInventoryOutOfStockWarnCount || 1),
    kitchenOverdueWarnCount: Number(config.opsSloKitchenOverdueWarnCount || 3),
    kitchenAvgReadyWarnMinutes: Number(config.opsSloKitchenAvgReadyWarnMinutes || 25),
    paymentFailureRateWarnPercent: Number(config.opsSloPaymentFailureRateWarnPercent || 5),
    paymentUnverifiedWarnCount: Number(config.opsSloPaymentUnverifiedWarnCount || 3),
    pendingRefundApprovalWarnCount: Number(config.opsSloPendingRefundApprovalWarnCount || 5),
    cashVarianceWarnCount: Number(config.opsSloCashVarianceWarnCount || 1),
    cashVarianceWarnAmount: Number(config.opsSloCashVarianceWarnAmount || 20),
    paymentUnverifiedGraceMinutes: Number(config.opsSloPaymentUnverifiedGraceMinutes || 15),
  };

  const unverifiedCutoff = new Date(
    now.getTime() - thresholds.paymentUnverifiedGraceMinutes * 60 * 1000
  );

  const [
    inventoryRows,
    openKitchenTickets,
    kitchenReadyRows,
    paymentTotalWindow,
    paymentFailedWindow,
    paymentVerifiedWindow,
    paymentUnverifiedAging,
    paymentPendingApprovalRows,
    paymentUnlinkedVerifiedWindow,
    cashOpenShiftCount,
    cashClosedShiftWindow,
    cashVarianceRows,
    cashLatestClosedShift,
  ] = await Promise.all([
    InventoryItem.aggregate([
      { $match: { locationId } },
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          outOfStockCount: {
            $sum: { $cond: [{ $eq: ["$isOutOfStock", true] }, 1, 0] },
          },
          lowStockCount: {
            $sum: {
              $cond: [{ $lte: ["$availableQuantity", "$lowStockThreshold"] }, 1, 0],
            },
          },
          autoDisabledCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$isOutOfStock", true] },
                    { $eq: ["$autoDisabledByStock", true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          inactiveCount: {
            $sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] },
          },
        },
      },
    ]),
    KitchenTicket.find(
      { locationId, status: { $in: ["NEW", "PREPARING"] } },
      "status targetReadyAt firedAt createdAt slaMinutes"
    ).lean(),
    KitchenTicket.aggregate([
      {
        $match: {
          locationId,
          status: { $in: ["READY", "EXPO_CONFIRMED", "SERVED"] },
          firedAt: { $exists: true, $ne: null },
          readyAt: { $exists: true, $ne: null, $gte: windowFrom },
        },
      },
      {
        $project: {
          readyMinutes: { $divide: [{ $subtract: ["$readyAt", "$firedAt"] }, 60000] },
        },
      },
      { $group: { _id: null, avgReadyMinutes: { $avg: "$readyMinutes" } } },
    ]),
    Payment.countDocuments({ createdAt: { $gte: windowFrom } }),
    Payment.countDocuments({
      createdAt: { $gte: windowFrom },
      status: { $in: ["failed", "canceled"] },
    }),
    Payment.countDocuments({ createdAt: { $gte: windowFrom }, verified: true }),
    Payment.countDocuments({ verified: false, createdAt: { $lte: unverifiedCutoff } }),
    Payment.aggregate([
      { $unwind: "$refundApprovals" },
      { $match: { "refundApprovals.status": "PENDING" } },
      { $count: "count" },
    ]),
    Payment.countDocuments({
      createdAt: { $gte: windowFrom },
      verified: true,
      usedForOrder: false,
    }),
    CashShift.countDocuments({ locationId, status: "OPEN" }),
    CashShift.countDocuments({
      locationId,
      status: "CLOSED",
      closedAt: { $gte: windowFrom },
    }),
    CashShift.aggregate([
      {
        $match: {
          locationId,
          status: "CLOSED",
          closedAt: { $gte: windowFrom },
        },
      },
      { $project: { absVariance: { $abs: "$variance" } } },
      { $match: { absVariance: { $gte: thresholds.cashVarianceWarnAmount } } },
      { $count: "count" },
    ]),
    CashShift.findOne({ locationId, status: "CLOSED" })
      .sort({ closedAt: -1 })
      .select("closedAt variance closingExpected closingCounted"),
  ]);

  const inventoryRaw = inventoryRows[0] || {
    totalItems: 0,
    outOfStockCount: 0,
    lowStockCount: 0,
    autoDisabledCount: 0,
    inactiveCount: 0,
  };

  const inventory = {
    totalItems: Number(inventoryRaw.totalItems || 0),
    outOfStockCount: Number(inventoryRaw.outOfStockCount || 0),
    lowStockCount: Number(inventoryRaw.lowStockCount || 0),
    autoDisabledCount: Number(inventoryRaw.autoDisabledCount || 0),
    inactiveCount: Number(inventoryRaw.inactiveCount || 0),
    lowStockRate: safeRate(inventoryRaw.lowStockCount, inventoryRaw.totalItems),
  };

  const kitchenBuckets = computeKitchenSlaBuckets(openKitchenTickets, now);
  const kitchen = {
    ...kitchenBuckets,
    avgReadyMinutes: Number((kitchenReadyRows?.[0]?.avgReadyMinutes || 0).toFixed(2)),
  };

  const payment = {
    totalWindow: Number(paymentTotalWindow || 0),
    failedWindow: Number(paymentFailedWindow || 0),
    verifiedWindow: Number(paymentVerifiedWindow || 0),
    unverifiedAgingCount: Number(paymentUnverifiedAging || 0),
    pendingRefundApprovals: Number(paymentPendingApprovalRows?.[0]?.count || 0),
    unlinkedVerifiedWindow: Number(paymentUnlinkedVerifiedWindow || 0),
    failureRate: safeRate(paymentFailedWindow, paymentTotalWindow),
    verificationRate: safeRate(paymentVerifiedWindow, paymentTotalWindow),
  };

  const cash = {
    openShiftCount: Number(cashOpenShiftCount || 0),
    closedShiftWindow: Number(cashClosedShiftWindow || 0),
    highVarianceShiftCount: Number(cashVarianceRows?.[0]?.count || 0),
    latestClosedShift: cashLatestClosedShift
      ? {
          closedAt: cashLatestClosedShift.closedAt,
          variance: Number(cashLatestClosedShift.variance || 0),
          closingExpected: Number(cashLatestClosedShift.closingExpected || 0),
          closingCounted: Number(cashLatestClosedShift.closingCounted || 0),
        }
      : null,
  };

  const alerts = buildSloAlerts({
    inventory,
    kitchen,
    payment,
    cash,
    thresholds,
  });
  const healthStatus = deriveOpsHealthStatus(alerts);

  const alertSummary = {
    total: alerts.length,
    critical: alerts.filter((alert) => alert.severity === "CRITICAL").length,
    warn: alerts.filter((alert) => alert.severity === "WARN").length,
  };

  return {
    generatedAt: now,
    locationId,
    windowMinutes,
    windowFrom,
    healthStatus,
    thresholds,
    alertSummary,
    alerts,
    inventory,
    kitchen,
    payment,
    cash,
  };
};

const buildIncidentView = (incident, now = new Date()) => {
  const plain = incident?.toObject ? incident.toObject() : incident;
  const endAt = plain.status === "RESOLVED" ? toDateSafe(plain.resolvedAt, now) : now;
  const startAt = toDateSafe(plain.firstSeenAt, now);
  const openMinutes = Math.max(0, Math.ceil((endAt.getTime() - startAt.getTime()) / 60000));
  return {
    ...plain,
    openMinutes,
  };
};

const applyEscalationLevel = (incident, desiredLevel, now, policy, reasonPrefix) => {
  const currentLevel = Math.max(1, Number(incident.escalationLevel || 1));
  if (desiredLevel <= currentLevel) {
    return false;
  }

  for (let level = currentLevel + 1; level <= desiredLevel; level += 1) {
    const targetRole = resolveEscalationTargetRole(policy, level);
    incident.escalationHistory.push({
      level,
      targetRole,
      escalatedAt: now,
      reason: `${reasonPrefix || "ESCALATED"}_L${level}`,
    });
  }

  incident.escalationLevel = desiredLevel;
  incident.currentTargetRole = resolveEscalationTargetRole(policy, desiredLevel);
  return true;
};

const syncIncidentsWithAlerts = async ({ locationId, alerts, policy, now = new Date() }) => {
  const openIncidents = await OpsIncident.find({
    locationId,
    status: { $in: ACTIVE_INCIDENT_STATUSES },
  }).sort({ updatedAt: -1, createdAt: -1 });

  const incidentsByCode = new Map();
  for (const incident of openIncidents) {
    const code = `${incident.alertCode || ""}`.trim().toUpperCase();
    if (!code || incidentsByCode.has(code)) {
      continue;
    }
    incidentsByCode.set(code, incident);
  }

  const touchedCodes = new Set();
  let createdCount = 0;
  let escalatedCount = 0;
  let autoResolvedCount = 0;

  for (const alert of alerts) {
    const alertCode = `${alert.code || ""}`.trim().toUpperCase();
    if (!alertCode) {
      continue;
    }

    let incident = incidentsByCode.get(alertCode);
    if (!incident) {
      const initialLevel = 1;
      incident = await OpsIncident.create({
        locationId,
        alertCode,
        category: `${alert.category || "general"}`.trim(),
        severity: `${alert.severity || "WARN"}`.trim().toUpperCase() === "CRITICAL" ? "CRITICAL" : "WARN",
        title: `${alert.title || alertCode}`.trim(),
        message: `${alert.message || ""}`.trim(),
        value: Number(alert.value || 0),
        threshold: Number(alert.threshold || 0),
        unit: `${alert.unit || ""}`.trim(),
        status: "OPEN",
        firstSeenAt: now,
        lastSeenAt: now,
        escalationLevel: initialLevel,
        currentTargetRole: resolveEscalationTargetRole(policy, initialLevel),
        escalationHistory: [
          {
            level: initialLevel,
            targetRole: resolveEscalationTargetRole(policy, initialLevel),
            escalatedAt: now,
            reason: "INCIDENT_OPENED",
          },
        ],
      });

      const desiredLevel = deriveEscalationLevel({
        openMinutes: 0,
        severity: incident.severity,
        policy,
      });
      if (applyEscalationLevel(incident, desiredLevel, now, policy, "INCIDENT_ESCALATED")) {
        escalatedCount += 1;
        await incident.save();
      }

      incidentsByCode.set(alertCode, incident);
      createdCount += 1;
      touchedCodes.add(alertCode);
      continue;
    }

    incident.category = `${alert.category || incident.category || "general"}`.trim();
    incident.severity = `${alert.severity || incident.severity || "WARN"}`.trim().toUpperCase() === "CRITICAL"
      ? "CRITICAL"
      : "WARN";
    incident.title = `${alert.title || incident.title || alertCode}`.trim();
    incident.message = `${alert.message || incident.message || ""}`.trim();
    incident.value = Number(alert.value || 0);
    incident.threshold = Number(alert.threshold || 0);
    incident.unit = `${alert.unit || incident.unit || ""}`.trim();
    incident.lastSeenAt = now;
    incident.autoResolved = false;
    if (incident.status === "RESOLVED") {
      incident.status = "OPEN";
      incident.resolvedAt = null;
      incident.resolvedBy = null;
      incident.resolutionNote = "";
    }

    const openMinutes = Math.max(
      0,
      Math.floor((now.getTime() - toDateSafe(incident.firstSeenAt, now).getTime()) / 60000)
    );
    const desiredLevel = deriveEscalationLevel({
      openMinutes,
      severity: incident.severity,
      policy,
    });
    if (applyEscalationLevel(incident, desiredLevel, now, policy, "INCIDENT_ESCALATED")) {
      escalatedCount += 1;
    }

    await incident.save();
    touchedCodes.add(alertCode);
  }

  for (const [alertCode, incident] of incidentsByCode.entries()) {
    if (touchedCodes.has(alertCode)) {
      continue;
    }
    incident.status = "RESOLVED";
    incident.resolvedAt = now;
    incident.autoResolved = true;
    incident.resolutionNote = "AUTO_CLEARED";
    await incident.save();
    autoResolvedCount += 1;
  }

  return {
    createdCount,
    escalatedCount,
    autoResolvedCount,
  };
};

const parseIncidentStatuses = (rawValue) => {
  if (!rawValue) {
    return ACTIVE_INCIDENT_STATUSES;
  }

  const values = `${rawValue}`
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  const unique = [...new Set(values)];
  const invalid = unique.filter((status) => !ALL_INCIDENT_STATUSES.includes(status));
  if (invalid.length > 0) {
    throw createHttpError(400, `Invalid incident status values: ${invalid.join(", ")}`);
  }

  return unique.length > 0 ? unique : ACTIVE_INCIDENT_STATUSES;
};

const getSloSnapshot = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.query.locationId);
    const windowMinutes = parseWindowMinutes(req.query.windowMinutes);
    const snapshot = await buildSloSnapshotData({ locationId, windowMinutes });

    return res.status(200).json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    return next(error);
  }
};

const runEscalationSweep = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.body.locationId || req.query.locationId);
    const windowMinutes = parseWindowMinutes(req.body.windowMinutes ?? req.query.windowMinutes);
    const policy = resolveEscalationPolicy();
    const snapshot = await buildSloSnapshotData({ locationId, windowMinutes });

    const syncResult = await syncIncidentsWithAlerts({
      locationId,
      alerts: snapshot.alerts || [],
      policy,
      now: toDateSafe(snapshot.generatedAt, new Date()),
    });

    await logAuditEvent({
      req,
      action: "OPS_ESCALATION_SWEEP_RUN",
      resourceType: "OpsIncident",
      statusCode: 200,
      metadata: {
        locationId,
        windowMinutes,
        alerts: Number(snapshot.alertSummary?.total || 0),
        ...syncResult,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        locationId,
        windowMinutes,
        policy,
        healthStatus: snapshot.healthStatus,
        alertSummary: snapshot.alertSummary,
        syncResult,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const listIncidents = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const locationId = normalizeLocationId(req.query.locationId);
    const statuses = parseIncidentStatuses(req.query.status);
    const severity = `${req.query.severity || ""}`.trim().toUpperCase();
    const query = {
      locationId,
      status: { $in: statuses },
    };

    if (["WARN", "CRITICAL"].includes(severity)) {
      query.severity = severity;
    }

    const [rows, total] = await Promise.all([
      OpsIncident.find(query)
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("acknowledgedBy resolvedBy", "name role"),
      OpsIncident.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: rows.map((row) => buildIncidentView(row)),
      pagination: { limit, offset, total },
    });
  } catch (error) {
    return next(error);
  }
};

const acknowledgeIncident = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid incident id."));
    }

    const incident = await OpsIncident.findById(id);
    if (!incident) {
      return next(createHttpError(404, "Incident not found."));
    }
    if (incident.status === "RESOLVED") {
      return next(createHttpError(409, "Resolved incident cannot be acknowledged."));
    }

    incident.status = "ACKED";
    incident.acknowledgedBy = req.user?._id;
    incident.acknowledgedAt = new Date();
    incident.ackNote = `${req.body.note || ""}`.trim();
    await incident.save();

    await logAuditEvent({
      req,
      action: "OPS_INCIDENT_ACKED",
      resourceType: "OpsIncident",
      resourceId: incident._id,
      statusCode: 200,
      metadata: {
        alertCode: incident.alertCode,
        escalationLevel: incident.escalationLevel,
      },
    });

    return res.status(200).json({
      success: true,
      data: buildIncidentView(incident),
    });
  } catch (error) {
    return next(error);
  }
};

const resolveIncident = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid incident id."));
    }

    const incident = await OpsIncident.findById(id);
    if (!incident) {
      return next(createHttpError(404, "Incident not found."));
    }
    if (incident.status === "RESOLVED") {
      return next(createHttpError(409, "Incident is already resolved."));
    }

    incident.status = "RESOLVED";
    incident.resolvedBy = req.user?._id;
    incident.resolvedAt = new Date();
    incident.autoResolved = false;
    incident.resolutionNote = `${req.body.note || ""}`.trim() || "MANUAL_RESOLVED";
    await incident.save();

    await logAuditEvent({
      req,
      action: "OPS_INCIDENT_RESOLVED",
      resourceType: "OpsIncident",
      resourceId: incident._id,
      statusCode: 200,
      metadata: {
        alertCode: incident.alertCode,
        escalationLevel: incident.escalationLevel,
      },
    });

    return res.status(200).json({
      success: true,
      data: buildIncidentView(incident),
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getSloSnapshot,
  runEscalationSweep,
  listIncidents,
  acknowledgeIncident,
  resolveIncident,
  __testables: {
    normalizeLocationId,
    parseWindowMinutes,
    safeRate,
    computeKitchenSlaBuckets,
    buildSloAlerts,
    deriveOpsHealthStatus,
    resolveEscalationPolicy,
    deriveEscalationLevel,
    resolveEscalationTargetRole,
    parseIncidentStatuses,
  },
};
