// 2026-02-28T18:50:00+08:00 Phase B2 - 扫码点餐（QR Table Ordering）
// 扫码 URL /order/qr?token=xxx 自动带入桌号，复用 self-order API
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getPublicMenuByToken, createSelfOrderByToken } from "../https";
import { formatReadableOrderId } from "../utils";

const getCartItemId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const groupByCategory = (items = []) => {
  const map = new Map();
  (items || []).forEach((item) => {
    const cat = item.category || "default";
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(item);
  });
  return Array.from(map.entries()).map(([category, list]) => ({ category, list }));
};

const QrTableOrder = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [cart, setCart] = useState([]);
  const [step, setStep] = useState("menu");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [successOrder, setSuccessOrder] = useState(null);

  const { data: menuRes, isLoading, isError, error } = useQuery({
    queryKey: ["qr-menu", token],
    queryFn: () => getPublicMenuByToken(token),
    enabled: !!token,
  });

  const createOrderMutation = useMutation({
    mutationFn: (payload) => createSelfOrderByToken({ ...payload, token }),
    onSuccess: (res) => {
      const order = res?.data?.data;
      setSuccessOrder(order);
      setStep("success");
      setCart([]);
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || "Order failed.";
      alert(msg);
    },
  });

  const menuData = menuRes?.data?.data || {};
  const tableNo = menuData.tableNo || "";
  const menuItems = menuData.menuItems || [];
  const categories = groupByCategory(menuItems);

  const addToCart = (item) => {
    const existing = cart.find((c) => c.name === item.name && !c.note);
    if (existing) {
      setCart(cart.map((c) => (c === existing ? { ...c, quantity: c.quantity + 1 } : c)));
    } else {
      setCart([
        ...cart,
        {
          id: getCartItemId(),
          name: item.name,
          quantity: 1,
          price: item.price,
          modifiers: [],
          note: "",
        },
      ]);
    }
  };

  const updateCartQty = (id, delta) => {
    setCart(
      cart
        .map((c) => (c.id === id ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const subtotal = cart.reduce((sum, c) => sum + (c.price || 0) * (c.quantity || 0), 0);
  const taxRate = Number(import.meta.env.VITE_TAX_RATE_PERCENT || 5.25);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  const handleCheckout = () => {
    if (cart.length === 0) {
      alert("Please add at least one item.");
      return;
    }
    const items = cart.map((c) => ({
      name: c.name,
      quantity: c.quantity,
      modifiers: c.modifiers || [],
      note: c.note || undefined,
    }));
    createOrderMutation.mutate({
      items,
      customerDetails: {
        name: customerName.trim() || "Guest",
        phone: customerPhone.trim() || "000000",
        guests: 1,
      },
      paymentMethod,
    });
  };

  const handleNewOrder = () => {
    setStep("menu");
    setSuccessOrder(null);
    setCustomerName("");
    setCustomerPhone("");
    setPaymentMethod("Cash");
  };

  if (!token) {
    return (
      <div className="fixed inset-0 bg-[#0d0d0d] flex items-center justify-center p-8">
        <p className="text-red-400 text-xl text-center">
          Invalid link. Please scan the table QR code.
        </p>
      </div>
    );
  }

  if (isError) {
    const msg = error?.response?.data?.message || "Failed to load menu.";
    return (
      <div className="fixed inset-0 bg-[#0d0d0d] flex items-center justify-center p-8">
        <p className="text-red-400 text-xl text-center">{msg}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#0d0d0d] flex items-center justify-center">
        <p className="text-white text-2xl">Loading...</p>
      </div>
    );
  }

  if (step === "success" && successOrder) {
    const pickupNo = formatReadableOrderId(successOrder._id);
    return (
      <div className="fixed inset-0 bg-[#0d0d0d] flex flex-col items-center justify-center p-8">
        <div className="text-6xl md:text-8xl font-bold text-[#02ca3a] mb-4">{pickupNo}</div>
        {tableNo && (
          <p className="text-[#ababab] text-xl mb-2">Table {tableNo}</p>
        )}
        <p className="text-[#ababab] text-xl mb-8">Order placed. Pay at counter or when served.</p>
        <button
          onClick={handleNewOrder}
          className="min-h-[72px] px-12 rounded-xl bg-[#2e4a40] text-[#02ca3a] text-2xl font-bold"
        >
          Add More
        </button>
      </div>
    );
  }

  if (step === "checkout") {
    return (
      <div className="fixed inset-0 bg-[#0d0d0d] flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <h1 className="text-white text-3xl font-bold mb-2">Checkout</h1>
          {tableNo && (
            <p className="text-[#ababab] text-lg mb-6">Table {tableNo}</p>
          )}
          <div className="mb-6 p-4 rounded-xl bg-[#1a1a1a]">
            <h2 className="text-[#ababab] text-lg mb-2">Order</h2>
            {cart.map((c) => (
              <div key={c.id} className="flex justify-between items-center py-2">
                <span className="text-white">
                  {c.name} × {c.quantity}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateCartQty(c.id, -1)}
                    className="min-h-[40px] min-w-[40px] rounded-lg bg-[#2a2a2a] text-white"
                  >
                    −
                  </button>
                  <span className="text-white w-8 text-center">{c.quantity}</span>
                  <button
                    onClick={() => updateCartQty(c.id, 1)}
                    className="min-h-[40px] min-w-[40px] rounded-lg bg-[#2a2a2a] text-white"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-4 mb-6">
            <input
              type="text"
              placeholder="Name (optional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full min-h-[56px] px-4 rounded-xl bg-[#1a1a1a] text-white text-xl"
            />
            <input
              type="tel"
              placeholder="Phone (optional)"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full min-h-[56px] px-4 rounded-xl bg-[#1a1a1a] text-white text-xl"
            />
          </div>
          <h2 className="text-[#ababab] text-xl mb-3">Payment</h2>
          <div className="flex gap-4">
            <button
              onClick={() => setPaymentMethod("Cash")}
              className={`flex-1 min-h-[64px] rounded-xl text-xl font-semibold ${
                paymentMethod === "Cash"
                  ? "bg-[#2e4a40] text-[#02ca3a]"
                  : "bg-[#2a2a2a] text-[#ababab]"
              }`}
            >
              Cash
            </button>
            <button
              onClick={() => setPaymentMethod("Online")}
              className={`flex-1 min-h-[64px] rounded-xl text-xl font-semibold ${
                paymentMethod === "Online"
                  ? "bg-[#2e4a40] text-[#02ca3a]"
                  : "bg-[#2a2a2a] text-[#ababab]"
              }`}
            >
              Card / Online
            </button>
          </div>
          {paymentMethod === "Online" && (
            <p className="text-[#888] text-sm mt-2">Pay at counter when served</p>
          )}
          <div className="mt-6 p-4 rounded-xl bg-[#1a1a1a]">
            <p className="text-white text-2xl font-bold">Total: €{total.toFixed(2)}</p>
          </div>
        </div>
        <div className="p-6 flex gap-4 border-t border-[#2a2a2a]">
          <button
            onClick={() => setStep("menu")}
            className="flex-1 min-h-[72px] rounded-xl bg-[#2a2a2a] text-white text-xl"
          >
            Back
          </button>
          <button
            onClick={handleCheckout}
            disabled={createOrderMutation.isPending}
            className="flex-[2] min-h-[72px] rounded-xl bg-[#2e4a40] text-[#02ca3a] text-xl font-bold"
          >
            {createOrderMutation.isPending ? "Processing..." : "Place Order"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#0d0d0d] flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <h1 className="text-white text-2xl md:text-3xl font-bold mb-2">Table Order</h1>
        {tableNo && (
          <p className="text-[#ababab] text-lg mb-4">Table {tableNo}</p>
        )}
        {categories.map(({ category, list }) => (
          <div key={category} className="mb-6">
            <h2 className="text-[#ababab] text-lg font-semibold mb-3">{category}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {list.map((item) => (
                <button
                  key={item.id || item.name}
                  onClick={() => addToCart(item)}
                  className="min-h-[100px] p-4 rounded-xl bg-[#1a1a1a] hover:bg-[#2a2a2a] flex flex-col justify-between items-start text-left"
                >
                  <span className="text-white text-lg font-semibold">{item.name}</span>
                  <span className="text-[#02ca3a] text-xl font-bold">
                    €{Number(item.price || 0).toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-[#2a2a2a] flex items-center gap-4">
        <div className="flex-1 min-h-[56px] flex items-center justify-between px-4 rounded-xl bg-[#1a1a1a]">
          <span className="text-white text-lg">
            {cart.length} items · €{total.toFixed(2)}
          </span>
          {cart.length > 0 && (
            <button
              onClick={() => setStep("checkout")}
              className="min-h-[48px] px-6 rounded-lg bg-[#2e4a40] text-[#02ca3a] font-bold"
            >
              Checkout
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QrTableOrder;
