/**
 * Phase D2.2–D2.3 活动列表与效果概览
 * 2026-02-28T18:40:00+08:00
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listPromotionRules,
  getPromotionEffects,
  createPromotionRule,
} from "../../https";

const cardClass = "bg-[#262626] rounded-lg p-4 border border-[#333]";
const inputClass =
  "w-full bg-[#1f1f1f] text-[#f5f5f5] border border-[#3b3b3b] rounded-md px-3 py-2 focus:outline-none";

const PROMO_TYPES = [
  { value: "ORDER_DISCOUNT", label: "Order discount" },
  { value: "TIERED_OFF", label: "Tiered (满减)" },
  { value: "BOGO", label: "BOGO (买赠)" },
  { value: "ITEM_DISCOUNT", label: "Item discount" },
];

const CampaignListPage = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    promoType: "ORDER_DISCOUNT",
    discountType: "PERCENT",
    discountValue: 10,
    minOrderAmount: 0,
    startAt: "",
    endAt: "",
  });

  const now = new Date();
  const rulesQuery = useQuery({
    queryKey: ["promotion-rules", statusFilter],
    queryFn: () => listPromotionRules({ locationId: "default", limit: 100 }),
  });
  const effectsQuery = useQuery({
    queryKey: ["promotion-effects"],
    queryFn: () =>
      getPromotionEffects({
        locationId: "default",
        from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        to: now.toISOString(),
      }),
  });

  const rules = rulesQuery.data?.data?.data ?? [];
  const effects = effectsQuery.data?.data?.data?.effects ?? [];
  const effectMap = new Map(effects.map((e) => [`${e.promotionId}`, e]));

  const withStatus = rules.map((r) => {
    const start = r.startAt ? new Date(r.startAt) : null;
    const end = r.endAt ? new Date(r.endAt) : null;
    let status = "ongoing";
    if (end && end.getTime() < now.getTime()) status = "ended";
    else if (start && start.getTime() > now.getTime()) status = "upcoming";
    return { ...r, _status: status };
  });

  const filtered =
    statusFilter === "ongoing"
      ? withStatus.filter((r) => r._status === "ongoing")
      : statusFilter === "ended"
      ? withStatus.filter((r) => r._status === "ended")
      : withStatus;

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-[#f5f5f5]">
          {t("campaign.title")}
        </h1>
        <p className="text-sm text-[#ababab]">{t("campaign.list")}</p>

        <div className="flex flex-wrap gap-2 items-center">
          <select
            className={inputClass}
            style={{ width: 120 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">{t("common.all")}</option>
            <option value="ongoing">{t("campaign.ongoing")}</option>
            <option value="ended">{t("campaign.ended")}</option>
          </select>
          <button
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            onClick={() => setShowCreate(!showCreate)}
          >
            {showCreate ? t("common.cancel") : t("campaign.create")}
          </button>
        </div>

        {showCreate && (
          <div className={cardClass}>
            <h2 className="font-medium text-[#e0e0e0] mb-3">
              {t("campaign.create")}
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-[#ababab] mb-1">
                  {t("promotion.code")}
                </label>
                <input
                  className={inputClass}
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="SUMMER10"
                />
              </div>
              <div>
                <label className="block text-sm text-[#ababab] mb-1">
                  {t("promotion.name")}
                </label>
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Summer 10% off"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-[#ababab] mb-1">
                  {t("promotion.promoType")}
                </label>
                <select
                  className={inputClass}
                  value={form.promoType}
                  onChange={(e) => setForm({ ...form, promoType: e.target.value })}
                >
                  {PROMO_TYPES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#ababab] mb-1">
                  {t("promotion.discountValue")}
                </label>
                <input
                  type="number"
                  className={inputClass}
                  value={form.discountValue}
                  onChange={(e) =>
                    setForm({ ...form, discountValue: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-[#ababab] mb-1">
                  {t("promotion.startAt") || "Start"}
                </label>
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={form.startAt}
                  onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-[#ababab] mb-1">
                  {t("promotion.endAt") || "End"}
                </label>
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={form.endAt}
                  onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                />
              </div>
            </div>
            <button
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              onClick={async () => {
                if (!form.code?.trim() || !form.name?.trim()) return;
                try {
                  await createPromotionRule({
                    locationId: "default",
                    code: form.code.trim().toUpperCase(),
                    name: form.name.trim(),
                    promoType: form.promoType,
                    discountType: form.discountType,
                    discountValue: Number(form.discountValue) || 0,
                    minOrderAmount: Number(form.minOrderAmount) || 0,
                    startAt: form.startAt || undefined,
                    endAt: form.endAt || undefined,
                  });
                  queryClient.invalidateQueries({ queryKey: ["promotion-rules"] });
                  queryClient.invalidateQueries({ queryKey: ["promotion-effects"] });
                  setShowCreate(false);
                } catch (err) {
                  console.error(err);
                }
              }}
            >
              {t("common.create")}
            </button>
          </div>
        )}

        <div className={cardClass}>
          <h2 className="font-medium text-[#e0e0e0] mb-3">
            {t("campaign.effect")}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#888] border-b border-[#333]">
                  <th className="py-2">{t("promotion.code")}</th>
                  <th className="py-2">{t("promotion.name")}</th>
                  <th className="py-2">{t("campaign.status") || t("common.status")}</th>
                  <th className="py-2">{t("member.orderHistory")?.replace(/历史/, "") || "Orders"}</th>
                  <th className="py-2">{t("common.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const eff = effectMap.get(`${r._id}`);
                  return (
                    <tr
                      key={r._id}
                      className="border-b border-[#2a2a2a] hover:bg-[#2a2a2a]"
                    >
                      <td className="py-2 font-mono text-indigo-400">{r.code}</td>
                      <td className="py-2 text-[#e0e0e0]">{r.name}</td>
                      <td className="py-2">
                        <span
                          className={
                            r._status === "ongoing"
                              ? "text-green-500"
                              : r._status === "ended"
                              ? "text-[#888]"
                              : "text-amber-500"
                          }
                        >
                          {r._status === "ongoing"
                            ? t("campaign.ongoing")
                            : r._status === "ended"
                            ? t("campaign.ended")
                            : "Upcoming"}
                        </span>
                      </td>
                      <td className="py-2">{eff?.orderCount ?? 0}</td>
                      <td className="py-2">
                        ¥{Number(eff?.discountTotal ?? 0).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <p className="text-[#666] text-sm py-4">{t("common.noData")}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignListPage;
