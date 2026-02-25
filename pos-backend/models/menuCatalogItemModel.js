const mongoose = require("mongoose");

const menuDayPartSchema = new mongoose.Schema(
  {
    startMinute: { type: Number, required: true, min: 0, max: 1439 },
    endMinute: { type: Number, required: true, min: 1, max: 1440 },
    daysOfWeek: {
      type: [Number],
      default: [],
      validate: {
        validator: (days = []) => days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6),
        message: "daysOfWeek must only contain integers from 0 to 6.",
      },
    },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const menuCatalogItemSchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true, trim: true, default: "default" },
    channelCode: { type: String, trim: true, uppercase: true, default: "ALL" },
    versionTag: { type: String, required: true, trim: true, default: "v1" },
    category: { type: String, trim: true, default: "Uncategorized" },
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, trim: true, lowercase: true },
    basePrice: { type: Number, required: true, min: 0 },
    dayParts: { type: [menuDayPartSchema], default: [] },
    status: {
      type: String,
      enum: ["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"],
      default: "DRAFT",
    },
    validFrom: { type: Date },
    validTo: { type: Date },
    syncStatus: {
      type: Map,
      of: {
        status: {
          type: String,
          enum: ["PENDING", "SYNCED", "FAILED"],
          default: "PENDING",
        },
        lastSyncAt: { type: Date },
        message: { type: String, trim: true },
      },
      default: {},
    },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

menuCatalogItemSchema.pre("validate", function preValidate(next) {
  this.locationId = `${this.locationId || ""}`.trim() || "default";
  this.channelCode = `${this.channelCode || "ALL"}`.trim().toUpperCase() || "ALL";
  this.versionTag = `${this.versionTag || "v1"}`.trim() || "v1";
  this.name = `${this.name || ""}`.trim();
  this.normalizedName = `${this.name || this.normalizedName || ""}`.trim().toLowerCase();

  if (this.validFrom && this.validTo && this.validTo <= this.validFrom) {
    return next(new Error("validTo must be later than validFrom."));
  }

  return next();
});

menuCatalogItemSchema.index(
  { locationId: 1, channelCode: 1, versionTag: 1, normalizedName: 1 },
  { unique: true }
);
menuCatalogItemSchema.index({ locationId: 1, status: 1, updatedAt: -1 });
menuCatalogItemSchema.index({ normalizedName: 1, status: 1 });

module.exports = mongoose.model("MenuCatalogItem", menuCatalogItemSchema);
