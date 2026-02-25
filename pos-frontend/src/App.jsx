import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";
import { Home, Auth, Orders, Tables, Menu, Dashboard, More, TableLayout } from "./pages";
import Header from "./components/shared/Header";
import { useSelector } from "react-redux";
import useLoadData from "./hooks/useLoadData";
import FullScreenLoader from "./components/shared/FullScreenLoader"

const normalizeRole = (role) => `${role || ""}`.trim().toLowerCase();

function Layout() {
  const isLoading = useLoadData();
  const location = useLocation();
  const hideHeaderRoutes = ["/auth"];
  const { isAuth } = useSelector(state => state.user);

  if(isLoading) return <FullScreenLoader />

  return (
    <>
      {!hideHeaderRoutes.includes(location.pathname) && <Header />}
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
                <Dashboard />
              </RoleProtectedRoute>
            </ProtectedRoutes>
          }
        />
        <Route
          path="/dashboard/channels"
          element={
            <ProtectedRoutes>
              <RoleProtectedRoute allowedRoles={["Admin"]}>
                <Dashboard defaultTab="Channels" />
              </RoleProtectedRoute>
            </ProtectedRoutes>
          }
        />
        <Route
          path="/dashboard/hardware"
          element={
            <ProtectedRoutes>
              <RoleProtectedRoute allowedRoles={["Admin"]}>
                <Dashboard defaultTab="Hardware" />
              </RoleProtectedRoute>
            </ProtectedRoutes>
          }
        />
        <Route
          path="/dashboard/templates"
          element={
            <ProtectedRoutes>
              <RoleProtectedRoute allowedRoles={["Admin"]}>
                <Dashboard defaultTab="Templates" />
              </RoleProtectedRoute>
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
        <Route path="*" element={<div>Not Found</div>} />
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
