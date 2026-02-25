const mongoose = require("mongoose");

const menuVersionSchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true, trim: true, default: "default" },
    versionTag: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED", "ARCHIVED"],
      default: "DRAFT",
    },
    effectiveFrom: { type: Date },
    publishedAt: { type: Date },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

menuVersionSchema.index({ locationId: 1, versionTag: 1 }, { unique: true });
menuVersionSchema.index({ locationId: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model("MenuVersion", menuVersionSchema);
