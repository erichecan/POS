import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";
import { Home, Auth, Orders, Tables, Menu, More, TableLayout } from "./pages";
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
  SettingsPage,
  AuditPage,
} from "./pages/admin";
import Header from "./components/shared/Header";
import NotFound from "./components/shared/NotFound";
import AdminLayout from "./layouts/AdminLayout";
import { useSelector } from "react-redux";
import useLoadData from "./hooks/useLoadData";
import FullScreenLoader from "./components/shared/FullScreenLoader";

const normalizeRole = (role) => `${role || ""}`.trim().toLowerCase();

function Layout() {
  const isLoading = useLoadData();
  const location = useLocation();
  const hideHeaderRoutes = ["/auth"];
  const isDashboard = location.pathname.startsWith("/dashboard");
  const { isAuth } = useSelector(state => state.user);

  if(isLoading) return <FullScreenLoader />

  return (
    <>
      {!hideHeaderRoutes.includes(location.pathname) && !isDashboard && <Header />}
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
          <Route path="kitchen" element={<KitchenPage />} />
          <Route path="ops" element={<OpsPage />} />
          <Route path="slo" element={<SLOPage />} />
          <Route path="channels" element={<ChannelsPage />} />
          <Route path="hardware" element={<HardwarePage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="stores" element={<StoresPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="audit" element={<AuditPage />} />
        </Route>
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
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
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
