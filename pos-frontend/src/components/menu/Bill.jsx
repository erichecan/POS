// 2026-02-26T21:00:00+08:00: i18n
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { getTotalPrice, removeAllItems, setItems } from "../../redux/slices/cartSlice";
import { addOrder, getReceiptTemplate, updateOrderItems, updateTable } from "../../https/index";
import { enqueueSnackbar } from "notistack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { removeCustomer } from "../../redux/slices/customerSlice";
import Invoice from "../invoice/Invoice";
import OrderActionToolbar from "../order/OrderActionToolbar";
import { formatDateAndTime, formatReadableOrderId, getDefaultCartRowId } from "../../utils";

const DEFAULT_RECEIPT_TEMPLATE = {
  storeName: "POS Store",
  headerTitle: "Order Receipt",
  footerMessage: "Thank you for your visit.",
  fields: {
    showOrderId: true,
    showOrderDate: true,
    showTableNo: true,
    showCustomerName: true,
    showCustomerPhone: false,
    showGuests: true,
    showItemNotes: true,
    showItemModifiers: true,
    showTaxBreakdown: true,
    showPaymentMethod: true,
  },
};

const getModifierDelta = (modifiers = []) =>
  Number(
    (Array.isArray(modifiers) ? modifiers : []).reduce(
      (sum, row) => sum + Number(row?.priceDelta || 0),
      0
    ).toFixed(2)
  );

const validateCartItemOptions = (items = []) => {
  const safeItems = Array.isArray(items) ? items : [];
  for (const item of safeItems) {
    const groups = Array.isArray(item?.optionGroups) ? item.optionGroups : [];
    if (!groups.length) {
      continue;
    }

    const selectedByGroup = (Array.isArray(item?.modifiers) ? item.modifiers : []).reduce((acc, row) => {
      const groupId = `${row?.groupId || ""}`.trim();
      if (!groupId) {
        return acc;
      }
      if (!acc[groupId]) {
        acc[groupId] = 0;
      }
      acc[groupId] += 1;
      return acc;
    }, {});

    for (const group of groups) {
      const groupId = `${group?.id || ""}`.trim();
      if (!groupId) {
        continue;
      }
      const selectedCount = Number(selectedByGroup[groupId] || 0);
      const isRequired = Boolean(group?.required);
      const minSelect = Number(group?.minSelect || 0);
      const maxSelect = Number(group?.maxSelect || 0);

      if (isRequired && selectedCount < 1) {
        return `${item.name} 缺少必选项：${group.name}`;
      }
      if (Number.isInteger(minSelect) && minSelect > 0 && selectedCount < minSelect) {
        return `${item.name} 需要至少选择 ${minSelect} 个「${group.name}」`;
      }
      if (Number.isInteger(maxSelect) && maxSelect > 0 && selectedCount > maxSelect) {
        return `${item.name} 最多选择 ${maxSelect} 个「${group.name}」`;
      }
      if (group.type !== "multi" && selectedCount > 1) {
        return `${item.name} 的「${group.name}」只能单选`;
      }
    }
  }

  return "";
};

// 2026-02-26T00:00:00Z: Split Bill (AA制) functionality
const SPLIT_MODE_EVEN = "even";
const SPLIT_MODE_ITEM = "item";

