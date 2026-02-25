const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema({
    tableNo: { type: Number, required: true, unique: true, min: 1 },
    status: {
        type: String,
        default: "Available",
        enum: ["Available", "Booked"]
    },
    seats: { 
        type: Number,
        required: true,
        min: 1,
        max: 20
    },
    currentOrder: {type: mongoose.Schema.Types.ObjectId, ref: "Order"}
});

module.exports = mongoose.model("Table", tableSchema);
