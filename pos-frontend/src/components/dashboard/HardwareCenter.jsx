import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  getHardwareCatalog,
  getStoreHardwareProfile,
  getStoreHardwareProfiles,
  upsertStoreHardwareProfile,
} from "../../https";

const cardClass = "bg-[#262626] rounded-lg p-4 border border-[#333]";
const inputClass =
  "w-full bg-[#1f1f1f] text-[#f5f5f5] border border-[#3b3b3b] rounded-md px-3 py-2 focus:outline-none";

const ROLE_KEY_OPTIONS = [
  "COUNTER_POS",
  "PAYMENT",
  "FRONT_PRINT",
  "KITCHEN_PRINT",
  "KDS",
  "CASH_DRAWER",
  "KIOSK",
  "QUEUE_DISPLAY",
  "SIGNAGE",
  "NETWORK",
];

const BUSINESS_TYPES = [
  "MILK_TEA",
  "SUSHI",
  "DIM_SUM",
  "WESTERN_DINING",
  "CHINESE_FAST_FOOD",
  "NAIL_SALON",
  "HOTPOT",
];

const COUNTRY_OPTIONS = ["US", "CA", "IE", "GB", "FR", "ES", "NL"];

const getRows = (response) => (Array.isArray(response?.data?.data) ? response.data.data : []);

const createDefaultSelection = () => ({
  roleKey: "COUNTER_POS",
  providerCode: "",
  modelCode: "",
  quantity: 1,
  zone: "",
});

