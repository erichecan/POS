/**
 * Phase C1 在线订餐 - 订单状态页
 * 2026-02-28T16:30:00+08:00 支付成功后展示，支持轮询状态
 */
import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { getPublicOrderStatus, verifyPublicPayment } from "../https";

const STATUS_LABELS = {
  "In Progress": { label: "Preparing", color: "text-yellow-400" },
  Ready: { label: "Ready for pickup", color: "text-green-400" },
  Completed: { label: "Completed", color: "text-green-500" },
  Cancelled: { label: "Cancelled", color: "text-red-400" },
};

const OnlineOrderStatus = () => {
  const { t } = useTranslation();
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (sessionId && orderId) {
      verifyPublicPayment({ session_id: sessionId, orderId })
        .then(() => setVerified(true))
        .catch(() => {});
    }
  }, [sessionId, orderId]);

  const statusQuery = useQuery({
    queryKey: ["public-order-status", orderId],
    queryFn: async () => {
      const res = await getPublicOrderStatus(orderId);
      return res.data?.data;
    },
    enabled: !!orderId,
    refetchInterval: verified ? 10000 : false,
  });

  const data = statusQuery.data;
  const statusInfo = data?.orderStatus ? STATUS_LABELS[data.orderStatus] : null;

  return (
    <div className="min-h-screen bg-[#1f1f1f] flex flex-col items-center justify-center px-4">
      {statusQuery.isLoading ? (
        <p className="text-[#ababab]">{t("common.loading")}</p>
      ) : data ? (
        <>
          <h1 className="text-[#f5f5f5] text-2xl font-bold mb-2">
            {t("onlineOrder.statusTitle", "Order Status")}
          </h1>
          <p className="text-[#ababab] mb-6">
            {t("onlineOrder.orderId", "Order")}: #{String(orderId).slice(-8)}
          </p>
          <div
            className={`text-2xl font-bold mb-4 ${
              statusInfo?.color || "text-[#f5f5f5]"
            }`}
          >
            {statusInfo?.label || data.orderStatus}
          </div>
          {data.pickupAt && (
            <p className="text-[#ababab] text-sm mb-4">
              {t("onlineOrder.pickupTime")}:{" "}
              {new Date(data.pickupAt).toLocaleString()}
            </p>
          )}
          <Link
            to="/order"
            className="mt-6 px-6 py-3 rounded-lg bg-[#025cca] text-white font-semibold"
          >
            {t("onlineOrder.newOrder", "Place New Order")}
          </Link>
        </>
      ) : (
        <p className="text-[#ababab]">{t("onlineOrder.notFound", "Order not found.")}</p>
      )}
    </div>
  );
};

export default OnlineOrderStatus;
