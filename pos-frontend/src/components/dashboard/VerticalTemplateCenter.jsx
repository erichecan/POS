import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  getStoreVerticalProfile,
  getStoreVerticalProfiles,
  getVerticalTemplateCatalog,
  previewStoreProvisioning,
  upsertStoreVerticalProfile,
} from "../../https";

const cardClass = "bg-[#262626] rounded-lg p-4 border border-[#333]";
const inputClass =
  "w-full bg-[#1f1f1f] text-[#f5f5f5] border border-[#3b3b3b] rounded-md px-3 py-2 focus:outline-none";

const COUNTRY_OPTIONS = ["US", "CA", "IE", "GB", "FR", "ES", "NL"];

const getRows = (response) => (Array.isArray(response?.data?.data) ? response.data.data : []);

const VerticalTemplateCenter = () => {
  const queryClient = useQueryClient();
  const [catalogFilter, setCatalogFilter] = useState({
    countryCode: "US",
    typeGroup: "",
    keyword: "",
  });
  const [profileForm, setProfileForm] = useState({
    locationId: "default",
    countryCode: "US",
    templateCode: "MILK_TEA",
    profileStatus: "ACTIVE",
    overridesText: JSON.stringify(
      {
        tableServiceProfile: {
          enabled: false,
        },
      },
      null,
      2
    ),
  });
  const [profileLoadVersion, setProfileLoadVersion] = useState(0);
  const [provisioningForm, setProvisioningForm] = useState({
    locationId: "preview-store-001",
    countryCode: "US",
    verticalTemplateCode: "MILK_TEA",
    providerPriorityText: "TOAST,SQUARE,CUSTOM",
    capabilityTargetsText: "",
    autoSelectHardware: true,
  });
  const [provisioningResult, setProvisioningResult] = useState(null);

  const catalogQuery = useQuery({
    queryKey: ["vertical-template-catalog", catalogFilter],
    queryFn: () =>
      getVerticalTemplateCatalog({
        countryCode: catalogFilter.countryCode,
        typeGroup: catalogFilter.typeGroup || undefined,
        keyword: catalogFilter.keyword || undefined,
      }),
  });

  const profilesQuery = useQuery({
    queryKey: ["store-vertical-profiles", profileLoadVersion],
    queryFn: () => getStoreVerticalProfiles({ limit: 100 }),
  });

  const catalogPayload = catalogQuery.data?.data?.data || {};
  const templates = useMemo(
    () => (Array.isArray(catalogPayload.templates) ? catalogPayload.templates : []),
    [catalogPayload.templates]
  );
  const profiles = useMemo(() => getRows(profilesQuery.data), [profilesQuery.data]);

  const templateOptions = useMemo(
    () => Array.from(new Set(templates.map((item) => item.templateCode))),
    [templates]
  );

  const saveProfileMutation = useMutation({
    mutationFn: ({ locationId, ...data }) =>
      upsertStoreVerticalProfile({ locationId, ...data }),
    onSuccess: (response) => {
      const templateCode = response?.data?.data?.templateCode;
      enqueueSnackbar(`Vertical profile saved: ${templateCode || "OK"}`, {
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["store-vertical-profiles"] });
      setProfileLoadVersion((prev) => prev + 1);
    },
    onError: (error) => {
      const message = error.response?.data?.message || "Failed to save vertical template profile.";
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  const loadProfileMutation = useMutation({
    mutationFn: (locationId) => getStoreVerticalProfile(locationId, { includeResolved: true }),
    onSuccess: (response) => {
      const data = response?.data?.data;
      if (!data) {
        enqueueSnackbar("No profile data found.", { variant: "warning" });
        return;
      }

      setProfileForm({
        locationId: data.locationId || "default",
        countryCode: data.countryCode || "US",
        templateCode: data.templateCode || "MILK_TEA",
        profileStatus: data.profileStatus || "ACTIVE",
        overridesText: JSON.stringify(data.overrides || {}, null, 2),
      });

      enqueueSnackbar(`Loaded template profile: ${data.locationId}`, { variant: "info" });
    },
    onError: (error) => {
      const message = error.response?.data?.message || "Profile not found for this location.";
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  const previewProvisioningMutation = useMutation({
    mutationFn: (payload) => previewStoreProvisioning(payload),
    onSuccess: (response) => {
      setProvisioningResult(response?.data?.data || null);
      enqueueSnackbar("Provisioning preview generated.", { variant: "success" });
    },
    onError: (error) => {
      const details = error.response?.data?.details;
      if (Array.isArray(details) && details.length > 0) {
        enqueueSnackbar(`Preview failed: ${details[0].reason}`, { variant: "error" });
        return;
      }
      const message = error.response?.data?.message || "Failed to preview store provisioning.";
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  const parseCsvUpper = (value) =>
    `${value || ""}`
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);

  const handleSave = (event) => {
    event.preventDefault();
    let overrides = {};
    try {
      overrides = profileForm.overridesText.trim()
        ? JSON.parse(profileForm.overridesText)
        : {};
    } catch (_error) {
      enqueueSnackbar("Overrides must be valid JSON.", { variant: "error" });
      return;
    }

    saveProfileMutation.mutate({
      locationId: `${profileForm.locationId || ""}`.trim() || "default",
      countryCode: profileForm.countryCode,
      templateCode: profileForm.templateCode,
      profileStatus: profileForm.profileStatus,
      overrides,
    });
  };

  const handlePreviewProvisioning = (event) => {
    event.preventDefault();
    previewProvisioningMutation.mutate({
      locationId: provisioningForm.locationId,
      countryCode: provisioningForm.countryCode,
      provisioning: {
        verticalTemplateCode: provisioningForm.verticalTemplateCode,
        providerPriority: parseCsvUpper(provisioningForm.providerPriorityText),
        capabilityTargets: parseCsvUpper(provisioningForm.capabilityTargetsText),
        autoSelectHardware: provisioningForm.autoSelectHardware,
      },
    });
  };

  return (
    <div className="container mx-auto py-2 px-6 md:px-4 space-y-4">
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[#f5f5f5] text-lg font-semibold">Vertical Template Catalog</h2>
            <p className="text-[#ababab] text-sm mt-1">
              Industry presets for milk tea, sushi, dim sum, western dining, nail salon, and more.
            </p>
          </div>
          <p className="text-xs text-[#8fa7d6]">
            Catalog: {catalogPayload.catalogVersion || "loading..."}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
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
            placeholder="Type Group (e.g. DINE_IN_FULL)"
            value={catalogFilter.typeGroup}
            onChange={(event) =>
              setCatalogFilter((prev) => ({
                ...prev,
                typeGroup: event.target.value.toUpperCase(),
              }))
            }
          />
          <input
            className={inputClass}
            placeholder="Keyword (中文/English)"
            value={catalogFilter.keyword}
            onChange={(event) =>
              setCatalogFilter((prev) => ({
                ...prev,
                keyword: event.target.value,
              }))
            }
          />
        </div>

        <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
          {templates.map((template) => (
            <div key={template.templateCode} className="bg-[#1f1f1f] rounded-md p-3 border border-[#333]">
              <div className="flex items-center justify-between">
                <p className="text-[#f5f5f5] font-semibold">
                  {template.displayName} · {template.displayNameEn}
                </p>
                <p className="text-xs text-[#9aa7bf]">{template.templateCode}</p>
              </div>
              <p className="text-xs text-[#8ea7d8] mt-2">Type: {template.typeGroup}</p>
              <p className="text-xs text-[#9ecdc3] mt-1">
                Required: {(template.requiredCapabilities || []).join(", ")}
              </p>
              <p className="text-xs text-[#b7b7b7] mt-1">
                Modes: {(template.operatingModes || []).join(", ")}
              </p>
            </div>
          ))}
          {templates.length === 0 && (
            <p className="text-sm text-[#ababab]">No template found for current filters.</p>
          )}
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[#f5f5f5] text-lg font-semibold">Store Provisioning Preview</h2>
            <p className="text-[#ababab] text-sm mt-1">
              Preview template + hardware auto-provisioning plan before store initialization.
            </p>
          </div>
        </div>

        <form className="space-y-3 mt-4" onSubmit={handlePreviewProvisioning}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <input
              className={inputClass}
              placeholder="Preview Location ID"
              value={provisioningForm.locationId}
              onChange={(event) =>
                setProvisioningForm((prev) => ({ ...prev, locationId: event.target.value }))
              }
            />
            <select
              className={inputClass}
              value={provisioningForm.countryCode}
              onChange={(event) =>
                setProvisioningForm((prev) => ({ ...prev, countryCode: event.target.value }))
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
              value={provisioningForm.verticalTemplateCode}
              onChange={(event) =>
                setProvisioningForm((prev) => ({
                  ...prev,
                  verticalTemplateCode: event.target.value,
                }))
              }
            >
              {templateOptions.map((templateCode) => (
                <option key={templateCode} value={templateCode}>
                  {templateCode}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-[#d6d6d6] px-2">
              <input
                type="checkbox"
                checked={provisioningForm.autoSelectHardware}
                onChange={(event) =>
                  setProvisioningForm((prev) => ({
                    ...prev,
                    autoSelectHardware: event.target.checked,
                  }))
                }
              />
              Auto Select Hardware
            </label>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <input
              className={inputClass}
              placeholder="Provider priority (comma-separated)"
              value={provisioningForm.providerPriorityText}
              onChange={(event) =>
                setProvisioningForm((prev) => ({
                  ...prev,
                  providerPriorityText: event.target.value,
                }))
              }
            />
            <input
              className={inputClass}
              placeholder="Extra capability targets (comma-separated, optional)"
              value={provisioningForm.capabilityTargetsText}
              onChange={(event) =>
                setProvisioningForm((prev) => ({
                  ...prev,
                  capabilityTargetsText: event.target.value,
                }))
              }
            />
          </div>

          <button
            type="submit"
            className={`bg-[#3f6fd2] text-white rounded-md px-4 py-2 font-semibold ${
              previewProvisioningMutation.isPending ? "opacity-70 cursor-not-allowed" : ""
            }`}
            disabled={previewProvisioningMutation.isPending}
          >
            {previewProvisioningMutation.isPending ? "Previewing..." : "Generate Preview"}
          </button>
        </form>

        {provisioningResult && (
          <div className="mt-4 border-t border-[#343434] pt-3 space-y-2">
            <p className="text-sm text-[#d7d7d7]">
              Country: <span className="text-[#9ecdc3]">{provisioningResult.countryCode}</span>
              {" · "}
              Template:{" "}
              <span className="text-[#9ecdc3]">
                {provisioningResult.summary?.templateCode || "N/A"}
              </span>
            </p>
            <p className="text-xs text-[#9aa8c0]">
              Covered capabilities:{" "}
              {(provisioningResult.summary?.hardware?.coveredCapabilities || []).join(", ") || "N/A"}
            </p>
            <p className="text-xs text-[#d6b074]">
              Missing capabilities:{" "}
              {(provisioningResult.summary?.hardware?.missingCapabilities || []).join(", ") || "None"}
            </p>
            <p className="text-xs text-[#c5c5c5]">
              Warnings: {(provisioningResult.summary?.hardware?.warnings || []).join(" | ") || "None"}
            </p>
            <div className="max-h-[180px] overflow-y-auto pr-1 space-y-2">
              {(provisioningResult.hardwareProfileDraft?.selections || []).map((selection, index) => (
                <div key={`${selection.providerCode}-${selection.modelCode}-${index}`} className="bg-[#1f1f1f] rounded-md p-2 border border-[#333]">
                  <p className="text-xs text-[#dfe5f2]">
                    {selection.providerCode} / {selection.modelCode} · {selection.roleKey}
                  </p>
                  <p className="text-xs text-[#9daac0] mt-1">
                    qty: {selection.quantity} · class: {selection.resolvedDeviceClass || "-"}
                  </p>
                </div>
              ))}
              {(provisioningResult.hardwareProfileDraft?.selections || []).length === 0 && (
                <p className="text-xs text-[#ababab]">No hardware selections generated.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[#f5f5f5] text-lg font-semibold">Store Vertical Profile</h2>
            <p className="text-[#ababab] text-sm mt-1">
              Bind a store to a vertical template, with JSON overrides.
            </p>
          </div>
          <button
            type="button"
            className="bg-[#3b3b3b] text-[#f5f5f5] rounded-md px-3 py-2 text-sm"
            onClick={() => loadProfileMutation.mutate(profileForm.locationId)}
            disabled={loadProfileMutation.isPending}
          >
            {loadProfileMutation.isPending ? "Loading..." : "Load Profile"}
          </button>
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
              value={profileForm.templateCode}
              onChange={(event) =>
                setProfileForm((prev) => ({ ...prev, templateCode: event.target.value }))
              }
            >
              {templateOptions.map((templateCode) => (
                <option key={templateCode} value={templateCode}>
                  {templateCode}
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

          <textarea
            className={`${inputClass} min-h-[220px] font-mono text-xs`}
            value={profileForm.overridesText}
            onChange={(event) =>
              setProfileForm((prev) => ({ ...prev, overridesText: event.target.value }))
            }
            placeholder='{"tableServiceProfile":{"enabled":true}}'
          />

          <button
            type="submit"
            className={`bg-[#F6B100] text-[#1f1f1f] rounded-md px-4 py-2 font-semibold ${
              saveProfileMutation.isPending ? "opacity-70 cursor-not-allowed" : ""
            }`}
            disabled={saveProfileMutation.isPending}
          >
            {saveProfileMutation.isPending ? "Saving..." : "Save Vertical Profile"}
          </button>
        </form>

        <div className="mt-4 border-t border-[#343434] pt-3">
          <p className="text-[#d7d7d7] text-sm font-semibold mb-2">Existing Vertical Profiles</p>
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {profiles.map((profile) => (
              <div key={profile._id} className="bg-[#1f1f1f] px-3 py-2 rounded-md border border-[#333]">
                <div className="flex items-center justify-between">
                  <p className="text-[#f5f5f5] text-sm">
                    {profile.locationId} · {profile.countryCode} · {profile.templateCode}
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
                  status: {profile.profileStatus || "ACTIVE"}
                </p>
              </div>
            ))}
            {profiles.length === 0 && (
              <p className="text-sm text-[#ababab]">No vertical profiles created.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerticalTemplateCenter;
