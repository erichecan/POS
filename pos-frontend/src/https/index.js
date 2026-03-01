import { axiosWrapper } from "./axiosWrapper";

// API Endpoints

// Auth Endpoints
export const login = (data) => axiosWrapper.post("/api/user/login", data);
export const register = (data) => axiosWrapper.post("/api/user/register", data);
export const getUserData = () => axiosWrapper.get("/api/user");
export const logout = () => axiosWrapper.post("/api/user/logout");

// Table Endpoints
export const addTable = (data) => axiosWrapper.post("/api/table/", data);
export const getTables = () => axiosWrapper.get("/api/table");
export const updateTable = ({ tableId, ...tableData }) =>
  axiosWrapper.put(`/api/table/${tableId}`, tableData);
export const transferTableOrder = (data) =>
  axiosWrapper.post("/api/table/transfer", data);
export const mergeTableOrders = (data) =>
  axiosWrapper.post("/api/table/merge", data);
export const splitTableOrder = (data) =>
  axiosWrapper.post("/api/table/split", data);
export const splitTableOrderBySeat = (data) =>
  axiosWrapper.post("/api/table/split-by-seat", data);
export const unmergeTableOrders = (data) =>
  axiosWrapper.post("/api/table/unmerge", data);

// Payment Endpoints
export const createOrderStripe = (data) =>
  axiosWrapper.post("/api/payment/create-order", data);
export const verifyPaymentStripe = (data) =>
  axiosWrapper.post("/api/payment/verify-payment", data);
export const retryVerifyPaymentStripe = (data) =>
  axiosWrapper.post("/api/payment/retry-verify", data);
export const getPayments = (params) => axiosWrapper.get("/api/payment", { params });
export const getPaymentStats = (params) => axiosWrapper.get("/api/payment/stats", { params });
export const getPaymentReconciliationGaps = (params) =>
  axiosWrapper.get("/api/payment/reconciliation/gaps", { params });
export const repairOrderPaymentLink = (data) =>
  axiosWrapper.post("/api/payment/reconciliation/repair-order", data);
export const refundPayment = (data) => axiosWrapper.post("/api/payment/refunds", data);
export const getRefundApprovals = (params) =>
  axiosWrapper.get("/api/payment/refunds/approvals", { params });
export const approveRefundApproval = ({ approvalId, ...data }) =>
  axiosWrapper.post(`/api/payment/refunds/approvals/${approvalId}/approve`, data);
export const rejectRefundApproval = ({ approvalId, ...data }) =>
  axiosWrapper.post(`/api/payment/refunds/approvals/${approvalId}/reject`, data);

// 2026-02-28T18:35:00+08:00 Phase D2 活动效果 API
export const getPromotionEffects = (params) =>
  axiosWrapper.get("/api/analytics/promotion-effects", { params });

// Order Endpoints
export const addOrder = (data) => axiosWrapper.post("/api/order/", data);
export const getOrders = (params) => axiosWrapper.get("/api/order", { params });
export const updateOrderStatus = ({ orderId, orderStatus }) =>
  axiosWrapper.put(`/api/order/${orderId}`, { orderStatus });
export const updateOrderItems = ({ orderId, ...data }) =>
  axiosWrapper.put(`/api/order/${orderId}/items`, data);
export const settleOrder = ({ orderId, ...data }) =>
  axiosWrapper.post(`/api/order/${orderId}/settle`, data);
export const getReceiptTemplate = (params) =>
  axiosWrapper.get("/api/order/receipt-template", { params });
export const upsertReceiptTemplate = (data) =>
  axiosWrapper.put("/api/order/receipt-template", data);

// 2026-02-28T13:00:00+08:00 PRD 7.23 品牌与触点管理
export const listBrandProfiles = (params) => axiosWrapper.get("/api/brand", { params });
export const getBrandProfile = (locationId) => axiosWrapper.get(`/api/brand/${locationId}`);
export const upsertBrandProfile = ({ locationId, ...data }) =>
  axiosWrapper.put(`/api/brand/${locationId}`, { locationId, ...data });

