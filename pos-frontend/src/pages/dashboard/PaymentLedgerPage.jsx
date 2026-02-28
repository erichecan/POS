/** Payment Ledger sub-page. 2026-02-26 */
// 2026-02-26T21:00:00+08:00: i18n
import React from "react";
import { useTranslation } from "react-i18next";
import PaymentsCenter from "../../components/dashboard/PaymentsCenter";

const PaymentLedgerPage = () => {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <PaymentsCenter initialSection="ledger" />
    </div>
  );
};

export default PaymentLedgerPage;
