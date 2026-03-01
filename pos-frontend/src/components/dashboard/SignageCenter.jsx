/**
 * 广告屏配置管理 - PRD 7.23.3 2026-02-28T13:00:00+08:00
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  listSignageDevices,
  createSignageDevice,
  updateSignageDevice,
  deleteSignageDevice,
  listAdMaterials,
} from "../../https";

const cardClass = "bg-[#262626] rounded-lg p-4 border border-[#333]";
const inputClass = "w-full bg-[#1f1f1f] text-[#f5f5f5] border border-[#3b3b3b] rounded-md px-3 py-2 focus:outline-none";

const CONTENT_TYPES = ["MENU", "QUEUE", "AD_LOOP", "MIXED"];
const STATUSES = ["ACTIVE", "INACTIVE", "OFFLINE"];

const SignageCenter = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    deviceCode: "",
    locationId: "default",
    physicalLocation: "",
    resolution: "1920x1080",
    contentType: "AD_LOOP",
    priority: 1,
    materialIds: [],
    status: "ACTIVE",
  });

  const devicesQuery = useQuery({
    queryKey: ["signage-devices"],
    queryFn: () => listSignageDevices({ limit: 100 }),
  });
  const materialsQuery = useQuery({
    queryKey: ["ad-materials"],
    queryFn: () => listAdMaterials({ limit: 100, status: "PUBLISHED" }),
  });

  const devices = devicesQuery.data?.data?.data || [];
  const materials = materialsQuery.data?.data?.data || [];

  const createMutation = useMutation({
    mutationFn: createSignageDevice,
    onSuccess: () => {
      enqueueSnackbar(t("brand.signageCreated"), { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["signage-devices"] });
      setShowForm(false);
      setForm({ deviceCode: "", locationId: "default", physicalLocation: "", resolution: "1920x1080", contentType: "AD_LOOP", priority: 1, materialIds: [], status: "ACTIVE" });
    },
    onError: (e) => enqueueSnackbar(e.response?.data?.message || t("brand.signageCreateFailed"), { variant: "error" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => updateSignageDevice({ id, ...data }),
    onSuccess: () => {
      enqueueSnackbar(t("brand.signageUpdated"), { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["signage-devices"] });
      setEditingId(null);
    },
    onError: (e) => enqueueSnackbar(e.response?.data?.message || t("brand.signageUpdateFailed"), { variant: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSignageDevice,
    onSuccess: () => {
      enqueueSnackbar(t("brand.signageDeleted"), { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["signage-devices"] });
    },
    onError: (e) => enqueueSnackbar(e.response?.data?.message || t("brand.signageDeleteFailed"), { variant: "error" }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const openEdit = (d) => {
    setEditingId(d._id);
    setForm({
      deviceCode: d.deviceCode,
      locationId: d.locationId || "default",
      physicalLocation: d.physicalLocation || "",
      resolution: d.resolution || "1920x1080",
      contentType: d.contentType || "AD_LOOP",
      priority: d.priority ?? 1,
      materialIds: d.materialIds?.map((m) => (typeof m === "object" ? m._id : m)) || [],
      status: d.status || "ACTIVE",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold text-[#f5f5f5]">{t("brand.signageTitle")}</h1>
        <button
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setForm({ deviceCode: "", locationId: "default", physicalLocation: "", resolution: "1920x1080", contentType: "AD_LOOP", priority: 1, materialIds: [], status: "ACTIVE" });
          }}
        >
          {t("brand.addSignage")}
        </button>
      </div>

      {(showForm || editingId) && (
        <div className={cardClass}>
          <h2 className="text-md font-medium text-[#e0e0e0] mb-3">
            {editingId ? t("brand.editSignage") : t("brand.newSignage")}
          </h2>
          <form onSubmit={handleSubmit} className="grid gap-3 max-w-md">
            <div>
              <label className="block text-sm text-[#ababab] mb-1">{t("brand.deviceCode")}</label>
              <input
                className={inputClass}
                value={form.deviceCode}
                onChange={(e) => setForm({ ...form, deviceCode: e.target.value })}
                required
                disabled={!!editingId}
              />
            </div>
            <div>
              <label className="block text-sm text-[#ababab] mb-1">{t("brand.physicalLocation")}</label>
              <input
                className={inputClass}
                value={form.physicalLocation}
                onChange={(e) => setForm({ ...form, physicalLocation: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-[#ababab] mb-1">{t("brand.resolution")}</label>
              <input
                className={inputClass}
                value={form.resolution}
                onChange={(e) => setForm({ ...form, resolution: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-[#ababab] mb-1">{t("brand.contentType")}</label>
              <select
                className={inputClass}
                value={form.contentType}
                onChange={(e) => setForm({ ...form, contentType: e.target.value })}
              >
                {CONTENT_TYPES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#ababab] mb-1">{t("brand.materialIds")}</label>
              <select
                className={inputClass}
                multiple
                value={form.materialIds}
                onChange={(e) =>
                  setForm({
                    ...form,
                    materialIds: Array.from(e.target.selectedOptions, (o) => o.value),
                  })
                }
              >
                {materials.map((m) => (
                  <option key={m._id} value={m._id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                {editingId ? t("common.save") : t("common.create")}
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-[#444] text-white rounded-md"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
              >
                {t("common.cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className={cardClass}>
        <h2 className="text-md font-medium text-[#e0e0e0] mb-3">{t("brand.signageList")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-[#ababab] border-b border-[#444]">
                <th className="py-2">{t("brand.deviceCode")}</th>
                <th className="py-2">{t("brand.physicalLocation")}</th>
                <th className="py-2">{t("brand.contentType")}</th>
                <th className="py-2">{t("brand.status")}</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d._id} className="border-b border-[#333]">
                  <td className="py-2 text-[#e0e0e0]">{d.deviceCode}</td>
                  <td className="py-2 text-[#e0e0e0]">{d.physicalLocation || "-"}</td>
                  <td className="py-2 text-[#e0e0e0]">{d.contentType}</td>
                  <td className="py-2 text-[#e0e0e0]">{d.status}</td>
                  <td className="py-2">
                    <button
                      className="text-indigo-400 hover:underline mr-2"
                      onClick={() => openEdit(d)}
                    >
                      {t("common.edit")}
                    </button>
                    <button
                      className="text-red-400 hover:underline"
                      onClick={() => {
                        if (window.confirm(t("brand.confirmDelete"))) deleteMutation.mutate(d._id);
                      }}
                    >
                      {t("common.delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {devices.length === 0 && (
          <p className="text-[#ababab] py-4">{t("brand.noSignage")}</p>
        )}
      </div>
    </div>
  );
};

export default SignageCenter;
