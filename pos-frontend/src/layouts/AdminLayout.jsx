/**
 * Admin Shell: sidebar + top bar + main content. SaaS-style backend layout.
 * 2026-02-24
 * 2026-02-26: support two-level (sub-item) menus
 */
import React, { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate, NavLink } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useMutation } from "@tanstack/react-query";
import { IoLogOut } from "react-icons/io5";
import { FaUserCircle } from "react-icons/fa";
import { logout } from "../https";
import { removeUser } from "../redux/slices/userSlice";
import { adminNavConfig, pathSegmentToLabel } from "../config/adminNavConfig";

const SIDEBAR_COLLAPSED_KEY = "pos-admin-sidebar-collapsed";

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const userData = useSelector((state) => state.user);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });
  // 2026-02-26: support two-level sidebar navigation
  const [expandedKeys, setExpandedKeys] = useState(new Set());

  const toggleExpanded = (key) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    document.title = "POS | Admin Dashboard";
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
    } catch (_) {}
  }, [sidebarCollapsed]);

  const logoutMutation = useMutation({
    mutationFn: () => logout(),
    onSuccess: () => {
      dispatch(removeUser());
      navigate("/auth");
    },
  });

  const pathSegments = location.pathname.split("/").filter(Boolean);
  const breadcrumbs = pathSegments.map((seg) => pathSegmentToLabel[seg] || seg);

  return (
    <div className="flex h-screen bg-[#1a1a1a] text-[#f5f5f5]">
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-[#333] bg-[#1f1f1f] transition-[width] duration-200 ${
          sidebarCollapsed ? "w-[4rem]" : "w-56"
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-[#333] px-3">
          {!sidebarCollapsed && (
            <span className="text-sm font-semibold text-[#ababab]">Admin</span>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            className="rounded p-1.5 text-[#ababab] hover:bg-[#333] hover:text-[#f5f5f5]"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg
              className={`h-5 w-5 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>
        {/* 2026-02-26: support two-level sidebar navigation */}
        <nav className="flex-1 overflow-y-auto py-3">
          {adminNavConfig.map((group) => (
            <div key={group.groupLabel} className="mb-4">
              {!sidebarCollapsed && (
                <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-[#6b6b6b]">
                  {group.groupLabel}
                </div>
              )}
              {group.items.map((item) => {
                const itemKey = `${group.groupLabel}-${item.label}`;
                const hasChildren = item.children && item.children.length > 0;
                const hasActiveChild =
                  hasChildren &&
                  item.children.some(
                    (c) =>
                      location.pathname === c.path ||
                      location.pathname.startsWith(c.path + "/")
                  );
                const isExpanded = expandedKeys.has(itemKey) || hasActiveChild;

                if (hasChildren) {
                  return (
                    <div key={itemKey}>
                      <button
                        type="button"
                        onClick={() => toggleExpanded(itemKey)}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-sm transition-colors border-l-2 ${
                          hasActiveChild
                            ? "border-[#f5f5f5] bg-[#262626] text-[#f5f5f5]"
                            : "border-transparent text-[#ababab] hover:bg-[#262626] hover:text-[#f5f5f5]"
                        }`}
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        {!sidebarCollapsed && (
                          <>
                            <span className="flex-1 text-left">{item.label}</span>
                            <span className="text-xs shrink-0">
                              {isExpanded ? "▼" : "▶"}
                            </span>
                          </>
                        )}
                      </button>
                      {!sidebarCollapsed && isExpanded && (
                        <div className="pl-8">
                          {item.children.map((child) => (
                            <NavLink
                              key={child.path}
                              to={child.path}
                              className={({ isActive }) =>
                                `flex items-center gap-2 py-2 pl-2 text-xs transition-colors border-l-2 ${
                                  isActive
                                    ? "border-[#f5f5f5] bg-[#262626] text-[#f5f5f5]"
                                    : "border-transparent text-[#ababab] hover:bg-[#262626] hover:text-[#f5f5f5]"
                                }`
                              }
                            >
                              {child.label}
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                        isActive
                          ? "border-l-2 border-[#f5f5f5] bg-[#262626] text-[#f5f5f5]"
                          : "border-l-2 border-transparent text-[#ababab] hover:bg-[#262626] hover:text-[#f5f5f5]"
                      }`
                    }
                    end
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        {!sidebarCollapsed && userData?.name && (
          <div className="border-t border-[#333] px-3 py-2 text-xs text-[#6b6b6b]">
            {userData.name} · {userData.role || "Admin"}
          </div>
        )}
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar: breadcrumb + Back to POS + user + logout */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[#333] bg-[#1f1f1f] px-4">
          <div className="flex items-center gap-3 min-w-0">
            <nav className="flex items-center gap-2 text-sm text-[#ababab]">
              {breadcrumbs.map((label, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 && <span className="text-[#555]">/</span>}
                  <span className={i === breadcrumbs.length - 1 ? "text-[#f5f5f5]" : ""}>
                    {label}
                  </span>
                </span>
              ))}
            </nav>
            <a
              href="/"
              className="shrink-0 text-sm text-[#ababab] hover:text-[#f5f5f5]"
            >
              Back to POS
            </a>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <FaUserCircle className="text-2xl text-[#ababab]" />
            <span className="hidden md:inline text-sm text-[#ababab]">{userData?.name}</span>
            <button
              type="button"
              onClick={() => logoutMutation.mutate()}
              className="rounded p-2 text-[#ababab] hover:bg-[#333] hover:text-[#f5f5f5]"
              aria-label="Logout"
            >
              <IoLogOut size={20} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#1f1f1f]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
