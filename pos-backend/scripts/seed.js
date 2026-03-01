// 2026-02-28: Demo seed - 中餐正餐, 30+ 条数据, 投资者/餐饮客户演示
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
const Organization = require("../models/organizationModel");
const Region = require("../models/regionModel");
const Store = require("../models/storeModel");
const WorkforceShift = require("../models/workforceShiftModel");
const MenuCategory = require("../models/menuCategoryModel");
const MenuCatalogItem = require("../models/menuCatalogItemModel");
const MenuVersion = require("../models/menuVersionModel");
const KitchenStation = require("../models/kitchenStationModel");
const KitchenTicket = require("../models/kitchenTicketModel");
const ChannelProvider = require("../models/channelProviderModel");
const MarketProfile = require("../models/marketProfileModel");
const StoreChannelConnection = require("../models/storeChannelConnectionModel");
const MemberAccount = require("../models/memberAccountModel");
const MemberLedgerEntry = require("../models/memberLedgerEntryModel");
const PromotionRule = require("../models/promotionRuleModel");
const PromotionCoupon = require("../models/promotionCouponModel");
const DeviceRegistration = require("../models/deviceRegistrationModel");
const CashShift = require("../models/cashShiftModel");
const CashMovement = require("../models/cashMovementModel");
const SettlementBatch = require("../models/settlementBatchModel");
const TableQrSession = require("../models/tableQrSessionModel");
const Position = require("../models/positionModel");
const ShiftTemplate = require("../models/shiftTemplateModel");
const EmployeeProfile = require("../models/employeeProfileModel");
const EmployeeWorkScope = require("../models/employeeWorkScopeModel");
const ScheduleSlot = require("../models/scheduleSlotModel");
const LeaveRequest = require("../models/leaveRequestModel");
const WorkHourRecord = require("../models/workHourRecordModel");
const WageRule = require("../models/wageRuleModel");
const { calculateOrderSummaryFromCatalog } = require("../utils/orderPricing");
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

