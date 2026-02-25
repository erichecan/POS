const express = require("express");
const mongoose = require("mongoose");
const {
  isVerifiedUser,
  requireRoles,
  requirePermission,
  requireDataScope,
} = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");
const { requireHighRiskApproval } = require("../middlewares/highRiskApprovalGuard");
const StoreChannelConnection = require("../models/storeChannelConnectionModel");
const {
  createProvider,
  listProviders,
  updateProvider,
  createMarketProfile,
  listMarketProfiles,
  updateMarketProfile,
  createStoreConnection,
  listStoreConnections,
  updateStoreConnection,
  createMappingRule,
  listMappingRules,
  updateMappingRule,
} = require("../controllers/channelConfigController");
const { ingestChannelOrder } = require("../controllers/channelIngressController");
const {
  listDeadLetters,
  replayDeadLetter,
  discardDeadLetter,
  getIngressUsage,
  getDeadLetterInsights,
} = require("../controllers/channelOpsController");

const router = express.Router();

const adminRead = [isVerifiedUser, requireRoles("Admin"), requirePermission("channel_config", "read")];
const adminWrite = [isVerifiedUser, requireRoles("Admin"), requirePermission("channel_config", "write")];

const resolveChannelLocationId = async (req) => {
  const explicitLocationId = `${req.body?.locationId || req.query?.locationId || ""}`.trim();
  if (explicitLocationId) {
    return explicitLocationId;
  }

  const connectionId = `${req.params?.id || ""}`.trim();
  if (!mongoose.Types.ObjectId.isValid(connectionId)) {
    return undefined;
  }

  const connection = await StoreChannelConnection.findById(connectionId).select("locationId").lean();
  return connection?.locationId;
};

router
  .route("/providers")
  .post(...adminWrite, idempotencyMiddleware, createProvider)
  .get(...adminRead, listProviders);
router
  .route("/providers/:id")
  .put(...adminWrite, idempotencyMiddleware, updateProvider);

router
  .route("/market-profiles")
  .post(...adminWrite, idempotencyMiddleware, createMarketProfile)
  .get(...adminRead, listMarketProfiles);
router
  .route("/market-profiles/:id")
  .put(...adminWrite, idempotencyMiddleware, updateMarketProfile);

router
  .route("/store-connections")
  .post(
    ...adminWrite,
    requireDataScope("channel_config", resolveChannelLocationId),
    idempotencyMiddleware,
    requireHighRiskApproval({
      actionType: "CHANNEL_CONNECTION_MUTATION",
      policyCode: "CHANNEL_CONNECTION_MUTATION",
      requirePolicy: true,
      locationResolver: resolveChannelLocationId,
      resourceType: "StoreChannelConnection",
      resourceIdResolver: (req) => req.body?.externalStoreId,
    }),
    createStoreConnection
  )
  .get(...adminRead, requireDataScope("channel_config", resolveChannelLocationId), listStoreConnections);
router
  .route("/store-connections/:id")
  .put(
    ...adminWrite,
    requireDataScope("channel_config", resolveChannelLocationId),
    idempotencyMiddleware,
    requireHighRiskApproval({
      actionType: "CHANNEL_CONNECTION_MUTATION",
      policyCode: "CHANNEL_CONNECTION_MUTATION",
      requirePolicy: true,
      locationResolver: resolveChannelLocationId,
      resourceType: "StoreChannelConnection",
      resourceIdResolver: (req) => req.params?.id,
    }),
    updateStoreConnection
  );

router
  .route("/mapping-rules")
  .post(...adminWrite, idempotencyMiddleware, createMappingRule)
  .get(...adminRead, listMappingRules);
router
  .route("/mapping-rules/:id")
  .put(...adminWrite, idempotencyMiddleware, updateMappingRule);

router
  .route("/ingress/orders")
  .post(
    ...adminWrite,
    requireDataScope("channel_config", resolveChannelLocationId),
    idempotencyMiddleware,
    ingestChannelOrder
  );

router
  .route("/ingress/dlq")
  .get(...adminRead, listDeadLetters);

router
  .route("/ingress/dlq/insights")
  .get(...adminRead, getDeadLetterInsights);

router
  .route("/ingress/dlq/:id/replay")
  .post(...adminWrite, idempotencyMiddleware, replayDeadLetter);

router
  .route("/ingress/dlq/:id/discard")
  .post(...adminWrite, idempotencyMiddleware, discardDeadLetter);

router
  .route("/ingress/usage")
  .get(...adminRead, getIngressUsage);

module.exports = router;