export const listSignageDevices = (params) => axiosWrapper.get("/api/signage", { params });
export const getSignageDevice = (id) => axiosWrapper.get(`/api/signage/${id}`);
export const createSignageDevice = (data) => axiosWrapper.post("/api/signage", data);
export const updateSignageDevice = ({ id, ...data }) => axiosWrapper.put(`/api/signage/${id}`, data);
export const deleteSignageDevice = (id) => axiosWrapper.delete(`/api/signage/${id}`);

export const listAdMaterials = (params) => axiosWrapper.get("/api/ad-material", { params });
export const getAdMaterial = (id) => axiosWrapper.get(`/api/ad-material/${id}`);
export const createAdMaterial = (data) => axiosWrapper.post("/api/ad-material", data);
export const updateAdMaterial = ({ id, ...data }) => axiosWrapper.put(`/api/ad-material/${id}`, data);
export const deleteAdMaterial = (id) => axiosWrapper.delete(`/api/ad-material/${id}`);

// Promotion Endpoints - PRD 7.11 M11 2026-02-28T16:15:00+08:00
export const listPromotionRules = (params) => axiosWrapper.get("/api/promotion/rules", { params });

// 2026-02-28T18:15:00+08:00 Phase D1 会员端 H5 公开 API（无需员工登录）
export const bindMember = (data) => axiosWrapper.post("/api/public/member/bind", data);
export const getMemberProfile = (memberCode, params) =>
  axiosWrapper.get(`/api/public/member/${encodeURIComponent(memberCode)}/profile`, { params });
export const listMemberOrders = (memberCode, params) =>
  axiosWrapper.get(`/api/public/member/${encodeURIComponent(memberCode)}/orders`, { params });
export const listMemberCoupons = (memberCode, params) =>
  axiosWrapper.get(`/api/public/member/${encodeURIComponent(memberCode)}/coupons`, { params });
export const createPromotionRule = (data) => axiosWrapper.post("/api/promotion/rules", data);
export const listPromotionCoupons = (params) => axiosWrapper.get("/api/promotion/coupons", { params });
export const createPromotionCoupon = (data) => axiosWrapper.post("/api/promotion/coupons", data);
export const previewPromotionApply = (data) => axiosWrapper.post("/api/promotion/apply/preview", data);

// Channel Config Endpoints
export const createChannelProvider = (data) =>
  axiosWrapper.post("/api/channel-config/providers", data);
export const getChannelProviders = (params) =>
  axiosWrapper.get("/api/channel-config/providers", { params });
export const updateChannelProvider = ({ id, ...data }) =>
  axiosWrapper.put(`/api/channel-config/providers/${id}`, data);

export const createMarketProfile = (data) =>
  axiosWrapper.post("/api/channel-config/market-profiles", data);
export const getMarketProfiles = (params) =>
  axiosWrapper.get("/api/channel-config/market-profiles", { params });
export const updateMarketProfile = ({ id, ...data }) =>
  axiosWrapper.put(`/api/channel-config/market-profiles/${id}`, data);

export const createStoreChannelConnection = (data) =>
  axiosWrapper.post("/api/channel-config/store-connections", data);
export const getStoreChannelConnections = (params) =>
  axiosWrapper.get("/api/channel-config/store-connections", { params });
export const updateStoreChannelConnection = ({ id, ...data }) =>
  axiosWrapper.put(`/api/channel-config/store-connections/${id}`, data);

export const createChannelMappingRule = (data) =>
  axiosWrapper.post("/api/channel-config/mapping-rules", data);
export const getChannelMappingRules = (params) =>
  axiosWrapper.get("/api/channel-config/mapping-rules", { params });
export const updateChannelMappingRule = ({ id, ...data }) =>
  axiosWrapper.put(`/api/channel-config/mapping-rules/${id}`, data);

export const ingestChannelOrder = (data) =>
  axiosWrapper.post("/api/channel-config/ingress/orders", data);
export const getChannelDeadLetters = (params) =>
  axiosWrapper.get("/api/channel-config/ingress/dlq", { params });
