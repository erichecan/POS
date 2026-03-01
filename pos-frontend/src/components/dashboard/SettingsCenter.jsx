/**
 * Settings 通用配置与连锁组织 - docs/plans/2026-02-28-settings-general-chain.md
 * 2026-02-28T14:00:00+08:00
 * 2026-02-28T15:05:00+08:00: PRD 7.24 M22 收银规则 Tab
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  listOrganizations,
  listRegions,
  listStores,
  updateOrganization,
  updateRegion,
  updateStore,
  getResolvedStoreSettings,
  getTillRules,
  upsertTillRules,
} from "../../https";

const cardClass = "bg-[#262626] rounded-lg p-4 border border-[#333]";
const inputClass = "w-full bg-[#1f1f1f] text-[#f5f5f5] border border-[#3b3b3b] rounded-md px-3 py-2 focus:outline-none";

const TIMEZONES = ["UTC", "America/New_York", "America/Los_Angeles", "Europe/Dublin", "Europe/London", "Asia/Shanghai", "Asia/Tokyo"];
const CURRENCIES = ["USD", "EUR", "GBP", "CNY", "JPY"];
const LOCALES = [
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
];

const SettingsCenter = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("general");
  const [level, setLevel] = useState("org");
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [selectedRegionId, setSelectedRegionId] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [form, setForm] = useState({
    timezone: "UTC",
    currency: "USD",
    countryCode: "US",
    locale: "en",
  });

  const orgsQuery = useQuery({
    queryKey: ["organizations"],
    queryFn: () => listOrganizations({ limit: 100 }),
  });
  const regionsQuery = useQuery({
    queryKey: ["regions", selectedOrgId],
    queryFn: () => listRegions({ organizationId: selectedOrgId, limit: 100 }),
    enabled: !!selectedOrgId,
  });
  const storesQuery = useQuery({
    queryKey: ["stores", selectedRegionId],
    queryFn: () => listStores({ regionId: selectedRegionId, limit: 100 }),
    enabled: !!selectedRegionId,
  });

  const orgs = orgsQuery.data?.data?.data ?? [];
  const regions = regionsQuery.data?.data?.data ?? [];
  const stores = storesQuery.data?.data?.data ?? [];

  const selectedOrg = orgs.find((o) => o._id === selectedOrgId);
  const selectedRegion = regions.find((r) => r._id === selectedRegionId);
  const selectedStore = stores.find((s) => s._id === selectedStoreId);

  const loadFormFromSelection = () => {
    if (level === "org" && selectedOrg) {
      const ds = selectedOrg.defaultSettings || {};
      setForm({
        timezone: ds.timezone || "UTC",
        currency: ds.currency || "USD",
        countryCode: ds.countryCode || "US",
        locale: ds.locale || "en",
      });
    } else if (level === "region" && selectedRegion) {
      setForm({
        timezone: selectedRegion.timezone || "UTC",
        currency: selectedRegion.currency || "EUR",
        countryCode: selectedRegion.countryCode || "US",
        locale: (selectedRegion.defaultSettings || {}).locale || "en",
      });
    } else if (level === "store" && selectedStore) {
      const ov = selectedStore.overrideSettings || {};
      setForm({
        timezone: selectedStore.timezone || "",
        currency: ov.currency || "",
        countryCode: ov.countryCode || "",
        locale: ov.locale || "",
      });
    }
  };

  React.useEffect(() => {
    loadFormFromSelection();
  }, [level, selectedOrgId, selectedRegionId, selectedStoreId, selectedOrg, selectedRegion, selectedStore]);

  const updateOrgMutation = useMutation({
    mutationFn: ({ id, defaultSettings }) => updateOrganization({ id, defaultSettings }),
    onSuccess: () => {
      enqueueSnackbar(t("settings.saved"), { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
    onError: (e) => enqueueSnackbar(e.response?.data?.message || t("settings.saveFailed"), { variant: "error" }),
  });

  const updateRegionMutation = useMutation({
    mutationFn: ({ id, ...data }) => updateRegion({ id, ...data }),
    onSuccess: () => {
      enqueueSnackbar(t("settings.saved"), { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["regions"] });
    },
    onError: (e) => enqueueSnackbar(e.response?.data?.message || t("settings.saveFailed"), { variant: "error" }),
  });

  const updateStoreMutation = useMutation({
    mutationFn: ({ id, ...data }) => updateStore({ id, ...data }),
    onSuccess: () => {
      enqueueSnackbar(t("settings.saved"), { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["stores"] });
    },
    onError: (e) => enqueueSnackbar(e.response?.data?.message || t("settings.saveFailed"), { variant: "error" }),
  });

  const handleSave = () => {
    if (level === "org" && selectedOrgId) {
      updateOrgMutation.mutate({
        id: selectedOrgId,
        defaultSettings: { timezone: form.timezone, currency: form.currency, countryCode: form.countryCode, locale: form.locale },
      });
    } else if (level === "region" && selectedRegionId) {
      updateRegionMutation.mutate({
        id: selectedRegionId,
        timezone: form.timezone,
        currency: form.currency,
        countryCode: form.countryCode,
        defaultSettings: { locale: form.locale },
      });
    } else if (level === "store" && selectedStoreId) {
      updateStoreMutation.mutate({
        id: selectedStoreId,
        timezone: form.timezone || undefined,
        overrideSettings: { currency: form.currency, countryCode: form.countryCode, locale: form.locale },
      });
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[#f5f5f5]">{t("admin.settings")}</h1>
      <p className="text-sm text-[#ababab]">{t("admin.settingsDesc")}</p>

      <div className="flex gap-2 border-b border-[#333] pb-2">
        <button
          className={`px-4 py-2 rounded-md ${tab === "general" ? "bg-indigo-600 text-white" : "bg-[#333] text-[#ababab]"}`}
          onClick={() => setTab("general")}
        >
          {t("settings.general")}
        </button>
        <button
          className={`px-4 py-2 rounded-md ${tab === "org" ? "bg-indigo-600 text-white" : "bg-[#333] text-[#ababab]"}`}
          onClick={() => setTab("org")}
        >
          {t("settings.organization")}
        </button>
        <button
          className={`px-4 py-2 rounded-md ${tab === "tillRules" ? "bg-indigo-600 text-white" : "bg-[#333] text-[#ababab]"}`}
          onClick={() => setTab("tillRules")}
        >
          {t("settings.tillRules")}
        </button>
      </div>

      {tab === "general" && (
        <div className={cardClass}>
          <h2 className="text-md font-medium text-[#e0e0e0] mb-3">{t("settings.levelSelect")}</h2>
          <div className="flex gap-2 mb-4">
            {["org", "region", "store"].map((l) => (
              <button
                key={l}
                className={`px-3 py-1 rounded ${level === l ? "bg-indigo-600" : "bg-[#444]"}`}
                onClick={() => setLevel(l)}
              >
                {t(`settings.level.${l}`)}
              </button>
            ))}
          </div>

          {level === "org" && (
            <div className="space-y-2 mb-4">
              <label className="block text-sm text-[#ababab]">{t("settings.selectOrg")}</label>
              <select
                className={inputClass}
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
              >
                <option value="">—</option>
                {orgs.map((o) => (
                  <option key={o._id} value={o._id}>{o.name} ({o.code})</option>
                ))}
              </select>
            </div>
          )}

          {level === "region" && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-[#ababab]">{t("settings.selectOrg")}</label>
                <select className={inputClass} value={selectedOrgId} onChange={(e) => { setSelectedOrgId(e.target.value); setSelectedRegionId(""); }}>
                  <option value="">—</option>
                  {orgs.map((o) => (
                    <option key={o._id} value={o._id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#ababab]">{t("settings.selectRegion")}</label>
                <select className={inputClass} value={selectedRegionId} onChange={(e) => setSelectedRegionId(e.target.value)}>
                  <option value="">—</option>
                  {regions.map((r) => (
                    <option key={r._id} value={r._id}>{r.name} ({r.code})</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {level === "store" && (
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm text-[#ababab]">{t("settings.selectOrg")}</label>
                <select className={inputClass} value={selectedOrgId} onChange={(e) => { setSelectedOrgId(e.target.value); setSelectedRegionId(""); setSelectedStoreId(""); }}>
                  <option value="">—</option>
                  {orgs.map((o) => (
                    <option key={o._id} value={o._id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#ababab]">{t("settings.selectRegion")}</label>
                <select className={inputClass} value={selectedRegionId} onChange={(e) => { setSelectedRegionId(e.target.value); setSelectedStoreId(""); }}>
                  <option value="">—</option>
                  {regions.map((r) => (
                    <option key={r._id} value={r._id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#ababab]">{t("settings.selectStore")}</label>
                <select className={inputClass} value={selectedStoreId} onChange={(e) => setSelectedStoreId(e.target.value)}>
                  <option value="">—</option>
                  {stores.map((s) => (
                    <option key={s._id} value={s._id}>{s.name} ({s.locationId})</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {(selectedOrgId && level === "org") || (selectedRegionId && level === "region") || (selectedStoreId && level === "store") ? (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-[#ababab] mb-1">{t("settings.timezone")}</label>
                  <select className={inputClass} value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[#ababab] mb-1">{t("settings.currency")}</label>
                  <select className={inputClass} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[#ababab] mb-1">{t("settings.countryCode")}</label>
                  <input className={inputClass} value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value })} placeholder="US" />
                </div>
                <div>
                  <label className="block text-sm text-[#ababab] mb-1">{t("settings.locale")}</label>
                  <select className={inputClass} value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })}>
                    {LOCALES.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                onClick={handleSave}
                disabled={updateOrgMutation.isPending || updateRegionMutation.isPending || updateStoreMutation.isPending}
              >
                {t("common.save")}
              </button>
            </>
          ) : (
            <p className="text-[#ababab]">{t("settings.selectFirst")}</p>
          )}
        </div>
      )}

      {tab === "org" && (
        <OrganizationTab
          orgs={orgs}
          listRegions={listRegions}
          listStores={listStores}
          getResolvedStoreSettings={getResolvedStoreSettings}
          t={t}
        />
      )}
      {tab === "tillRules" && <TillRulesTab t={t} />}
    </div>
  );
};

const OrganizationTab = ({ orgs, listRegions, listStores, getResolvedStoreSettings, t }) => {
  const [selectedStoreForResolved, setSelectedStoreForResolved] = useState(null);
  const allRegionsQuery = useQuery({
    queryKey: ["regions-all"],
    queryFn: () => listRegions({ limit: 200 }),
  });
  const allStoresQuery = useQuery({
    queryKey: ["stores-all"],
    queryFn: () => listStores({ limit: 200 }),
  });
  const resolvedQuery = useQuery({
    queryKey: ["resolved-settings", selectedStoreForResolved],
    queryFn: () => getResolvedStoreSettings(selectedStoreForResolved),
    enabled: !!selectedStoreForResolved,
  });

  const regions = allRegionsQuery.data?.data?.data ?? [];
  const stores = allStoresQuery.data?.data?.data ?? [];
  const resolved = resolvedQuery.data?.data?.data?.resolvedSettings ?? {};
  const storeOptions = orgs.flatMap((org) => {
    const orgId = org._id;
    return regions
      .filter((r) => (r.organizationId?._id || r.organizationId) === orgId)
      .flatMap((region) =>
        stores
          .filter((s) => (s.regionId?._id || s.regionId) === region._id)
          .map((store) => ({ store, org, region }))
      );
  });

  return (
    <div className={cardClass}>
      <h2 className="text-md font-medium text-[#e0e0e0] mb-3">{t("settings.orgTree")}</h2>
      <div className="space-y-2 mb-4">
        {orgs.map((org) => {
          const orgRegions = regions.filter((r) => (r.organizationId?._id || r.organizationId) === org._id);
          const ds = org.defaultSettings || {};
          return (
            <div key={org._id} className="border border-[#444] rounded p-2">
              <div className="text-[#f5f5f5] font-medium">
                {org.name} <span className="text-[#888]">({org.code})</span>
              </div>
              <div className="text-xs text-[#666] mt-1">
                {t("settings.settings")}: {Object.keys(ds).length ? Object.entries(ds).map(([k, v]) => `${k}=${v}`).join(", ") : "—"}
              </div>
              {orgRegions.map((region) => {
                const regionStores = stores.filter((s) => (s.regionId?._id || s.regionId) === region._id);
                return (
                  <div key={region._id} className="ml-4 mt-2 border-l border-[#444] pl-3">
                    <div className="text-[#e0e0e0] text-sm">
                      {region.name} <span className="text-[#888]">({region.code})</span> — tz: {region.timezone}, curr: {region.currency}
                    </div>
                    {regionStores.map((store) => (
                      <div key={store._id} className="ml-4 mt-1 text-xs text-[#ababab]">
                        • {store.name} ({store.locationId}) {store.timezone ? `tz: ${store.timezone}` : ""}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-medium text-[#e0e0e0] mb-2">{t("settings.resolvedPreview")}</h3>
        <p className="text-xs text-[#ababab] mb-2">{t("settings.resolvedHint")}</p>
        <select
          className={`${inputClass} max-w-md`}
          value={selectedStoreForResolved || ""}
          onChange={(e) => setSelectedStoreForResolved(e.target.value || null)}
        >
          <option value="">{t("settings.selectStoreToPreview")}</option>
          {storeOptions.map(({ store, org, region }) => (
            <option key={store._id} value={store._id}>
              {org.name} / {region.name} / {store.name}
            </option>
          ))}
        </select>
        {selectedStoreForResolved && (
          <div className="mt-2 p-3 bg-[#1f1f1f] rounded text-sm">
            <pre className="text-[#e0e0e0] whitespace-pre-wrap">
              {resolvedQuery.isLoading ? t("common.loading") : JSON.stringify(resolved, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Till Rules Tab - PRD 7.24 M22 2026-02-28T15:05:00+08:00
 */
