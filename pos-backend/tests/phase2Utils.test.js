const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const {
  routeItemToStationCode,
  deriveTicketStatusFromItems,
} = require("../utils/kitchenRouting");
const {
  normalizeLocationId: normalizeInventoryLocationId,
  DEFAULT_LOCATION_ID,
  applyOutOfStockFlag,
} = require("../utils/inventoryService");
const { normalizeLocationId: normalizeCashLocationId } = require("../utils/cashShiftService");

test("kitchen routing: routeItemToStationCode maps categories correctly", () => {
  assert.equal(routeItemToStationCode("Masala Chai"), "BAR");
  assert.equal(routeItemToStationCode("Gulab Jamun"), "DESSERT");
  assert.equal(routeItemToStationCode("Margherita Pizza"), "PIZZA");
  assert.equal(routeItemToStationCode("Greek Salad"), "COLD");
  assert.equal(routeItemToStationCode("Paneer Butter Masala"), "HOT_LINE");
});

test("kitchen routing: deriveTicketStatusFromItems derives aggregate status", () => {
  assert.equal(deriveTicketStatusFromItems([]), "NEW");
  assert.equal(
    deriveTicketStatusFromItems([{ status: "READY" }, { status: "CANCELLED" }]),
    "READY"
  );
  assert.equal(
    deriveTicketStatusFromItems([{ status: "PREPARING" }, { status: "NEW" }]),
    "PREPARING"
  );
  assert.equal(
    deriveTicketStatusFromItems([{ status: "CANCELLED" }, { status: "CANCELLED" }]),
    "CANCELLED"
  );
});

test("location normalization: inventory and cash default and trim behavior", () => {
  assert.equal(normalizeInventoryLocationId(undefined), DEFAULT_LOCATION_ID);
  assert.equal(normalizeInventoryLocationId("  store-1 "), "store-1");
  assert.equal(normalizeCashLocationId(undefined), "default");
  assert.equal(normalizeCashLocationId("  loc-a "), "loc-a");
});

test("inventory auto-86: out of stock auto disables and restock reactivates", async () => {
  let saveCount = 0;
  const item = {
    availableQuantity: 0,
    autoDisableOnOutOfStock: true,
    isOutOfStock: false,
    autoDisabledByStock: false,
    status: "active",
    async save() {
      saveCount += 1;
      return this;
    },
  };

  await applyOutOfStockFlag(item);
  assert.equal(item.isOutOfStock, true);
  assert.equal(item.status, "inactive");
  assert.equal(item.autoDisabledByStock, true);

  item.availableQuantity = 4;
  await applyOutOfStockFlag(item);
  assert.equal(item.isOutOfStock, false);
  assert.equal(item.status, "active");
  assert.equal(item.autoDisabledByStock, false);
  assert.equal(saveCount >= 2, true);
});
