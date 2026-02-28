/** Admin Ops. 2026-02-24 SaaS admin. */
// 2026-02-26T21:00:00+08:00: i18n
import React from "react";
import { useTranslation } from "react-i18next";
import OperationsCenter from "../../components/dashboard/OperationsCenter";

const OpsPage = () => {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <OperationsCenter />
    </div>
  );
};

export default OpsPage;
