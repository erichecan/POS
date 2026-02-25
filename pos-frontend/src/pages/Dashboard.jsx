import React, { useState, useEffect } from "react";
import { MdTableBar, MdCategory } from "react-icons/md";
import { BiSolidDish } from "react-icons/bi";
import Metrics from "../components/dashboard/Metrics";
import RecentOrders from "../components/dashboard/RecentOrders";
import Modal from "../components/dashboard/Modal";
import ChannelConfig from "../components/dashboard/ChannelConfig";
import OperationsCenter from "../components/dashboard/OperationsCenter";
import KitchenBoard from "../components/dashboard/KitchenBoard";
import PaymentsCenter from "../components/dashboard/PaymentsCenter";
import SLOCenter from "../components/dashboard/SLOCenter";
import HardwareCenter from "../components/dashboard/HardwareCenter";
import VerticalTemplateCenter from "../components/dashboard/VerticalTemplateCenter";
import { useLocation } from "react-router-dom";

const buttons = [
  { label: "Add Table", icon: <MdTableBar />, action: "table" },
  { label: "Add Category", icon: <MdCategory />, action: "category" },
  { label: "Add Dishes", icon: <BiSolidDish />, action: "dishes" },
];

const tabs = [
  "Metrics",
  "Orders",
  "Payments",
  "Kitchen",
  "Channels",
  "Hardware",
  "Templates",
  "Ops",
  "SLO",
];

const normalizeTab = (value, fallback = "Metrics") => {
  const normalized = `${value || ""}`.trim().toLowerCase();
  const matched = tabs.find((tab) => tab.toLowerCase() === normalized);
  return matched || fallback;
};

const Dashboard = ({ defaultTab = "Metrics" }) => {
  const location = useLocation();
  const resolvedDefaultTab = normalizeTab(defaultTab);

  useEffect(() => {
    document.title = "POS | Admin Dashboard"
  }, [])

  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(resolvedDefaultTab);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabFromQuery = params.get("tab");
    setActiveTab(normalizeTab(tabFromQuery, resolvedDefaultTab));
  }, [location.search, resolvedDefaultTab]);

  const handleOpenModal = (action) => {
    if (action === "table") setIsTableModalOpen(true);
  };

  return (
    <div className="bg-[#1f1f1f] h-[calc(100vh-5rem)] overflow-y-auto">
      <div className="container mx-auto flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between py-6 md:py-8 px-6 md:px-4">
        <div className="flex flex-wrap items-center gap-3">
          {buttons.map(({ label, icon, action }) => {
            return (
              <button
                key={action}
                onClick={() => handleOpenModal(action)}
                className="bg-[#1a1a1a] hover:bg-[#262626] px-8 py-3 rounded-lg text-[#f5f5f5] font-semibold text-md flex items-center gap-2"
              >
                {label} {icon}
              </button>
            );
          })}
        </div>

        <div className="w-full xl:w-auto overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
          {tabs.map((tab) => {
            return (
              <button
                key={tab}
                className={`
                px-5 py-3 rounded-lg text-[#f5f5f5] font-semibold text-sm md:text-md flex items-center gap-2 ${
                  activeTab === tab
                    ? "bg-[#262626]"
                    : "bg-[#1a1a1a] hover:bg-[#262626]"
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            );
          })}
          </div>
        </div>
      </div>

      {activeTab === "Metrics" && <Metrics />}
      {activeTab === "Orders" && <RecentOrders />}
      {activeTab === "Payments" && <PaymentsCenter />}
      {activeTab === "Kitchen" && <KitchenBoard />}
      {activeTab === "Channels" && <ChannelConfig />}
      {activeTab === "Hardware" && <HardwareCenter />}
      {activeTab === "Templates" && <VerticalTemplateCenter />}
      {activeTab === "Ops" && <OperationsCenter />}
      {activeTab === "SLO" && <SLOCenter />}

      {isTableModalOpen && <Modal setIsTableModalOpen={setIsTableModalOpen} />}
    </div>
  );
};

export default Dashboard;
