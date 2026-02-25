import React, { useEffect, useMemo, useState } from "react";
import BottomNav from "../components/shared/BottomNav";
import OrderCard from "../components/orders/OrderCard";
import BackButton from "../components/shared/BackButton";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrders, settleOrder } from "../https/index";
import { enqueueSnackbar } from "notistack";
import Modal from "../components/shared/Modal";
import { formatDateAndTime, formatReadableOrderId, getDefaultCartRowId, getReadableCustomerName } from "../utils";
import { useDispatch } from "react-redux";
import { setCustomer, updateTable } from "../redux/slices/customerSlice";
import { setItems } from "../redux/slices/cartSlice";
import { useNavigate } from "react-router-dom";
import { menus } from "../constants";

const Orders = () => {
  const [status, setStatus] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "POS | Orders";
  }, []);

  const { data: resData, isError } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      return await getOrders();
    },
    placeholderData: keepPreviousData,
  });

  const settleMutation = useMutation({
    mutationFn: ({ orderId, ...data }) => settleOrder({ orderId, ...data }),
    onSuccess: () => {
      enqueueSnackbar("Checkout completed.", { variant: "success" });
      setSelectedOrder(null);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
    onError: (error) => {
      const message = error.response?.data?.message || "Failed to checkout order.";
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  const orders = useMemo(
    () => (Array.isArray(resData?.data?.data) ? resData.data.data : []),
    [resData]
  );

  const filteredOrders = useMemo(() => {
    if (status === "all") return orders;
    if (status === "progress") {
      return orders.filter((order) => order.orderStatus === "In Progress");
    }
    if (status === "ready") {
      return orders.filter((order) => order.orderStatus === "Ready");
    }
    if (status === "completed") {
      return orders.filter((order) => order.orderStatus === "Completed");
    }

    return orders;
  }, [orders, status]);
  const optionGroupsByName = useMemo(() => {
    const map = new Map();
    menus.forEach((menu) => {
      (menu.items || []).forEach((item) => {
        map.set(`${item.name || ""}`.trim().toLowerCase(), item.optionGroups || []);
      });
    });
    return map;
  }, []);

  useEffect(() => {
    if (isError) {
      enqueueSnackbar("Something went wrong!", { variant: "error" });
    }
  }, [isError]);

  const openOrderInMenu = (order) => {
    if (!order?._id) {
      enqueueSnackbar("Order context missing.", { variant: "error" });
      return;
    }

    if (!order?.table?._id) {
      enqueueSnackbar("Order is not linked to a dine-in table.", { variant: "warning" });
      return;
    }

    dispatch(
      setCustomer({
        name: order.customerDetails?.name || "",
        phone: order.customerDetails?.phone || "",
        guests: Number(order.customerDetails?.guests || 1),
        activeOrderId: order._id,
      })
    );
    dispatch(
      updateTable({
        table: {
          tableId: order.table._id,
          tableNo: order.table?.tableNo || "N/A",
        },
        mergedTables: [],
      })
    );
    dispatch(
      setItems(
        (order.items || []).map((item, index) => ({
          id: getDefaultCartRowId(item, index),
          name: item.name,
          quantity: Number(item.quantity || 1),
          basePrice: Number(item.basePrice || item.pricePerQuantity || 0),
          pricePerQuantity: Number(item.pricePerQuantity || 0),
          price: Number(item.price || 0),
          seatNo: item.seatNo,
          note: `${item.note || ""}`.trim(),
          modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
          optionGroups: optionGroupsByName.get(`${item.name || ""}`.trim().toLowerCase()) || [],
        }))
      )
    );
    setSelectedOrder(null);
    navigate("/menu");
  };

  const checkoutOrder = (order) => {
    if (!order?._id) {
      return;
    }
    settleMutation.mutate({
      orderId: order._id,
      paymentMethod: "Cash",
      reason: "Checkout from orders page",
    });
  };

  const readableOrderId = formatReadableOrderId(selectedOrder?._id);
  const readableCustomerName = getReadableCustomerName(
    selectedOrder?.customerDetails?.name,
    selectedOrder?.customerDetails?.phone
  );
  const canEditOrCheckout =
    selectedOrder && !["Completed", "Cancelled"].includes(selectedOrder.orderStatus);

  return (
    <section className="bg-[#1f1f1f] h-[calc(100vh-5rem)] min-h-[calc(100vh-5rem)] flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-8 xl:px-10 py-4">
        <div className="flex items-center gap-3 md:gap-4">
          <BackButton />
          <h1 className="text-[#f5f5f5] text-xl md:text-2xl font-bold tracking-wider">Orders</h1>
        </div>
        <div className="w-full md:w-auto overflow-x-auto">
          <div className="flex items-center gap-2 md:gap-3 min-w-max">
          <button
            onClick={() => setStatus("all")}
            className={`text-[#ababab] text-sm md:text-base min-h-[44px] ${
              status === "all" && "bg-[#383838] rounded-lg px-4 py-2"
            } rounded-lg px-4 py-2 font-semibold`}
          >
            All
          </button>
          <button
            onClick={() => setStatus("progress")}
            className={`text-[#ababab] text-sm md:text-base min-h-[44px] ${
              status === "progress" && "bg-[#383838] rounded-lg px-4 py-2"
            } rounded-lg px-4 py-2 font-semibold`}
          >
            In Progress
          </button>
          <button
            onClick={() => setStatus("ready")}
            className={`text-[#ababab] text-sm md:text-base min-h-[44px] ${
              status === "ready" && "bg-[#383838] rounded-lg px-4 py-2"
            } rounded-lg px-4 py-2 font-semibold`}
          >
            Ready
          </button>
          <button
            onClick={() => setStatus("completed")}
            className={`text-[#ababab] text-sm md:text-base min-h-[44px] ${
              status === "completed" && "bg-[#383838] rounded-lg px-4 py-2"
            } rounded-lg px-4 py-2 font-semibold`}
          >
            Completed
          </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 px-4 md:px-8 xl:px-16 py-2 pb-32 flex-1 min-h-0 overflow-y-auto">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order) => {
            return <OrderCard key={order._id} order={order} onSelect={setSelectedOrder} />;
          })
        ) : (
          <p className="col-span-3 text-gray-500">No orders available</p>
        )}
      </div>

      <Modal isOpen={Boolean(selectedOrder)} onClose={() => setSelectedOrder(null)} title="Order Details">
        {selectedOrder && (
          <div className="space-y-3 text-sm text-[#f5f5f5]">
            <div className="rounded-lg bg-[#202020] border border-[#343434] p-3 space-y-1">
              <p>
                {readableOrderId} · Table #{selectedOrder?.table?.tableNo || "N/A"} ·{" "}
                {selectedOrder?.orderStatus}
              </p>
              <p>
                {readableCustomerName} · {selectedOrder?.customerDetails?.guests || "N/A"} pax ·{" "}
                {selectedOrder?.customerDetails?.phone || "N/A"}
              </p>
              <p>
                {formatDateAndTime(selectedOrder?.orderDate)} · {selectedOrder?.paymentMethod} · €
                {Number(selectedOrder?.bills?.totalWithTax || 0).toFixed(2)}
              </p>
            </div>

            <div>
              <p className="mb-1 text-[#ababab]">Items</p>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-[#343434]">
                {(selectedOrder.items || []).map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="flex items-center justify-between px-3 py-2 border-b border-b-[#2a2a2a] last:border-b-0"
                  >
                    <span className="text-[#d7e4ff]">
                      {item.name} x{item.quantity}
                    </span>
                    <span>€{Number(item.price || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {canEditOrCheckout && (
              <div className="flex gap-3">
                <button
                  onClick={() => openOrderInMenu(selectedOrder)}
                  className="flex-1 bg-[#2f4f7a] text-[#dfefff] py-2 rounded-lg font-semibold"
                >
                  Add/Edit Items
                </button>
                <button
                  onClick={() => checkoutOrder(selectedOrder)}
                  disabled={settleMutation.isPending}
                  className={`flex-1 bg-[#F6B100] text-[#1f1f1f] py-2 rounded-lg font-semibold ${
                    settleMutation.isPending ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                >
                  {settleMutation.isPending ? "Checking out..." : "Checkout (Cash)"}
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <BottomNav />
    </section>
  );
};

export default Orders;