// 2026-02-28: 中餐正餐演示 - 30 条订单，全部使用真实菜单菜品
const ORDER_FIXTURES = [
  { customerDetails: { name: "张明", phone: "13800001001", guests: 2 }, tableNo: 1, paymentMethod: "Cash", orderStatus: "In Progress", items: [{ name: "夫妻肺片", quantity: 1 }, { name: "珍珠奶茶", quantity: 2 }], minutesAgo: 5 },
  { customerDetails: { name: "李芳", phone: "13800001002", guests: 4 }, tableNo: 2, paymentMethod: "Online", orderStatus: "Ready", items: [{ name: "宫保鸡丁", quantity: 1 }, { name: "红烧肉", quantity: 1 }, { name: "酸梅汤", quantity: 2 }], minutesAgo: 25 },
  { customerDetails: { name: "王强", phone: "13800001003", guests: 3 }, tableNo: 3, paymentMethod: "Cash", orderStatus: "Completed", items: [{ name: "糖醋里脊", quantity: 1 }, { name: "鲜榨橙汁", quantity: 2 }], minutesAgo: 90 },
  { customerDetails: { name: "陈静", phone: "13800001004", guests: 2 }, tableNo: 4, paymentMethod: "Online", orderStatus: "Completed", items: [{ name: "清蒸鲈鱼", quantity: 1 }, { name: "啤酒", quantity: 1 }], minutesAgo: 150 },
  { customerDetails: { name: "刘洋", phone: "13800001005", guests: 5 }, tableNo: 5, paymentMethod: "Cash", orderStatus: "Cancelled", items: [{ name: "麻婆豆腐", quantity: 1 }, { name: "酸辣汤", quantity: 2 }], minutesAgo: 200 },
  { customerDetails: { name: "赵敏", phone: "13800001006", guests: 6 }, tableNo: 6, paymentMethod: "Online", orderStatus: "In Progress", items: [{ name: "蒜泥黄瓜", quantity: 2 }, { name: "柠檬水", quantity: 3 }], minutesAgo: 3 },
  { customerDetails: { name: "周杰", phone: "13800001007", guests: 4 }, tableNo: 7, paymentMethod: "Cash", orderStatus: "Ready", items: [{ name: "东坡肉", quantity: 1 }, { name: "老鸭汤", quantity: 2 }], minutesAgo: 45 },
  { customerDetails: { name: "吴梅", phone: "13800001008", guests: 2 }, tableNo: 8, paymentMethod: "Online", orderStatus: "Completed", items: [{ name: "杨枝甘露", quantity: 1 }, { name: "红酒", quantity: 1 }], minutesAgo: 180 },
  { customerDetails: { name: "郑浩", phone: "13800001009", guests: 3 }, tableNo: 9, paymentMethod: "Cash", orderStatus: "In Progress", items: [{ name: "口水鸡", quantity: 1 }, { name: "小笼包", quantity: 2 }, { name: "酸梅汤", quantity: 2 }], minutesAgo: 12 },
  { customerDetails: { name: "孙丽", phone: "13800001010", guests: 4 }, tableNo: 10, paymentMethod: "Online", orderStatus: "Ready", items: [{ name: "鱼香肉丝", quantity: 1 }, { name: "扬州炒饭", quantity: 1 }, { name: "珍珠奶茶", quantity: 2 }], minutesAgo: 35 },
  { customerDetails: { name: "黄磊", phone: "13800001011", guests: 2 }, tableNo: 11, paymentMethod: "Cash", orderStatus: "Completed", items: [{ name: "凉拌木耳", quantity: 1 }, { name: "葱油拌面", quantity: 1 }, { name: "绿豆糕", quantity: 1 }], minutesAgo: 120 },
  { customerDetails: { name: "林晓", phone: "13800001012", guests: 4 }, tableNo: 12, paymentMethod: "Online", orderStatus: "Completed", items: [{ name: "皮蛋豆腐", quantity: 1 }, { name: "冬瓜排骨汤", quantity: 1 }, { name: "黄酒", quantity: 2 }], minutesAgo: 250 },
  { customerDetails: { name: "何刚", phone: "13800001013", guests: 2 }, tableNo: 1, paymentMethod: "Cash", orderStatus: "Completed", items: [{ name: "宫保鸡丁", quantity: 1 }, { name: "蛋炒饭", quantity: 1 }], minutesAgo: 300 },
  { customerDetails: { name: "钱进", phone: "13800001014", guests: 3 }, tableNo: 2, paymentMethod: "Online", orderStatus: "In Progress", items: [{ name: "麻婆豆腐", quantity: 2 }, { name: "西红柿蛋汤", quantity: 1 }, { name: "桂花糕", quantity: 2 }], minutesAgo: 8 },
  { customerDetails: { name: "冯雪", phone: "13800001015", guests: 2 }, tableNo: 3, paymentMethod: "Cash", orderStatus: "Ready", items: [{ name: "红烧肉", quantity: 1 }, { name: "酸梅汤", quantity: 1 }], minutesAgo: 55 },
  { customerDetails: { name: "许涛", phone: "13800001016", guests: 5 }, tableNo: 4, paymentMethod: "Online", orderStatus: "Completed", items: [{ name: "清蒸鲈鱼", quantity: 1 }, { name: "小笼包", quantity: 3 }, { name: "茅台", quantity: 1 }], minutesAgo: 200 },
  { customerDetails: { name: "姚华", phone: "13800001017", guests: 2 }, tableNo: 5, paymentMethod: "Cash", orderStatus: "In Progress", items: [{ name: "夫妻肺片", quantity: 1 }, { name: "糖醋里脊", quantity: 1 }, { name: "珍珠奶茶", quantity: 2 }], minutesAgo: 18 },
  { customerDetails: { name: "蒋峰", phone: "13800001018", guests: 4 }, tableNo: 6, paymentMethod: "Online", orderStatus: "Ready", items: [{ name: "东坡肉", quantity: 1 }, { name: "扬州炒饭", quantity: 2 }, { name: "啤酒", quantity: 2 }], minutesAgo: 42 },
  { customerDetails: { name: "沈琳", phone: "13800001019", guests: 3 }, tableNo: 7, paymentMethod: "Cash", orderStatus: "Completed", items: [{ name: "口水鸡", quantity: 1 }, { name: "酸辣汤", quantity: 1 }, { name: "红豆糕", quantity: 2 }], minutesAgo: 140 },
  { customerDetails: { name: "韩冰", phone: "13800001020", guests: 2 }, tableNo: 8, paymentMethod: "Online", orderStatus: "Completed", items: [{ name: "蒜泥黄瓜", quantity: 1 }, { name: "宫保鸡丁", quantity: 1 }, { name: "红酒", quantity: 1 }], minutesAgo: 220 },
  { customerDetails: { name: "杨帆", phone: "13800001021", guests: 6 }, tableNo: 9, paymentMethod: "Cash", orderStatus: "In Progress", items: [{ name: "凉拌木耳", quantity: 2 }, { name: "鱼香肉丝", quantity: 1 }, { name: "红烧肉", quantity: 1 }, { name: "鲜榨橙汁", quantity: 4 }], minutesAgo: 10 },
  { customerDetails: { name: "朱婷", phone: "13800001022", guests: 4 }, tableNo: 10, paymentMethod: "Online", orderStatus: "Ready", items: [{ name: "皮蛋豆腐", quantity: 1 }, { name: "清蒸鲈鱼", quantity: 1 }, { name: "老鸭汤", quantity: 1 }, { name: "杨枝甘露", quantity: 2 }], minutesAgo: 38 },
  { customerDetails: { name: "秦海", phone: "13800001023", guests: 2 }, tableNo: 11, paymentMethod: "Cash", orderStatus: "Completed", items: [{ name: "麻婆豆腐", quantity: 1 }, { name: "葱油拌面", quantity: 1 }, { name: "柠檬水", quantity: 2 }], minutesAgo: 165 },
  { customerDetails: { name: "尤佳", phone: "13800001024", guests: 3 }, tableNo: 12, paymentMethod: "Online", orderStatus: "In Progress", items: [{ name: "东坡肉", quantity: 1 }, { name: "小笼包", quantity: 2 }, { name: "酸梅汤", quantity: 2 }], minutesAgo: 6 },
  { customerDetails: { name: "施文", phone: "13800001025", guests: 4 }, tableNo: 1, paymentMethod: "Cash", orderStatus: "Ready", items: [{ name: "糖醋里脊", quantity: 1 }, { name: "扬州炒饭", quantity: 2 }, { name: "冬瓜排骨汤", quantity: 1 }, { name: "黄酒", quantity: 2 }], minutesAgo: 50 },
  { customerDetails: { name: "孔亮", phone: "13800001026", guests: 2 }, tableNo: 2, paymentMethod: "Online", orderStatus: "Completed", items: [{ name: "夫妻肺片", quantity: 1 }, { name: "宫保鸡丁", quantity: 1 }, { name: "绿豆糕", quantity: 1 }, { name: "啤酒", quantity: 1 }], minutesAgo: 190 },
  { customerDetails: { name: "严芳", phone: "13800001027", guests: 5 }, tableNo: 3, paymentMethod: "Cash", orderStatus: "Completed", items: [{ name: "口水鸡", quantity: 2 }, { name: "红烧肉", quantity: 1 }, { name: "清蒸鲈鱼", quantity: 1 }, { name: "酸辣汤", quantity: 2 }, { name: "珍珠奶茶", quantity: 3 }], minutesAgo: 280 },
  { customerDetails: { name: "贺敏", phone: "13800001028", guests: 2 }, tableNo: 4, paymentMethod: "Online", orderStatus: "In Progress", items: [{ name: "蒜泥黄瓜", quantity: 1 }, { name: "麻婆豆腐", quantity: 1 }, { name: "蛋炒饭", quantity: 1 }], minutesAgo: 15 },
  { customerDetails: { name: "汤磊", phone: "13800001029", guests: 4 }, tableNo: 5, paymentMethod: "Cash", orderStatus: "Ready", items: [{ name: "凉拌木耳", quantity: 1 }, { name: "鱼香肉丝", quantity: 1 }, { name: "西红柿蛋汤", quantity: 1 }, { name: "桂花糕", quantity: 2 }], minutesAgo: 48 },
  { customerDetails: { name: "殷红", phone: "13800001030", guests: 3 }, tableNo: 6, paymentMethod: "Online", orderStatus: "Completed", items: [{ name: "皮蛋豆腐", quantity: 1 }, { name: "东坡肉", quantity: 1 }, { name: "老鸭汤", quantity: 1 }, { name: "红酒", quantity: 1 }], minutesAgo: 210 },
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

// 2026-02-28: 团队管理 Phase 1 - 岗位与班次模板
const seedPositionsAndShiftTemplates = async () => {
  const LOCATION_ID = "default";
  const positions = [
    { name: "服务员", code: "WAITER", scopeType: "TABLES", scopeConfig: {}, defaultHourlyRate: 0 },
    { name: "Runner/传菜", code: "RUNNER", scopeType: "RUNNER", scopeConfig: {}, defaultHourlyRate: 0 },
    { name: "帮炒", code: "WOK", scopeType: "KITCHEN", scopeConfig: { stationCode: "WOK" }, defaultHourlyRate: 0 },
    { name: "外卖打包员", code: "PACKER", scopeType: "TAKEOUT", scopeConfig: { stationCode: "PACK" }, defaultHourlyRate: 0 },
    { name: "吧台", code: "BAR", scopeType: "BAR", scopeConfig: { stationCode: "BAR" }, defaultHourlyRate: 0 },
    { name: "收银", code: "CASHIER", scopeType: "CASHIER", scopeConfig: {}, defaultHourlyRate: 0 },
    { name: "店长", code: "MANAGER", scopeType: "MANAGER", scopeConfig: {}, defaultHourlyRate: 0 },
  ];
  const templates = [
    { name: "早班", code: "MORNING", startTime: "09:00", endTime: "14:00", breakMinutes: 30 },
    { name: "午班", code: "AFTERNOON", startTime: "14:00", endTime: "18:00", breakMinutes: 0 },
    { name: "晚班", code: "EVENING", startTime: "18:00", endTime: "22:00", breakMinutes: 30 },
    { name: "全天", code: "FULL", startTime: "09:00", endTime: "22:00", breakMinutes: 60 },
  ];
  for (const p of positions) {
    await Position.create({ ...p, locationId: LOCATION_ID });
  }
  for (const t of templates) {
    await ShiftTemplate.create({ ...t, locationId: LOCATION_ID });
  }
};

const seedOrganization = async () => {
  const org = await Organization.create({
    code: "RESTRO",
    name: "Restro Group",
    status: "ACTIVE"
  });
  return org;
};

const seedRegions = async (orgId) => {
  const regions = await Region.insertMany([
    {
      organizationId: orgId,
      code: "NA",
      name: "North America",
      countryCode: "US",
      currency: "USD",
      timezone: "America/New_York",
      status: "ACTIVE"
    },
    {
      organizationId: orgId,
      code: "AP",
      name: "Asia Pacific",
      countryCode: "JP",
      currency: "JPY",
      timezone: "Asia/Tokyo",
      status: "ACTIVE"
    }
  ]);
  return regions;
};

const seedStores = async (orgId, regions) => {
  const naRegion = regions.find((r) => r.code === "NA");
  const apRegion = regions.find((r) => r.code === "AP");
  const stores = await Store.insertMany([
    {
      organizationId: orgId,
      regionId: naRegion._id,
      locationId: "LOC-001",
      code: "NYC-01",
      name: "Restro NYC Downtown",
      status: "ACTIVE",
      timezone: "America/New_York",
      overrideSettings: { countryCode: "US", currency: "USD" }
    },
    {
      organizationId: orgId,
      regionId: naRegion._id,
      locationId: "LOC-002",
      code: "LA-01",
      name: "Restro Los Angeles",
      status: "ACTIVE",
      timezone: "America/Los_Angeles",
      overrideSettings: { countryCode: "US", currency: "USD" }
    },
    {
      organizationId: orgId,
      regionId: apRegion._id,
      locationId: "LOC-003",
      code: "TKY-01",
      name: "Restro Tokyo",
      status: "ACTIVE",
      timezone: "Asia/Tokyo",
      overrideSettings: { countryCode: "JP", currency: "JPY" }
    }
  ]);
  return stores;
};

const seedWorkforceShifts = async (users, stores, createdBy) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const adminUser = users.find((u) => u.role === "Admin");
  const cashierUser = users.find((u) => u.role === "Cashier");
  const waiterUser = users.find((u) => u.role === "Waiter");
  const nycStore = stores.find((s) => s.locationId === "LOC-001");
  const laStore = stores.find((s) => s.locationId === "LOC-002");
  const tkyStore = stores.find((s) => s.locationId === "LOC-003");

  const shifts = await WorkforceShift.insertMany([
    {
      locationId: nycStore.locationId,
      employeeId: adminUser._id,
      role: "Admin",
      startAt: new Date(today.getTime() + 6 * 60 * 60 * 1000),
      endAt: new Date(today.getTime() + 14 * 60 * 60 * 1000),
      status: "SCHEDULED",
      createdBy
    },
    {
      locationId: nycStore.locationId,
      employeeId: cashierUser._id,
      role: "Cashier",
      startAt: new Date(today.getTime() + 14 * 60 * 60 * 1000),
      endAt: new Date(today.getTime() + 22 * 60 * 60 * 1000),
      status: "SCHEDULED",
      createdBy
    },
    {
      locationId: laStore.locationId,
      employeeId: waiterUser._id,
      role: "Waiter",
      startAt: new Date(today.getTime() + 17 * 60 * 60 * 1000),
      endAt: new Date(today.getTime() + 23 * 60 * 60 * 1000),
      status: "SCHEDULED",
      createdBy
    },
    {
      locationId: laStore.locationId,
      employeeId: adminUser._id,
      role: "Admin",
      startAt: new Date(today.getTime() + 6 * 60 * 60 * 1000),
      endAt: new Date(today.getTime() + 14 * 60 * 60 * 1000),
      status: "SCHEDULED",
      createdBy
    },
    {
      locationId: tkyStore.locationId,
      employeeId: waiterUser._id,
      role: "Waiter",
      startAt: new Date(today.getTime() + 17 * 60 * 60 * 1000),
      endAt: new Date(today.getTime() + 23 * 60 * 60 * 1000),
      status: "SCHEDULED",
      createdBy
    }
  ]);
  return shifts;
};