export const getChannelDeadLetterInsights = (params) =>
  axiosWrapper.get("/api/channel-config/ingress/dlq/insights", { params });
export const replayChannelDeadLetter = ({ id, ...data }) =>
  axiosWrapper.post(`/api/channel-config/ingress/dlq/${id}/replay`, data);
export const discardChannelDeadLetter = ({ id, ...data }) =>
  axiosWrapper.post(`/api/channel-config/ingress/dlq/${id}/discard`, data);

// Inventory Endpoints
export const upsertInventoryItem = (data) =>
  axiosWrapper.post("/api/inventory/items", data);
export const getInventoryItems = (params) =>
  axiosWrapper.get("/api/inventory/items", { params });
export const adjustInventoryItem = ({ id, ...data }) =>
  axiosWrapper.post(`/api/inventory/items/${id}/adjust`, data);
export const bootstrapInventory = (data) =>
  axiosWrapper.post("/api/inventory/bootstrap", data);

// Cash Shift Endpoints
export const openCashShift = (data) => axiosWrapper.post("/api/cash/shifts", data);
export const getCashShifts = (params) => axiosWrapper.get("/api/cash/shifts", { params });
export const getCashShiftById = (id) => axiosWrapper.get(`/api/cash/shifts/${id}`);
export const addCashShiftMovement = ({ id, ...data }) =>
  axiosWrapper.post(`/api/cash/shifts/${id}/movements`, data);
export const closeCashShift = ({ id, ...data }) =>
  axiosWrapper.post(`/api/cash/shifts/${id}/close`, data);

// 2026-02-28: 团队管理 - 岗位
export const getPositions = (params) =>
  axiosWrapper.get("/api/workforce/positions", { params });
export const getPositionById = (id) =>
  axiosWrapper.get(`/api/workforce/positions/${id}`);
export const createPosition = (data) =>
  axiosWrapper.post("/api/workforce/positions", data);
export const updatePosition = ({ id, ...data }) =>
  axiosWrapper.put(`/api/workforce/positions/${id}`, data);
export const deletePosition = (id) =>
  axiosWrapper.delete(`/api/workforce/positions/${id}`);

export const getEmployeesWithScopes = (params) =>
  axiosWrapper.get("/api/workforce/employees", { params });
export const getEmployeeWorkScope = (userId, params) =>
  axiosWrapper.get(`/api/workforce/employees/${userId}/work-scope`, { params });
export const upsertEmployeeWorkScope = (userId, data) =>
  axiosWrapper.put(`/api/workforce/employees/${userId}/work-scope`, data);

export const getShiftTemplates = (params) =>
  axiosWrapper.get("/api/workforce/shift-templates", { params });
export const createShiftTemplate = (data) =>
  axiosWrapper.post("/api/workforce/shift-templates", data);
export const updateShiftTemplate = ({ id, ...data }) =>
  axiosWrapper.put(`/api/workforce/shift-templates/${id}`, data);
export const deleteShiftTemplate = (id) =>
  axiosWrapper.delete(`/api/workforce/shift-templates/${id}`);

export const getScheduleSlots = (params) =>
  axiosWrapper.get("/api/workforce/schedule", { params });
export const createScheduleSlot = (data) =>
  axiosWrapper.post("/api/workforce/schedule", data);
export const bulkCreateScheduleSlots = (data) =>
  axiosWrapper.post("/api/workforce/schedule/bulk", data);
export const updateScheduleSlot = ({ id, ...data }) =>
  axiosWrapper.put(`/api/workforce/schedule/${id}`, data);
export const deleteScheduleSlot = (id) =>
  axiosWrapper.delete(`/api/workforce/schedule/${id}`);

export const getLeaveRequests = (params) =>
  axiosWrapper.get("/api/workforce/leave", { params });
export const createLeaveRequest = (data) =>
  axiosWrapper.post("/api/workforce/leave", data);
export const approveLeaveRequest = (id, data) =>
  axiosWrapper.post(`/api/workforce/leave/${id}/approve`, data);

export const getWorkHourRecords = (params) =>
  axiosWrapper.get("/api/workforce/work-hours", { params });
