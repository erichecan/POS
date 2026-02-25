const mongoose = require("mongoose");

const ENTITY_TYPES = ["item", "modifier", "status", "tax", "refund_reason", "service_fee"];

const channelMappingRuleSchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true, trim: true },
    providerCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    entityType: { type: String, required: true, enum: ENTITY_TYPES },
    internalCode: { type: String, required: true, trim: true },
    externalCode: { type: String, required: true, trim: true },
    mappingData: { type: mongoose.Schema.Types.Mixed },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

channelMappingRuleSchema.index(
  { locationId: 1, providerCode: 1, entityType: 1, internalCode: 1 },
  { unique: true }
);
channelMappingRuleSchema.index(
  { locationId: 1, providerCode: 1, entityType: 1, externalCode: 1 },
  { unique: true }
);
channelMappingRuleSchema.index({ locationId: 1, providerCode: 1, entityType: 1 });

module.exports = mongoose.model("ChannelMappingRule", channelMappingRuleSchema);