const seedTables = async () => {
  const tables = await Table.insertMany(TABLES);
  return new Map(tables.map((table) => [table.tableNo, table]));
};

const buildPaymentDoc = (fixture, orderDoc, seedIndex, method) => ({
  paymentId: method === "Online" ? `pi_seed_${seedIndex}` : `cash_seed_${seedIndex}`,
  orderId: String(orderDoc._id),
  chargeId: method === "Online" ? `ch_seed_${seedIndex}` : null,
  amount: orderDoc.bills.totalWithTax,
  currency: "CNY",
  status: "succeeded",
  method: method === "Online" ? "card" : "cash",
  email: method === "Online" ? `${fixture.customerDetails.name.replace(/\s+/g, "")}@demo.com` : null,
  contact: fixture.customerDetails.phone,
  verified: true,
  usedForOrder: true,
  orderDbId: orderDoc._id,
  source: "verify_endpoint",
  paymentCapturedAt: orderDoc.orderDate,
  gatewayCode: method === "Online" ? "STRIPE" : "CASH",
});

const seedOrdersAndPayments = async (tableByNo) => {
  const orders = [];
  const payments = [];
  let seedIndex = 1;

  for (const fixture of ORDER_FIXTURES) {
    const table = tableByNo.get(fixture.tableNo);
    if (!table) throw new Error(`Table ${fixture.tableNo} not found.`);

    const orderDate = new Date(Date.now() - fixture.minutesAgo * 60 * 1000);
    const { items, bills } = await calculateOrderSummaryFromCatalog(fixture.items, {
      locationId: "default",
      at: orderDate,
    });

    const paymentData =
      fixture.paymentMethod === "Online"
        ? { stripe_session_id: `cs_seed_${seedIndex}`, stripe_payment_intent_id: `pi_seed_${seedIndex}`, stripe_charge_id: `ch_seed_${seedIndex}` }
        : undefined;

    const orderDoc = await Order.create({
      customerDetails: fixture.customerDetails,
      orderStatus: fixture.orderStatus,
      orderDate,
      bills,
      items,
      table: table._id,
      paymentMethod: fixture.paymentMethod,
      paymentData,
      locationId: "default",
    });

    orders.push(orderDoc);

    const paymentDoc = await Payment.create(buildPaymentDoc(fixture, orderDoc, seedIndex, fixture.paymentMethod));
    payments.push(paymentDoc);

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

// 2026-02-28: 中餐正餐演示菜单 - 统一与订单菜品一致
const seedMenuData = async () => {
  await MenuCategory.deleteMany({});
  await MenuCatalogItem.deleteMany({});
  await MenuVersion.deleteMany({});

  const catDefs = [
    { name: "凉菜", icon: "🥗", color: "#22c55e", sortOrder: 0, description: "开胃冷盘" },
    { name: "热菜", icon: "🍖", color: "#ef4444", sortOrder: 1, description: "主菜热炒" },
    { name: "汤羹", icon: "🍜", color: "#f97316", sortOrder: 2, description: "汤类" },
    { name: "主食", icon: "🍚", color: "#eab308", sortOrder: 3, description: "米饭面食" },
    { name: "饮品", icon: "🥤", color: "#06b6d4", sortOrder: 4, description: "饮料茶饮" },
    { name: "甜品", icon: "🍰", color: "#ec4899", sortOrder: 5, description: "甜点" },
    { name: "酒水", icon: "🍶", color: "#8b5cf6", sortOrder: 6, description: "酒类" },
  ];

  const cats = await MenuCategory.insertMany(
    catDefs.map((c) => ({ ...c, locationId: "default", normalizedName: c.name.toLowerCase(), status: "ACTIVE" }))
  );
  console.log(`  MenuCategories: ${cats.length}`);

  const itemDefs = [
    { name: "夫妻肺片", category: "凉菜", basePrice: 38 },
    { name: "蒜泥黄瓜", category: "凉菜", basePrice: 18 },
    { name: "口水鸡", category: "凉菜", basePrice: 42 },
    { name: "凉拌木耳", category: "凉菜", basePrice: 22 },
    { name: "皮蛋豆腐", category: "凉菜", basePrice: 28 },
    { name: "宫保鸡丁", category: "热菜", basePrice: 48 },
    { name: "糖醋里脊", category: "热菜", basePrice: 52 },
    { name: "红烧肉", category: "热菜", basePrice: 58 },
    { name: "清蒸鲈鱼", category: "热菜", basePrice: 88 },
    { name: "麻婆豆腐", category: "热菜", basePrice: 38 },
    { name: "鱼香肉丝", category: "热菜", basePrice: 45 },
    { name: "东坡肉", category: "热菜", basePrice: 68 },
    { name: "酸辣汤", category: "汤羹", basePrice: 28 },
    { name: "老鸭汤", category: "汤羹", basePrice: 48 },
    { name: "冬瓜排骨汤", category: "汤羹", basePrice: 42 },
    { name: "西红柿蛋汤", category: "汤羹", basePrice: 22 },
    { name: "小笼包", category: "主食", basePrice: 32 },
    { name: "扬州炒饭", category: "主食", basePrice: 35 },
    { name: "葱油拌面", category: "主食", basePrice: 28 },
    { name: "蛋炒饭", category: "主食", basePrice: 25 },
    { name: "珍珠奶茶", category: "饮品", basePrice: 22 },
    { name: "酸梅汤", category: "饮品", basePrice: 18 },
    { name: "柠檬水", category: "饮品", basePrice: 15 },
    { name: "鲜榨橙汁", category: "饮品", basePrice: 28 },
    { name: "绿豆糕", category: "甜品", basePrice: 18 },
    { name: "桂花糕", category: "甜品", basePrice: 22 },
    { name: "红豆糕", category: "甜品", basePrice: 20 },
    { name: "杨枝甘露", category: "甜品", basePrice: 32 },
    { name: "茅台", category: "酒水", basePrice: 188 },
    { name: "啤酒", category: "酒水", basePrice: 18 },
    { name: "红酒", category: "酒水", basePrice: 98 },
    { name: "黄酒", category: "酒水", basePrice: 38 },
  ];

  const menuItems = await MenuCatalogItem.insertMany(
    itemDefs.map((item) => ({
      locationId: "default",
      channelCode: "ALL",
      versionTag: "v1",
      category: item.category,
      name: item.name,
      normalizedName: item.name.toLowerCase(),
      basePrice: item.basePrice,
      status: "ACTIVE",
    }))
  );
  console.log(`  MenuCatalogItems: ${menuItems.length}`);

  await MenuVersion.create({
    locationId: "default",
    versionTag: "v1",
    status: "PUBLISHED",
    effectiveFrom: new Date(),
    publishedAt: new Date(),
    notes: "中餐正餐演示菜单 v1",
  });

  return { categoriesCount: cats.length, itemsCount: menuItems.length };
};

// 2026-02-28: 厨房工位、工单、渠道、会员、优惠、设备、现金、结算、自助点餐
const seedKitchenStations = async () => {
  await KitchenStation.deleteMany({});
  const stations = await KitchenStation.insertMany([
    { locationId: "default", code: "COLD", displayName: "凉菜", type: "COLD", displayOrder: 0 },
    { locationId: "default", code: "HOT_LINE", displayName: "热菜", type: "HOT", displayOrder: 1 },
    { locationId: "default", code: "NOODLE", displayName: "面点", type: "HOT", displayOrder: 2 },
    { locationId: "default", code: "BAR", displayName: "酒水", type: "BAR", displayOrder: 3 },
  ]);
  console.log(`  KitchenStations: ${stations.length}`);
  return stations;
};

const { routeItemToStationCode } = require("../utils/kitchenRouting");

const seedKitchenTickets = async (orders) => {
  await KitchenTicket.deleteMany({});
  let count = 0;
  for (const order of orders) {
    if (order.orderStatus === "Cancelled") continue;
    const ticketItems = order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      stationCode: routeItemToStationCode(item.name),
    }));
    await KitchenTicket.create({
      orderId: order._id,
      locationId: "default",
      sourceType: "POS",
      fulfillmentType: "DINE_IN",
      status: order.orderStatus === "Completed" ? "SERVED" : order.orderStatus === "Ready" ? "READY" : "PREPARING",
      customerName: order.customerDetails?.name,
      table: order.table,
      items: ticketItems,
    });
    count++;
  }
  console.log(`  KitchenTickets: ${count}`);
  return count;
};

