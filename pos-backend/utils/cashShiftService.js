const createHttpError = require("http-errors");
const CashShift = require("../models/cashShiftModel");
const CashMovement = require("../models/cashMovementModel");
const config = require("../config/config");

const normalizeLocationId = (locationId) => `${locationId || ""}`.trim() || "default";

const findOpenShift = async (locationId) =>
  CashShift.findOne({ locationId: normalizeLocationId(locationId), status: "OPEN" });

const recordCashMovement = async ({
  shiftId,
  locationId,
  type,
  direction,
  amount,
  reason,
  createdBy,
  metadata,
}) => {
  return CashMovement.create({
    shiftId,
    locationId: normalizeLocationId(locationId),
    type,
    direction,
    amount,
    reason,
    createdBy,
    metadata,
  });
};

const applyCashSaleToOpenShift = async ({ locationId, amount, createdBy, metadata }) => {
  const normalizedLocationId = normalizeLocationId(locationId);
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return null;
  }

  const shift = await findOpenShift(normalizedLocationId);
  if (!shift) {
    if (config.cashShiftStrict) {
      throw createHttpError(
        409,
        `No open cash shift for location ${normalizedLocationId}.`
      );
    }
    return null;
  }

  shift.cashSalesTotal += numericAmount;
  await shift.save();

  await recordCashMovement({
    shiftId: shift._id,
    locationId: normalizedLocationId,
    type: "SALE",
    direction: "IN",
    amount: numericAmount,
    reason: "Cash sale from order",
    createdBy,
    metadata,
  });

  return shift;
};

module.exports = {
  normalizeLocationId,
  findOpenShift,
  recordCashMovement,
  applyCashSaleToOpenShift,
};
