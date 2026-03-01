import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";
import { Home, Auth, Orders, Tables, Menu, More, TableLayout, CashierStation, HandheldPos, KioskOrder, QrTableOrder, OnlineOrder, OnlineOrderStatus, QueueTakeNumber, QueueDisplay, QueueManage } from "./pages";
import { MemberCenter, MemberLogin } from "./pages/member";
import {
  Overview,
  OrdersPage,
  PaymentsPage,
  KitchenPage,
  OpsPage,
  SLOPage,
  ChannelsPage,
  HardwarePage,
  TemplatesPage,
  StoresPage,
  TeamPage,
  TeamSchedulePage,
  TeamLeavePage,
  TeamWorkHoursPage,
  TeamWagePage,
  SettingsPage,
  AuditPage,
} from "./pages/admin";
import {
  PaymentLedgerPage,
  PaymentRefundsPage,
  PaymentReconciliationPage,
  ChannelConfigWizardPage,
  ChannelOrdersPage,
  KitchenStationsPage,
  KitchenTicketsPage,
  KitchenReplayPage,
  ChannelProvidersPage,
  ChannelMarketsPage,
  ChannelConnectionsPage,
  ChannelMappingsPage,
  MenuItemsPage,
  MenuVersionsPage,
  MenuCategoriesPage,
  BrandLogoPage,
  BrandReceiptPage,
  BrandSignagePage,
  BrandAdsPage,
  PromotionRulesPage,
  PromotionCouponsPage,
  CampaignListPage,
} from "./pages/dashboard/index.js";
import Header from "./components/shared/Header";
import NotFound from "./components/shared/NotFound";
import AdminLayout from "./layouts/AdminLayout";
import { useSelector } from "react-redux";
import useLoadData from "./hooks/useLoadData";
import FullScreenLoader from "./components/shared/FullScreenLoader";
import { VerticalProfileProvider } from "./contexts/VerticalProfileContext";

const normalizeRole = (role) => `${role || ""}`.trim().toLowerCase();

