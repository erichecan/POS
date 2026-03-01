/**
 * Brand Profile - 品牌与 Logo 设置
 * PRD 7.23.1 2026-02-28
 */
const mongoose = require("mongoose");

const brandProfileSchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true, trim: true, default: "default", unique: true, index: true },
    brandName: { type: String, trim: true, default: "POS Store", maxlength: 80 },
    brandNameEn: { type: String, trim: true, default: "", maxlength: 80 },
    slogan: { type: String, trim: true, default: "", maxlength: 120 },
    primaryColor: { type: String, trim: true, default: "#1a1a1a", maxlength: 20 },
    secondaryColor: { type: String, trim: true, default: "#666666", maxlength: 20 },
    logoUrl: { type: String, trim: true, default: "", maxlength: 512 },
    logoLightUrl: { type: String, trim: true, default: "", maxlength: 512 },
    logoDarkUrl: { type: String, trim: true, default: "", maxlength: 512 },
    showLogoOnReceipt: { type: Boolean, default: true },
    showLogoOnSignage: { type: Boolean, default: true },
    showLogoOnQueueDisplay: { type: Boolean, default: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BrandProfile", brandProfileSchema);