const seedChannelData = async (stores) => {
  await StoreChannelConnection.deleteMany({});
  await MarketProfile.deleteMany({});
  await ChannelProvider.deleteMany({});

  const providers = await ChannelProvider.insertMany([
    { providerCode: "ELEME", displayName: "饿了么", channelType: "marketplace", capabilities: { orders: true, menu: true } },
    { providerCode: "MEITUAN", displayName: "美团外卖", channelType: "marketplace", capabilities: { orders: true } },
    { providerCode: "DINE_IN", displayName: "堂食", channelType: "first_party", capabilities: { orders: true } },
  ]);

  const markets = await MarketProfile.insertMany([
    { countryCode: "CN", name: "中国", currency: "CNY", timezone: "Asia/Shanghai" },
    { countryCode: "US", name: "美国", currency: "USD", timezone: "America/New_York" },
  ]);

  const connections = [];
  for (const store of stores) {
    connections.push({
      locationId: store.locationId,
      providerCode: "ELEME",
      externalStoreId: `ext_${store.locationId}`,
      credentialRef: `creds_${store.locationId}`,
      enabled: true,
    });
  }
  await StoreChannelConnection.insertMany(connections);

  console.log(`  ChannelProviders: ${providers.length}, Markets: ${markets.length}, Connections: ${connections.length}`);
  return { providers, markets, connections };
};

