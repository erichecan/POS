const mongoose = require("mongoose");
const config = require("../config/config");
const User = require("../models/userModel");
const Table = require("../models/tableModel");
const Order = require("../models/orderModel");
const Payment = require("../models/paymentModel");
const DeveloperApiKey = require("../models/developerApiKeyModel");
const DeveloperApiUsage = require("../models/developerApiUsageModel");
const StoreHardwareProfile = require("../models/storeHardwareProfileModel");
const StoreVerticalProfile = require("../models/storeVerticalProfileModel");
const { calculateOrderSummary } = require("../utils/orderPricing");
const { hashApiKey, deriveKeyPrefix } = require("../utils/developerAuthService");
const { resolveMongoUri } = require("../utils/resolveMongoUri");

const USERS = [
  // 2026-02-24: 测试管理员，登录邮箱 testadmin@restro.local，密码 12345678（schema 要求至少 8 位）
  {
    name: "Test Admin",
    email: "testadmin@restro.local",
    phone: "9000000000",
    password: "12345678",
    role: "Admin"
  },
  {
    name: "System Admin",
    email: "admin@restro.local",
    phone: "9000000001",
    password: "Admin@12345",
    role: "Admin"
  },
  {
    name: "Counter Cashier",
    email: "cashier@restro.local",
    phone: "9000000002",
    password: "Cashier@12345",
    role: "Cashier"
  },
  {
    name: "Floor Waiter",
    email: "waiter@restro.local",
    phone: "9000000003",
    password: "Waiter@12345",
    role: "Waiter"
  }
];

const TABLES = [
  { tableNo: 1, seats: 2 },
  { tableNo: 2, seats: 2 },
  { tableNo: 3, seats: 4 },
  { tableNo: 4, seats: 4 },
  { tableNo: 5, seats: 4 },
  { tableNo: 6, seats: 6 },
  { tableNo: 7, seats: 6 },
  { tableNo: 8, seats: 6 },
  { tableNo: 9, seats: 8 },
  { tableNo: 10, seats: 8 },
  { tableNo: 11, seats: 10 },
  { tableNo: 12, seats: 10 }
];

const ORDER_FIXTURES = [
  {
    customerDetails: { name: "Aarav Sharma", phone: "9876500001", guests: 2 },
    tableNo: 1,
    paymentMethod: "Cash",
    orderStatus: "In Progress",
    items: [
      { name: "Paneer Tikka", quantity: 1 },
      { name: "Masala Chai", quantity: 2 }
    ],
    minutesAgo: 15
  },
  {
    customerDetails: { name: "Isha Verma", phone: "9876500002", guests: 4 },
    tableNo: 2,
    paymentMethod: "Online",
    orderStatus: "Ready",
    items: [
      { name: "Butter Chicken", quantity: 1 },
      { name: "Chicken Biryani", quantity: 1 },
      { name: "Lemon Soda", quantity: 2 }
    ],
    minutesAgo: 40
  },
  {
    customerDetails: { name: "Neel Patel", phone: "9876500003", guests: 3 },
    tableNo: 3,
    paymentMethod: "Cash",
    orderStatus: "Completed",
    items: [
      { name: "Margherita Pizza", quantity: 1 },
      { name: "Cold Coffee", quantity: 2 }
    ],
    minutesAgo: 120
  },
  {
    customerDetails: { name: "Riya Singh", phone: "9876500004", guests: 2 },
    tableNo: 4,
    paymentMethod: "Online",
    orderStatus: "Completed",
    items: [
      { name: "Rogan Josh", quantity: 1 },
      { name: "Rum", quantity: 1 }
    ],
    minutesAgo: 180
  },
  {
    customerDetails: { name: "Kabir Mehta", phone: "9876500005", guests: 5 },
    tableNo: 5,
    paymentMethod: "Cash",
    orderStatus: "Cancelled",
    items: [
      { name: "Veg Supreme Pizza", quantity: 1 },
      { name: "Tomato Soup", quantity: 2 }
    ],
    minutesAgo: 260
  },
  {
    customerDetails: { name: "Anaya Nair", phone: "9876500006", guests: 6 },
    tableNo: 6,
    paymentMethod: "Online",
    orderStatus: "In Progress",
    items: [
      { name: "Chicken Tikka", quantity: 2 },
      { name: "Fresh Lime Water", quantity: 3 }
    ],
    minutesAgo: 8
  },
  {
    customerDetails: { name: "Dev Khanna", phone: "9876500007", guests: 4 },
    tableNo: 7,
    paymentMethod: "Cash",
    orderStatus: "Ready",
    items: [
      { name: "Kadai Paneer", quantity: 1 },
      { name: "Sweet Corn Soup", quantity: 2 }
    ],
    minutesAgo: 55
  },
  {
    customerDetails: { name: "Mira Joshi", phone: "9876500008", guests: 2 },
    tableNo: 8,
    paymentMethod: "Online",
    orderStatus: "Completed",
    items: [
      { name: "Chocolate Lava Cake", quantity: 1 },
      { name: "Cocktail", quantity: 1 }
    ],
    minutesAgo: 320
  }
];

const ACTIVE_ORDER_STATUSES = new Set(["In Progress", "Ready"]);
const PARTNER_API_KEY_PLAIN = "pos_partner_seed_orders_read_2026";

