/** Payment Reconciliation sub-page. 2026-02-26 */
import React from "react";
import PaymentsCenter from "../../components/dashboard/PaymentsCenter";

const PaymentReconciliationPage = () => (
  <div className="container mx-auto py-6 px-4 md:px-6">
    <PaymentsCenter initialSection="reconciliation" />
  </div>
);

export default PaymentReconciliationPage;