export const upsertWorkHourRecord = (data) =>
  axiosWrapper.post("/api/workforce/work-hours", data);
export const clockIn = (data) =>
  axiosWrapper.post("/api/workforce/work-hours/clock-in", data);
export const clockOut = (data) =>
  axiosWrapper.post("/api/workforce/work-hours/clock-out", data);

export const getWageRules = (params) =>
  axiosWrapper.get("/api/workforce/wage/rules", { params });
export const createWageRule = (data) =>
  axiosWrapper.post("/api/workforce/wage/rules", data);
export const calculateWage = (data) =>
  axiosWrapper.post("/api/workforce/wage/calculate", data);

// Kitchen Endpoints
export const bootstrapKitchenStations = (data) =>
  axiosWrapper.post("/api/kitchen/stations/bootstrap", data);
export const upsertKitchenStation = (data) =>
  axiosWrapper.post("/api/kitchen/stations", data);
export const getKitchenStations = (params) =>
  axiosWrapper.get("/api/kitchen/stations", { params });
export const getKitchenTickets = (params) =>
  axiosWrapper.get("/api/kitchen/tickets", { params });
export const getKitchenReplayEvents = (params) =>
  axiosWrapper.get("/api/kitchen/events/replay", { params });
export const getKitchenStats = (params) =>
  axiosWrapper.get("/api/kitchen/stats", { params });
export const updateKitchenTicketStatus = ({ id, ...data }) =>
  axiosWrapper.post(`/api/kitchen/tickets/${id}/status`, data);
export const updateKitchenTicketPriority = ({ id, ...data }) =>
  axiosWrapper.post(`/api/kitchen/tickets/${id}/priority`, data);
export const updateKitchenTicketItemStatus = ({ id, itemId, ...data }) =>
  axiosWrapper.post(`/api/kitchen/tickets/${id}/items/${itemId}/status`, data);
export const expediteKitchenTicket = ({ id, ...data }) =>
  axiosWrapper.post(`/api/kitchen/tickets/${id}/expedite`, data);
export const handoffKitchenTicket = ({ id, ...data }) =>
  axiosWrapper.post(`/api/kitchen/tickets/${id}/handoff`, data);

// Ops / SLO Endpoints
export const getOpsSloSnapshot = (params) =>
  axiosWrapper.get("/api/ops/slo", { params });
export const runOpsEscalationSweep = (data) =>
  axiosWrapper.post("/api/ops/escalations/run", data);
export const getOpsIncidents = (params) =>
  axiosWrapper.get("/api/ops/incidents", { params });
export const acknowledgeOpsIncident = ({ id, ...data }) =>
  axiosWrapper.post(`/api/ops/incidents/${id}/ack`, data);
export const resolveOpsIncident = ({ id, ...data }) =>
  axiosWrapper.post(`/api/ops/incidents/${id}/resolve`, data);

// Device / Hardware Endpoints
export const registerDevice = (data) => axiosWrapper.post("/api/device", data);
export const getDevices = (params) => axiosWrapper.get("/api/device", { params });
export const heartbeatDevice = ({ id, ...data }) =>
  axiosWrapper.post(`/api/device/${id}/heartbeat`, data);
export const getHardwareCatalog = (params) => axiosWrapper.get("/api/device/catalog", { params });
export const getStoreHardwareProfiles = (params) =>
  axiosWrapper.get("/api/device/profiles", { params });
export const getStoreHardwareProfile = (locationId) =>
  axiosWrapper.get(`/api/device/profiles/${locationId}`);
export const upsertStoreHardwareProfile = ({ locationId, ...data }) =>
  axiosWrapper.put(`/api/device/profiles/${locationId}`, data);

// Vertical Template Endpoints
export const getVerticalTemplateCatalog = (params) =>
  axiosWrapper.get("/api/organization/vertical-templates/catalog", { params });
export const getStoreVerticalProfiles = (params) =>
  axiosWrapper.get("/api/organization/vertical-templates/profiles", { params });
export const getStoreVerticalProfile = (locationId, params) =>
  axiosWrapper.get(`/api/organization/vertical-templates/profiles/${locationId}`, { params });
