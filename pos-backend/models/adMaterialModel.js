/**
 * Ad Material - 广告素材
 * PRD 7.23.4 2026-02-28
 */
const mongoose = require("mongoose");

const adMaterialSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    mediaType: { type: String, enum: ["IMAGE", "VIDEO"], required: true, index: true },
    mediaUrl: { type: String, required: true, trim: true, maxlength: 1024 },
    category: {
      type: String,
      enum: ["BRAND", "PROMO", "MENU", "GENERAL"],
      default: "GENERAL",
      index: true,
    },
    tags: [{ type: String, trim: true, maxlength: 32 }],
    locationIds: [{ type: String, trim: true }],
    validFrom: { type: Date },
    validTo: { type: Date },
    durationSeconds: { type: Number, default: 10 },
    status: { type: String, enum: ["DRAFT", "PUBLISHED", "ARCHIVED"], default: "DRAFT", index: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

adMaterialSchema.index({ status: 1, category: 1 });
adMaterialSchema.index({ validFrom: 1, validTo: 1 });

module.exports = mongoose.model("AdMaterial", adMaterialSchema);
