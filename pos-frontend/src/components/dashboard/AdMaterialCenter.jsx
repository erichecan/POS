/**
 * 广告素材管理 - PRD 7.23.4 2026-02-28T13:00:00+08:00
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  listAdMaterials,
  createAdMaterial,
  updateAdMaterial,
  deleteAdMaterial,
} from "../../https";

const cardClass = "bg-[#262626] rounded-lg p-4 border border-[#333]";
const inputClass = "w-full bg-[#1f1f1f] text-[#f5f5f5] border border-[#3b3b3b] rounded-md px-3 py-2 focus:outline-none";

const CATEGORIES = ["BRAND", "PROMO", "MENU", "GENERAL"];
const MEDIA_TYPES = ["IMAGE", "VIDEO"];
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"];

const AdMaterialCenter = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    mediaType: "IMAGE",
    mediaUrl: "",
    category: "GENERAL",
    status: "DRAFT",
    durationSeconds: 10,
  });

  const materialsQuery = useQuery({
    queryKey: ["ad-materials"],
    queryFn: () => listAdMaterials({ limit: 100 }),
  });
  const materials = materialsQuery.data?.data?.data || [];

  const createMutation = useMutation({
    mutationFn: createAdMaterial,
    onSuccess: () => {
      enqueueSnackbar(t("brand.materialCreated"), { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["ad-materials"] });
      setShowForm(false);
      setForm({ name: "", mediaType: "IMAGE", mediaUrl: "", category: "GENERAL", status: "DRAFT", durationSeconds: 10 });
    },
    onError: (e) => enqueueSnackbar(e.response?.data?.message || t("brand.materialCreateFailed"), { variant: "error" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => updateAdMaterial({ id, ...data }),
    onSuccess: () => {
      enqueueSnackbar(t("brand.materialUpdated"), { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["ad-materials"] });
      setEditingId(null);
    },
    onError: (e) => enqueueSnackbar(e.response?.data?.message || t("brand.materialUpdateFailed"), { variant: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdMaterial,
    onSuccess: () => {
      enqueueSnackbar(t("brand.materialDeleted"), { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["ad-materials"] });
    },
    onError: (e) => enqueueSnackbar(e.response?.data?.message || t("brand.materialDeleteFailed"), { variant: "error" }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name?.trim() || !form.mediaUrl?.trim()) {
      enqueueSnackbar(t("brand.nameAndUrlRequired"), { variant: "error" });
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const openEdit = (m) => {
    setEditingId(m._id);
    setForm({
      name: m.name || "",
      mediaType: m.mediaType || "IMAGE",
      mediaUrl: m.mediaUrl || "",
      category: m.category || "GENERAL",
      status: m.status || "DRAFT",
      durationSeconds: m.durationSeconds ?? 10,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold text-[#f5f5f5]">{t("brand.adsTitle")}</h1>
        <button
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setForm({ name: "", mediaType: "IMAGE", mediaUrl: "", category: "GENERAL", status: "DRAFT", durationSeconds: 10 });
          }}
        >
          {t("brand.addMaterial")}
        </button>
      </div>

      {(showForm || editingId) && (
        <div className={cardClass}>
          <h2 className="text-md font-medium text-[#e0e0e0] mb-3">
            {editingId ? t("brand.editMaterial") : t("brand.newMaterial")}
          </h2>
          <form onSubmit={handleSubmit} className="grid gap-3 max-w-md">
            <div>
              <label className="block text-sm text-[#ababab] mb-1">{t("brand.materialName")}</label>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-[#ababab] mb-1">{t("brand.mediaUrl")}</label>
              <input
                className={inputClass}
                value={form.mediaUrl}
                onChange={(e) => setForm({ ...form, mediaUrl: e.target.value })}
                required
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-sm text-[#ababab] mb-1">{t("brand.mediaType")}</label>
              <select
                className={inputClass}
                value={form.mediaType}
                onChange={(e) => setForm({ ...form, mediaType: e.target.value })}
              >
                {MEDIA_TYPES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#ababab] mb-1">{t("brand.category")}</label>
              <select
                className={inputClass}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#ababab] mb-1">{t("brand.status")}</label>
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#ababab] mb-1">{t("brand.durationSeconds")}</label>
              <input
                type="number"
                className={inputClass}
                value={form.durationSeconds}
                onChange={(e) => setForm({ ...form, durationSeconds: Number(e.target.value) || 10 })}
              />
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
        <h2 className="text-md font-medium text-[#e0e0e0] mb-3">{t("brand.materialList")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-[#ababab] border-b border-[#444]">
                <th className="py-2">{t("brand.materialName")}</th>
                <th className="py-2">{t("brand.mediaType")}</th>
                <th className="py-2">{t("brand.category")}</th>
                <th className="py-2">{t("brand.status")}</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m._id} className="border-b border-[#333]">
                  <td className="py-2 text-[#e0e0e0]">{m.name}</td>
                  <td className="py-2 text-[#e0e0e0]">{m.mediaType}</td>
                  <td className="py-2 text-[#e0e0e0]">{m.category}</td>
                  <td className="py-2 text-[#e0e0e0]">{m.status}</td>
                  <td className="py-2">
                    <button
                      className="text-indigo-400 hover:underline mr-2"
                      onClick={() => openEdit(m)}
                    >
                      {t("common.edit")}
                    </button>
                    <button
                      className="text-red-400 hover:underline"
                      onClick={() => {
                        if (window.confirm(t("brand.confirmDelete"))) deleteMutation.mutate(m._id);
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
        {materials.length === 0 && (
          <p className="text-[#ababab] py-4">{t("brand.noMaterials")}</p>
        )}
      </div>
    </div>
  );
};

export default AdMaterialCenter;
