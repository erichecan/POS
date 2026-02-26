// 2026-02-26T19:55:00+08:00: Menu category model for hierarchical category management
const mongoose = require("mongoose");

const menuCategorySchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true, trim: true, default: "default" },
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, trim: true, lowercase: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "MenuCategory", default: null },
    description: { type: String, trim: true, default: "" },
    sortOrder: { type: Number, default: 0 },
    icon: { type: String, trim: true, default: "" },
    color: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "ARCHIVED"],
      default: "ACTIVE",
    },
  },
  { timestamps: true }
);

menuCategorySchema.pre("validate", function preValidate(next) {
  this.locationId = `${this.locationId || ""}`.trim() || "default";
  this.name = `${this.name || ""}`.trim();
  this.normalizedName = this.name.toLowerCase();
  return next();
});

menuCategorySchema.index(
  { locationId: 1, normalizedName: 1, parentId: 1 },
  { unique: true }
);
menuCategorySchema.index({ locationId: 1, sortOrder: 1 });
menuCategorySchema.index({ parentId: 1 });

module.exports = mongoose.model("MenuCategory", menuCategorySchema);
