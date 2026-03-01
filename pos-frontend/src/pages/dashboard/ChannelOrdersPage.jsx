/**
 * Phase E2.3 渠道订单列表与状态可视化 - 2026-02-28T16:20:00+08:00
 */
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrders, updateOrderStatus } from "../../https";
import { enqueueSnackbar } from "notistack";
import { formatReadableOrderId, getReadableCustomerName } from "../../utils";

const STATUS_COLORS = {
  "In Progress": "bg-amber-500/20 text-amber-400",
  Ready: "bg-green-500/20 text-green-400",
  Completed: "bg-blue-500/20 text-blue-400",
  Cancelled: "bg-gray-500/20 text-gray-400",
};

const ChannelOrdersPage = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const ordersQuery = useQuery({
    queryKey: ["orders", "CHANNEL"],
    queryFn: () => getOrders({ sourceType: "CHANNEL" }),
    placeholderData: keepPreviousData,
    refetchInterval: 15000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, orderStatus }) => updateOrderStatus({ orderId, orderStatus }),
    onSuccess: () => {
      enqueueSnackbar(t("channel.orders.statusUpdated", "Status updated"), { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e) =>
      enqueueSnackbar(e.response?.data?.message || "Failed to update status", { variant: "error" }),
  });

  const orders = useMemo(
    () => (Array.isArray(ordersQuery.data?.data?.data) ? ordersQuery.data.data : []),
    [ordersQuery.data]
  );

  if (ordersQuery.isLoading && !ordersQuery.data) {
    return (
      <div className="container mx-auto py-6 px-4">
        <p className="text-[#ababab]">{t("common.loading", "Loading...")}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <h1 className="text-[#f5f5f5] text-2xl font-bold mb-6">
        {t("channel.orders.title", "Channel Orders")}
      </h1>
      <p className="text-[#ababab] mb-6">
        {t("channel.orders.desc", "Orders from Uber Eats, DoorDash, and other delivery channels.")}
      </p>

      {orders.length === 0 ? (
        <div className="rounded-xl bg-[#262626] border border-[#343434] p-8 text-center">
          <p className="text-[#ababab]">{t("channel.orders.noOrders", "No channel orders yet.")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order._id}
              className="rounded-xl bg-[#262626] border border-[#343434] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <div>
                  <span className="text-[#f5f5f5] font-semibold">
                    #{formatReadableOrderId(order._id)}
                  </span>
                  <span
                    className={`ml-2 px-2 py-0.5 rounded text-xs ${
                      STATUS_COLORS[order.orderStatus] || "bg-gray-500/20 text-gray-400"
                    }`}
                  >
                    {order.orderStatus}
                  </span>
                  {order.channelProviderCode && (
                    <span className="ml-2 text-[#ababab] text-sm">
                      via {order.channelProviderCode}
                    </span>
                  )}
                </div>
                <span className="text-[#9f9f9f] text-sm">
                  {order.orderDate
                    ? new Date(order.orderDate).toLocaleString()
                    : "-"}
                </span>
              </div>
              <p className="text-[#ababab] text-sm">
                {getReadableCustomerName(order.customerDetails?.name, order.customerDetails?.phone)} •
                {(order.items || []).length} {t("common.items", "items")}
              </p>
              {(order.items || []).slice(0, 3).map((item, i) => (
                <p key={i} className="text-[#9f9f9f] text-xs mt-1">
                  {item.name} x{item.quantity}
                </p>
              ))}
              {order.orderStatus !== "Completed" && order.orderStatus !== "Cancelled" && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {["In Progress", "Ready", "Completed"].map((s) =>
                    s !== order.orderStatus ? (
                      <button
                        key={s}
                        onClick={() =>
                          updateStatusMutation.mutate({
                            orderId: order._id,
                            orderStatus: s,
                          })
                        }
                        disabled={updateStatusMutation.isPending}
                        className="px-3 py-1 rounded-lg text-sm bg-[#3b3b3b] text-[#f5f5f5] hover:bg-[#4b4b4b]"
                      >
                        → {s}
                      </button>
                    ) : null
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChannelOrdersPage;