const seedMembers = async () => {
  await MemberLedgerEntry.deleteMany({});
  await MemberAccount.deleteMany({});

  // 2026-02-28: 为每位会员添加唯一 email，避免 locationId_1_email_1 唯一索引冲突（多个 null 被视为重复）
  const members = await MemberAccount.insertMany([
    { locationId: "default", memberCode: "M001", name: "张明", phone: "13800001001", email: "m001@demo.local", tier: "GOLD", pointsBalance: 1200, walletBalance: 200 },
    { locationId: "default", memberCode: "M002", name: "李芳", phone: "13800001002", email: "m002@demo.local", tier: "SILVER", pointsBalance: 580 },
    { locationId: "default", memberCode: "M003", name: "王强", phone: "13800001003", email: "m003@demo.local", tier: "BRONZE", pointsBalance: 120 },
    { locationId: "default", memberCode: "M004", name: "陈静", phone: "13800001004", email: "m004@demo.local", tier: "GOLD", pointsBalance: 2500, walletBalance: 500 },
    { locationId: "default", memberCode: "M005", name: "刘洋", phone: "13800001005", email: "m005@demo.local", tier: "PLATINUM", pointsBalance: 5000, walletBalance: 1000 },
  ]);

  const memberIds = members.map((m) => m._id);
  const ledgerEntries = [];
  for (let i = 0; i < 12; i++) {
    ledgerEntries.push({
      memberId: memberIds[i % 5],
      locationId: "default",
      type: i % 3 === 0 ? "POINT_EARN" : i % 3 === 1 ? "WALLET_TOPUP" : "POINT_REDEEM",
      pointsDelta: i % 3 === 0 ? 100 : i % 3 === 2 ? -50 : 0,
      walletDelta: i % 3 === 1 ? 100 : 0,
      reason: "演示数据",
    });
  }
  await MemberLedgerEntry.insertMany(ledgerEntries);

  console.log(`  MemberAccounts: ${members.length}, LedgerEntries: ${ledgerEntries.length}`);
  return members;
};