const seedUsers = async () => {
  const savedUsers = [];
  for (const userData of USERS) {
    const user = new User(userData);
    await user.save();
    savedUsers.push(user);
  }

  return savedUsers;
};

const seedTables = async () => {
  const tables = await Table.insertMany(TABLES);
  return new Map(tables.map((table) => [table.tableNo, table]));
};

const buildPaymentDoc = (fixture, orderDoc, seedIndex) => ({
  paymentId: `pi_seed_${seedIndex}`,
  orderId: `cs_seed_${seedIndex}`,
  chargeId: `ch_seed_${seedIndex}`,
  amount: orderDoc.bills.totalWithTax,
  currency: "EUR",
  status: "succeeded",
  method: "card",
  email: `${fixture.customerDetails.name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
  contact: fixture.customerDetails.phone,
  verified: true,
  usedForOrder: true,
  orderDbId: orderDoc._id,
  source: "verify_endpoint",
  paymentCapturedAt: orderDoc.orderDate
});

const seedOrdersAndPayments = async (tableByNo) => {
  const orders = [];
  const payments = [];

  let seedIndex = 1;
  for (const fixture of ORDER_FIXTURES) {
    const table = tableByNo.get(fixture.tableNo);
    if (!table) {
      throw new Error(`Table ${fixture.tableNo} not found while seeding orders.`);
    }

    const { items, bills } = calculateOrderSummary(fixture.items);
    const orderDate = new Date(Date.now() - fixture.minutesAgo * 60 * 1000);

    const paymentData =
      fixture.paymentMethod === "Online"
        ? {
            stripe_session_id: `cs_seed_${seedIndex}`,
            stripe_payment_intent_id: `pi_seed_${seedIndex}`,
            stripe_charge_id: `ch_seed_${seedIndex}`,
          }
        : undefined;

    const orderDoc = await Order.create({
      customerDetails: fixture.customerDetails,
      orderStatus: fixture.orderStatus,
      orderDate,
      bills,
      items,
      table: table._id,
      paymentMethod: fixture.paymentMethod,
      paymentData
    });

    orders.push(orderDoc);

    if (fixture.paymentMethod === "Online") {
      const paymentDoc = await Payment.create(
        buildPaymentDoc(fixture, orderDoc, seedIndex)
      );
      payments.push(paymentDoc);
    }

    if (ACTIVE_ORDER_STATUSES.has(fixture.orderStatus)) {
      table.status = "Booked";
      table.currentOrder = orderDoc._id;
      await table.save();
    }

    seedIndex += 1;
  }

  return { orders, payments };
};

const seedPartnerApiKeys = async ({ createdBy }) => {
  const plainKey = PARTNER_API_KEY_PLAIN;
  const record = await DeveloperApiKey.create({
    name: "Seed Partner Integration Key",
    keyPrefix: deriveKeyPrefix(plainKey),
    keyHash: hashApiKey(plainKey),
    status: "ACTIVE",
    scopes: ["orders:read"],
    rateLimitPerMinute: 120,
    allowedIps: [],
    sandboxOnly: false,
    metadata: {
      seeded: true,
      purpose: "partner-orders-read"
    },
    createdBy
  });

  return {
    keys: [record],
    plainKeys: [plainKey]
  };
};

const resetCollections = async () => {
  await StoreVerticalProfile.deleteMany({});
  await StoreHardwareProfile.deleteMany({});
  await DeveloperApiUsage.deleteMany({});
  await DeveloperApiKey.deleteMany({});
  await Payment.deleteMany({});
  await Order.deleteMany({});
  await Table.deleteMany({});
  await User.deleteMany({});
};

const printSummary = (result) => {
  console.log("\nSeed completed successfully.");
  console.log("Database:", config.databaseURI);
  console.log("Users:", result.users.length);
  console.log("Tables:", result.tablesCount);
  console.log("Orders:", result.orders.length);
  console.log("Payments:", result.payments.length);
  console.log("Partner API Keys:", result.partnerKeys.length);
  console.log("\nLogin credentials:");
  console.log("- TestAdmin: testadmin@restro.local / 12345678");
  console.log("- Admin   : admin@restro.local / Admin@12345");
  console.log("- Cashier : cashier@restro.local / Cashier@12345");
  console.log("- Waiter  : waiter@restro.local / Waiter@12345");
  console.log("\nPartner API seed credentials:");
  console.log(`- x-api-key: ${result.partnerPlainKeys[0]}`);
};

const run = async () => {
  try {
    const normalizedUri = await resolveMongoUri(config.databaseURI);
    console.log("Resolved Mongo URI scheme:", normalizedUri.split("://")[0]);
    await mongoose.connect(normalizedUri);
    console.log("Connected for seeding.");
    await resetCollections();

    const users = await seedUsers();
    const tableByNo = await seedTables();
    const { orders, payments } = await seedOrdersAndPayments(tableByNo);
    const { keys: partnerKeys, plainKeys: partnerPlainKeys } = await seedPartnerApiKeys({
      createdBy: users[0]?._id
    });

    printSummary({
      users,
      tablesCount: tableByNo.size,
      orders,
      payments,
      partnerKeys,
      partnerPlainKeys
    });
  } catch (error) {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

run();
