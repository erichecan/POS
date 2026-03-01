import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import BackButton from "../components/shared/BackButton";
import BottomNav from "../components/shared/BottomNav";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { MdDashboard, MdTableBar, MdOutlineReorder, MdSettings, MdDevices, MdStorefront, MdReceipt, MdPointOfSale, MdPhoneIphone, MdFormatListNumbered } from "react-icons/md";
import { LuLayoutGrid } from "react-icons/lu";

const More = () => {
  // 2026-02-26T21:00:00+08:00: i18n internationalization
  // 2026-02-28T13:00:00+08:00: PRD 7.23 小票模板迁移至品牌管理
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { role } = useSelector((state) => state.user);
  const normalizedRole = `${role || ""}`.trim().toLowerCase();
  const isAdmin = normalizedRole === "admin";
  const isCashier = normalizedRole === "cashier";

  useEffect(() => {
    document.title = `POS | ${t("more.title")}`;
  }, [t]);

  const actionItems = useMemo(() => {
    const baseItems = [
      ...((isCashier || isAdmin) ? [{
        key: "cashier",
        label: t("cashier.title") || "Cashier Station",
        description: t("cashier.desc") || "Order queue and checkout",
        icon: <MdPointOfSale size={22} />,
        route: "/cashier",
      }] : []),
      {
        key: "handheld",
        label: t("handheld.title") || "Handheld POS",
        description: t("handheld.desc") || "Mobile ordering, scan table/item",
        icon: <MdPhoneIphone size={22} />,
        route: "/handheld",
      },
      {
        key: "tables",
        label: t("nav.tables"),
        description: t("more.tablesDesc"),
        icon: <MdTableBar size={22} />,
        route: "/tables",
      },
      {
        key: "orders",
        label: t("nav.orders"),
        description: t("more.ordersDesc"),
        icon: <MdOutlineReorder size={22} />,
        route: "/orders",
      },
      {
        key: "layout",
        label: t("nav.tableLayout"),
        description: t("more.tableLayoutDesc"),
        icon: <LuLayoutGrid size={22} />,
        route: "/tables/layout",
      },
      {
        key: "queue",
        label: t("queue.manage", "Queue Management"),
        description: t("queue.manageDesc", "Call numbers, manage queue"),
        icon: <MdFormatListNumbered size={22} />,
        route: "/queue/manage",
      },
    ];

    if (isAdmin) {
      baseItems.unshift({
        key: "brand-receipt",
        label: t("more.receiptTemplate"),
        description: t("more.receiptTemplateDesc"),
        icon: <MdReceipt size={22} />,
        route: "/dashboard/brand/receipt",
      });
      baseItems.unshift({
        key: "vertical-templates",
        label: t("more.verticalTemplates"),
        description: t("more.verticalTemplatesDesc"),
        icon: <MdStorefront size={22} />,
        route: "/dashboard/templates",
      });
      baseItems.unshift({
        key: "hardware-center",
        label: t("more.hardwareCenter"),
        description: t("more.hardwareCenterDesc"),
        icon: <MdDevices size={22} />,
        route: "/dashboard/hardware",
      });
      baseItems.unshift({
        key: "backend-config",
        label: t("more.backendConfig"),
        description: t("more.backendConfigDesc"),
        icon: <MdSettings size={22} />,
        route: "/dashboard/channels",
      });
      baseItems.unshift({
        key: "dashboard",
        label: t("nav.dashboard"),
        description: t("more.dashboardDesc"),
        icon: <MdDashboard size={22} />,
        route: "/dashboard/overview",
      });
    }

    return baseItems;
  }, [isAdmin, t]);

  return (
    <section className="bg-[#1f1f1f] h-[calc(100vh-5rem)] overflow-hidden">
      <div className="flex items-center gap-4 px-10 py-4">
        <BackButton />
        <h1 className="text-[#f5f5f5] text-2xl font-bold tracking-wider">{t("more.title")}</h1>
      </div>

      <div className="px-10 py-4 overflow-y-auto h-[calc(100%-7rem)] pb-28 space-y-5">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {actionItems.map((item) => (
            <button
              key={item.key}
              onClick={() => navigate(item.route)}
              className="text-left bg-[#262626] border border-[#343434] rounded-xl p-5 hover:bg-[#2d2d2d] transition-colors"
            >
              <div className="flex items-center gap-3 text-[#f5f5f5]">
                <span className="text-[#F6B100]">{item.icon}</span>
                <h2 className="text-lg font-semibold">{item.label}</h2>
              </div>
              <p className="mt-3 text-sm text-[#ababab]">{item.description}</p>
            </button>
          ))}
        </div>

        {/* 2026-02-28 PRD 7.23: 小票模板已迁移至 品牌管理 > Receipt Template */}
        <div className="bg-[#262626] border border-[#343434] rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[#f5f5f5] text-lg font-semibold">{t("more.receiptTemplate")}</h2>
              <p className="text-[#ababab] text-sm mt-1">{t("more.receiptTemplateDesc")}</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => navigate("/dashboard/brand/receipt")}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#F6B100] text-[#1f1f1f]"
              >
                {t("more.configureReceipt")}
              </button>
            )}
          </div>
          <p className="text-sm text-[#9f9f9f] mt-3">{t("more.receiptBrandHint")}</p>
        </div>
      </div>

      <BottomNav />
    </section>
  );
};

export default More;
