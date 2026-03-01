/**
 * Promotion Rules 配置 - PRD 7.11 M11 2026-02-28T16:20:00+08:00
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { listPromotionRules, createPromotionRule } from "../../https";

const cardClass = "bg-[#262626] rounded-lg p-4 border border-[#333]";
const inputClass = "w-full bg-[#1f1f1f] text-[#f5f5f5] border border-[#3b3b3b] rounded-md px-3 py-2 focus:outline-none";

const PROMO_TYPES = [
  { value: "ORDER_DISCOUNT", label: "Order discount" },
  { value: "TIERED_OFF", label: "Tiered (满减)" },
  { value: "BOGO", label: "BOGO (买赠)" },
  { value: "ITEM_DISCOUNT", label: "Item discount" },
];

const PromotionRulesCenter = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    promoType: "ORDER_DISCOUNT",
    discountType: "PERCENT",
    discountValue: 10,
    minOrderAmount: 0,
    maxDiscountAmount: "",
    stackable: false,
    autoApply: false,
    priority: 0,
    tiers: [{ threshold: 100, discountType: "FIXED", discountValue: 10 }],
    buyQuantity: 2,
    getQuantity: 1,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["promotion-rules"],
    queryFn: () => listPromotionRules({ locationId: "default", limit: 100 }),
  });
  const rules = data?.data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (payload) => createPromotionRule({ locationId: "default", ...payload }),
    onSuccess: () => {
      enqueueSnackbar(t("promotion.ruleCreated"), { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["promotion-rules"] });
      setShowForm(false);
      setForm({ code: "", name: "", promoType: "ORDER_DISCOUNT", discountType: "PERCENT", discountValue: 10, minOrderAmount: 0, maxDiscountAmount: "", stackable: false, autoApply: false, priority: 0, tiers: [{ threshold: 100, discountType: "FIXED", discountValue: 10 }], buyQuantity: 2, getQuantity: 1 });
    },
    onError: (e) => enqueueSnackbar(e.response?.data?.message || t("promotion.createFailed"), { variant: "error" }),
  });

  const handleSubmit = () => {
    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      promoType: form.promoType,
      stackable: form.stackable,
      autoApply: form.autoApply,
      priority: form.priority,
      minOrderAmount: Number(form.minOrderAmount) || 0,
    };
    if (form.promoType === "ORDER_DISCOUNT" || form.promoType === "ITEM_DISCOUNT") {
      payload.discountType = form.discountType;
      payload.discountValue = Number(form.discountValue) || 0;
      if (form.maxDiscountAmount) payload.maxDiscountAmount = Number(form.maxDiscountAmount);
    }
    if (form.promoType === "TIERED_OFF") {
      payload.tiers = form.tiers.filter((t) => Number(t.threshold) >= 0 && t.discountType && Number(t.discountValue) >= 0);
    }
    if (form.promoType === "BOGO") {
      payload.buyQuantity = Number(form.buyQuantity) || 2;
      payload.getQuantity = Number(form.getQuantity) || 1;
      payload.discountValue = 100;
    }
    createMutation.mutate(payload);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[#f5f5f5]">{t("promotion.rules")}</h1>
      <p className="text-sm text-[#ababab]">{t("promotion.rulesDesc")}</p>

      <div className="flex justify-between items-center">
        <button
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? t("common.cancel") : t("promotion.addRule")}
        </button>
      </div>

      {showForm && (
        <div className={cardClass}>
          <h2 className="text-md font-medium text-[#e0e0e0] mb-3">{t("promotion.newRule")}</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-[#ababab] mb-1">{t("promotion.code")}</label>
              <input className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="SUMMER10" />
            </div>
            <div>
              <label className="block text-sm text-[#ababab] mb-1">{t("promotion.name")}</label>
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Summer 10% off" />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm text-[#ababab] mb-1">{t("promotion.promoType")}</label>
            <select className={inputClass} value={form.promoType} onChange={(e) => setForm({ ...form, promoType: e.target.value })}>
              {PROMO_TYPES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          {(form.promoType === "ORDER_DISCOUNT" || form.promoType === "ITEM_DISCOUNT") && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-[#ababab] mb-1">{t("promotion.discountType")}</label>
                <select className={inputClass} value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}>
                  <option value="PERCENT">Percent</option>
                  <option value="FIXED">Fixed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#ababab] mb-1">{t("promotion.discountValue")}</label>
                <input type="number" className={inputClass} value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm text-[#ababab] mb-1">{t("promotion.minOrderAmount")}</label>
                <input type="number" className={inputClass} value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm text-[#ababab] mb-1">{t("promotion.maxDiscountAmount")}</label>
                <input type="number" className={inputClass} value={form.maxDiscountAmount} onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value })} placeholder="Optional" />
              </div>
            </div>
          )}
          {form.promoType === "TIERED_OFF" && (
            <div className="mb-4">
              <label className="block text-sm text-[#ababab] mb-1">Tiers (threshold, type, value)</label>
              {form.tiers.map((t, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input type="number" className={inputClass} style={{ maxWidth: 100 }} placeholder="threshold" value={t.threshold} onChange={(e) => {
                    const next = [...form.tiers];
                    next[i] = { ...next[i], threshold: Number(e.target.value) || 0 };
                    setForm({ ...form, tiers: next });
                  }} />
                  <select className={inputClass} style={{ maxWidth: 90 }} value={t.discountType} onChange={(e) => {
                    const next = [...form.tiers];
                    next[i] = { ...next[i], discountType: e.target.value };
                    setForm({ ...form, tiers: next });
                  }}>
                    <option value="PERCENT">%</option>
                    <option value="FIXED">Fixed</option>
                  </select>
                  <input type="number" className={inputClass} style={{ maxWidth: 80 }} placeholder="value" value={t.discountValue} onChange={(e) => {
                    const next = [...form.tiers];
                    next[i] = { ...next[i], discountValue: Number(e.target.value) || 0 };
                    setForm({ ...form, tiers: next });
                  }} />
                </div>
              ))}
              <button type="button" className="text-sm text-indigo-400" onClick={() => setForm({ ...form, tiers: [...form.tiers, { threshold: 200, discountType: "FIXED", discountValue: 25 }] })}>+ Add tier</button>
            </div>
          )}
          {form.promoType === "BOGO" && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-[#ababab] mb-1">{t("promotion.buyQuantity")}</label>
                <input type="number" min={1} className={inputClass} value={form.buyQuantity} onChange={(e) => setForm({ ...form, buyQuantity: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm text-[#ababab] mb-1">{t("promotion.getQuantity")}</label>
                <input type="number" min={1} className={inputClass} value={form.getQuantity} onChange={(e) => setForm({ ...form, getQuantity: e.target.value })} />
              </div>
            </div>
          )}
          <div className="flex gap-4 mb-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.stackable} onChange={(e) => setForm({ ...form, stackable: e.target.checked })} />
              <span className="text-sm text-[#ababab]">{t("promotion.stackable")}</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.autoApply} onChange={(e) => setForm({ ...form, autoApply: e.target.checked })} />
              <span className="text-sm text-[#ababab]">{t("promotion.autoApply")}</span>
            </label>
          </div>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50" onClick={handleSubmit} disabled={createMutation.isPending || !form.code || !form.name}>
            {createMutation.isPending ? t("common.saving") : t("common.save")}
          </button>
        </div>
      )}

      <div className={cardClass}>
        <h2 className="text-md font-medium text-[#e0e0e0] mb-3">{t("promotion.existingRules")}</h2>
        {isLoading ? (
          <p className="text-[#ababab]">{t("common.loading")}</p>
        ) : rules.length === 0 ? (
          <p className="text-[#ababab]">{t("promotion.noRules")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#ababab] border-b border-[#444]">
                  <th className="py-2">Code</th>
                  <th className="py-2">Name</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Discount</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r._id} className="border-b border-[#333]">
                    <td className="py-2 text-[#e0e0e0]">{r.code}</td>
                    <td className="py-2 text-[#e0e0e0]">{r.name}</td>
                    <td className="py-2 text-[#ababab]">{r.promoType || "ORDER_DISCOUNT"}</td>
                    <td className="py-2 text-[#ababab]">{r.status}</td>
                    <td className="py-2 text-[#ababab]">
                      {r.promoType === "TIERED_OFF" ? "Tiered" : r.promoType === "BOGO" ? `Buy ${r.buyQuantity} Get ${r.getQuantity}` : `${r.discountType} ${r.discountValue}${r.discountType === "PERCENT" ? "%" : ""}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PromotionRulesCenter;
