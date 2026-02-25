/**
 * Admin sidebar navigation config (SaaS-style grouped).
 * 2026-02-24 SaaS admin layout.
 */
import {
  MdDashboard,
  MdOutlineReorder,
  MdPayment,
  MdRestaurant,
  MdSettings,
  MdDevices,
  MdStorefront,
  MdStore,
  MdPeople,
  MdBuild,
  MdHistory,
} from "react-icons/md";
import { IoBarChartSharp } from "react-icons/io5";

export const adminNavConfig = [
  {
    groupLabel: "Overview",
    items: [
      { label: "Overview", path: "/dashboard/overview", icon: MdDashboard },
    ],
  },
  {
    groupLabel: "Operations",
    items: [
      { label: "Orders", path: "/dashboard/orders", icon: MdOutlineReorder },
      { label: "Payments", path: "/dashboard/payments", icon: MdPayment },
      { label: "Kitchen", path: "/dashboard/kitchen", icon: MdRestaurant },
      { label: "Ops", path: "/dashboard/ops", icon: MdSettings },
      { label: "SLO", path: "/dashboard/slo", icon: IoBarChartSharp },
    ],
  },
  {
    groupLabel: "Configuration",
    items: [
      { label: "Channels", path: "/dashboard/channels", icon: MdStorefront },
      { label: "Hardware", path: "/dashboard/hardware", icon: MdDevices },
      { label: "Templates", path: "/dashboard/templates", icon: MdStorefront },
    ],
  },
  {
    groupLabel: "Organization",
    items: [
      { label: "Stores", path: "/dashboard/stores", icon: MdStore },
      { label: "Team", path: "/dashboard/team", icon: MdPeople },
    ],
  },
  {
    groupLabel: "Settings",
    items: [
      { label: "Settings", path: "/dashboard/settings", icon: MdBuild },
    ],
  },
  {
    groupLabel: "Audit",
    items: [
      { label: "Activity log", path: "/dashboard/audit", icon: MdHistory },
    ],
  },
];

/**
 * Path to breadcrumb label map (for top bar).
 */
export const pathSegmentToLabel = {
  dashboard: "Dashboard",
  overview: "Overview",
  orders: "Orders",
  payments: "Payments",
  kitchen: "Kitchen",
  ops: "Ops",
  slo: "SLO",
  channels: "Channels",
  hardware: "Hardware",
  templates: "Templates",
  stores: "Stores",
  team: "Team",
  settings: "Settings",
  audit: "Activity log",
};