const seedPromotions = async () => {
  await PromotionCoupon.deleteMany({});
  await PromotionRule.deleteMany({});

  const rules = await PromotionRule.insertMany([
    { locationId: "default", code: "FULL100", name: "满100减15", discountType: "FIXED", discountValue: 15, minOrderAmount: 100 },
    { locationId: "default", code: "NEW10", name: "新客9折", discountType: "PERCENT", discountValue: 10, minOrderAmount: 50 },
    { locationId: "default", code: "VIP20", name: "会员专属满200减30", discountType: "FIXED", discountValue: 30, minOrderAmount: 200 },
  ]);

  const ruleId = rules[0]._id;
  const coupons = await PromotionCoupon.insertMany([
    { code: "DEMO15", promotionId: ruleId, status: "ACTIVE", usageLimit: 10 },
    { code: "WELCOME10", promotionId: ruleId, status: "ACTIVE", usageLimit: 5 },
  ]);

  console.log(`  PromotionRules: ${rules.length}, Coupons: ${coupons.length}`);
  return { rules, coupons };
};

// 2026-02-28T12:10:00+08:00: PRD 7.22 - 确保 default location 有 vertical profile（POS 单店场景）
const seedStoreProfiles = async (stores) => {
  await StoreVerticalProfile.deleteMany({});
  const profileList = stores.map((s) => ({
    locationId: s.locationId,
    countryCode: "US",
    templateCode: "WESTERN_DINING",
    profileStatus: "ACTIVE",
    overrides: {},
  }));
  if (!profileList.some((p) => p.locationId === "default")) {
    profileList.push({
      locationId: "default",
      countryCode: "US",
      templateCode: "WESTERN_DINING",
      profileStatus: "ACTIVE",
      overrides: {},
    });
  }
  const profiles = await StoreVerticalProfile.insertMany(profileList);
  console.log(`  StoreVerticalProfiles: ${profiles.length}`);
  return profiles;
};

