import React, { useEffect, useMemo, useState } from "react";
import BottomNav from "../components/shared/BottomNav";
import BackButton from "../components/shared/BackButton";
import TableCard from "../components/tables/TableCard";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTables, settleOrder, transferTableOrder } from "../https";
import { enqueueSnackbar } from "notistack";
import Modal from "../components/shared/Modal";
import { useDispatch } from "react-redux";
import { setCustomer, updateTable } from "../redux/slices/customerSlice";
import { removeAllItems, setItems } from "../redux/slices/cartSlice";
import { useNavigate } from "react-router-dom";
import { menus } from "../constants";
import {
  formatDateAndTime,
  formatReadableOrderId,
  getDefaultCartRowId,
  getReadableCustomerName,
} from "../utils";

const Tables = () => {
  const [status, setStatus] = useState("all");
  const [openTableTarget, setOpenTableTarget] = useState(null);
  const [bookedTableTarget, setBookedTableTarget] = useState(null);
  const [guestDraft, setGuestDraft] = useState(1);
  const [nameDraft, setNameDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [mergeWithTableId, setMergeWithTableId] = useState("");
  const [settleTarget, setSettleTarget] = useState(null);
  const [settlePaymentMethod, setSettlePaymentMethod] = useState("Cash");
  // 2026-02-26T00:00:03Z: Transfer Table state
  const [showTransferUI, setShowTransferUI] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    document.title = "POS | Tables";
  }, []);

  const { data: resData, isError } = useQuery({
    queryKey: ["tables"],
    queryFn: async () => {
      return await getTables();
    },
    placeholderData: keepPreviousData,
  });

  const settleMutation = useMutation({
    mutationFn: ({ orderId, ...data }) => settleOrder({ orderId, ...data }),
    onSuccess: () => {
      enqueueSnackbar("Payment settled and table released.", { variant: "success" });
      setSettleTarget(null);
      setBookedTableTarget(null);
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      const message = error.response?.data?.message || "Failed to settle payment.";
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  // 2026-02-26T00:00:04Z: Transfer Table mutation
  const transferMutation = useMutation({
    mutationFn: (data) => transferTableOrder(data),
    onSuccess: () => {
      enqueueSnackbar("Table transferred successfully.", { variant: "success" });
      setShowTransferUI(false);
      setTransferTargetId("");
      setBookedTableTarget(null);
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      const message = error.response?.data?.message || "Failed to transfer table.";
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  const tablesData = useMemo(
    () => (Array.isArray(resData?.data?.data) ? resData.data.data : []),
    [resData]
  );
  const optionGroupsByName = useMemo(() => {
    const map = new Map();
    menus.forEach((menu) => {
      (menu.items || []).forEach((item) => {
        map.set(`${item.name || ""}`.trim().toLowerCase(), item.optionGroups || []);
      });
    });
    return map;
  }, []);

  const filteredTables = useMemo(() => {
    if (status === "booked") {
      return tablesData.filter((table) => table.status === "Booked");
    }

    return tablesData;
  }, [tablesData, status]);

  const mergeCandidateTables = useMemo(() => {
    if (!openTableTarget?._id) {
      return [];
    }

    return tablesData.filter(
      (table) => table.status === "Available" && `${table._id}` !== `${openTableTarget._id}`
    );
  }, [tablesData, openTableTarget]);

  // 2026-02-26T00:00:05Z: Available tables for transfer (exclude current booked table)
  const transferCandidateTables = useMemo(() => {
    if (!bookedTableTarget?._id) return [];
    return tablesData.filter(
      (t) => t.status === "Available" && `${t._id}` !== `${bookedTableTarget._id}`
    );
  }, [tablesData, bookedTableTarget]);

  const handleTransfer = () => {
    if (!transferTargetId || !bookedTableTarget?._id) return;
    transferMutation.mutate({
      sourceTableId: bookedTableTarget._id,
      targetTableId: transferTargetId,
    });
  };

  useEffect(() => {
    if (isError) {
      enqueueSnackbar("Something went wrong!", { variant: "error" });
    }
  }, [isError]);

  const openTableModal = (table) => {
    if (!table) {
      return;
    }

    if (table.status === "Booked") {
      setBookedTableTarget(table);
      return;
    }

    setOpenTableTarget(table);
    setGuestDraft(Math.max(1, Number(table.seats || 1)));
    setNameDraft("");
    setPhoneDraft("");
    setMergeWithTableId("");
  };

  const closeOpenTableModal = () => {
    setOpenTableTarget(null);
    setMergeWithTableId("");
  };

  const closeBookedDetailModal = () => {
    setBookedTableTarget(null);
    setShowTransferUI(false);
    setTransferTargetId("");
  };

  const proceedToMenu = () => {
    const sanitizedName = `${nameDraft || ""}`.trim();
    const sanitizedPhone = `${phoneDraft || ""}`.trim();
    const guests = Number(guestDraft);
    const selectedMergeTable = mergeCandidateTables.find(
      (table) => `${table._id}` === `${mergeWithTableId}`
    );

    if (!sanitizedName) {
      enqueueSnackbar("Please input customer name before opening table.", { variant: "warning" });
      return;
    }

    if (!/^\+?[0-9]{6,15}$/.test(sanitizedPhone)) {
      enqueueSnackbar("Customer phone must be 6 to 15 digits.", { variant: "warning" });
      return;
    }

    if (!Number.isInteger(guests) || guests < 1 || guests > 20) {
      enqueueSnackbar("Guests must be between 1 and 20.", { variant: "warning" });
      return;
    }

    const primarySeats = Number(openTableTarget?.seats || 0);
    if (guests > primarySeats) {
      if (!selectedMergeTable) {
        enqueueSnackbar("Guest count exceeds seats. Please choose a table to merge.", {
          variant: "warning",
        });
        return;
      }
      if (guests > primarySeats + Number(selectedMergeTable?.seats || 0)) {
        enqueueSnackbar("Combined seats are still insufficient for this party size.", {
          variant: "warning",
        });
        return;
      }
    }

    dispatch(removeAllItems());
    dispatch(
      setCustomer({
        name: sanitizedName,
        phone: sanitizedPhone,
        guests,
      })
    );
    dispatch(
      updateTable({
        table: {
          tableId: openTableTarget._id,
          tableNo: openTableTarget.tableNo,
        },
        mergedTables: selectedMergeTable
          ? [
              {
                tableId: selectedMergeTable._id,
                tableNo: selectedMergeTable.tableNo,
              },
            ]
          : [],
      })
    );
    closeOpenTableModal();
    navigate("/menu");
  };

  const enterBookedOrderMenu = () => {
    const order = bookedTableTarget?.currentOrder;
    if (!order?._id) {
      enqueueSnackbar("Order context is missing for this table.", { variant: "error" });
      return;
    }

    const linkedTables = tablesData.filter(
      (table) => `${table?.currentOrder?._id || ""}` === `${order._id}`
    );
    const mergedTables = linkedTables
      .filter((table) => `${table._id}` !== `${bookedTableTarget?._id}`)
      .map((table) => ({
        tableId: table._id,
        tableNo: table.tableNo,
      }));

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
          tableId: bookedTableTarget._id,
          tableNo: bookedTableTarget.tableNo,
        },
        mergedTables,
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
    closeBookedDetailModal();
    navigate("/menu");
  };

  const openSettlementModal = () => {
    const order = bookedTableTarget?.currentOrder;
    if (!order?._id) {
      enqueueSnackbar("No active order found for settlement.", { variant: "error" });
      return;
    }
    setSettleTarget({
      orderId: order._id,
      tableNo: bookedTableTarget?.tableNo,
      totalWithTax: Number(order?.bills?.totalWithTax || 0),
      readableOrderId: formatReadableOrderId(order._id),
      customerName: getReadableCustomerName(order?.customerDetails?.name, order?.customerDetails?.phone),
    });
    setSettlePaymentMethod("Cash");
  };

  const confirmSettlement = () => {
    if (!settleTarget?.orderId) {
      return;
    }

    settleMutation.mutate({
      orderId: settleTarget.orderId,
      paymentMethod: settlePaymentMethod,
      reason: `Checkout from table #${settleTarget.tableNo}`,
    });
  };

  const selectedMergeTable = mergeCandidateTables.find(
    (table) => `${table._id}` === `${mergeWithTableId}`
  );

  return (
    <section className="bg-[#1f1f1f] h-[calc(100vh-5rem)] min-h-[calc(100vh-5rem)] flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-8 xl:px-10 py-4">
        <div className="flex items-center gap-3 md:gap-4">
          <BackButton />
          <h1 className="text-[#f5f5f5] text-xl md:text-2xl font-bold tracking-wider">Tables</h1>
          <button
            onClick={() => navigate("/tables/layout")}
            className="bg-[#2f4f7a] text-[#dfefff] min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Layout Designer
          </button>
        </div>
        <div className="w-full md:w-auto overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
          <button
            onClick={() => setStatus("all")}
            className={`text-[#ababab] text-sm md:text-base min-h-[44px] ${
              status === "all" && "bg-[#383838] rounded-lg px-4 py-2"
            } rounded-lg px-4 py-2 font-semibold`}
          >
            All
          </button>
          <button
            onClick={() => setStatus("booked")}
            className={`text-[#ababab] text-sm md:text-base min-h-[44px] ${
              status === "booked" && "bg-[#383838] rounded-lg px-4 py-2"
            } rounded-lg px-4 py-2 font-semibold`}
          >
            Booked
          </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-3 px-6 md:px-10 xl:px-16 py-4 pb-36 flex-1 min-h-0 overflow-y-auto">
        {filteredTables.length > 0 ? (
          filteredTables.map((table) => {
            return <TableCard key={table._id} table={table} onOpen={openTableModal} />;
          })
        ) : (
          <p className="col-span-5 text-gray-500">No tables available</p>
        )}
      </div>

      <Modal isOpen={Boolean(openTableTarget)} onClose={closeOpenTableModal} title="Open Table">
        <div className="space-y-3">
          <div className="text-sm text-[#ababab]">
            Table <span className="text-[#f5f5f5] font-semibold">#{openTableTarget?.tableNo}</span> · Seats{" "}
            <span className="text-[#f5f5f5] font-semibold">{openTableTarget?.seats}</span>
          </div>
          <div>
            <label className="block text-[#ababab] mb-2 text-sm font-medium">Customer Name</label>
            <div className="flex items-center rounded-lg p-3 px-4 bg-[#1f1f1f]">
              <input
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                placeholder="Enter customer name"
                className="bg-transparent flex-1 text-white focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-[#ababab] mb-2 text-sm font-medium">Customer Phone</label>
            <div className="flex items-center rounded-lg p-3 px-4 bg-[#1f1f1f]">
              <input
                value={phoneDraft}
                onChange={(event) => setPhoneDraft(event.target.value)}
                placeholder="+353851234567"
                className="bg-transparent flex-1 text-white focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium text-[#ababab]">Guests</label>
            <div className="flex items-center justify-between bg-[#1f1f1f] px-4 py-3 rounded-lg">
              <button
                onClick={() => setGuestDraft((prev) => Math.max(1, Number(prev || 1) - 1))}
                className="text-yellow-500 text-2xl"
              >
                &minus;
              </button>
              <span className="text-white">{guestDraft} Person</span>
              <button
                onClick={() => setGuestDraft((prev) => Math.min(20, Number(prev || 1) + 1))}
                className="text-yellow-500 text-2xl"
              >
                &#43;
              </button>
            </div>
            {Number(guestDraft) > Number(openTableTarget?.seats || 0) && (
              <p className="text-xs text-yellow-400 mt-2">
                Guests exceed seat capacity. Please choose a table to merge.
              </p>
            )}
          </div>

          {Number(guestDraft) > Number(openTableTarget?.seats || 0) && (
            <div>
              <label className="block mb-2 text-sm font-medium text-[#ababab]">Merge With Table</label>
              <select
                value={mergeWithTableId}
                onChange={(event) => setMergeWithTableId(event.target.value)}
                className="w-full bg-[#1f1f1f] text-[#f5f5f5] px-4 py-3 rounded-lg outline-none"
              >
                <option value="">Select available table</option>
                {mergeCandidateTables.map((table) => (
                  <option key={table._id} value={table._id}>
                    Table #{table.tableNo} · {table.seats} seats
                  </option>
                ))}
              </select>
              {mergeCandidateTables.length === 0 && (
                <p className="text-xs text-red-400 mt-2">No available table can be merged currently.</p>
              )}
              {selectedMergeTable && (
                <p className="text-xs text-[#9ed4ff] mt-2">
                  Combined seats: {Number(openTableTarget?.seats || 0) + Number(selectedMergeTable.seats || 0)}
                </p>
              )}
            </div>
          )}
          <button
            onClick={proceedToMenu}
            className="w-full bg-[#F6B100] text-[#1f1f1f] rounded-lg py-3 mt-2 font-semibold"
          >
            Open Table And Start Order
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(bookedTableTarget)}
        onClose={closeBookedDetailModal}
        title="Booked Table Details"
      >
        <div className="space-y-2 text-sm text-[#f5f5f5]">
          <p>Table: #{bookedTableTarget?.tableNo}</p>
          <p>Seats: {bookedTableTarget?.seats}</p>
          <p>
            Order: {formatReadableOrderId(bookedTableTarget?.currentOrder?._id)}
          </p>
          <p>
            Customer:{" "}
            {getReadableCustomerName(
              bookedTableTarget?.currentOrder?.customerDetails?.name,
              bookedTableTarget?.currentOrder?.customerDetails?.phone
            )}
          </p>
          <p>Phone: {bookedTableTarget?.currentOrder?.customerDetails?.phone || "N/A"}</p>
          <p>Guests: {bookedTableTarget?.currentOrder?.customerDetails?.guests || "N/A"}</p>
          <p>
            Booked At:{" "}
            {bookedTableTarget?.currentOrder?.orderDate
              ? formatDateAndTime(bookedTableTarget.currentOrder.orderDate)
              : "N/A"}
          </p>
          <p>Status: {bookedTableTarget?.currentOrder?.orderStatus || "N/A"}</p>
          <p>
            Items:{" "}
            {Array.isArray(bookedTableTarget?.currentOrder?.items)
              ? bookedTableTarget.currentOrder.items.length
              : 0}
          </p>
          <p>
            Current Bill: €
            {Number(bookedTableTarget?.currentOrder?.bills?.totalWithTax || 0).toFixed(2)}
          </p>

          <div className="pt-3 flex gap-3">
            <button
              onClick={enterBookedOrderMenu}
              className="flex-1 bg-[#2f4f7a] text-[#e6f0ff] py-2 rounded-lg font-semibold"
            >
              Add/Edit Items
            </button>
            <button
              onClick={openSettlementModal}
              className="flex-1 bg-[#F6B100] text-[#1f1f1f] py-2 rounded-lg font-semibold"
            >
              Checkout
            </button>
          </div>

          {/* 2026-02-26T00:00:06Z: Transfer Table UI */}
          <div className="pt-3 border-t border-[#333] mt-3">
            {!showTransferUI ? (
              <button
                onClick={() => setShowTransferUI(true)}
                className="w-full bg-[#333] text-[#f5f5f5] py-2 rounded-lg font-semibold text-sm"
              >
                Transfer Table / 转台
              </button>
            ) : (
              <div className="space-y-2">
                <label className="block text-[#ababab] text-sm font-medium">
                  Transfer to Table
                </label>
                <select
                  value={transferTargetId}
                  onChange={(e) => setTransferTargetId(e.target.value)}
                  className="w-full bg-[#1f1f1f] text-[#f5f5f5] px-4 py-3 rounded-lg outline-none"
                >
                  <option value="">Select available table</option>
                  {transferCandidateTables.map((t) => (
                    <option key={t._id} value={t._id}>
                      Table #{t.tableNo} · {t.seats} seats
                    </option>
                  ))}
                </select>
                {transferCandidateTables.length === 0 && (
                  <p className="text-xs text-red-400">No available tables to transfer to.</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowTransferUI(false);
                      setTransferTargetId("");
                    }}
                    className="flex-1 bg-[#333] text-[#ababab] py-2 rounded-lg font-semibold text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTransfer}
                    disabled={!transferTargetId || transferMutation.isPending}
                    className={`flex-1 bg-[#025cca] text-[#f5f5f5] py-2 rounded-lg font-semibold text-sm ${
                      !transferTargetId || transferMutation.isPending
                        ? "opacity-60 cursor-not-allowed"
                        : ""
                    }`}
                  >
                    {transferMutation.isPending ? "Transferring..." : "Confirm Transfer"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(settleTarget)} onClose={() => setSettleTarget(null)} title="Settle Payment">
        <div className="space-y-3 text-sm text-[#f5f5f5]">
          <p>Order: {settleTarget?.readableOrderId}</p>
          <p>Customer: {settleTarget?.customerName}</p>
          <p>Table: #{settleTarget?.tableNo}</p>
          <p>Total: €{Number(settleTarget?.totalWithTax || 0).toFixed(2)}</p>

          <div>
            <label className="block text-[#ababab] mb-2 text-sm font-medium">Payment Method</label>
            <div className="flex gap-2">
              <button
                onClick={() => setSettlePaymentMethod("Cash")}
                className={`px-4 py-2 rounded-lg ${
                  settlePaymentMethod === "Cash"
                    ? "bg-[#2e4a40] text-[#9ef0bb]"
                    : "bg-[#1f1f1f] text-[#ababab]"
                }`}
              >
                Cash
              </button>
              <button
                disabled
                className="px-4 py-2 rounded-lg bg-[#2a2a2a] text-[#686868] cursor-not-allowed"
                title="Enable after Stripe environment configuration"
              >
                Online (Stripe pending config)
              </button>
            </div>
          </div>

          <button
            onClick={confirmSettlement}
            disabled={settleMutation.isPending}
            className={`w-full bg-[#F6B100] text-[#1f1f1f] rounded-lg py-3 mt-2 font-semibold ${
              settleMutation.isPending ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            {settleMutation.isPending ? "Settling..." : "Confirm Checkout"}
          </button>
        </div>
      </Modal>

      <BottomNav />
    </section>
  );
};

export default Tables;