const HardwareCenter = () => {
  const queryClient = useQueryClient();
  const [catalogFilter, setCatalogFilter] = useState({
    countryCode: "US",
    providerCode: "",
    capability: "",
    deviceClass: "",
  });
  const [profileForm, setProfileForm] = useState({
    locationId: "default",
    countryCode: "US",
    businessType: "CHINESE_FAST_FOOD",
    profileStatus: "ACTIVE",
    providerPriorityText: "SQUARE,TOAST,CUSTOM",
    capabilityTargetsText: "COUNTER_CHECKOUT,EMV_NFC_PAYMENT,FRONT_RECEIPT_PRINT,KDS_PRODUCTION",
    selections: [createDefaultSelection()],
  });
  const [profileLoadVersion, setProfileLoadVersion] = useState(0);

  const catalogQuery = useQuery({
    queryKey: ["hardware-catalog", catalogFilter],
    queryFn: () =>
      getHardwareCatalog({
        countryCode: catalogFilter.countryCode,
        providerCode: catalogFilter.providerCode || undefined,
        capability: catalogFilter.capability || undefined,
        deviceClass: catalogFilter.deviceClass || undefined,
      }),
  });

  const profilesQuery = useQuery({
    queryKey: ["store-hardware-profiles", profileLoadVersion],
    queryFn: () => getStoreHardwareProfiles({ limit: 100 }),
  });

  const catalogPayload = catalogQuery.data?.data?.data || {};
  const providers = useMemo(
    () => (Array.isArray(catalogPayload.providers) ? catalogPayload.providers : []),
    [catalogPayload.providers]
  );
  const profiles = useMemo(() => getRows(profilesQuery.data), [profilesQuery.data]);

  const providerOptions = useMemo(
    () => providers.map((provider) => provider.providerCode),
    [providers]
  );

  const providerDeviceMap = useMemo(() => {
    const map = new Map();
    providers.forEach((provider) => {
      map.set(
        provider.providerCode,
        Array.isArray(provider.devices) ? provider.devices : []
      );
    });
    return map;
  }, [providers]);

  const saveProfileMutation = useMutation({
    mutationFn: ({ locationId, ...data }) =>
      upsertStoreHardwareProfile({ locationId, ...data }),
    onSuccess: (response) => {
      const warnings = response?.data?.validation?.warnings || [];
      if (warnings.length > 0) {
        enqueueSnackbar(`Saved with warnings: ${warnings.join(" | ")}`, {
          variant: "warning",
        });
      } else {
        enqueueSnackbar("Hardware profile saved.", { variant: "success" });
      }
      queryClient.invalidateQueries({ queryKey: ["store-hardware-profiles"] });
      setProfileLoadVersion((prev) => prev + 1);
    },
    onError: (error) => {
      const details = error.response?.data?.details;
      if (Array.isArray(details) && details.length > 0) {
        enqueueSnackbar(`Save failed: ${details[0].reason}`, { variant: "error" });
        return;
      }
      const message = error.response?.data?.message || "Failed to save hardware profile.";
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  const loadProfileMutation = useMutation({
    mutationFn: (locationId) => getStoreHardwareProfile(locationId),
    onSuccess: (response) => {
      const data = response?.data?.data;
      if (!data) {
        enqueueSnackbar("No profile data found.", { variant: "warning" });
        return;
      }
      setProfileForm({
        locationId: data.locationId || "default",
        countryCode: data.countryCode || "US",
        businessType: data.businessType || "CHINESE_FAST_FOOD",
        profileStatus: data.profileStatus || "ACTIVE",
        providerPriorityText: Array.isArray(data.providerPriority)
          ? data.providerPriority.join(",")
          : "",
        capabilityTargetsText: Array.isArray(data.capabilityTargets)
          ? data.capabilityTargets.join(",")
          : "",
        selections:
          Array.isArray(data.selections) && data.selections.length > 0
            ? data.selections.map((item) => ({
                roleKey: item.roleKey || "COUNTER_POS",
                providerCode: item.providerCode || "",
                modelCode: item.modelCode || "",
                quantity: Number(item.quantity || 1),
                zone: item.zone || "",
              }))
            : [createDefaultSelection()],
      });
      enqueueSnackbar(`Loaded hardware profile: ${data.locationId}`, { variant: "info" });
    },
    onError: (error) => {
      const message = error.response?.data?.message || "Profile not found for this location.";
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  const updateSelection = (index, patch) => {
    setProfileForm((prev) => {
      const rows = [...prev.selections];
      const nextRow = { ...rows[index], ...patch };
      if (patch.providerCode !== undefined) {
        const devices = providerDeviceMap.get(patch.providerCode) || [];
        const hasModel = devices.some((device) => device.modelCode === nextRow.modelCode);
        if (!hasModel) {
          nextRow.modelCode = "";
        }
      }
      rows[index] = nextRow;
      return { ...prev, selections: rows };
    });
  };

  const addSelection = () => {
    setProfileForm((prev) => ({
      ...prev,
      selections: [...prev.selections, createDefaultSelection()],
    }));
  };

  const removeSelection = (index) => {
    setProfileForm((prev) => ({
      ...prev,
      selections: prev.selections.filter((_, rowIndex) => rowIndex !== index),
    }));
  };

  const parseCsv = (value) =>
    `${value || ""}`
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);

  const handleSave = (event) => {
    event.preventDefault();
    const locationId = `${profileForm.locationId || ""}`.trim() || "default";
    const selections = profileForm.selections
      .map((item) => ({
        roleKey: `${item.roleKey || ""}`.trim().toUpperCase(),
        providerCode: `${item.providerCode || ""}`.trim().toUpperCase(),
        modelCode: `${item.modelCode || ""}`.trim().toUpperCase(),
        quantity: Number(item.quantity || 1),
        zone: `${item.zone || ""}`.trim(),
      }))
      .filter((item) => item.roleKey && item.providerCode && item.modelCode);

    if (selections.length === 0) {
      enqueueSnackbar("Please configure at least one hardware selection.", {
        variant: "warning",
      });
      return;
    }

    saveProfileMutation.mutate({
      locationId,
      countryCode: profileForm.countryCode,
      businessType: profileForm.businessType,
      profileStatus: profileForm.profileStatus,
      providerPriority: parseCsv(profileForm.providerPriorityText),
      capabilityTargets: parseCsv(profileForm.capabilityTargetsText),
      selections,
    });
  };

  return (
    <div className="container mx-auto py-2 px-6 md:px-4 space-y-4">
      {/* 2026-02-26: Hardware description section */}
      <div className="mb-6 rounded-lg border border-[#333] bg-[#262626] p-4">
        <h2 className="text-lg font-semibold text-[#f5f5f5] mb-2">Hardware Management</h2>
        <p className="text-sm text-[#ababab] leading-relaxed">
          <strong className="text-[#f5f5f5]">Hardware Catalog</strong> lists all compatible POS devices (terminals, printers, scanners, cash drawers, kiosks) filtered by country, provider, and capabilities. These are reference models — not yet connected to your store.<br/><br/>
          <strong className="text-[#f5f5f5]">Store Hardware Profile</strong> is your store's specific hardware setup. Select which devices each store location uses, assign roles (e.g. counter POS, kitchen printer), and save the configuration. This determines what hardware is expected at each store for operational readiness checks.
        </p>
      </div>

      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[#f5f5f5] text-lg font-semibold">Hardware Catalog</h2>
            <p className="text-[#ababab] text-sm mt-1">
              Toast / Square / Custom device matrix for NA + EU rollout.
            </p>
          </div>
          <p className="text-xs text-[#8fa7d6]">
            Catalog: {catalogPayload.catalogVersion || "loading..."}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
          <select
            className={inputClass}
            value={catalogFilter.countryCode}
            onChange={(event) =>
              setCatalogFilter((prev) => ({ ...prev, countryCode: event.target.value }))
            }
          >
            {COUNTRY_OPTIONS.map((countryCode) => (
              <option key={countryCode} value={countryCode}>
                {countryCode}
              </option>
            ))}
          </select>
          <input
            className={inputClass}
            placeholder="Provider (TOAST/SQUARE)"
            value={catalogFilter.providerCode}
            onChange={(event) =>
              setCatalogFilter((prev) => ({
                ...prev,
                providerCode: event.target.value.toUpperCase(),
              }))
            }
          />
          <input
            className={inputClass}
            placeholder="Capability (e.g. KDS_PRODUCTION)"
            value={catalogFilter.capability}
            onChange={(event) =>
              setCatalogFilter((prev) => ({
                ...prev,
                capability: event.target.value.toUpperCase(),
              }))
            }
          />
          <input
            className={inputClass}
            placeholder="Device Class (e.g. KIOSK)"
            value={catalogFilter.deviceClass}
            onChange={(event) =>
              setCatalogFilter((prev) => ({
                ...prev,
                deviceClass: event.target.value.toUpperCase(),
              }))
            }
          />
        </div>

        <div className="mt-4 space-y-3 max-h-[360px] overflow-y-auto pr-1">
          {providers.map((provider) => (
            <div key={provider.providerCode} className="bg-[#1f1f1f] rounded-md p-3 border border-[#333]">
              <div className="flex items-center justify-between">
                <p className="text-[#f5f5f5] font-semibold">
                  {provider.providerCode} · {provider.providerName}
                </p>
                <p className="text-xs text-[#9fa8bf]">
                  {(provider.countryCodes || []).join(", ")}
                </p>
              </div>
              <div className="mt-2 grid grid-cols-1 xl:grid-cols-2 gap-2">
                {(provider.devices || []).map((device) => (
                  <div key={device.modelCode} className="bg-[#252525] rounded px-3 py-2 border border-[#353535]">
                    <p className="text-[#dfe6f5] text-sm font-medium">{device.displayName}</p>
                    <p className="text-[#9aa8c0] text-xs mt-1">
                      {device.modelCode} · {device.deviceClass}
                    </p>
                    <p className="text-[#8fd0c8] text-xs mt-1">
                      {(device.capabilityTags || []).join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {providers.length === 0 && (
            <p className="text-sm text-[#ababab]">No catalog result for current filters.</p>
          )}
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[#f5f5f5] text-lg font-semibold">Store Hardware Profile</h2>
            <p className="text-[#ababab] text-sm mt-1">
              Configure hardware bundles by store location (country-aware validation).
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="bg-[#3b3b3b] text-[#f5f5f5] rounded-md px-3 py-2 text-sm"
              onClick={() => loadProfileMutation.mutate(profileForm.locationId)}
              disabled={loadProfileMutation.isPending}
            >
              {loadProfileMutation.isPending ? "Loading..." : "Load Profile"}
            </button>
          </div>
        </div>

        <form className="space-y-3 mt-4" onSubmit={handleSave}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <input
              className={inputClass}
              placeholder="Location ID"
              value={profileForm.locationId}
              onChange={(event) =>
                setProfileForm((prev) => ({ ...prev, locationId: event.target.value }))
              }
            />
            <select
              className={inputClass}
              value={profileForm.countryCode}
              onChange={(event) =>
                setProfileForm((prev) => ({ ...prev, countryCode: event.target.value }))
              }
            >
              {COUNTRY_OPTIONS.map((countryCode) => (
                <option key={countryCode} value={countryCode}>
                  {countryCode}
                </option>
              ))}
            </select>
            <select
              className={inputClass}
              value={profileForm.businessType}
              onChange={(event) =>
                setProfileForm((prev) => ({ ...prev, businessType: event.target.value }))
              }
            >
              {BUSINESS_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <select
              className={inputClass}
              value={profileForm.profileStatus}
              onChange={(event) =>
                setProfileForm((prev) => ({ ...prev, profileStatus: event.target.value }))
              }
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <input
              className={inputClass}
              placeholder="Provider priority (comma-separated)"
              value={profileForm.providerPriorityText}
              onChange={(event) =>
                setProfileForm((prev) => ({ ...prev, providerPriorityText: event.target.value }))
              }
            />
            <input
              className={inputClass}
              placeholder="Capability targets (comma-separated)"
              value={profileForm.capabilityTargetsText}
              onChange={(event) =>
                setProfileForm((prev) => ({ ...prev, capabilityTargetsText: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#c9d3e8] font-semibold">Hardware Selections</p>
              <button
                type="button"
                className="bg-[#2f4f7a] text-[#dfefff] rounded-md px-3 py-1 text-xs"
                onClick={addSelection}
              >
                + Add Row
              </button>
            </div>

            {profileForm.selections.map((row, index) => {
              const modelOptions = providerDeviceMap.get(row.providerCode) || [];
              return (
                <div key={`${index}-${row.roleKey}`} className="grid grid-cols-1 xl:grid-cols-6 gap-2">
                  <select
                    className={inputClass}
                    value={row.roleKey}
                    onChange={(event) => updateSelection(index, { roleKey: event.target.value })}
                  >
                    {ROLE_KEY_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <select
                    className={inputClass}
                    value={row.providerCode}
                    onChange={(event) =>
                      updateSelection(index, { providerCode: event.target.value })
                    }
                  >
                    <option value="">Provider</option>
                    {providerOptions.map((providerCode) => (
                      <option key={`${index}-${providerCode}`} value={providerCode}>
                        {providerCode}
                      </option>
                    ))}
                  </select>
                  <select
                    className={inputClass}
                    value={row.modelCode}
                    onChange={(event) => updateSelection(index, { modelCode: event.target.value })}
                  >
                    <option value="">Model</option>
                    {modelOptions.map((device) => (
                      <option key={`${index}-${device.modelCode}`} value={device.modelCode}>
                        {device.modelCode}
                      </option>
                    ))}
                  </select>
                  <input
                    className={inputClass}
                    placeholder="Zone (Front/Kitchen)"
                    value={row.zone}
                    onChange={(event) => updateSelection(index, { zone: event.target.value })}
                  />
                  <input
                    type="number"
                    min={1}
                    max={200}
                    className={inputClass}
                    value={row.quantity}
                    onChange={(event) =>
                      updateSelection(index, { quantity: Number(event.target.value || 1) })
                    }
                  />
                  <button
                    type="button"
                    className="bg-[#3b2a2a] text-[#ffb5b5] rounded-md px-3 py-2 text-sm"
                    onClick={() => removeSelection(index)}
                    disabled={profileForm.selections.length <= 1}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="submit"
            className={`bg-[#F6B100] text-[#1f1f1f] rounded-md px-4 py-2 font-semibold ${
              saveProfileMutation.isPending ? "opacity-70 cursor-not-allowed" : ""
            }`}
            disabled={saveProfileMutation.isPending}
          >
            {saveProfileMutation.isPending ? "Saving..." : "Save Hardware Profile"}
          </button>
        </form>

        <div className="mt-4 border-t border-[#343434] pt-3">
          <p className="text-[#d7d7d7] text-sm font-semibold mb-2">Existing Profiles</p>
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {profiles.map((profile) => (
              <div key={profile._id} className="bg-[#1f1f1f] px-3 py-2 rounded-md border border-[#333]">
                <div className="flex items-center justify-between">
                  <p className="text-[#f5f5f5] text-sm">
                    {profile.locationId} · {profile.countryCode} · {profile.businessType || "N/A"}
                  </p>
                  <button
                    type="button"
                    className="text-xs bg-[#353535] text-[#dfefff] px-2 py-1 rounded"
                    onClick={() => loadProfileMutation.mutate(profile.locationId)}
                  >
                    Load
                  </button>
                </div>
                <p className="text-xs text-[#9fb3d9] mt-1">
                  selections: {Array.isArray(profile.selections) ? profile.selections.length : 0}
                </p>
              </div>
            ))}
            {profiles.length === 0 && (
              <p className="text-sm text-[#ababab]">No hardware profiles created.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HardwareCenter;