const seedDevices = async () => {
  await DeviceRegistration.deleteMany({});
  const devices = await DeviceRegistration.insertMany([
    { deviceCode: "KDS-001", locationId: "default", deviceType: "KDS", status: "ONLINE" },
    { deviceCode: "PRINTER-001", locationId: "default", deviceType: "PRINTER", status: "ONLINE" },
    { deviceCode: "PRINTER-002", locationId: "default", deviceType: "PRINTER", status: "ONLINE" },
  ]);
  console.log(`  DeviceRegistrations: ${devices.length}`);
  return devices;
};

const seedCashData = async (users) => {
  await CashMovement.deleteMany({});
  await CashShift.deleteMany({});
  const cashier = users.find((u) => u.role === "Cashier");

  const shifts = await CashShift.insertMany([
    { locationId: "default", status: "CLOSED", openingFloat: 500, cashSalesTotal: 3200, openedBy: cashier._id, closedBy: cashier._id, closedAt: new Date() },
    { locationId: "default", status: "OPEN", openingFloat: 500, cashSalesTotal: 0, openedBy: cashier._id },
  ]);

  await CashMovement.insertMany([
    { shiftId: shifts[0]._id, locationId: "default", type: "SALE", direction: "IN", amount: 150, reason: "订单收款" },
    { shiftId: shifts[0]._id, locationId: "default", type: "SALE", direction: "IN", amount: 280, reason: "订单收款" },
  ]);

  console.log(`  CashShifts: ${shifts.length}`);
  return shifts;
};

const seedSettlements = async () => {
  await SettlementBatch.deleteMany({});
  const now = new Date();
  const yesterday = new Date(now.getTime() - 864e5);
  const batches = await SettlementBatch.insertMany([
    { locationId: "default", startAt: yesterday, endAt: now, status: "GENERATED", metrics: { grossSales: 15800, paymentCount: 28 } },
    { locationId: "default", startAt: new Date(yesterday.getTime() - 864e5), endAt: yesterday, status: "GENERATED", metrics: { grossSales: 12200, paymentCount: 22 } },
  ]);
  console.log(`  SettlementBatches: ${batches.length}`);
  return batches;
};

const seedTableQrSessions = async (tables) => {
  await TableQrSession.deleteMany({});
  const tableList = Array.from(tables.values());
  const sessions = await TableQrSession.insertMany(
    tableList.slice(0, 3).map((t) => ({
      tableId: t._id,
      locationId: "default",
      token: `qr_${t.tableNo}_${Date.now()}`,
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 864e5),
    }))
  );
  console.log(`  TableQrSessions: ${sessions.length}`);
  return sessions;
};