const Bill = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const customerData = useSelector((state) => state.customer);
  const cartData = useSelector((state) => state.cart);
  const total = useSelector(getTotalPrice);
  const taxRate = Number(import.meta.env.VITE_TAX_RATE_PERCENT || 5.25);
  const cardSurchargeRate = Number(import.meta.env.VITE_CARD_SURCHARGE_PERCENT || 0);
  const tax = (total * taxRate) / 100;
  const cardSurcharge = cardSurchargeRate > 0 ? (total * cardSurchargeRate) / 100 : 0;
  const totalPriceWithTax = total + tax;
  const isEditingExistingOrder = Boolean(customerData?.activeOrderId);

  const [showInvoice, setShowInvoice] = useState(false);
  const [orderInfo, setOrderInfo] = useState();

  const [showSplitPanel, setShowSplitPanel] = useState(false);
  const [splitMode, setSplitMode] = useState(SPLIT_MODE_EVEN);
  const [splitPeople, setSplitPeople] = useState(2);
  const [splitGroups, setSplitGroups] = useState([
    { name: "Guest 1", itemIndices: [] },
    { name: "Guest 2", itemIndices: [] },
  ]);

  const receiptTemplateQuery = useQuery({
    queryKey: ["receipt-template"],
    queryFn: async () => {
      const response = await getReceiptTemplate();
      return response.data?.data;
    },
    staleTime: 60 * 1000,
  });

  const orderMutation = useMutation({
    mutationFn: (reqData) => {
      if (isEditingExistingOrder) {
        return updateOrderItems({
          orderId: customerData.activeOrderId,
          ...reqData,
        });
      }
      return addOrder(reqData);
    },
    onSuccess: async (resData) => {
      const { data } = resData.data;
      setOrderInfo(data);

      if (isEditingExistingOrder) {
        enqueueSnackbar("Order updated. You can continue adding items or checkout from table details.", {
          variant: "success",
        });
        const optionGroupLookup = new Map(
          (Array.isArray(cartData) ? cartData : []).map((item) => [`${item.name}`.trim().toLowerCase(), item.optionGroups || []])
        );
        const mappedItems = (data.items || []).map((item, index) => ({
          id: getDefaultCartRowId(item, index),
          name: item.name,
          quantity: Number(item.quantity || 1),
          basePrice: Number(item.basePrice || Number(item.pricePerQuantity || 0) - getModifierDelta(item.modifiers)),
          pricePerQuantity: Number(item.pricePerQuantity || 0),
          price: Number(item.price || 0),
          note: `${item.note || ""}`.trim(),
          modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
          optionGroups: optionGroupLookup.get(`${item.name}`.trim().toLowerCase()) || [],
        }));
        if (mappedItems.length === 0) {
          dispatch(setItems(Array.isArray(cartData) ? cartData : []));
          enqueueSnackbar("Order updated but server returned empty items. Local cart is kept for safety.", {
            variant: "warning",
          });
        } else {
          dispatch(setItems(mappedItems));
        }
        setShowInvoice(false);
      } else {
        const linkedTables = [
          customerData.table,
          ...(Array.isArray(customerData?.mergedTables) ? customerData.mergedTables : []),
        ].filter((tableRow) => tableRow?.tableId);
        try {
          await Promise.all(
            linkedTables.map((tableRow) =>
              updateTable({
                status: "Booked",
                orderId: data._id,
                tableId: tableRow.tableId,
              })
            )
          );
        } catch (tableError) {
          enqueueSnackbar("Order created, but some table status updates failed.", {
            variant: "warning",
          });
        }
        dispatch(removeCustomer());
        dispatch(removeAllItems());
        enqueueSnackbar("Order placed. Payment can be settled later.", { variant: "success" });
        setShowInvoice(true);
      }

      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      const msg = error.response?.data?.message || error?.message || "Failed to submit order!";
      enqueueSnackbar(msg, { variant: "error", autoHideDuration: 5000 });
    },
  });

  // 2026-02-28T12:46:00+08:00: 分单 400 修复 - 规范化 items 供后端校验（仅传 name/quantity/modifiers/note/seatNo）
  const buildItemsForApi = (items) => {
    if (!Array.isArray(items) || items.length === 0) return [];
    return items.map((item) => {
      const qty = Math.max(1, Math.min(20, Math.floor(Number(item.quantity) || 1)));
      const seatNo = item.seatNo;
      const validSeatNo =
        seatNo !== undefined &&
        seatNo !== null &&
        `${seatNo}`.trim() !== "" &&
        Number.isInteger(Number(seatNo)) &&
        Number(seatNo) >= 1 &&
        Number(seatNo) <= 50
          ? Number(seatNo)
          : undefined;
      return {
        name: `${item.name || ""}`.trim() || "Unknown",
        quantity: qty,
        note: `${item.note || ""}`.trim().slice(0, 200) || undefined,
        modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
        ...(validSeatNo !== undefined ? { seatNo: validSeatNo } : {}),
      };
    });
  };

  const handlePlaceOrder = async () => {
    if (!customerData?.table?.tableId) {
      enqueueSnackbar("Please select a table before placing order.", {
        variant: "warning",
      });
      return;
    }

    if (!`${customerData.customerName || ""}`.trim() || !`${customerData.customerPhone || ""}`.trim()) {
      enqueueSnackbar("Please fill customer name and phone before placing order.", {
        variant: "warning",
      });
      return;
    }

    if (!Array.isArray(cartData) || cartData.length === 0) {
      enqueueSnackbar("Please add at least one item in cart.", {
        variant: "warning",
      });
      return;
    }

    const optionValidationError = validateCartItemOptions(cartData);
    if (optionValidationError) {
      enqueueSnackbar(optionValidationError, {
        variant: "warning",
      });
      return;
    }

    const apiItems = buildItemsForApi(cartData);
    if (apiItems.length === 0) {
      enqueueSnackbar("No valid items to submit. Please check the cart.", { variant: "error" });
      return;
    }

    const payload = {
      customerDetails: {
        name: customerData.customerName,
        phone: customerData.customerPhone,
        guests: customerData.guests,
      },
      items: apiItems,
      table: customerData.table.tableId,
      paymentMethod: "Pending",
    };

    orderMutation.mutate(payload);
  };

  // 2026-02-28T13:00:00+08:00 PRD 7.23.2 小票打印展示 Logo、品牌标语、促销文案
  const openPrintWindow = (receiptOrder, template) => {
    const mergedTemplate = {
      ...DEFAULT_RECEIPT_TEMPLATE,
      ...(template || {}),
      logoUrl: template?.logoUrl || "",
      brandSlogan: template?.brandSlogan || "",
      promoText: template?.promoText || "",
      fields: {
        ...DEFAULT_RECEIPT_TEMPLATE.fields,
        ...(template?.fields || {}),
      },
    };
    const fields = mergedTemplate.fields;
    const itemsHtml = (receiptOrder.items || [])
      .map((item) => {
        const modifiersText = (item.modifiers || [])
          .map((modifier) =>
            `${modifier.name}${Number(modifier?.priceDelta || 0) > 0 ? `(+€${Number(modifier.priceDelta).toFixed(2)})` : ""}`
          )
          .join("、");
        const noteText = `${item.note || ""}`.trim();
        return `
          <div class="item-row">
            <div class="item-main">
              <span>${item.name} x${item.quantity}</span>
              <span>€${Number(item.price || 0).toFixed(2)}</span>
            </div>
            ${
              fields.showItemModifiers && modifiersText
                ? `<div class="item-sub">选项: ${modifiersText}</div>`
                : ""
            }
            ${fields.showItemNotes && noteText ? `<div class="item-sub">备注: ${noteText}</div>` : ""}
          </div>
        `;
      })
      .join("");

    const WinPrint = window.open("", "", "width=900,height=650");
    if (!WinPrint) {
      enqueueSnackbar("Print window blocked by browser.", { variant: "warning" });
      return;
    }

    WinPrint.document.write(`
      <html>
        <head>
          <title>${mergedTemplate.headerTitle}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; color: #111; }
            .receipt { width: 320px; border: 1px dashed #666; padding: 12px; }
            .title { font-weight: 700; text-align: center; font-size: 18px; margin-bottom: 8px; }
            .store { text-align: center; margin-bottom: 8px; font-size: 13px; }
            .line { font-size: 12px; margin: 3px 0; }
            .sep { border-top: 1px dashed #666; margin: 8px 0; }
            .item-row { font-size: 12px; margin: 6px 0; }
            .item-main { display: flex; justify-content: space-between; gap: 8px; }
            .item-sub { color: #444; margin-top: 2px; }
            .totals { font-size: 12px; }
            .totals .row { display: flex; justify-content: space-between; margin: 3px 0; }
            .footer { margin-top: 10px; text-align: center; font-size: 11px; color: #444; }
          </style>
        </head>
        <body>
          <div class="receipt">
            ${mergedTemplate.logoUrl ? `<div class="logo-wrap" style="text-align:center;margin-bottom:8px"><img src="${mergedTemplate.logoUrl}" alt="Logo" style="max-width:120px;max-height:48px;object-fit:contain" /></div>` : ""}
            <div class="title">${mergedTemplate.headerTitle}</div>
            <div class="store">${mergedTemplate.storeName}</div>
            ${mergedTemplate.brandSlogan ? `<div class="store" style="font-size:11px;color:#666">${mergedTemplate.brandSlogan}</div>` : ""}
            ${mergedTemplate.promoText ? `<div class="store" style="font-size:11px;color:#888">${mergedTemplate.promoText}</div>` : ""}
            <div class="sep"></div>
            ${
              fields.showOrderId
                ? `<div class="line">订单号: ${formatReadableOrderId(receiptOrder._id || receiptOrder.orderId || "DRAFT")}</div>`
                : ""
            }
            ${
              fields.showOrderDate
                ? `<div class="line">时间: ${formatDateAndTime(receiptOrder.orderDate || new Date().toISOString())}</div>`
                : ""
            }
            ${
              fields.showTableNo
                ? `<div class="line">桌号: ${receiptOrder.tableNo || "N/A"}</div>`
                : ""
            }
            ${
              fields.showCustomerName
                ? `<div class="line">顾客: ${receiptOrder.customerName || "Walk-in"}</div>`
                : ""
            }
            ${
              fields.showCustomerPhone
                ? `<div class="line">电话: ${receiptOrder.customerPhone || "N/A"}</div>`
                : ""
            }
            ${fields.showGuests ? `<div class="line">人数: ${receiptOrder.guests || 1}</div>` : ""}
            ${fields.showPaymentMethod ? `<div class="line">支付: ${receiptOrder.paymentMethod || "Pending"}</div>` : ""}
            <div class="sep"></div>
            ${itemsHtml}
            <div class="sep"></div>
            <div class="totals">
              <div class="row"><span>小计</span><span>€${Number(receiptOrder.total || 0).toFixed(2)}</span></div>
              ${
                fields.showTaxBreakdown
                  ? `<div class="row"><span>税</span><span>€${Number(receiptOrder.tax || 0).toFixed(2)}</span></div>`
                  : ""
              }
              <div class="row"><strong>合计</strong><strong>€${Number(receiptOrder.totalWithTax || 0).toFixed(2)}</strong></div>
            </div>
            <div class="footer">${mergedTemplate.footerMessage}</div>
          </div>
        </body>
      </html>
    `);

    WinPrint.document.close();
    WinPrint.focus();
    setTimeout(() => {
      WinPrint.print();
      WinPrint.close();
    }, 250);
  };

  // 2026-02-26T00:00:01Z: Split Bill helpers
  const handleToggleSplitPanel = () => {
    setShowSplitPanel((prev) => !prev);
    if (!showSplitPanel) {
      setSplitMode(SPLIT_MODE_EVEN);
      setSplitPeople(2);
      setSplitGroups([
        { name: "Guest 1", itemIndices: [] },
        { name: "Guest 2", itemIndices: [] },
      ]);
    }
  };

  const addSplitGroup = () => {
    setSplitGroups((prev) => [
      ...prev,
      { name: `Guest ${prev.length + 1}`, itemIndices: [] },
    ]);
  };

  const removeSplitGroup = (groupIdx) => {
    if (splitGroups.length <= 2) return;
    setSplitGroups((prev) => prev.filter((_, i) => i !== groupIdx));
  };

  const toggleItemInGroup = (groupIdx, itemIdx) => {
    setSplitGroups((prev) =>
      prev.map((group, gi) => {
        if (gi !== groupIdx) return group;
        const exists = group.itemIndices.includes(itemIdx);
        return {
          ...group,
          itemIndices: exists
            ? group.itemIndices.filter((i) => i !== itemIdx)
            : [...group.itemIndices, itemIdx],
        };
      })
    );
  };

  const getGroupSubtotal = (group) => {
    const items = Array.isArray(cartData) ? cartData : [];
    return group.itemIndices.reduce((sum, idx) => {
      const item = items[idx];
      if (!item) return sum;
      return sum + Number(item.price || 0);
    }, 0);
  };

  const getGroupTax = (group) => (getGroupSubtotal(group) * taxRate) / 100;
  const getGroupTotal = (group) => getGroupSubtotal(group) + getGroupTax(group);

  const perPersonAmount = splitPeople > 0 ? totalPriceWithTax / splitPeople : 0;

  const handlePrintReceipt = () => {
    const draftOrder = orderInfo || {
      orderId: customerData.activeOrderId || customerData.orderId,
      orderDate: new Date().toISOString(),
      tableNo: customerData?.table?.tableNo,
      customerName: customerData.customerName,
      customerPhone: customerData.customerPhone,
      guests: customerData.guests,
      paymentMethod: "Pending",
      items: cartData,
      total,
      tax,
      totalWithTax: totalPriceWithTax,
      bills: {
        total,
        tax,
        totalWithTax: totalPriceWithTax,
      },
    };

    const normalized = {
      _id: draftOrder._id || draftOrder.orderId,
      orderDate: draftOrder.orderDate || new Date().toISOString(),
      tableNo: draftOrder?.table?.tableNo || draftOrder.tableNo || customerData?.table?.tableNo,
      customerName: draftOrder?.customerDetails?.name || draftOrder.customerName,
      customerPhone: draftOrder?.customerDetails?.phone || draftOrder.customerPhone,
      guests: draftOrder?.customerDetails?.guests || draftOrder.guests,
      paymentMethod: draftOrder.paymentMethod || "Pending",
      items: Array.isArray(draftOrder.items) ? draftOrder.items : [],
      total: Number(draftOrder?.bills?.total ?? draftOrder.total ?? 0),
      tax: Number(draftOrder?.bills?.tax ?? draftOrder.tax ?? 0),
      totalWithTax: Number(draftOrder?.bills?.totalWithTax ?? draftOrder.totalWithTax ?? 0),
    };

    if (!normalized.items.length) {
      enqueueSnackbar("Cart is empty. Please add items before printing receipt.", {
        variant: "warning",
      });
      return;
    }

    openPrintWindow(normalized, receiptTemplateQuery.data || DEFAULT_RECEIPT_TEMPLATE);
  };

  return (
    <>
      <div className="flex items-center justify-between px-5 mt-2">
        <p className="text-xs text-[#ababab] font-medium mt-2">{t("cart.items")}({cartData.length})</p>
        <h1 className="text-[#f5f5f5] text-md font-bold">€{total.toFixed(2)}</h1>
      </div>
      {cardSurchargeRate > 0 && (
        <div className="flex items-center justify-between px-5 mt-2">
          <p className="text-xs text-[#ababab] font-medium mt-2">{t("cart.cardSurcharge")}({cardSurchargeRate}%)</p>
          <h1 className="text-[#f5f5f5] text-md font-bold">€{cardSurcharge.toFixed(2)}</h1>
        </div>
      )}
      <div className="flex items-center justify-between px-5 mt-2">
        <p className="text-xs text-[#ababab] font-medium mt-2">Tax({taxRate}%)</p>
        <h1 className="text-[#f5f5f5] text-md font-bold">€{tax.toFixed(2)}</h1>
      </div>
      <div className="flex items-center justify-between px-5 mt-2">
        <p className="text-xs text-[#ababab] font-medium mt-2">{t("cart.totalWithTax")}</p>
        <h1 className="text-[#f5f5f5] text-md font-bold">€{totalPriceWithTax.toFixed(2)}</h1>
      </div>
      <div className="px-5 mt-4">
        <p className="text-xs text-[#97a3b8]">
          {isEditingExistingOrder
            ? t("cart.editingOrder", { orderId: formatReadableOrderId(customerData.activeOrderId) })
            : t("cart.orderNote")}
        </p>
      </div>

      {/* 2026-02-26T00:00:02Z: Split Bill Panel */}
      {showSplitPanel && (
        <div className="mx-5 mt-3 mb-2 bg-[#262626] border border-[#333] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[#f5f5f5] font-semibold text-sm">{t("cart.splitBill")}</h3>
            <button
              onClick={handleToggleSplitPanel}
              className="text-[#ababab] hover:text-[#f5f5f5] text-lg leading-none"
            >
              ✕
            </button>
          </div>

          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setSplitMode(SPLIT_MODE_EVEN)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold ${
                splitMode === SPLIT_MODE_EVEN
                  ? "bg-[#f6b100] text-[#1f1f1f]"
                  : "bg-[#333] text-[#ababab]"
              }`}
            >
              {t("cart.splitEvenly")}
            </button>
            <button
              onClick={() => setSplitMode(SPLIT_MODE_ITEM)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold ${
                splitMode === SPLIT_MODE_ITEM
                  ? "bg-[#f6b100] text-[#1f1f1f]"
                  : "bg-[#333] text-[#ababab]"
              }`}
            >
              {t("cart.splitByItem")}
            </button>
          </div>

          {splitMode === SPLIT_MODE_EVEN && (
            <div>
              <label className="block text-[#ababab] text-xs mb-2">{t("cart.numberOfPeople")}</label>
              <div className="flex items-center justify-between bg-[#1f1f1f] px-4 py-2 rounded-lg mb-3">
                <button
                  onClick={() => setSplitPeople((p) => Math.max(2, p - 1))}
                  className="text-yellow-400 text-xl font-bold"
                >
                  −
                </button>
                <span className="text-[#f5f5f5] font-semibold">{splitPeople}</span>
                <button
                  onClick={() => setSplitPeople((p) => Math.min(20, p + 1))}
                  className="text-yellow-400 text-xl font-bold"
                >
                  +
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {Array.from({ length: splitPeople }, (_, i) => (
                  <div key={i} className="bg-[#1f1f1f] rounded-lg p-3 text-center">
                    <p className="text-[#ababab] text-xs mb-1">Guest {i + 1}</p>
                    <p className="text-[#f5f5f5] font-bold text-sm">€{perPersonAmount.toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[#ababab] text-xs text-center">
                €{totalPriceWithTax.toFixed(2)} ÷ {splitPeople} = €{perPersonAmount.toFixed(2)} / {t("cart.perPerson")}
              </div>
            </div>
          )}

          {splitMode === SPLIT_MODE_ITEM && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[#ababab] text-xs">{t("cart.groups")} ({splitGroups.length})</span>
                <button
                  onClick={addSplitGroup}
                  className="text-xs bg-[#025cca] text-[#f5f5f5] px-3 py-1 rounded-lg"
                >
                  {t("cart.addGuest")}
                </button>
              </div>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {splitGroups.map((group, gi) => (
                  <div key={gi} className="bg-[#1f1f1f] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[#f5f5f5] text-xs font-semibold">{group.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-yellow-400 text-xs font-bold">
                          €{getGroupTotal(group).toFixed(2)}
                        </span>
                        {splitGroups.length > 2 && (
                          <button
                            onClick={() => removeSplitGroup(gi)}
                            className="text-red-400 text-xs hover:text-red-300"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {(Array.isArray(cartData) ? cartData : []).map((item, idx) => {
                        const checked = group.itemIndices.includes(idx);
                        const assignedElsewhere = splitGroups.some(
                          (g, gIdx) => gIdx !== gi && g.itemIndices.includes(idx)
                        );
                        return (
                          <label
                            key={idx}
                            className={`flex items-center gap-2 text-xs cursor-pointer ${
                              assignedElsewhere ? "opacity-40" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={assignedElsewhere && !checked}
                              onChange={() => toggleItemInGroup(gi, idx)}
                              className="accent-yellow-400"
                            />
                            <span className="text-[#ababab] flex-1 truncate">
                              {item.name} x{item.quantity}
                            </span>
                            <span className="text-[#f5f5f5]">€{Number(item.price || 0).toFixed(2)}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="mt-1 text-[#ababab] text-xs flex justify-between border-t border-[#333] pt-1">
                      <span>Subtotal: €{getGroupSubtotal(group).toFixed(2)}</span>
                      <span>Tax: €{getGroupTax(group).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2026-03-01: iPad 点餐 - 订单操作工具栏 */}
      <div className="px-5 py-2 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          <OrderActionToolbar
            onPrintCheck={handlePrintReceipt}
            onSplit={handleToggleSplitPanel}
            onDiscount={() => enqueueSnackbar("Discount: configure in backend", { variant: "info" })}
            onSurcharge={() => enqueueSnackbar("Surcharge: configure in backend", { variant: "info" })}
            onAddTips={() => enqueueSnackbar("Add Tips: configure in backend", { variant: "info" })}
            onTaxExempt={() => enqueueSnackbar("Tax Exempt: configure in backend", { variant: "info" })}
            onDeposit={() => enqueueSnackbar("Deposit: configure in backend", { variant: "info" })}
            onPromotion={() => enqueueSnackbar("Promotion: configure in backend", { variant: "info" })}
            splitActive={showSplitPanel}
          />
        </div>
      </div>
      <div className="sticky bottom-0 z-10 bg-[#1a1a1a] border-t border-t-[#2a2a2a] flex flex-wrap items-center gap-3 px-5 pt-4 pb-4">
        <button
          onClick={handleToggleSplitPanel}
          className={`px-4 py-3 rounded-lg font-semibold text-lg ${
            showSplitPanel
              ? "bg-[#333] text-[#f5f5f5]"
              : "bg-[#025cca] text-[#f5f5f5]"
          }`}
          title={t("cart.splitBill")}
        >
          {t("cart.split")}
        </button>
        <button
          onClick={handlePrintReceipt}
          className="bg-[#025cca] px-4 py-3 rounded-lg text-[#f5f5f5] font-semibold text-lg"
        >
          {t("cart.printReceipt")}
        </button>
        <button
          disabled={orderMutation.isPending}
          onClick={handlePlaceOrder}
          className={`bg-[#f6b100] px-4 py-3 w-full rounded-lg text-[#1f1f1f] font-semibold text-lg ${
            orderMutation.isPending ? "opacity-60 cursor-not-allowed" : ""
          }`}
        >
          {orderMutation.isPending
            ? t("cart.submitting")
            : isEditingExistingOrder
            ? t("cart.saveChanges")
            : t("cart.placeOrder")}
        </button>
      </div>

      {showInvoice && <Invoice orderInfo={orderInfo} setShowInvoice={setShowInvoice} />}
    </>
  );
};

export default Bill;
