// 2026-02-26T21:00:00+08:00: i18n
// 2026-02-28T12:15:00+08:00: PRD 7.22 - tableServiceProfile.enabled 控制桌台入口
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { FaHome } from "react-icons/fa";
import { MdOutlineReorder, MdTableBar } from "react-icons/md";
import { CiCircleMore } from "react-icons/ci";
import { BiSolidDish } from "react-icons/bi";
import { useNavigate, useLocation } from "react-router-dom";
import { useVerticalProfile } from "../../contexts/VerticalProfileContext";

const BottomNav = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [isQuickOpenEnabled] = useState(true);
  const { resolved } = useVerticalProfile();
  const tableServiceEnabled = resolved?.tableServiceProfile?.enabled !== false;

  const isActive = (path) => location.pathname === path;
  const navItems = [
    { key: "home", path: "/", label: t("bottomNav.home"), icon: FaHome },
    { key: "orders", path: "/orders", label: t("bottomNav.orders"), icon: MdOutlineReorder },
    ...(tableServiceEnabled ? [{ key: "tables", path: "/tables", label: t("bottomNav.tables"), icon: MdTableBar }] : []),
    { key: "more", path: "/more", label: t("bottomNav.more"), icon: CiCircleMore },
  ];
  const colCount = navItems.length;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#262626]/95 backdrop-blur px-2 md:px-4 pt-2 pb-2"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
    >
      <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <button
              key={item.key}
              onClick={() => navigate(item.path)}
              className={`min-h-[44px] rounded-2xl flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 font-semibold text-xs md:text-sm ${
                active ? "text-[#f5f5f5] bg-[#343434]" : "text-[#ababab]"
              }`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
      {tableServiceEnabled && (
        <button
          disabled={!isQuickOpenEnabled || isActive("/tables")}
          onClick={() => navigate("/tables")}
          className={`hidden md:flex absolute -top-5 left-1/2 -translate-x-1/2 bg-[#F6B100] text-[#f5f5f5] rounded-full p-3 items-center justify-center shadow-lg ${
            !isQuickOpenEnabled || isActive("/tables") ? "opacity-60 cursor-not-allowed" : ""
          }`}
        >
          <BiSolidDish size={24} />
        </button>
      )}
    </div>
  );
};

export default BottomNav;
