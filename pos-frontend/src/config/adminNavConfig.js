/**
 * Admin sidebar navigation config (SaaS-style grouped).
 * 2026-02-24 SaaS admin layout.
 * 2026-02-26: sidebar restructure with sub-menus
 * 2026-02-26: add Table Layout in Organization group
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
  MdMenuBook,
  MdGridOn,
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
      {
        label: "Payments",
        icon: MdPayment,
        children: [
          { label: "Ledger", path: "/dashboard/payments/ledger" },
          { label: "Refund Approvals", path: "/dashboard/payments/refunds" },
          { label: "Reconciliation", path: "/dashboard/payments/reconciliation" },
        ],
      },
      {
        label: "Kitchen",
        icon: MdRestaurant,
        children: [
          { label: "Stations", path: "/dashboard/kitchen/stations" },
          { label: "Tickets", path: "/dashboard/kitchen/tickets" },
          { label: "Event Replay", path: "/dashboard/kitchen/replay" },
        ],
      },
      {
        label: "Menu",
        icon: MdMenuBook,
        children: [
          { label: "Items", path: "/dashboard/menu/items" },
          { label: "Versions", path: "/dashboard/menu/versions" },
        ],
      },
      { label: "Ops", path: "/dashboard/ops", icon: MdSettings },
      { label: "SLO", path: "/dashboard/slo", icon: IoBarChartSharp },
    ],
  },
  {
    groupLabel: "Configuration",
    items: [
      {
        label: "Channels",
        icon: MdStorefront,
        children: [
          { label: "Providers", path: "/dashboard/channels/providers" },
          { label: "Markets", path: "/dashboard/channels/markets" },
          { label: "Connections", path: "/dashboard/channels/connections" },
          { label: "Mapping Rules", path: "/dashboard/channels/mappings" },
        ],
      },
      { label: "Hardware", path: "/dashboard/hardware", icon: MdDevices },
      { label: "Templates", path: "/dashboard/templates", icon: MdStorefront },
    ],
  },
  {
    groupLabel: "Organization",
    items: [
      { label: "Stores", path: "/dashboard/stores", icon: MdStore },
      { label: "Table Layout", path: "/tables/layout", icon: MdGridOn },
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
  ledger: "Ledger",
  refunds: "Refund Approvals",
  reconciliation: "Reconciliation",
  kitchen: "Kitchen",
  stations: "Stations",
  tickets: "Tickets",
  replay: "Event Replay",
  menu: "Menu",
  items: "Items",
  versions: "Versions",
  ops: "Ops",
  slo: "SLO",
  channels: "Channels",
  providers: "Providers",
  markets: "Markets",
  connections: "Connections",
  mappings: "Mapping Rules",
  hardware: "Hardware",
  templates: "Templates",
  stores: "Stores",
  layout: "Table Layout",
  team: "Team",
  settings: "Settings",
  audit: "Activity log",
};