function Layout() {
  const isLoading = useLoadData();
  const location = useLocation();
  // 2026-02-28T18:45:00+08:00 Phase B - Kiosk/QR 无 header
  const hideHeaderRoutes = ["/auth", "/kiosk", "/member", "/queue"];
  const isPublicOrder = location.pathname.startsWith("/order");
  const isDashboard = location.pathname.startsWith("/dashboard");
  const { isAuth } = useSelector(state => state.user);

  if (isLoading) return <FullScreenLoader />;

  return (
    <VerticalProfileProvider>
      <>
        {!hideHeaderRoutes.includes(location.pathname) && !isDashboard && !isPublicOrder && <Header />}
        <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoutes>
              <Home />
            </ProtectedRoutes>
          }
        />
        <Route path="/auth" element={isAuth ? <Navigate to="/" /> : <Auth />} />
        {/* 2026-02-28T16:40:00+08:00 Phase C 在线订餐 + 排队叫号 - 公开路由 */}
        <Route path="/order" element={<OnlineOrder />} />
        <Route path="/order/status/:orderId" element={<OnlineOrderStatus />} />
        <Route path="/queue" element={<QueueTakeNumber />} />
        <Route path="/queue/display" element={<QueueDisplay />} />
        <Route
          path="/queue/manage"
          element={
            <ProtectedRoutes>
              <QueueManage />
            </ProtectedRoutes>
          }
        />
        {/* 2026-02-28T18:26:00+08:00 Phase D1 会员端 H5 公开路由 */}
        <Route path="/member" element={<MemberCenter />} />
        <Route path="/member/login" element={<MemberLogin />} />
        <Route
          path="/orders"
          element={
            <ProtectedRoutes>
              <Orders />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/tables"
          element={
            <ProtectedRoutes>
              <Tables />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/menu"
          element={
            <ProtectedRoutes>
              <Menu />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoutes>
              <RoleProtectedRoute allowedRoles={["Admin"]}>
                <AdminLayout />
              </RoleProtectedRoute>
            </ProtectedRoutes>
          }
        >
          <Route index element={<Navigate to="/dashboard/overview" replace />} />
          <Route path="overview" element={<Overview />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="payments/ledger" element={<PaymentLedgerPage />} />
          <Route path="payments/refunds" element={<PaymentRefundsPage />} />
          <Route path="payments/reconciliation" element={<PaymentReconciliationPage />} />
          <Route path="kitchen" element={<KitchenPage />} />
          <Route path="kitchen/stations" element={<KitchenStationsPage />} />
          <Route path="kitchen/tickets" element={<KitchenTicketsPage />} />
          <Route path="kitchen/replay" element={<KitchenReplayPage />} />
          <Route path="menu/items" element={<MenuItemsPage />} />
          <Route path="menu/categories" element={<MenuCategoriesPage />} />
          <Route path="menu/versions" element={<MenuVersionsPage />} />
          <Route path="ops" element={<OpsPage />} />
          <Route path="slo" element={<SLOPage />} />
          <Route path="channels" element={<ChannelsPage />} />
          <Route path="channels/wizard" element={<ChannelConfigWizardPage />} />
          <Route path="channels/orders" element={<ChannelOrdersPage />} />
          <Route path="channels/providers" element={<ChannelProvidersPage />} />
          <Route path="channels/markets" element={<ChannelMarketsPage />} />
          <Route path="channels/connections" element={<ChannelConnectionsPage />} />
          <Route path="channels/mappings" element={<ChannelMappingsPage />} />
          <Route path="hardware" element={<HardwarePage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="brand/logo" element={<BrandLogoPage />} />
          <Route path="brand/receipt" element={<BrandReceiptPage />} />
          <Route path="brand/signage" element={<BrandSignagePage />} />
          <Route path="brand/ads" element={<BrandAdsPage />} />
          <Route path="promotions/rules" element={<PromotionRulesPage />} />
          <Route path="promotions/coupons" element={<PromotionCouponsPage />} />
          <Route path="campaigns" element={<CampaignListPage />} />
          <Route path="stores" element={<StoresPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="team/schedule" element={<TeamSchedulePage />} />
          <Route path="team/leave" element={<TeamLeavePage />} />
          <Route path="team/work-hours" element={<TeamWorkHoursPage />} />
          <Route path="team/wage" element={<TeamWagePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="audit" element={<AuditPage />} />
        </Route>
        <Route
          path="/cashier"
          element={
            <ProtectedRoutes>
              <CashierStation />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/handheld"
          element={
            <ProtectedRoutes>
              <HandheldPos />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/more"
          element={
            <ProtectedRoutes>
              <More />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/tables/layout"
          element={
            <ProtectedRoutes>
              <TableLayout />
            </ProtectedRoutes>
          }
        />
        {/* 2026-02-28T18:47:00+08:00 Phase B - Kiosk / QR 公开路由 */}
        <Route path="/kiosk" element={<KioskOrder />} />
        <Route path="/order/qr" element={<QrTableOrder />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </>
    </VerticalProfileProvider>
  );
}

function ProtectedRoutes({ children }) {
  const { isAuth } = useSelector((state) => state.user);
  if (!isAuth) {
    return <Navigate to="/auth" />;
  }

  return children;
}

function RoleProtectedRoute({ children, allowedRoles }) {
  const { role } = useSelector((state) => state.user);
  const normalizedRole = normalizeRole(role);
  const allowed = Array.isArray(allowedRoles)
    ? allowedRoles.map((item) => normalizeRole(item))
    : [];

  if (!allowed.includes(normalizedRole)) {
    return <Navigate to="/" />;
  }

  return children;
}

function App() {
  return (
    <Router>
      <Layout />
    </Router>
  );
}

export default App;
