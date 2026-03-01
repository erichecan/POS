import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import BottomNav from "../components/shared/BottomNav";
import BackButton from "../components/shared/BackButton";
import TableCard from "../components/tables/TableCard";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useVerticalProfile } from "../contexts/VerticalProfileContext";
// 2026-02-24T12:00:05Z: 转台/并台/拆台/撤销并台迁移到 Tables
// 2026-02-28T12:20:00+08:00: PRD 7.22 - tableServiceProfile 控制并台/拆台/席位分单显示
// 2026-03-01T14:30:00+08:00: iPad 点餐 UX - 右侧上下文面板（订单详情 | 收银）
import {
  getTables,
  settleOrder,
  transferTableOrder,
  mergeTableOrders,
  splitTableOrder,
  splitTableOrderBySeat,
  unmergeTableOrders,
} from "../https";
import { enqueueSnackbar } from "notistack";
import Modal from "../components/shared/Modal";
import PaymentTenderPanel from "../components/tender/PaymentTenderPanel";
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
  // 2026-02-26T21:00:00+08:00: i18n internationalization
  const { t } = useTranslation();
  const [status, setStatus] = useState("all");
  const [openTableTarget, setOpenTableTarget] = useState(null);
  const [bookedTableTarget, setBookedTableTarget] = useState(null);
  const [guestDraft, setGuestDraft] = useState(1);
  const [nameDraft, setNameDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [mergeWithTableId, setMergeWithTableId] = useState("");
  const [settleTarget, setSettleTarget] = useState(null);
  const [settlePaymentMethod, setSettlePaymentMethod] = useState("Cash");
  // 2026-02-24T12:00:15Z: 转台/并台/拆台/撤销并台 state
  const [showTransferUI, setShowTransferUI] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState("");
  const [showMergeUI, setShowMergeUI] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [showSplitUI, setShowSplitUI] = useState(false);
  const [splitTargetId, setSplitTargetId] = useState("");
  const [splitSelectedItems, setSplitSelectedItems] = useState([]); // { key, name, maxQty, splitQty, pricePerQuantity?, seatNo? }
  const [splitGuests, setSplitGuests] = useState(1);
  const [showSplitBySeatUI, setShowSplitBySeatUI] = useState(false);
  const [splitBySeatTargetId, setSplitBySeatTargetId] = useState("");
  const [splitBySeatNos, setSplitBySeatNos] = useState("");
  const [showUnmergeUI, setShowUnmergeUI] = useState(false);
  // 2026-03-01T14:30:00+08:00: 右侧面板标签 order|payment
  const [rightPanelTab, setRightPanelTab] = useState("order");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { resolved } = useVerticalProfile();
  const tsp = resolved?.tableServiceProfile || {};
  const supportsMerge = tsp.supportsTableMerge === true;
  const supportsSeatSplit = tsp.supportsSeatSplit === true;

  useEffect(() => {
    document.title = `POS | ${t("tables.title")}`;
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

  // 2026-02-24T12:00:20Z: 转台 mutation
  const transferMutation = useMutation({
    mutationFn: (data) => transferTableOrder(data),
    onSuccess: () => {
      enqueueSnackbar(t("tables.transferSuccess") || "Table transferred successfully.", {
        variant: "success",
      });
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

  const mergeMutation = useMutation({
    mutationFn: (data) => mergeTableOrders(data),
    onSuccess: () => {
      enqueueSnackbar(t("tables.mergeSuccess") || "Table orders merged successfully.", {
        variant: "success",
      });
      setShowMergeUI(false);
      setMergeTargetId("");
      setBookedTableTarget(null);
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      const message = error.response?.data?.message || "Failed to merge table orders.";
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  const splitMutation = useMutation({
    mutationFn: (data) => splitTableOrder(data),
    onSuccess: () => {
      enqueueSnackbar(t("tables.splitSuccess") || "Table order split successfully.", {
        variant: "success",
      });
      setShowSplitUI(false);
      setSplitTargetId("");
      setSplitSelectedItems([]);
      setBookedTableTarget(null);
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      const message = error.response?.data?.message || "Failed to split table order.";
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  const splitBySeatMutation = useMutation({
    mutationFn: (data) => splitTableOrderBySeat(data),
    onSuccess: () => {
      enqueueSnackbar(t("tables.splitBySeatSuccess") || "Table order split by seats successfully.", {
        variant: "success",
      });
      setShowSplitBySeatUI(false);
      setSplitBySeatTargetId("");
      setSplitBySeatNos("");
      setBookedTableTarget(null);
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      const message =
        error.response?.data?.message || "Failed to split table order by seats.";
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  const unmergeMutation = useMutation({
    mutationFn: (data) => unmergeTableOrders(data),
    onSuccess: () => {
      enqueueSnackbar(t("tables.unmergeSuccess") || "Table orders unmerged successfully.", {
        variant: "success",
      });
      setShowUnmergeUI(false);
      setBookedTableTarget(null);
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      const message = error.response?.data?.message || "Failed to unmerge table orders.";
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

  // 2026-02-24T12:00:25Z: 转台目标：空闲桌台
  const transferCandidateTables = useMemo(() => {
    if (!bookedTableTarget?._id) return [];
    return tablesData.filter(
      (t) => t.status === "Available" && `${t._id}` !== `${bookedTableTarget._id}`
    );
  }, [tablesData, bookedTableTarget]);

  // 并台目标：其他已订桌（不同订单，堂食现金）
  const mergeCandidateBookedTables = useMemo(() => {
    if (!bookedTableTarget?._id) return [];
    const currentOrderId = bookedTableTarget?.currentOrder?._id;
    const order = bookedTableTarget?.currentOrder;
    if (!order || !["Cash", "Pending"].includes(order.paymentMethod)) return [];
    return tablesData.filter((t) => {
      if (t.status !== "Booked" || !t.currentOrder) return false;
      if (`${t._id}` === `${bookedTableTarget._id}`) return false;
      if (`${t.currentOrder._id}` === `${currentOrderId}`) return false;
      const o = t.currentOrder;
      return ["Cash", "Pending"].includes(o.paymentMethod || "");
    });
  }, [tablesData, bookedTableTarget]);

  // 拆台目标：空闲桌台
  const splitTargetTables = useMemo(() => {
    if (!bookedTableTarget?._id) return [];
    return tablesData.filter(
      (t) => t.status === "Available" && `${t._id}` !== `${bookedTableTarget._id}`
    );
  }, [tablesData, bookedTableTarget]);

  // 当前订单是否有可撤销的并台记录
  const hasMergeHistory = useMemo(() => {
    const history = bookedTableTarget?.currentOrder?.mergeHistory || [];
    return history.some((e) => !e.unmergedAt);
  }, [bookedTableTarget]);

  // 订单菜品中已有 seatNo 的座位号集合
  const orderSeatNos = useMemo(() => {
    const items = bookedTableTarget?.currentOrder?.items || [];
    const set = new Set();
    items.forEach((item) => {
      const n = item.seatNo;
      if (n !== undefined && n !== null && Number.isInteger(Number(n)) && Number(n) >= 1) {
        set.add(Number(n));
      }
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [bookedTableTarget]);

  // 2026-02-24T12:00:30Z: 后端 API 使用 fromTableId/toTableId
  const handleTransfer = () => {
    if (!transferTargetId || !bookedTableTarget?._id) return;
    transferMutation.mutate({
      fromTableId: bookedTableTarget._id,
      toTableId: transferTargetId,
    });
  };

  const handleMerge = () => {
    if (!mergeTargetId || !bookedTableTarget?._id) return;
    mergeMutation.mutate({
      fromTableId: bookedTableTarget._id,
      toTableId: mergeTargetId,
    });
  };

  const handleSplit = () => {
    if (!splitTargetId || !bookedTableTarget?._id) return;
    const items = splitSelectedItems
      .filter((s) => s.splitQty > 0)
      .map((s) => {
        const base = { name: s.name, quantity: s.splitQty };
        if (s.pricePerQuantity != null) base.pricePerQuantity = s.pricePerQuantity;
        if (s.seatNo != null) base.seatNo = s.seatNo;
        return base;
      });
    if (items.length === 0) {
      enqueueSnackbar(t("tables.selectItemsForSplit") || "请至少选择一项菜品", {
        variant: "warning",
      });
      return;
    }
    splitMutation.mutate({
      fromTableId: bookedTableTarget._id,
      toTableId: splitTargetId,
      items,
      splitGuests: splitGuests >= 1 ? splitGuests : undefined,
    });
  };

  const handleSplitBySeat = () => {
    if (!splitBySeatTargetId || !bookedTableTarget?._id) return;
    const seatNos = `${splitBySeatNos || ""}`
      .split(/[,，\s]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 1);
    if (seatNos.length === 0) {
      enqueueSnackbar(t("tables.enterSeatNos") || "请输入座位号（如 1,2）", {
        variant: "warning",
      });
      return;
    }
    splitBySeatMutation.mutate({
      fromTableId: bookedTableTarget._id,
      toTableId: splitBySeatTargetId,
      seatNos,
    });
  };

  const handleUnmerge = () => {
    const orderId = bookedTableTarget?.currentOrder?._id;
    if (!orderId) return;
    unmergeMutation.mutate({ targetOrderId: orderId });
  };

  // 拆台：初始化勾选项（从订单菜品）
  const orderItemsForSplit = useMemo(() => {
    const items = bookedTableTarget?.currentOrder?.items || [];
    return items.map((item, idx) => ({
      key: `${item.name || ""}::${item.pricePerQuantity || 0}::${item.seatNo ?? "*"}::${idx}`,
      name: item.name,
      quantity: Number(item.quantity || 1),
      pricePerQuantity: item.pricePerQuantity,
      seatNo: item.seatNo,
    }));
  }, [bookedTableTarget]);

  useEffect(() => {
    if (isError) {
      enqueueSnackbar("Something went wrong!", { variant: "error" });
    }
  }, [isError]);

  // 2026-02-24T12:00:35Z: 打开拆台 UI 时初始化勾选项与拆分人数
  useEffect(() => {
    if (showSplitUI && orderItemsForSplit.length > 0) {
      setSplitSelectedItems(
        orderItemsForSplit.map((item) => ({
          key: item.key,
          name: item.name,
          maxQty: item.quantity,
          splitQty: 0,
          pricePerQuantity: item.pricePerQuantity,
          seatNo: item.seatNo,
        }))
      );
      const guests = Number(bookedTableTarget?.currentOrder?.customerDetails?.guests || 1);
      setSplitGuests(guests > 1 ? Math.floor(guests / 2) : 1);
    }
  }, [showSplitUI, orderItemsForSplit, bookedTableTarget]);

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
    setRightPanelTab("order");
    setSettleTarget(null);
    setShowTransferUI(false);
    setTransferTargetId("");
    setShowMergeUI(false);
    setMergeTargetId("");
    setShowSplitUI(false);
    setSplitTargetId("");
    setSplitSelectedItems([]);
    setShowSplitBySeatUI(false);
    setSplitBySeatTargetId("");
    setSplitBySeatNos("");
    setShowUnmergeUI(false);
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
    setRightPanelTab("payment");
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
          <h1 className="text-[#f5f5f5] text-xl md:text-2xl font-bold tracking-wider">{t("tables.title")}</h1>
          <button
            onClick={() => navigate("/tables/layout")}
            className="bg-[#2f4f7a] text-[#dfefff] min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold"
          >
            {t("tables.layoutDesigner")}
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
            {t("tables.all")}
          </button>
          <button
            onClick={() => setStatus("booked")}
            className={`text-[#ababab] text-sm md:text-base min-h-[44px] ${
              status === "booked" && "bg-[#383838] rounded-lg px-4 py-2"
            } rounded-lg px-4 py-2 font-semibold`}
          >
            {t("tables.booked")}
          </button>
          </div>
        </div>
      </div>

      <div
        className={`flex flex-1 min-h-0 ${bookedTableTarget ? "flex-row gap-0" : ""}`}
      >
        <div
          className={`grid gap-3 px-6 md:px-10 xl:px-16 py-4 pb-36 flex-1 min-h-0 overflow-y-auto ${
            bookedTableTarget
              ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4"
              : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5"
          }`}
        >
          {filteredTables.length > 0 ? (
            filteredTables.map((table) => (
              <TableCard key={table._id} table={table} onOpen={openTableModal} />
            ))
          ) : (
            <p className="col-span-5 text-gray-500">{t("tables.noTables")}</p>
          )}
        </div>

        {bookedTableTarget && (
          <aside className="w-full lg:w-96 xl:w-[26rem] shrink-0 flex flex-col bg-[#252525] border-l border-[#333] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] shrink-0">
              <div className="flex gap-1">
                <button
                  onClick={() => setRightPanelTab("order")}
                  className={`px-3 py-1.5 rounded text-sm font-medium ${
                    rightPanelTab === "order"
                      ? "bg-[#383838] text-[#f5f5f5]"
                      : "text-[#ababab] hover:text-[#f5f5f5]"
                  }`}
                >
                  {t("tables.panelOrderDetails")}
                </button>
                <button
                  onClick={() => {
                    if (!settleTarget) openSettlementModal();
                    else setRightPanelTab("payment");
                  }}
                  className={`px-3 py-1.5 rounded text-sm font-medium ${
                    rightPanelTab === "payment"
                      ? "bg-[#383838] text-[#f5f5f5]"
                      : "text-[#ababab] hover:text-[#f5f5f5]"
                  }`}
                >
                  {t("tables.panelPayment")}
                </button>
              </div>
              <button
                onClick={closeBookedDetailModal}
                className="p-1.5 text-[#ababab] hover:text-[#f5f5f5] rounded"
                aria-label={t("common.close")}
              >
                &times;
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {rightPanelTab === "order" ? (
                <div className="p-4 space-y-2 text-sm text-[#f5f5f5]">
                  <p>{t("tables.table")}: #{bookedTableTarget?.tableNo}</p>
                  <p>{t("tables.seats")}: {bookedTableTarget?.seats}</p>
                  <p>
                    {t("tables.order")} {formatReadableOrderId(bookedTableTarget?.currentOrder?._id)}
                  </p>
                  <p>
                    {t("tables.customer")}{" "}
                    {getReadableCustomerName(
                      bookedTableTarget?.currentOrder?.customerDetails?.name,
                      bookedTableTarget?.currentOrder?.customerDetails?.phone
                    )}
                  </p>
                  <p>{t("tables.phoneLabel")} {bookedTableTarget?.currentOrder?.customerDetails?.phone || "N/A"}</p>
                  <p>{t("tables.guestsLabel")} {bookedTableTarget?.currentOrder?.customerDetails?.guests || "N/A"}</p>
                  <p>
                    {t("tables.bookedAt")}{" "}
                    {bookedTableTarget?.currentOrder?.orderDate
                      ? formatDateAndTime(bookedTableTarget.currentOrder.orderDate)
                      : "N/A"}
                  </p>
                  <p>{t("tables.statusLabel")} {bookedTableTarget?.currentOrder?.orderStatus || "N/A"}</p>
                  <p>
                    {t("tables.itemsLabel")}{" "}
                    {Array.isArray(bookedTableTarget?.currentOrder?.items)
                      ? bookedTableTarget.currentOrder.items.length
                      : 0}
                  </p>
                  <p>
                    {t("tables.currentBill")} €
                    {Number(bookedTableTarget?.currentOrder?.bills?.totalWithTax || 0).toFixed(2)}
                  </p>

                  <div className="pt-3 flex gap-3">
                    <button
                      onClick={enterBookedOrderMenu}
                      className="flex-1 bg-[#2f4f7a] text-[#e6f0ff] py-2 rounded-lg font-semibold"
                    >
                      {t("tables.addEditItems")}
                    </button>
                    <button
                      onClick={openSettlementModal}
                      className="flex-1 bg-[#F6B100] text-[#1f1f1f] py-2 rounded-lg font-semibold"
                    >
                      {t("tables.checkout")}
                    </button>
                  </div>

                  {/* 转台 */}
                  <div className="pt-3 border-t border-[#333] mt-3">
                    {!showTransferUI ? (
                      <button
                        onClick={() => setShowTransferUI(true)}
                        className="w-full bg-[#333] text-[#f5f5f5] py-2 rounded-lg font-semibold text-sm"
                      >
                        {t("tables.transferTable")}
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <label className="block text-[#ababab] text-sm font-medium">
                          {t("tables.transferTo")}
                        </label>
                        <select
                          value={transferTargetId}
                          onChange={(e) => setTransferTargetId(e.target.value)}
                          className="w-full bg-[#1f1f1f] text-[#f5f5f5] px-4 py-3 rounded-lg outline-none"
                        >
                          <option value="">{t("tables.selectAvailableTable")}</option>
                          {transferCandidateTables.map((tbl) => (
                            <option key={tbl._id} value={tbl._id}>
                              {t("tables.table")} #{tbl.tableNo} · {tbl.seats} {t("tables.seats")}
                            </option>
                          ))}
                        </select>
                        {transferCandidateTables.length === 0 && (
                          <p className="text-xs text-red-400">{t("tables.noTransferTable")}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setShowTransferUI(false);
                              setTransferTargetId("");
                            }}
                            className="flex-1 bg-[#333] text-[#ababab] py-2 rounded-lg font-semibold text-sm"
                          >
                            {t("common.cancel")}
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
                            {transferMutation.isPending ? t("tables.transferring") : t("tables.confirmTransfer")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 并台 */}
                  {supportsMerge && (
                    <div className="pt-3 border-t border-[#333] mt-3">
                      {!showMergeUI ? (
                        <button
                          onClick={() => setShowMergeUI(true)}
                          className="w-full bg-[#333] text-[#f5f5f5] py-2 rounded-lg font-semibold text-sm"
                          disabled={mergeCandidateBookedTables.length === 0}
                        >
                          {t("tables.mergeTable")}
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <label className="block text-[#ababab] text-sm font-medium">
                            {t("tables.mergeInto")}
                          </label>
                          <select
                            value={mergeTargetId}
                            onChange={(e) => setMergeTargetId(e.target.value)}
                            className="w-full bg-[#1f1f1f] text-[#f5f5f5] px-4 py-3 rounded-lg outline-none"
                          >
                            <option value="">{t("tables.selectBookedTable")}</option>
                            {mergeCandidateBookedTables.map((tbl) => (
                              <option key={tbl._id} value={tbl._id}>
                                {t("tables.table")} #{tbl.tableNo} · {tbl.seats} {t("tables.seats")}
                              </option>
                            ))}
                          </select>
                          {mergeCandidateBookedTables.length === 0 && (
                            <p className="text-xs text-red-400">{t("tables.noMergeTarget")}</p>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setShowMergeUI(false);
                                setMergeTargetId("");
                              }}
                              className="flex-1 bg-[#333] text-[#ababab] py-2 rounded-lg font-semibold text-sm"
                            >
                              {t("common.cancel")}
                            </button>
                            <button
                              onClick={handleMerge}
                              disabled={!mergeTargetId || mergeMutation.isPending}
                              className={`flex-1 bg-[#2e4a40] text-[#9ef0bb] py-2 rounded-lg font-semibold text-sm ${
                                !mergeTargetId || mergeMutation.isPending
                                  ? "opacity-60 cursor-not-allowed"
                                  : ""
                              }`}
                            >
                              {mergeMutation.isPending ? t("tables.merging") : t("tables.confirmMerge")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 拆台 */}
                  {supportsMerge && (
                    <div className="pt-3 border-t border-[#333] mt-3">
                      {!showSplitUI ? (
                        <button
                          onClick={() => setShowSplitUI(true)}
                          className="w-full bg-[#333] text-[#f5f5f5] py-2 rounded-lg font-semibold text-sm"
                          disabled={
                            splitTargetTables.length === 0 ||
                            !(bookedTableTarget?.currentOrder?.items?.length > 0)
                          }
                        >
                          {t("tables.splitTable")}
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <label className="block text-[#ababab] text-sm font-medium">
                            {t("tables.splitTo")}
                          </label>
                          <select
                            value={splitTargetId}
                            onChange={(e) => setSplitTargetId(e.target.value)}
                            className="w-full bg-[#1f1f1f] text-[#f5f5f5] px-4 py-3 rounded-lg outline-none"
                          >
                            <option value="">{t("tables.selectAvailableTable")}</option>
                            {splitTargetTables.map((tbl) => (
                              <option key={tbl._id} value={tbl._id}>
                                {t("tables.table")} #{tbl.tableNo} · {tbl.seats} {t("tables.seats")}
                              </option>
                            ))}
                          </select>
                          <label className="block text-[#ababab] text-sm font-medium mt-2">
                            {t("tables.selectItemsForSplit")}
                          </label>
                          <div className="max-h-[120px] overflow-y-auto space-y-1 bg-[#1f1f1f] rounded-lg p-2">
                            {splitSelectedItems.map((item) => (
                              <div key={item.key} className="flex items-center justify-between gap-2 text-sm">
                                <span className="text-[#f5f5f5] truncate flex-1">
                                  {item.name} ×{item.maxQty}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSplitSelectedItems((prev) =>
                                        prev.map((p) =>
                                          p.key === item.key
                                            ? { ...p, splitQty: Math.max(0, p.splitQty - 1) }
                                            : p
                                        )
                                      )
                                    }
                                    className="bg-[#333] text-[#f5f5f5] w-7 h-7 rounded text-center"
                                  >
                                    −
                                  </button>
                                  <span className="text-[#f5f5f5] w-6 text-center">{item.splitQty}</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSplitSelectedItems((prev) =>
                                        prev.map((p) =>
                                          p.key === item.key
                                            ? { ...p, splitQty: Math.min(p.maxQty, p.splitQty + 1) }
                                            : p
                                        )
                                      )
                                    }
                                    className="bg-[#333] text-[#f5f5f5] w-7 h-7 rounded text-center"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <label className="block text-[#ababab] text-sm font-medium">
                            {t("tables.splitGuests")}
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={splitGuests}
                            onChange={(e) => setSplitGuests(Math.max(1, Number(e.target.value) || 1))}
                            className="w-full bg-[#1f1f1f] text-[#f5f5f5] px-4 py-2 rounded-lg outline-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setShowSplitUI(false);
                                setSplitTargetId("");
                                setSplitSelectedItems([]);
                              }}
                              className="flex-1 bg-[#333] text-[#ababab] py-2 rounded-lg font-semibold text-sm"
                            >
                              {t("common.cancel")}
                            </button>
                            <button
                              onClick={handleSplit}
                              disabled={
                                !splitTargetId ||
                                splitMutation.isPending ||
                                splitSelectedItems.every((s) => s.splitQty === 0)
                              }
                              className={`flex-1 bg-[#025cca] text-[#f5f5f5] py-2 rounded-lg font-semibold text-sm ${
                                !splitTargetId ||
                                splitMutation.isPending ||
                                splitSelectedItems.every((s) => s.splitQty === 0)
                                  ? "opacity-60 cursor-not-allowed"
                                  : ""
                              }`}
                            >
                              {splitMutation.isPending ? t("tables.splitting") : t("tables.confirmSplit")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 按座位拆台 */}
                  {supportsSeatSplit && (
                    <div className="pt-3 border-t border-[#333] mt-3">
                      {!showSplitBySeatUI ? (
                        <button
                          onClick={() => setShowSplitBySeatUI(true)}
                          className="w-full bg-[#333] text-[#f5f5f5] py-2 rounded-lg font-semibold text-sm"
                          disabled={
                            splitTargetTables.length === 0 ||
                            orderSeatNos.length === 0
                          }
                        >
                          {t("tables.splitBySeat")}
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <label className="block text-[#ababab] text-sm font-medium">
                            {t("tables.splitTo")}
                          </label>
                          <select
                            value={splitBySeatTargetId}
                            onChange={(e) => setSplitBySeatTargetId(e.target.value)}
                            className="w-full bg-[#1f1f1f] text-[#f5f5f5] px-4 py-3 rounded-lg outline-none"
                          >
                            <option value="">{t("tables.selectAvailableTable")}</option>
                            {splitTargetTables.map((tbl) => (
                              <option key={tbl._id} value={tbl._id}>
                                {t("tables.table")} #{tbl.tableNo} · {tbl.seats} {t("tables.seats")}
                              </option>
                            ))}
                          </select>
                          <label className="block text-[#ababab] text-sm font-medium">
                            {t("tables.seatNosHint")}
                          </label>
                          <input
                            type="text"
                            placeholder="1,2,3"
                            value={splitBySeatNos}
                            onChange={(e) => setSplitBySeatNos(e.target.value)}
                            className="w-full bg-[#1f1f1f] text-[#f5f5f5] px-4 py-3 rounded-lg outline-none"
                          />
                          {orderSeatNos.length > 0 && (
                            <p className="text-xs text-[#9ed4ff]">
                              {t("tables.availableSeats")}: {orderSeatNos.join(", ")}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setShowSplitBySeatUI(false);
                                setSplitBySeatTargetId("");
                                setSplitBySeatNos("");
                              }}
                              className="flex-1 bg-[#333] text-[#ababab] py-2 rounded-lg font-semibold text-sm"
                            >
                              {t("common.cancel")}
                            </button>
                            <button
                              onClick={handleSplitBySeat}
                              disabled={
                                !splitBySeatTargetId ||
                                splitBySeatMutation.isPending ||
                                !splitBySeatNos.trim()
                              }
                              className={`flex-1 bg-[#025cca] text-[#f5f5f5] py-2 rounded-lg font-semibold text-sm ${
                                !splitBySeatTargetId ||
                                splitBySeatMutation.isPending ||
                                !splitBySeatNos.trim()
                                  ? "opacity-60 cursor-not-allowed"
                                  : ""
                              }`}
                            >
                              {splitBySeatMutation.isPending
                                ? t("tables.splitting")
                                : t("tables.confirmSplitBySeat")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 撤销并台 */}
                  {supportsMerge && hasMergeHistory && (
                    <div className="pt-3 border-t border-[#333] mt-3">
                      {!showUnmergeUI ? (
                        <button
                          onClick={() => setShowUnmergeUI(true)}
                          className="w-full bg-[#333] text-[#f5c6c6] py-2 rounded-lg font-semibold text-sm"
                        >
                          {t("tables.unmergeTable")}
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-[#ababab]">{t("operations.unmergeDesc")}</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowUnmergeUI(false)}
                              className="flex-1 bg-[#333] text-[#ababab] py-2 rounded-lg font-semibold text-sm"
                            >
                              {t("common.cancel")}
                            </button>
                            <button
                              onClick={handleUnmerge}
                              disabled={unmergeMutation.isPending}
                              className={`flex-1 bg-[#5c2a2a] text-[#f5c6c6] py-2 rounded-lg font-semibold text-sm ${
                                unmergeMutation.isPending ? "opacity-60 cursor-not-allowed" : ""
                              }`}
                            >
                              {unmergeMutation.isPending
                                ? t("tables.unmerging")
                                : t("tables.confirmUnmerge")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : !settleTarget ? (
                <div className="p-4 text-[#ababab] text-sm">
                  <button
                    onClick={openSettlementModal}
                    className="w-full bg-[#F6B100] text-[#1f1f1f] py-3 rounded-lg font-semibold"
                  >
                    {t("tables.checkout")}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4 p-4 max-h-full overflow-y-auto">
                  <div className="space-y-2 text-sm text-[#f5f5f5] border-b border-[#333] pb-4">
                    <p>{t("tables.order")} {settleTarget?.readableOrderId}</p>
                    <p>{t("tables.customer")} {settleTarget?.customerName}</p>
                    <p>{t("tables.table")}: #{settleTarget?.tableNo}</p>
                    <p className="font-bold">{t("common.total")}: €{Number(settleTarget?.totalWithTax || 0).toFixed(2)}</p>
                  </div>
                  <PaymentTenderPanel
                    total={settleTarget?.totalWithTax}
                    onPayCash={() => confirmSettlement()}
                    disabled={settleMutation.isPending}
                    currencySymbol="€"
                  />
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      <Modal isOpen={Boolean(openTableTarget)} onClose={closeOpenTableModal} title={t("tables.openTable")}>
        <div className="space-y-3">
          <div className="text-sm text-[#ababab]">
            {t("tables.table")} <span className="text-[#f5f5f5] font-semibold">#{openTableTarget?.tableNo}</span> · {t("tables.seats")}{" "}
            <span className="text-[#f5f5f5] font-semibold">{openTableTarget?.seats}</span>
          </div>
          <div>
            <label className="block text-[#ababab] mb-2 text-sm font-medium">{t("tables.customerName")}</label>
            <div className="flex items-center rounded-lg p-3 px-4 bg-[#1f1f1f]">
              <input
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                placeholder={t("tables.enterCustomerName")}
                className="bg-transparent flex-1 text-white focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-[#ababab] mb-2 text-sm font-medium">{t("tables.customerPhone")}</label>
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
            <label className="block mb-2 text-sm font-medium text-[#ababab]">{t("tables.guests")}</label>
            <div className="flex items-center justify-between bg-[#1f1f1f] px-4 py-3 rounded-lg">
              <button
                onClick={() => setGuestDraft((prev) => Math.max(1, Number(prev || 1) - 1))}
                className="text-yellow-500 text-2xl"
              >
                &minus;
              </button>
              <span className="text-white">{guestDraft} {t("common.person")}</span>
              <button
                onClick={() => setGuestDraft((prev) => Math.min(20, Number(prev || 1) + 1))}
                className="text-yellow-500 text-2xl"
              >
                &#43;
              </button>
            </div>
            {Number(guestDraft) > Number(openTableTarget?.seats || 0) && (
              <p className="text-xs text-yellow-400 mt-2">
                {t("tables.guestsExceedCapacity")}
              </p>
            )}
          </div>

          {Number(guestDraft) > Number(openTableTarget?.seats || 0) && (
            <div>
              <label className="block mb-2 text-sm font-medium text-[#ababab]">{t("tables.mergeWithTable")}</label>
              <select
                value={mergeWithTableId}
                onChange={(event) => setMergeWithTableId(event.target.value)}
                className="w-full bg-[#1f1f1f] text-[#f5f5f5] px-4 py-3 rounded-lg outline-none"
              >
                <option value="">{t("tables.selectAvailableTable")}</option>
                {mergeCandidateTables.map((table) => (
                  <option key={table._id} value={table._id}>
                    {t("tables.table")} #{table.tableNo} · {table.seats} {t("tables.seats")}
                  </option>
                ))}
              </select>
              {mergeCandidateTables.length === 0 && (
                <p className="text-xs text-red-400 mt-2">{t("tables.noMergeTable")}</p>
              )}
              {selectedMergeTable && (
                <p className="text-xs text-[#9ed4ff] mt-2">
                  {t("tables.combinedSeats")} {Number(openTableTarget?.seats || 0) + Number(selectedMergeTable.seats || 0)}
                </p>
              )}
            </div>
          )}
          <button
            onClick={proceedToMenu}
            className="w-full bg-[#F6B100] text-[#1f1f1f] rounded-lg py-3 mt-2 font-semibold"
          >
            {t("tables.openTableAndStartOrder")}
          </button>
        </div>
      </Modal>

      <BottomNav />
    </section>
  );
};

export default Tables;
