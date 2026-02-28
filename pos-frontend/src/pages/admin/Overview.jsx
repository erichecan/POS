/**
 * Admin Overview: metrics + quick actions. 2026-02-24 SaaS admin.
 * // 2026-02-26T21:00:00+08:00: i18n
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MdTableBar, MdOutlineReorder, MdStorefront } from "react-icons/md";
import Metrics from "../../components/dashboard/Metrics";
import Modal from "../../components/dashboard/Modal";

const Overview = () => {
  const { t } = useTranslation();
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#f5f5f5]">{t("admin.overview")}</h1>
        <p className="text-sm text-[#ababab] mt-1">{t("admin.kpisAndActions")}</p>
      </div>
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setIsTableModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-[#262626] px-4 py-2.5 text-sm font-medium text-[#f5f5f5] hover:bg-[#333] border border-[#333]"
        >
          <MdTableBar className="h-5 w-5" />
          {t("admin.addTable")}
        </button>
        <Link
          to="/dashboard/orders"
          className="flex items-center gap-2 rounded-lg bg-[#262626] px-4 py-2.5 text-sm font-medium text-[#f5f5f5] hover:bg-[#333] border border-[#333]"
        >
          <MdOutlineReorder className="h-5 w-5" />
          {t("nav.orders")}
        </Link>
        <Link
          to="/dashboard/channels"
          className="flex items-center gap-2 rounded-lg bg-[#262626] px-4 py-2.5 text-sm font-medium text-[#f5f5f5] hover:bg-[#333] border border-[#333]"
        >
          <MdStorefront className="h-5 w-5" />
          {t("admin.channels")}
        </Link>
      </div>
      <Metrics />
      {isTableModalOpen && <Modal setIsTableModalOpen={setIsTableModalOpen} />}
    </div>
  );
};

export default Overview;
