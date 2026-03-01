const mongoose = require("mongoose");

const receiptTemplateFieldsSchema = new mongoose.Schema(
  {
    showOrderId: { type: Boolean, default: true },
    showOrderDate: { type: Boolean, default: true },
    showTableNo: { type: Boolean, default: true },
    showCustomerName: { type: Boolean, default: true },
    showCustomerPhone: { type: Boolean, default: false },
    showGuests: { type: Boolean, default: true },
    showItemNotes: { type: Boolean, default: true },
    showItemModifiers: { type: Boolean, default: true },
    showTaxBreakdown: { type: Boolean, default: true },
    showPaymentMethod: { type: Boolean, default: true },
  },
  { _id: false }
);

const receiptTemplateSchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true, trim: true, default: "default", unique: true },
    headerTitle: { type: String, trim: true, default: "Order Receipt", maxlength: 80 },
    storeName: { type: String, trim: true, default: "POS Store", maxlength: 120 },
    footerMessage: { type: String, trim: true, default: "Thank you for your visit.", maxlength: 200 },
    logoUrl: { type: String, trim: true, default: "", maxlength: 512 },
    brandSlogan: { type: String, trim: true, default: "", maxlength: 120 },
    promoText: { type: String, trim: true, default: "", maxlength: 200 },
    fields: { type: receiptTemplateFieldsSchema, default: () => ({}) },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReceiptTemplate", receiptTemplateSchema);
