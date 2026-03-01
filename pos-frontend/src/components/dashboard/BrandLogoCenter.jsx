/**
 * Brand & Logo 配置 - PRD 7.23.1 2026-02-28T13:00:00+08:00
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { getBrandProfile, upsertBrandProfile } from "../../https";

const cardClass = "bg-[#262626] rounded-lg p-4 border border-[#333]";
const inputClass = "w-full bg-[#1f1f1f] text-[#f5f5f5] border border-[#3b3b3b] rounded-md px-3 py-2 focus:outline-none";

const BrandLogoCenter = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [locationId] = useState("default");
  const [form, setForm] = useState({
    brandName: "",
    brandNameEn: "",
    slogan: "",
    primaryColor: "#1a1a1a",
    secondaryColor: "#666666",
    logoUrl: "",
    logoLightUrl: "",
    logoDarkUrl: "",
    showLogoOnReceipt: true,
    showLogoOnSignage: true,
    showLogoOnQueueDisplay: true,
  });

  const { data } = useQuery({
    queryKey: ["brand-profile", locationId],
    queryFn: () => getBrandProfile(locationId),
  });

  React.useEffect(() => {
    const d = data?.data?.data;
    if (d) {
      setForm({
        brandName: d.brandName || "",
        brandNameEn: d.brandNameEn || "",
        slogan: d.slogan || "",
        primaryColor: d.primaryColor || "#1a1a1a",
        secondaryColor: d.secondaryColor || "#666666",
        logoUrl: d.logoUrl || "",
        logoLightUrl: d.logoLightUrl || "",
        logoDarkUrl: d.logoDarkUrl || "",
        showLogoOnReceipt: d.showLogoOnReceipt !== false,
        showLogoOnSignage: d.showLogoOnSignage !== false,
        showLogoOnQueueDisplay: d.showLogoOnQueueDisplay !== false,
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => upsertBrandProfile({ locationId, ...form }),
    onSuccess: () => {
      enqueueSnackbar(t("brand.saved"), { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["brand-profile"] });
    },
    onError: (e) => {
      enqueueSnackbar(e.response?.data?.message || t("brand.saveFailed"), { variant: "error" });
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[#f5f5f5]">{t("brand.title")}</h1>
      <div className={cardClass}>
        <h2 className="text-md font-medium text-[#e0e0e0] mb-3">{t("brand.basicInfo")}</h2>
        <div className="grid gap-3">
          <div>
            <label className="block text-sm text-[#ababab] mb-1">{t("brand.brandName")}</label>
            <input
              className={inputClass}
              value={form.brandName}
              onChange={(e) => setForm({ ...form, brandName: e.target.value })}
              placeholder="POS Store"
            />
          </div>
          <div>
            <label className="block text-sm text-[#ababab] mb-1">{t("brand.brandNameEn")}</label>
            <input
              className={inputClass}
              value={form.brandNameEn}
              onChange={(e) => setForm({ ...form, brandNameEn: e.target.value })}
              placeholder="Store"
            />
          </div>
          <div>
            <label className="block text-sm text-[#ababab] mb-1">{t("brand.slogan")}</label>
            <input
              className={inputClass}
              value={form.slogan}
              onChange={(e) => setForm({ ...form, slogan: e.target.value })}
              placeholder=""
            />
          </div>
        </div>
      </div>
      <div className={cardClass}>
        <h2 className="text-md font-medium text-[#e0e0e0] mb-3">{t("brand.colors")}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-[#ababab] mb-1">{t("brand.primaryColor")}</label>
            <input
              type="color"
              className="w-full h-10 rounded cursor-pointer"
              value={form.primaryColor}
              onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm text-[#ababab] mb-1">{t("brand.secondaryColor")}</label>
            <input
              type="color"
              className="w-full h-10 rounded cursor-pointer"
              value={form.secondaryColor}
              onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
            />
          </div>
        </div>
      </div>
      <div className={cardClass}>
        <h2 className="text-md font-medium text-[#e0e0e0] mb-3">{t("brand.logoUrls")}</h2>
        <div className="grid gap-3">
          <div>
            <label className="block text-sm text-[#ababab] mb-1">{t("brand.logoUrl")}</label>
            <input
              className={inputClass}
              value={form.logoUrl}
              onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-sm text-[#ababab] mb-1">{t("brand.logoLightUrl")}</label>
            <input
              className={inputClass}
              value={form.logoLightUrl}
              onChange={(e) => setForm({ ...form, logoLightUrl: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm text-[#ababab] mb-1">{t("brand.logoDarkUrl")}</label>
            <input
              className={inputClass}
              value={form.logoDarkUrl}
              onChange={(e) => setForm({ ...form, logoDarkUrl: e.target.value })}
            />
          </div>
        </div>
      </div>
      <div className={cardClass}>
        <h2 className="text-md font-medium text-[#e0e0e0] mb-3">{t("brand.displayOptions")}</h2>
        <div className="space-y-2">
          {["showLogoOnReceipt", "showLogoOnSignage", "showLogoOnQueueDisplay"].map((key) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-[#e0e0e0]">{t(`brand.${key}`)}</span>
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

export default BrandLogoCenter;
