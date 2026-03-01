const mongoose = require("mongoose");

const orderItemModifierSchema = new mongoose.Schema({
    groupId: { type: String, trim: true },
    groupName: { type: String, trim: true },
    optionId: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    priceDelta: { type: Number, required: true, min: -9999, max: 9999, default: 0 },
}, { _id: false });

const orderItemSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    basePrice: { type: Number, min: 0, default: 0 },
    pricePerQuantity: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    seatNo: { type: Number, min: 1, max: 50 },
    note: { type: String, trim: true, maxlength: 200 },
    modifiers: { type: [orderItemModifierSchema], default: [] },
}, { _id: false });

const orderMergeHistorySchema = new mongoose.Schema({
    sourceOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    sourceTableId: { type: mongoose.Schema.Types.ObjectId, ref: "Table" },
    mergedAt: { type: Date, default: Date.now },
    sourceCustomerDetails: {
        name: { type: String, required: true, trim: true },
        phone: { type: String, required: true, trim: true },
        guests: { type: Number, required: true, min: 1, max: 50 },
    },
    sourceBills: {
        total: { type: Number, required: true, min: 0 },
        tax: { type: Number, required: true, min: 0 },
        totalWithTax: { type: Number, required: true, min: 0 }
    },
    sourceItems: { type: [orderItemSchema], default: [] },
    unmergedAt: { type: Date },
    unmergedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { _id: false });

const appliedPromotionSchema = new mongoose.Schema({
    promotionId: { type: mongoose.Schema.Types.ObjectId, ref: "PromotionRule" },
    code: { type: String, trim: true, uppercase: true },
    name: { type: String, trim: true },
    discountType: { type: String, enum: ["PERCENT", "FIXED"] },
    discountAmount: { type: Number, min: 0, default: 0 },
    sourceType: { type: String, enum: ["RULE", "COUPON"], default: "RULE" },
    sourceCode: { type: String, trim: true, uppercase: true },
}, { _id: false });

const orderSchema = new mongoose.Schema({
    customerDetails: {
        name: { type: String, required: true, trim: true },
        phone: { type: String, required: true, trim: true },
        guests: { type: Number, required: true, min: 1, max: 50 },
    },
    orderStatus: {
        type: String,
        required: true,
        enum: ["In Progress", "Ready", "Completed", "Cancelled"]
    },
    sourceType: {
        type: String,
        required: true,
        enum: ["POS", "CHANNEL"],
        default: "POS"
    },
    channelProviderCode: {
        type: String,
        trim: true,
        uppercase: true
    },
    externalOrderId: {
        type: String,
        trim: true
    },
    locationId: {
        type: String,
        trim: true
    },
    fulfillmentType: {
        type: String,
        enum: ["DINE_IN", "DELIVERY", "PICKUP", "OTHER"],
        default: "DINE_IN"
    },
    orderDate: {
        type: Date,
        default : Date.now
    },
    bills: {
        total: { type: Number, required: true, min: 0 },
        tax: { type: Number, required: true, min: 0 },
        totalWithTax: { type: Number, required: true, min: 0 },
        discountTotal: { type: Number, min: 0, default: 0 },
        subtotalBeforeDiscount: { type: Number, min: 0, default: 0 }
    },
    items: {
        type: [orderItemSchema],
        required: true,
        validate: {
            validator: (items) => Array.isArray(items) && items.length > 0,
            message: "At least one order item is required"
        }
    },
    table: { type: mongoose.Schema.Types.ObjectId, ref: "Table" },
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: "MemberAccount" },
    appliedPromotions: { type: [appliedPromotionSchema], default: [] },
    paymentMethod: {
        type: String,
        required: true,
        enum: ["Cash", "Online", "Pending"]
    },
    paymentData: {
        stripe_session_id: { type: String },
        stripe_payment_intent_id: { type: String },
        stripe_charge_id: { type: String }
    },
    // 2026-02-28T16:00:00+08:00 Phase C1 在线订餐：外带/配送信息
    fulfillmentDetails: {
        pickupAt: { type: Date },
        deliveryAddress: { type: String, trim: true },
    },
    mergeHistory: { type: [orderMergeHistorySchema], default: [] },
}, { timestamps : true } );

orderSchema.index(
    { sourceType: 1, channelProviderCode: 1, externalOrderId: 1 },
    {
        unique: true,
        partialFilterExpression: {
            sourceType: "CHANNEL",
            channelProviderCode: { $exists: true, $type: "string" },
            externalOrderId: { $exists: true, $type: "string" }
        }
    }
);

module.exports = mongoose.model("Order", orderSchema);
