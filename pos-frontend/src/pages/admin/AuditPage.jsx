/**
 * Admin Audit: activity log. 2026-02-24 SaaS admin.
 * Phase 3: placeholder; can later call audit API.
 * // 2026-02-26T21:00:00+08:00: i18n
 */
import React from "react";
import { useTranslation } from "react-i18next";

const AuditPage = () => {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <h1 className="text-xl font-semibold text-[#f5f5f5]">{t("admin.activityLog")}</h1>
      <p className="text-sm text-[#ababab] mt-1">{t("admin.auditDesc")}</p>
      <div className="mt-6 rounded-lg border border-[#333] bg-[#262626] p-6 text-[#ababab]">
        {t("admin.auditPlaceholder")}
      </div>
    </div>
  );
};

export default AuditPage;