export const upsertStoreVerticalProfile = ({ locationId, ...data }) =>
  axiosWrapper.put(`/api/organization/vertical-templates/profiles/${locationId}`, data);

// Organization Endpoints - 2026-02-28T14:00:00+08:00 settings-general-chain
export const listOrganizations = (params) =>
  axiosWrapper.get("/api/organization/orgs", { params });
export const updateOrganization = ({ id, ...data }) =>
  axiosWrapper.patch(`/api/organization/orgs/${id}`, data);
export const listRegions = (params) =>
  axiosWrapper.get("/api/organization/regions", { params });
export const updateRegion = ({ id, ...data }) =>
  axiosWrapper.patch(`/api/organization/regions/${id}`, data);
export const listStores = (params) =>
  axiosWrapper.get("/api/organization/stores", { params });
export const createOrganizationStore = (data) =>
  axiosWrapper.post("/api/organization/stores", data);
export const updateStore = ({ id, ...data }) =>
  axiosWrapper.patch(`/api/organization/stores/${id}`, data);
export const getResolvedStoreSettings = (storeId) =>
  axiosWrapper.get(`/api/organization/stores/${storeId}/resolved-settings`);

// 2026-02-28T16:30:00+08:00 Phase E2.2 菜单同步状态
export const getMenuSyncStatusSummary = (params) =>
  axiosWrapper.get("/api/menu/sync-status", { params });

// 2026-02-28T15:35:00+08:00 Phase E1.2 Handheld - resolve table by QR token
export const resolveTableByToken = (token) =>
  axiosWrapper.get(`/api/self-order/staff/resolve-table/${encodeURIComponent(token)}`);

// Till Rules - PRD 7.24 M22 2026-02-28T15:00:00+08:00
export const getTillRules = (locationId) =>
  axiosWrapper.get(`/api/till-rules/${locationId || "default"}`);
export const upsertTillRules = ({ locationId = "default", ...data }) =>
  axiosWrapper.put(`/api/till-rules/${locationId}`, { locationId, ...data });
export const previewStoreProvisioning = (data) =>
  axiosWrapper.post("/api/organization/stores/provisioning-preview", data);

// 2026-02-28T18:35:00+08:00 Phase B - Self-Order / Kiosk / QR Table
export const generateTableQrSession = (data) =>
  axiosWrapper.post("/api/self-order/sessions", data);
export const getKioskMenu = (params) =>
  axiosWrapper.get("/api/self-order/public/menu/kiosk", { params });
export const getPublicMenuByToken = (token) =>
  axiosWrapper.get(`/api/self-order/public/menu/${token}`);
export const createKioskOrder = (data) =>
  axiosWrapper.post("/api/self-order/public/kiosk/orders", data);
export const createSelfOrderByToken = (data) =>
  axiosWrapper.post("/api/self-order/public/orders", data);

// 2026-02-28T16:20:00+08:00 Phase C1 在线订餐 - 公开 API
export const getPublicMenu = (params) =>
  axiosWrapper.get("/api/public/menu", { params });
export const createPublicOrder = (data) =>
  axiosWrapper.post("/api/public/orders", data);
export const getPublicOrderStatus = (orderId) =>
  axiosWrapper.get(`/api/public/orders/${orderId}/status`);
export const createPublicPaymentCheckout = (data) =>
  axiosWrapper.post("/api/public/payment/create-checkout", data);
export const verifyPublicPayment = (data) =>
  axiosWrapper.post("/api/public/payment/verify", data);

// 2026-02-28T16:21:00+08:00 Phase C2 排队叫号
export const takeQueueNumber = (data) =>
  axiosWrapper.post("/api/queue/tickets", data);
export const getQueueDisplay = (params) =>
  axiosWrapper.get("/api/queue/display", { params });
export const getQueueTickets = (params) =>
  axiosWrapper.get("/api/queue/tickets", { params });
export const updateQueueTicket = ({ id, ...data }) =>
  axiosWrapper.patch(`/api/queue/tickets/${id}`, data);