const TillRulesTab = ({ t }) => {
  const locationId = "default";
  const rulesQuery = useQuery({
    queryKey: ["till-rules", locationId],
    queryFn: () => getTillRules(locationId),
  });
  const queryClient = useQueryClient();
  const data = rulesQuery.data?.data?.data ?? {};
  const [form, setForm] = useState(() => ({
    tipOptions: data.tipOptions || [0, 10, 15, 18, 20, 25],
    tipCustomAllowed: data.tipCustomAllowed ?? true,
    tipCalcBase: data.tipCalcBase || "SUBTOTAL",
    tipRoundRule: data.tipRoundRule || "ROUND",
    tipShowOnReceipt: data.tipShowOnReceipt ?? true,
    tipShowNoTipOption: data.tipShowNoTipOption ?? true,
    ccServiceFeeRate: data.ccServiceFeeRate ?? 0,
    ccServiceFeeFixed: data.ccServiceFeeFixed ?? 0,
    debitServiceFeeRate: data.debitServiceFeeRate ?? 0,
    otherPaymentFeeRate: data.otherPaymentFeeRate ?? 0,
    showServiceFeeSeparately: data.showServiceFeeSeparately ?? false,
    ccMinOrderAmount: data.ccMinOrderAmount ?? 0,
    defaultTaxRate: data.defaultTaxRate ?? 0,
    taxInclusive: data.taxInclusive ?? false,
    deliveryFeeBase: data.deliveryFeeBase ?? 0,
    packagingFee: data.packagingFee ?? 0,
  }));

  React.useEffect(() => {
    if (!rulesQuery.data?.data?.data) return;
    const d = rulesQuery.data.data.data;
    setForm({
      tipOptions: d.tipOptions || [0, 10, 15, 18, 20, 25],
      tipCustomAllowed: d.tipCustomAllowed ?? true,
      tipCalcBase: d.tipCalcBase || "SUBTOTAL",
      tipRoundRule: d.tipRoundRule || "ROUND",
      tipShowOnReceipt: d.tipShowOnReceipt ?? true,
      tipShowNoTipOption: d.tipShowNoTipOption ?? true,
      ccServiceFeeRate: d.ccServiceFeeRate ?? 0,
      ccServiceFeeFixed: d.ccServiceFeeFixed ?? 0,
      debitServiceFeeRate: d.debitServiceFeeRate ?? 0,
      otherPaymentFeeRate: d.otherPaymentFeeRate ?? 0,
      showServiceFeeSeparately: d.showServiceFeeSeparately ?? false,
      ccMinOrderAmount: d.ccMinOrderAmount ?? 0,
      defaultTaxRate: d.defaultTaxRate ?? 0,
      taxInclusive: d.taxInclusive ?? false,
      deliveryFeeBase: d.deliveryFeeBase ?? 0,
      packagingFee: d.packagingFee ?? 0,
    });
  }, [rulesQuery.data?.data?.data]);

  const updateMutation = useMutation({
    mutationFn: (payload) => upsertTillRules({ locationId, ...payload }),
    onSuccess: () => {
      enqueueSnackbar(t("settings.saved"), { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["till-rules", locationId] });
    },
    onError: (e) => enqueueSnackbar(e.response?.data?.message || t("settings.saveFailed"), { variant: "error" }),
  });

  const tipOptionsStr = Array.isArray(form.tipOptions) ? form.tipOptions.join(", ") : "";
  const setTipOptionsFromStr = (s) => {
    const arr = String(s)
      .split(/[,，\s]+/)
      .map((n) => parseFloat(n))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100);
    setForm((f) => ({ ...f, tipOptions: arr.length ? arr : [0, 10, 15, 18, 20, 25] }));
  };

  return (
    <div className={cardClass}>
      <h2 className="text-md font-medium text-[#e0e0e0] mb-3">{t("settings.tillRulesDesc")}</h2>
      <p className="text-xs text-[#ababab] mb-4">{t("settings.locationId")}: {locationId}</p>
      {rulesQuery.isLoading ? (
        <p className="text-[#ababab]">{t("common.loading")}</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#ababab] mb-1">{t("settings.tipOptions")}</label>
              <input
                className={inputClass}
                value={tipOptionsStr}
                onChange={(e) => setTipOptionsFromStr(e.target.value)}
                placeholder="0, 10, 15, 18, 20, 25"
              />
            </div>
            <div className="flex flex-col justify-end gap-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.tipCustomAllowed}
                  onChange={(e) => setForm((f) => ({ ...f, tipCustomAllowed: e.target.checked }))}
                />
                <span className="text-sm text-[#ababab]">{t("settings.tipCustomAllowed")}</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.tipShowOnReceipt}
                  onChange={(e) => setForm((f) => ({ ...f, tipShowOnReceipt: e.target.checked }))}
                />
                <span className="text-sm text-[#ababab]">{t("settings.tipShowOnReceipt")}</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.tipShowNoTipOption}
                  onChange={(e) => setForm((f) => ({ ...f, tipShowNoTipOption: e.target.checked }))}
                />
                <span className="text-sm text-[#ababab]">{t("settings.tipShowNoTipOption")}</span>
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#ababab] mb-1">{t("settings.tipCalcBase")}</label>
              <select
                className={inputClass}
                value={form.tipCalcBase}
                onChange={(e) => setForm((f) => ({ ...f, tipCalcBase: e.target.value }))}
              >
                <option value="SUBTOTAL">{t("settings.tipCalcBaseSubtotal")}</option>
                <option value="AFTER_TAX">{t("settings.tipCalcBaseAfterTax")}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#ababab] mb-1">{t("settings.tipRoundRule")}</label>
              <select
                className={inputClass}
                value={form.tipRoundRule}
                onChange={(e) => setForm((f) => ({ ...f, tipRoundRule: e.target.value }))}
              >
                <option value="FLOOR">FLOOR</option>
                <option value="CEIL">CEIL</option>
                <option value="ROUND">ROUND</option>
              </select>
            </div>
          </div>
          <div className="border-t border-[#444] pt-4">
            <h3 className="text-sm font-medium text-[#e0e0e0] mb-2">Payment service fees</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-[#ababab] mb-1">{t("settings.ccServiceFeeRate")}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  className={inputClass}
                  value={form.ccServiceFeeRate}
                  onChange={(e) => setForm((f) => ({ ...f, ccServiceFeeRate: Number(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <label className="block text-sm text-[#ababab] mb-1">{t("settings.ccServiceFeeFixed")}</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className={inputClass}
                  value={form.ccServiceFeeFixed}
                  onChange={(e) => setForm((f) => ({ ...f, ccServiceFeeFixed: Number(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <label className="block text-sm text-[#ababab] mb-1">{t("settings.debitServiceFeeRate")}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  className={inputClass}
                  value={form.debitServiceFeeRate}
                  onChange={(e) => setForm((f) => ({ ...f, debitServiceFeeRate: Number(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <label className="block text-sm text-[#ababab] mb-1">{t("settings.otherPaymentFeeRate")}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  className={inputClass}
                  value={form.otherPaymentFeeRate}
                  onChange={(e) => setForm((f) => ({ ...f, otherPaymentFeeRate: Number(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.showServiceFeeSeparately}
                onChange={(e) => setForm((f) => ({ ...f, showServiceFeeSeparately: e.target.checked }))}
              />
              <span className="text-sm text-[#ababab]">{t("settings.showServiceFeeSeparately")}</span>
            </div>
            <div className="mt-2">
              <label className="block text-sm text-[#ababab] mb-1">{t("settings.ccMinOrderAmount")}</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                style={{ maxWidth: 160 }}
                value={form.ccMinOrderAmount}
                onChange={(e) => setForm((f) => ({ ...f, ccMinOrderAmount: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <div className="border-t border-[#444] pt-4">
            <h3 className="text-sm font-medium text-[#e0e0e0] mb-2">Tax & other fees</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-[#ababab] mb-1">{t("settings.defaultTaxRate")}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  className={inputClass}
                  value={form.defaultTaxRate}
                  onChange={(e) => setForm((f) => ({ ...f, defaultTaxRate: Number(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <label className="block text-sm text-[#ababab] mb-1">{t("settings.deliveryFeeBase")}</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className={inputClass}
                  value={form.deliveryFeeBase}
                  onChange={(e) => setForm((f) => ({ ...f, deliveryFeeBase: Number(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <label className="block text-sm text-[#ababab] mb-1">{t("settings.packagingFee")}</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className={inputClass}
                  value={form.packagingFee}
                  onChange={(e) => setForm((f) => ({ ...f, packagingFee: Number(e.target.value) || 0 }))}
                />
              </div>
              <label className="flex items-center gap-2 mt-6">
                <input
                  type="checkbox"
                  checked={form.taxInclusive}
                  onChange={(e) => setForm((f) => ({ ...f, taxInclusive: e.target.checked }))}
                />
                <span className="text-sm text-[#ababab]">{t("settings.taxInclusive")}</span>
              </label>
            </div>
          </div>
          <button
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            onClick={() => updateMutation.mutate(form)}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? t("common.saving") : t("common.save")}
          </button>
        </div>
      )}
    </div>
  );
};

export default SettingsCenter;
