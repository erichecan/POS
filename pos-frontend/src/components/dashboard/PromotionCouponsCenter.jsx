/**
 * Promotion Coupons 管理 - PRD 7.11 M11 2026-02-28T16:20:00+08:00
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { listPromotionRules, listPromotionCoupons, createPromotionCoupon } from "../../https";

const cardClass = "bg-[#262626] rounded-lg p-4 border border-[#333]";
const inputClass = "w-full bg-[#1f1f1f] text-[#f5f5f5] border border-[#3b3b3b] rounded-md px-3 py-2 focus:outline-none";

const PromotionCouponsCenter = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: "",
    promotionId: "",
    usageLimit: 1,
    expiresAt: "",
  });

  const rulesQuery = useQuery({
    queryKey: ["promotion-rules"],
    queryFn: () => listPromotionRules({ locationId: "default", limit: 100 }),
  });
  const couponsQuery = useQuery({
    queryKey: ["promotion-coupons"],
    queryFn: () => listPromotionCoupons({ limit: 100 }),
  });
  const rules = rulesQuery.data?.data?.data ?? [];
  const coupons = couponsQuery.data?.data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (payload) => createPromotionCoupon(payload),
    onSuccess: () => {
      enqueueSnackbar(t("promotion.couponCreated"), { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["promotion-coupons"] });
      setShowForm(false);
      setForm({ code: "", promotionId: "", usageLimit: 1, expiresAt: "" });
    },
    onError: (e) => enqueueSnackbar(e.response?.data?.message || t("promotion.createFailed"), { variant: "error" }),
  });

  const handleSubmit = () => {
    if (!form.code?.trim() || !form.promotionId) return;
    createMutation.mutate({
      code: form.code.trim(),
      promotionId: form.promotionId,
      usageLimit: Number(form.usageLimit) || 1,
      expiresAt: form.expiresAt || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[#f5f5f5]">{t("promotion.coupons")}</h1>
      <p className="text-sm text-[#ababab]">{t("promotion.couponsDesc")}</p>

      <div className="flex justify-between items-center">
        <button
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? t("common.cancel") : t("promotion.addCoupon")}
        </button>
      </div>

      {showForm && (
        <div className={cardClass}>
          <h2 className="text-md font-medium text-[#e0e0e0] mb-3">{t("promotion.newCoupon")}</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-[#ababab] mb-1">{t("promotion.code")}</label>
              <input className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="SAVE10" />
            </div>
            <div>
              <label className="block text-sm text-[#ababab] mb-1">{t("promotion.promotionRule")}</label>
              <select className={inputClass} value={form.promotionId} onChange={(e) => setForm({ ...form, promotionId: e.target.value })}>
                <option value="">— {t("common.select")} —</option>
                {rules.map((r) => (
                  <option key={r._id} value={r._id}>{r.code} - {r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#ababab] mb-1">{t("promotion.usageLimit")}</label>
              <input type="number" min={1} className={inputClass} value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm text-[#ababab] mb-1">{t("promotion.expiresAt")}</label>
              <input type="datetime-local" className={inputClass} value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
            </div>
          </div>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50" onClick={handleSubmit} disabled={createMutation.isPending || !form.code || !form.promotionId}>
            {createMutation.isPending ? t("common.saving") : t("common.save")}
          </button>
        </div>
      )}

      <div className={cardClass}>
        <h2 className="text-md font-medium text-[#e0e0e0] mb-3">{t("promotion.existingCoupons")}</h2>
        {couponsQuery.isLoading ? (
          <p className="text-[#ababab]">{t("common.loading")}</p>
        ) : coupons.length === 0 ? (
          <p className="text-[#ababab]">{t("promotion.noCoupons")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#ababab] border-b border-[#444]">
                  <th className="py-2">Code</th>
                  <th className="py-2">Rule</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Usage</th>
                  <th className="py-2">Expires</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c._id} className="border-b border-[#333]">
                    <td className="py-2 text-[#e0e0e0]">{c.code}</td>
                    <td className="py-2 text-[#ababab]">{c.promotionId?.name || c.promotionId?.code || "—"}</td>
                    <td className="py-2 text-[#ababab]">{c.status}</td>
                    <td className="py-2 text-[#ababab]">{c.usageCount || 0} / {c.usageLimit || 1}</td>
                    <td className="py-2 text-[#ababab]">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "—"}</td>
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

export default PromotionCouponsCenter;
