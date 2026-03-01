/**
 * 收银员工作台 - Phase A3 ABCPOS 对标 2026-02-28T17:30:00+08:00
 * 订单队列 + 结账区 + 快捷操作（现金/刷卡/打印）
 */
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrders, settleOrder } from "../https";
import { enqueueSnackbar } from "notistack";
import BackButton from "../components/shared/BackButton";
import PaymentTenderPanel from "../components/tender/PaymentTenderPanel";
import { formatReadableOrderId, getReadableCustomerName } from "../utils";
import { MdPointOfSale, MdPrint, MdCreditCard } from "react-icons/md";

const CURRENCY_MAP = { USD: "$", EUR: "€", GBP: "£", CNY: "¥", JPY: "¥" };

const CashierStation = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState(null);

  const ordersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
    placeholderData: keepPreviousData,
    refetchInterval: 10000,
  });
  const orders = useMemo(
    () => (Array.isArray(ordersQuery.data?.data?.data) ? ordersQuery.data.data : []),
    [ordersQuery.data]
  );
  const checkoutableOrders = useMemo(
    () => orders.filter((o) => ["In Progress", "Ready"].includes(o.orderStatus)),
    [orders]
  );
  const currencySymbol = "€";

  const settleMutation = useMutation({
    mutationFn: ({ orderId, paymentMethod }) =>
      settleOrder({ orderId, paymentMethod }),
    onSuccess: () => {
      enqueueSnackbar(t("cashier.settled") || "Checkout completed.", { variant: "success" });
      setSelectedOrder(null);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
    onError: (e) =>
      enqueueSnackbar(e.response?.data?.message || "Settlement failed.", { variant: "error" }),
  });

  const total = selectedOrder?.bills?.totalWithTax ?? 0;
  const handlePayCash = ({ amountTendered }) => {
    if (!selectedOrder?._id) return;
    settleMutation.mutate({ orderId: selectedOrder._id, paymentMethod: "Cash" });
  };
  const handlePayCard = () => {
    if (!selectedOrder?._id) return;
    enqueueSnackbar("Stripe integration: use Tables/Orders for card.", { variant: "info" });
  };

  const handlePrint = () => {
    if (!selectedOrder) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      enqueueSnackbar("Pop-up blocked. Allow pop-ups to print.", { variant: "warning" });
      return;
    }
    const items = (selectedOrder.items || [])
      .map((i) => `${i.name} x${i.quantity} ${currencySymbol}${(i.price || 0).toFixed(2)}`)
      .join("\n");
    printWindow.document.write(`
      <pre style="font-family:monospace;padding:16px;">
Order #${formatReadableOrderId(selectedOrder._id)}
${getReadableCustomerName(selectedOrder.customerDetails)}
---
${items}
---
Subtotal: ${currencySymbol}${(selectedOrder.bills?.subtotal || 0).toFixed(2)}
Tax: ${currencySymbol}${(selectedOrder.bills?.tax || 0).toFixed(2)}
Total: ${currencySymbol}${(selectedOrder.bills?.totalWithTax || 0).toFixed(2)}
      </pre>
    `);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
  };

  return (
    <div className="min-h-screen bg-[#1f1f1f] pb-24">
      <div className="sticky top-0 z-10 bg-[#262626] border-b border-[#333] px-4 py-3 flex items-center gap-4">
        <BackButton />
        <h1 className="text-lg font-semibold text-[#f5f5f5] flex items-center gap-2">
          <MdPointOfSale size={24} />
          {t("cashier.title") || "Cashier Station"}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        {/* 订单队列 */}
        <div className="bg-[#262626] rounded-lg border border-[#333] p-4">
          <h2 className="text-md font-medium text-[#e0e0e0] mb-3">
            {t("cashier.orderQueue") || "Order Queue"} ({checkoutableOrders.length})
          </h2>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {checkoutableOrders.map((order) => {
              const isSelected = selectedOrder?._id === order._id;
              return (
                <button
                  key={order._id}
                  onClick={() => setSelectedOrder(order)}
                  className={`w-full text-left p-3 rounded-lg border transition ${
                    isSelected ? "bg-[#3b3b3b] border-[#F6B100]" : "bg-[#1f1f1f] border-[#333] hover:border-[#444]"
                  }`}
                >
                  <div className="flex justify-between">
                    <span className="text-[#f5f5f5] font-medium">
                      #{formatReadableOrderId(order._id)}
                    </span>
                    <span className="text-[#ababab] text-sm">
                      {currencySymbol}{(order.bills?.totalWithTax || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-xs text-[#ababab] mt-1">
                    {getReadableCustomerName(order.customerDetails)} · {order.orderStatus}
                  </div>
                </button>
              );
            })}
            {checkoutableOrders.length === 0 && (
              <p className="text-[#ababab] text-sm py-4">{t("cashier.noOrders") || "No orders to checkout."}</p>
            )}
          </div>
        </div>

        {/* 结账区 */}
        <div className="bg-[#262626] rounded-lg border border-[#333] p-4">
          <h2 className="text-md font-medium text-[#e0e0e0] mb-3">
            {t("cashier.checkout") || "Checkout"}
          </h2>
          {selectedOrder ? (
            <>
              <div className="mb-4 p-3 bg-[#1f1f1f] rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-[#ababab]">#{formatReadableOrderId(selectedOrder._id)}</span>
                  <span className="text-[#f5f5f5] font-bold">
                    {currencySymbol}{total.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-[#ababab] mt-1">{getReadableCustomerName(selectedOrder.customerDetails)}</p>
              </div>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={handlePrint}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-[#333] text-[#f5f5f5] font-medium"
                >
                  <MdPrint size={18} />
                  {t("cashier.print") || "Print"}
                </button>
              </div>
              <PaymentTenderPanel
                total={total}
                onPayCash={handlePayCash}
                onPayCard={handlePayCard}
                currencySymbol={currencySymbol}
                disabled={settleMutation.isPending}
              />
            </>
          ) : (
            <p className="text-[#ababab] text-sm py-8">{t("cashier.selectOrder") || "Select an order to checkout."}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CashierStation;
