/**
 * 小票模板（品牌管理子模块）- PRD 7.23.2 2026-02-28T13:00:00+08:00
 */
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { getReceiptTemplate, upsertReceiptTemplate } from "../../https";

const DEFAULT = {
  storeName: "POS Store",
  headerTitle: "Order Receipt",
  footerMessage: "Thank you for your visit.",
  logoUrl: "",
  brandSlogan: "",
  promoText: "",
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

const cardClass = "bg-[#262626] rounded-lg p-4 border border-[#333]";
const inputClass = "w-full bg-[#1f1f1f] text-[#f5f5f5] border border-[#3b3b3b] rounded-md px-3 py-2 focus:outline-none";

const ReceiptTemplateCenter = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...DEFAULT });

  const { data } = useQuery({
    queryKey: ["receipt-template"],
    queryFn: async () => {
      const res = await getReceiptTemplate();
      return res.data?.data || DEFAULT;
    },
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      ...DEFAULT,
      ...data,
      fields: { ...DEFAULT.fields, ...(data.fields || {}) },
    });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => upsertReceiptTemplate(form),
    onSuccess: () => {
      enqueueSnackbar(t("brand.receiptSaved"), { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["receipt-template"] });
    },
    onError: (e) => {
      enqueueSnackbar(e.response?.data?.message || t("brand.receiptSaveFailed"), { variant: "error" });
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[#f5f5f5]">{t("brand.receiptTemplate")}</h1>
      <div className={cardClass}>
        <h2 className="text-md font-medium text-[#e0e0e0] mb-3">{t("brand.receiptHeader")}</h2>
        <div className="grid gap-3">
          <div>
            <label className="block text-sm text-[#ababab] mb-1">{t("brand.storeName")}</label>
            <input
              className={inputClass}
              value={form.storeName}
              onChange={(e) => setForm({ ...form, storeName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm text-[#ababab] mb-1">{t("brand.headerTitle")}</label>
            <input
              className={inputClass}
              value={form.headerTitle}
              onChange={(e) => setForm({ ...form, headerTitle: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm text-[#ababab] mb-1">{t("brand.logoUrl")}</label>
            <input
              className={inputClass}
              value={form.logoUrl || ""}
              onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-sm text-[#ababab] mb-1">{t("brand.brandSlogan")}</label>
            <input
              className={inputClass}
              value={form.brandSlogan || ""}
              onChange={(e) => setForm({ ...form, brandSlogan: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm text-[#ababab] mb-1">{t("brand.promoText")}</label>
            <input
              className={inputClass}
              value={form.promoText || ""}
              onChange={(e) => setForm({ ...form, promoText: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm text-[#ababab] mb-1">{t("brand.footerMessage")}</label>
            <input
              className={inputClass}
              value={form.footerMessage}
              onChange={(e) => setForm({ ...form, footerMessage: e.target.value })}
            />
          </div>
        </div>
      </div>
      <div className={cardClass}>
        <h2 className="text-md font-medium text-[#e0e0e0] mb-3">{t("brand.fieldsToShow")}</h2>
        <div className="grid grid-cols-2 gap-2">
          {Object.keys(DEFAULT.fields).map((key) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.fields?.[key] ?? true}
                onChange={(e) => setForm({ ...form, fields: { ...form.fields, [key]: e.target.checked } })}
                className="rounded"
              />
              <span className="text-sm text-[#e0e0e0]">{t(`brand.field.${key}`)}</span>
            </label>
          ))}
        </div>
      </div>
      <button
        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
      >
        {saveMutation.isPending ? t("common.saving") : t("common.save")}
      </button>
    </div>
  );
};

export default ReceiptTemplateCenter;
