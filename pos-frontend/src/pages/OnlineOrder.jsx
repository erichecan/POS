/**
 * Phase C1 在线订餐 - 消费者订餐页面
 * 2026-02-28T16:25:00+08:00 无需登录，选菜 → 填信息 → 支付 → 状态
 */
import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  getPublicMenu,
  createPublicOrder,
  createPublicPaymentCheckout,
} from "../https";
import { menus } from "../constants";

const LOCATION_ID = "default";

// 将 API menuItems 转为分组结构
const groupMenuItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) return [];
  const byCategory = {};
  items.forEach((it) => {
    const cat = `${it.category || "other"}`.trim();
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push({
      id: it.id || it.name,
      name: it.name,
      price: Number(it.price || 0),
      category: cat,
    });
  });
  return Object.entries(byCategory).map(([name, items]) => ({ name, items }));
};

// 静态菜单 fallback 转为分组
const getStaticGroups = () => {
  const flat = [];
  menus.forEach((menu) => {
    (menu.items || []).forEach((it) => {
      flat.push({
        id: it.id,
        name: it.name,
        price: it.price,
        category: menu.name,
      });
    });
  });
  return groupMenuItems(flat);
};

const OnlineOrder = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const cancelled = searchParams.get("cancelled") === "1";

  const [step, setStep] = useState("menu"); // menu | checkout | redirecting
  const [cart, setCart] = useState([]);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    fulfillmentType: "PICKUP",
    pickupAt: "",
    deliveryAddress: "",
  });

  const locationId = searchParams.get("locationId") || LOCATION_ID;

  const menuQuery = useQuery({
    queryKey: ["public-menu", locationId],
    queryFn: async () => {
      const res = await getPublicMenu({ locationId });
      return res.data?.data;
    },
    staleTime: 60 * 1000,
  });

  const groups = menuQuery.data?.menuItems?.length
    ? groupMenuItems(menuQuery.data.menuItems)
    : getStaticGroups();

  const createOrderMutation = useMutation({
    mutationFn: (payload) => createPublicOrder(payload),
    onSuccess: async (res) => {
      const orderId = res.data?.data?.orderId;
      if (!orderId) {
        enqueueSnackbar("Order created but no orderId returned.", { variant: "error" });
        return;
      }
      try {
        const payRes = await createPublicPaymentCheckout({
          orderId,
          successUrl: `${window.location.origin}/order/status/${orderId}?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/order?cancelled=1`,
        });
        const url = payRes.data?.checkoutUrl;
        if (url) {
          setStep("redirecting");
          window.location.href = url;
        } else {
          enqueueSnackbar("Payment checkout URL not available.", { variant: "error" });
          setStep("checkout");
        }
      } catch (err) {
        enqueueSnackbar(err.response?.data?.message || "Failed to create payment.", {
          variant: "error",
        });
        setStep("checkout");
      }
    },
    onError: (err) => {
      enqueueSnackbar(err.response?.data?.message || "Failed to place order.", {
        variant: "error",
      });
      setStep("checkout");
    },
  });

  useEffect(() => {
    if (cancelled) {
      enqueueSnackbar("Payment cancelled.", { variant: "info" });
    }
  }, [cancelled]);

  const addToCart = (item, qty = 1) => {
    const existing = cart.find((c) => c.name === item.name && !c.note);
    if (existing) {
      setCart(
        cart.map((c) =>
          c.name === item.name && !c.note
            ? { ...c, quantity: c.quantity + qty }
            : c
        )
      );
    } else {
      setCart([
        ...cart,
        {
          name: item.name,
          quantity: qty,
          price: item.price,
          modifiers: [],
        },
      ]);
    }
  };

  const updateCartQty = (idx, delta) => {
    const item = cart[idx];
    const next = item.quantity + delta;
    if (next <= 0) {
      setCart(cart.filter((_, i) => i !== idx));
    } else {
      setCart(cart.map((c, i) => (i === idx ? { ...c, quantity: next } : c)));
    }
  };

  const total = cart.reduce((s, c) => s + (c.price || 0) * (c.quantity || 1), 0);
  const taxRate = Number(import.meta.env.VITE_TAX_RATE_PERCENT || 5.25);
  const totalWithTax = total * (1 + taxRate / 100);

  const handlePlaceOrder = () => {
    if (
      !form.name?.trim() ||
      !form.phone?.trim() ||
      cart.length === 0
    ) {
      enqueueSnackbar("Please fill name, phone and add at least one item.", {
        variant: "warning",
      });
      return;
    }
    const items = cart.map((c) => ({
      name: c.name,
      quantity: Math.max(1, Math.min(20, c.quantity || 1)),
      modifiers: c.modifiers || [],
    }));
    const payload = {
      locationId,
      items,
      customerDetails: { name: form.name.trim(), phone: form.phone.trim(), guests: 1 },
      fulfillmentType: form.fulfillmentType,
    };
    if (form.fulfillmentType === "PICKUP" && form.pickupAt) {
      payload.pickupAt = form.pickupAt;
    }
    if (form.fulfillmentType === "DELIVERY" && form.deliveryAddress) {
      payload.deliveryAddress = form.deliveryAddress.trim();
    }
    setStep("checkout");
    createOrderMutation.mutate(payload);
  };

  if (step === "redirecting") {
    return (
      <div className="min-h-screen bg-[#1f1f1f] flex items-center justify-center">
        <p className="text-[#f5f5f5] text-lg">Redirecting to payment...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1f1f1f] pb-24">
      <header className="bg-[#1a1a1a] px-4 py-3 border-b border-[#2a2a2a]">
        <h1 className="text-[#f5f5f5] text-xl font-bold">
          {t("onlineOrder.title", "Online Order")}
        </h1>
        <p className="text-[#ababab] text-sm mt-1">
          {t("onlineOrder.subtitle", "Browse menu and order for pickup or delivery")}
        </p>
      </header>

      {step === "menu" && (
        <>
          <div className="px-4 py-3 overflow-y-auto max-h-[60vh]">
            {groups.map((g) => (
              <div key={g.name} className="mb-6">
                <h2 className="text-[#f5f5f5] font-semibold mb-2">{g.name}</h2>
                <div className="grid grid-cols-2 gap-3">
                  {g.items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-[#1a1a1a] rounded-lg p-3 flex justify-between items-center"
                    >
                      <div>
                        <p className="text-[#f5f5f5] font-medium">{item.name}</p>
                        <p className="text-[#ababab] text-sm">€{item.price?.toFixed(2)}</p>
                      </div>
                      <button
                        onClick={() => addToCart(item)}
                        className="bg-[#025cca] text-white px-3 py-2 rounded-lg text-sm font-semibold"
                      >
                        {t("common.add")}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="fixed bottom-0 left-0 right-0 bg-[#1a1a1a] border-t border-[#2a2a2a] p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[#ababab]">
                {cart.length} {t("common.items")} · €{totalWithTax.toFixed(2)}
              </span>
              <button
                onClick={() => setStep("checkout")}
                disabled={cart.length === 0}
                className="bg-[#f6b100] text-[#1f1f1f] px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
              >
                {t("cart.placeOrder", "Place Order")}
              </button>
            </div>
          </div>
        </>
      )}

      {step === "checkout" && (
        <div className="px-4 py-4 max-w-lg mx-auto">
          <div className="mb-4">
            <h2 className="text-[#f5f5f5] font-semibold mb-2">{t("cart.orderDetails")}</h2>
            {cart.map((c, i) => (
              <div
                key={i}
                className="flex justify-between items-center py-2 border-b border-[#2a2a2a]"
              >
                <span className="text-[#f5f5f5]">
                  {c.name} x{c.quantity}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateCartQty(i, -1)}
                    className="text-yellow-400 text-lg"
                  >
                    −
                  </button>
                  <span className="text-[#f5f5f5] w-6 text-center">{c.quantity}</span>
                  <button
                    onClick={() => updateCartQty(i, 1)}
                    className="text-yellow-400 text-lg"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
            <p className="text-[#f5f5f5] font-bold mt-2">
              {t("cart.totalWithTax")}: €{totalWithTax.toFixed(2)}
            </p>
          </div>

          <div className="space-y-3 mb-6">
            <input
              type="text"
              placeholder={t("customerInfo.name", "Name")}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-[#2a2a2a] text-[#f5f5f5] px-4 py-3 rounded-lg"
            />
            <input
              type="tel"
              placeholder={t("common.phone")}
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full bg-[#2a2a2a] text-[#f5f5f5] px-4 py-3 rounded-lg"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setForm((f) => ({ ...f, fulfillmentType: "PICKUP" }))}
                className={`flex-1 py-2 rounded-lg font-semibold ${
                  form.fulfillmentType === "PICKUP"
                    ? "bg-[#025cca] text-white"
                    : "bg-[#333] text-[#ababab]"
                }`}
              >
                {t("onlineOrder.pickup", "Pickup")}
              </button>
              <button
                onClick={() => setForm((f) => ({ ...f, fulfillmentType: "DELIVERY" }))}
                className={`flex-1 py-2 rounded-lg font-semibold ${
                  form.fulfillmentType === "DELIVERY"
                    ? "bg-[#025cca] text-white"
                    : "bg-[#333] text-[#ababab]"
                }`}
              >
                {t("onlineOrder.delivery", "Delivery")}
              </button>
            </div>
            {form.fulfillmentType === "PICKUP" && (
              <input
                type="datetime-local"
                placeholder={t("onlineOrder.pickupTime", "Pickup time")}
                value={form.pickupAt}
                onChange={(e) => setForm((f) => ({ ...f, pickupAt: e.target.value }))}
                className="w-full bg-[#2a2a2a] text-[#f5f5f5] px-4 py-3 rounded-lg"
              />
            )}
            {form.fulfillmentType === "DELIVERY" && (
              <input
                type="text"
                placeholder={t("onlineOrder.deliveryAddress", "Delivery address")}
                value={form.deliveryAddress}
                onChange={(e) => setForm((f) => ({ ...f, deliveryAddress: e.target.value }))}
                className="w-full bg-[#2a2a2a] text-[#f5f5f5] px-4 py-3 rounded-lg"
              />
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("menu")}
              className="flex-1 py-3 rounded-lg bg-[#333] text-[#f5f5f5] font-semibold"
            >
              {t("common.back")}
            </button>
            <button
              onClick={handlePlaceOrder}
              disabled={createOrderMutation.isPending}
              className="flex-1 py-3 rounded-lg bg-[#f6b100] text-[#1f1f1f] font-semibold disabled:opacity-50"
            >
              {createOrderMutation.isPending
                ? t("cart.submitting", "Submitting...")
                : t("onlineOrder.payNow", "Pay with Card")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnlineOrder;