// 2026-02-28 12:00:00: reset - 先删子表/关联表，再删主表
const resetCollections = async () => {
  await CashMovement.deleteMany({});
  await CashShift.deleteMany({});
  await SettlementBatch.deleteMany({});
  await TableQrSession.deleteMany({});
  await KitchenTicket.deleteMany({});
  await KitchenStation.deleteMany({});
  await MemberLedgerEntry.deleteMany({});
  await MemberAccount.deleteMany({});
  await PromotionCoupon.deleteMany({});
  await PromotionRule.deleteMany({});
  await StoreChannelConnection.deleteMany({});
  await MarketProfile.deleteMany({});
  await ChannelProvider.deleteMany({});
  await DeviceRegistration.deleteMany({});
  await MenuVersion.deleteMany({});
  await MenuCatalogItem.deleteMany({});
  await MenuCategory.deleteMany({});
  await WorkforceShift.deleteMany({});
  await Store.deleteMany({});
  await Region.deleteMany({});
  await Organization.deleteMany({});
  await StoreVerticalProfile.deleteMany({});
  await StoreHardwareProfile.deleteMany({});
  await DeveloperApiUsage.deleteMany({});
  await DeveloperApiKey.deleteMany({});
  await Payment.deleteMany({});
  await Order.deleteMany({});
  await Table.deleteMany({});
  await WageRule.deleteMany({});
  await WorkHourRecord.deleteMany({});
  await ScheduleSlot.deleteMany({});
  await LeaveRequest.deleteMany({});
  await EmployeeWorkScope.deleteMany({});
  await EmployeeProfile.deleteMany({});
  await ShiftTemplate.deleteMany({});
  await Position.deleteMany({});
  await User.deleteMany({});
};

const printSummary = (result) => {
  console.log("\nSeed completed successfully. 2026-02-28 演示数据（中餐正餐）");
  console.log("Database:", config.databaseURI);
  console.log("Organizations:", result.organizationsCount);
  console.log("Regions:", result.regionsCount);
  console.log("Stores:", result.storesCount);
  console.log("Users:", result.users.length);
  console.log("Workforce Shifts:", result.workforceShiftsCount);
  console.log("Tables:", result.tablesCount);
  console.log("Orders:", result.orders.length);
  console.log("Payments:", result.payments.length);
  console.log("Partner API Keys:", result.partnerKeys.length);
  console.log("Menu Categories:", result.menuCategoriesCount);
  console.log("Menu Items:", result.menuItemsCount);
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
    // 2026-02-28: 支持 MONGODB_SEED_URI 单独指定 seed 用库（便于本地 seed 不修改 .env）
    const uri = process.env.MONGODB_SEED_URI || config.databaseURI;
    const normalizedUri = await resolveMongoUri(uri);
    console.log("Resolved Mongo URI scheme:", normalizedUri.split("://")[0], uri.includes("localhost") ? "(local)" : "");
    await mongoose.connect(normalizedUri);
    console.log("Connected for seeding.");
    await resetCollections();

    const users = await seedUsers();
    await seedPositionsAndShiftTemplates();
    const org = await seedOrganization();
    const regions = await seedRegions(org._id);
    const stores = await seedStores(org._id, regions);
    const tableByNo = await seedTables();
    // 2026-02-28 12:01:00: 菜单必须在订单前，calculateOrderSummaryFromCatalog 依赖 MenuCatalogItem
    const menuSeed = await seedMenuData();
    const { orders, payments } = await seedOrdersAndPayments(tableByNo);
    const { keys: partnerKeys, plainKeys: partnerPlainKeys } = await seedPartnerApiKeys({
      createdBy: users[0]?._id
    });
    const workforceShifts = await seedWorkforceShifts(users, stores, users[0]?._id);
    // 2026-02-28 12:02:00: 厨房、渠道、会员、优惠、设备、现金、结算、自助点餐
    await seedKitchenStations();
    await seedKitchenTickets(orders);
    await seedChannelData(stores);
    await seedMembers();
    await seedPromotions();
    await seedStoreProfiles(stores);
    await seedDevices();
    await seedCashData(users);
    await seedSettlements();
    await seedTableQrSessions(tableByNo);

    printSummary({
      users,
      organizationsCount: 1,
      regionsCount: regions.length,
      storesCount: stores.length,
      workforceShiftsCount: workforceShifts.length,
      tablesCount: tableByNo.size,
      orders,
      payments,
      partnerKeys,
      partnerPlainKeys,
      menuCategoriesCount: menuSeed.categoriesCount,
      menuItemsCount: menuSeed.itemsCount,
    });
  } catch (error) {
    console.error("Seed failed:", error.message || error);

    // 2026-02-28: Atlas 认证失败时输出排查指引
    const isAtlasAuth = error.code === 8000 || (error.codeName === "AtlasError" && /auth|authentication/i.test(String(error.message || "")));
    if (isAtlasAuth) {
      console.error("\n--- MongoDB Atlas 认证失败排查 ---");
      console.error("1. 密码含特殊字符(@/:#!%等) 需 URL 编码，例：@ → %40, : → %3A");
      console.error("2. 使用本地 MongoDB：MONGODB_URI=mongodb://localhost:27017/pos-db node scripts/seed.js");
      console.error("3. 或使用 npm run seed:local（需本地已启动 MongoDB）");
      console.error("4. 检查 Atlas 控制台：Database Access 用户权限、Network Access IP 白名单");
    }

    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

run();
