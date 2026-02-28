// 2026-02-26T19:42:00+08:00: Enterprise menu management with HQ-store architecture, categories, day parts
// 2026-02-26T21:00:00+08:00: i18n
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { axiosWrapper } from "../../https/axiosWrapper";

const LOCATIONS = [
  { value: "default", label: "HQ (Master)" },
  { value: "LOC-001", label: "LOC-001" },
  { value: "LOC-002", label: "LOC-002" },
  { value: "LOC-003", label: "LOC-003" },
];

const CHANNELS = ["ALL", "DINE_IN", "TAKEOUT", "DELIVERY", "ONLINE"];
const STATUSES = ["ALL", "DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"];
const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_STYLES = {
  DRAFT: "bg-gray-700 text-gray-300",
  ACTIVE: "bg-green-900/60 text-green-400",
  INACTIVE: "bg-yellow-900/60 text-yellow-400",
  ARCHIVED: "bg-red-900/60 text-red-400",
};

const EMPTY_DAYPART = { startMinute: 0, endMinute: 1440, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], price: "" };

const minutesToTime = (m) => {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
};

const timeToMinutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const MenuItemsPage = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [locationId, setLocationId] = useState("default");
  const [channelCode, setChannelCode] = useState("ALL");
  const [versionTag, setVersionTag] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [versions, setVersions] = useState([]);

  const formRef = useRef(null);

  const defaultForm = {
    name: "",
    category: "",
    basePrice: "",
    status: "DRAFT",
    locationId: "default",
    channelCode: "ALL",
    versionTag: "v1",
    dayParts: [],
    validFrom: "",
    validTo: "",
    description: "",
  };
  const [form, setForm] = useState(defaultForm);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (locationId) params.set("locationId", locationId);
      if (channelCode && channelCode !== "ALL") params.set("channelCode", channelCode);
      if (versionTag) params.set("versionTag", versionTag);
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      params.set("limit", "200");

      const { data } = await axiosWrapper.get(`/api/menu/items?${params.toString()}`);
      const list = data.data || [];

      if (locationId !== "default") {
        const hqParams = new URLSearchParams();
        hqParams.set("locationId", "default");
        if (channelCode && channelCode !== "ALL") hqParams.set("channelCode", channelCode);
        if (versionTag) hqParams.set("versionTag", versionTag);
        if (statusFilter && statusFilter !== "ALL") hqParams.set("status", statusFilter);
        if (search.trim()) hqParams.set("search", search.trim());
        hqParams.set("limit", "200");

        try {
          const { data: hqData } = await axiosWrapper.get(`/api/menu/items?${hqParams.toString()}`);
          const hqItems = (hqData.data || []).map((i) => ({ ...i, _inherited: true }));
          const storeNames = new Set(list.map((i) => i.name));
          const merged = [...list, ...hqItems.filter((i) => !storeNames.has(i.name))];
          setItems(merged);
        } catch {
          setItems(list);
        }
      } else {
        setItems(list);
      }
    } catch (e) {
      console.error("Failed to load menu items:", e);
      setError(t("menu.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [locationId, channelCode, versionTag, statusFilter, search]);

  const fetchVersions = useCallback(async () => {
    try {
      const { data } = await axiosWrapper.get(`/api/menu/versions?locationId=${locationId}`);
      setVersions(data.data || []);
    } catch {
      setVersions([]);
    }
  }, [locationId]);

  // 2026-02-26T20:02:00+08:00: Fetch categories from API + merge with extracted from items
  const [apiCategories, setApiCategories] = useState([]);
  const fetchApiCategories = useCallback(async () => {
    try {
      const { data } = await axiosWrapper.get(`/api/menu/categories?locationId=${locationId}&status=ACTIVE`);
      setApiCategories(data.data || []);
    } catch {
      setApiCategories([]);
    }
  }, [locationId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { fetchVersions(); }, [fetchVersions]);
  useEffect(() => { fetchApiCategories(); }, [fetchApiCategories]);

  const categories = useMemo(() => {
    const cats = new Set();
    apiCategories.forEach((c) => { if (c.name) cats.add(c.name); });
    items.forEach((i) => { if (i.category) cats.add(i.category); });
    return Array.from(cats).sort();
  }, [items, apiCategories]);

  const filteredItems = useMemo(() => {
    if (selectedCategory === "ALL") return items;
    return items.filter((i) => i.category === selectedCategory);
  }, [items, selectedCategory]);

  const resetForm = () => {
    setForm({ ...defaultForm, locationId });
    setEditItem(null);
    setShowForm(false);
  };

  const openAddForm = () => {
    setForm({ ...defaultForm, locationId });
    setEditItem(null);
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const handleEdit = (item) => {
    setForm({
      name: item.name || "",
      category: item.category || "",
      basePrice: String(item.basePrice ?? ""),
      status: item.status || "DRAFT",
      locationId: item.locationId || "default",
      channelCode: item.channelCode || "ALL",
      versionTag: item.versionTag || "v1",
      dayParts: (item.dayParts || []).map((dp) => ({
        startMinute: dp.startMinute ?? 0,
        endMinute: dp.endMinute ?? 1440,
        daysOfWeek: dp.daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
        price: String(dp.price ?? ""),
      })),
      validFrom: item.validFrom ? item.validFrom.slice(0, 10) : "",
      validTo: item.validTo ? item.validTo.slice(0, 10) : "",
      description: item.metadata?.description || "",
    });
    setEditItem(item);
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const handleDuplicate = (item) => {
    setForm({
      name: `${item.name} (Copy)`,
      category: item.category || "",
      basePrice: String(item.basePrice ?? ""),
      status: "DRAFT",
      locationId: locationId !== "default" ? locationId : "LOC-001",
      channelCode: item.channelCode || "ALL",
      versionTag: item.versionTag || "v1",
      dayParts: (item.dayParts || []).map((dp) => ({
        startMinute: dp.startMinute ?? 0,
        endMinute: dp.endMinute ?? 1440,
        daysOfWeek: dp.daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
        price: String(dp.price ?? ""),
      })),
      validFrom: "",
      validTo: "",
      description: item.metadata?.description || "",
    });
    setEditItem(null);
    setShowForm(true);
  };

  const handleCreateOverride = (item) => {
    setForm({
      name: item.name,
      category: item.category || "",
      basePrice: String(item.basePrice ?? ""),
      status: "DRAFT",
      locationId,
      channelCode: item.channelCode || "ALL",
      versionTag: item.versionTag || "v1",
      dayParts: (item.dayParts || []).map((dp) => ({
        startMinute: dp.startMinute ?? 0,
        endMinute: dp.endMinute ?? 1440,
        daysOfWeek: dp.daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
        price: String(dp.price ?? ""),
      })),
      validFrom: "",
      validTo: "",
      description: item.metadata?.description || "",
    });
    setEditItem(null);
    setShowForm(true);
  };

  const handleArchive = async (item) => {
    if (!window.confirm(t("menu.confirmArchive", { name: item.name }))) return;
    try {
      await axiosWrapper.put("/api/menu/items", {
        _id: item._id,
        name: item.name,
        basePrice: item.basePrice,
        status: "ARCHIVED",
        locationId: item.locationId,
        channelCode: item.channelCode,
        versionTag: item.versionTag,
      });
      fetchItems();
    } catch (err) {
      alert(err.response?.data?.message || t("menu.archiveFailed"));
    }
  };

  const handleBulkArchive = async () => {
    if (!window.confirm(t("menu.confirmArchiveBulk", { count: selectedIds.size }))) return;
    const targets = items.filter((i) => selectedIds.has(i._id) && !i._inherited);
    for (const item of targets) {
      try {
        await axiosWrapper.put("/api/menu/items", {
          _id: item._id,
          name: item.name,
          basePrice: item.basePrice,
          status: "ARCHIVED",
          locationId: item.locationId,
          channelCode: item.channelCode,
          versionTag: item.versionTag,
        });
      } catch { /* skip failed */ }
    }
    setSelectedIds(new Set());
    fetchItems();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category.trim(),
        basePrice: Number(form.basePrice),
        status: form.status,
        locationId: form.locationId,
        channelCode: form.channelCode,
        versionTag: form.versionTag || "v1",
        dayParts: form.dayParts
          .filter((dp) => dp.price !== "")
          .map((dp) => ({
            startMinute: dp.startMinute,
            endMinute: dp.endMinute,
            daysOfWeek: dp.daysOfWeek,
            price: Number(dp.price),
          })),
        metadata: { description: form.description },
      };
      if (form.validFrom) payload.validFrom = new Date(form.validFrom).toISOString();
      if (form.validTo) payload.validTo = new Date(form.validTo).toISOString();
      if (editItem) payload._id = editItem._id;

      await axiosWrapper.put("/api/menu/items", payload);
      resetForm();
      fetchItems();
    } catch (err) {
      alert(err.response?.data?.message || t("menu.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const addDayPart = () => {
    setForm((prev) => ({
      ...prev,
      dayParts: [...prev.dayParts, { ...EMPTY_DAYPART }],
    }));
  };

  const updateDayPart = (idx, field, value) => {
    setForm((prev) => {
      const dp = [...prev.dayParts];
      dp[idx] = { ...dp[idx], [field]: value };
      return { ...prev, dayParts: dp };
    });
  };

  const removeDayPart = (idx) => {
    setForm((prev) => ({
      ...prev,
      dayParts: prev.dayParts.filter((_, i) => i !== idx),
    }));
  };

  const toggleDayOfWeek = (dpIdx, dayIdx) => {
    setForm((prev) => {
      const dp = [...prev.dayParts];
      const days = [...dp[dpIdx].daysOfWeek];
      const pos = days.indexOf(dayIdx);
      if (pos >= 0) days.splice(pos, 1);
      else days.push(dayIdx);
      days.sort();
      dp[dpIdx] = { ...dp[dpIdx], daysOfWeek: days };
      return { ...prev, dayParts: dp };
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.filter((i) => !i._inherited).length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.filter((i) => !i._inherited).map((i) => i._id)));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const locationLabel = (loc) => LOCATIONS.find((l) => l.value === loc)?.label || loc;

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#1a1a1a]">
      {/* ── Top Toolbar ── */}
      <div className="shrink-0 border-b border-[#333] bg-[#1f1f1f] px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-bold text-[#f5f5f5] mr-2">{t("menu.menuCenter")}</h1>

          {/* Location */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-[#ababab]">{t("common.location")}</label>
            <select
              value={locationId}
              onChange={(e) => { setLocationId(e.target.value); setSelectedIds(new Set()); }}
              className="rounded bg-[#262626] border border-[#333] px-2 py-1.5 text-sm text-[#f5f5f5] focus:border-yellow-400 focus:outline-none"
            >
              {LOCATIONS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* Channel */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-[#ababab]">{t("common.channel")}</label>
            <select
              value={channelCode}
              onChange={(e) => setChannelCode(e.target.value)}
              className="rounded bg-[#262626] border border-[#333] px-2 py-1.5 text-sm text-[#f5f5f5] focus:border-yellow-400 focus:outline-none"
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Version */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-[#ababab]">{t("common.version")}</label>
            <select
              value={versionTag}
              onChange={(e) => setVersionTag(e.target.value)}
              className="rounded bg-[#262626] border border-[#333] px-2 py-1.5 text-sm text-[#f5f5f5] focus:border-yellow-400 focus:outline-none"
            >
              <option value="">{t("menu.allVersions")}</option>
              {versions.map((v) => (
                <option key={v.versionTag || v._id} value={v.versionTag}>
                  {v.versionTag}{v.status === "PUBLISHED" ? " ✓" : ""}
                </option>
              ))}
              <option value="v1">v1</option>
            </select>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-[#ababab]">{t("common.status")}</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded bg-[#262626] border border-[#333] px-2 py-1.5 text-sm text-[#f5f5f5] focus:border-yellow-400 focus:outline-none"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[180px] max-w-xs">
            <input
              type="text"
              placeholder={t("menu.searchItems")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded bg-[#262626] border border-[#333] px-3 py-1.5 text-sm text-[#f5f5f5] placeholder-[#666] focus:border-yellow-400 focus:outline-none"
            />
          </div>

          <button
            onClick={openAddForm}
            className="ml-auto rounded bg-yellow-400 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-yellow-300 transition-colors"
          >
            {t("menu.addItem")}
          </button>
        </div>
      </div>

      {/* ── Bulk Actions Bar ── */}
      {selectedIds.size > 0 && (
        <div className="shrink-0 flex items-center gap-3 bg-yellow-400/10 border-b border-yellow-400/30 px-4 py-2">
          <span className="text-sm text-yellow-400 font-medium">{t("menu.itemsSelected", { count: selectedIds.size })}</span>
          <button
            onClick={handleBulkArchive}
            className="rounded bg-red-900/60 px-3 py-1 text-xs text-red-300 hover:bg-red-800 transition-colors"
          >
            {t("menu.archiveSelected")}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="rounded border border-[#333] px-3 py-1 text-xs text-[#ababab] hover:bg-[#333] transition-colors"
          >
            {t("menu.clearSelection")}
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Category Sidebar ── */}
        <aside className="shrink-0 w-52 border-r border-[#333] bg-[#1f1f1f] overflow-y-auto">
          <div className="px-3 pt-3 pb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#ababab] uppercase tracking-wider">{t("menu.categories")}</span>
            <button
              onClick={() => setShowCategoryManager(!showCategoryManager)}
              className="text-[10px] text-yellow-400 hover:text-yellow-300"
              title={t("menu.manageCategories")}
            >
              ⚙
            </button>
          </div>

          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`w-full text-left px-3 py-2 text-sm transition-colors ${
              selectedCategory === "ALL"
                ? "bg-yellow-400/10 text-yellow-400 font-medium border-r-2 border-yellow-400"
                : "text-[#ababab] hover:bg-[#262626] hover:text-[#f5f5f5]"
            }`}
          >
            {t("menu.allCategories")}
            <span className="ml-1.5 text-xs opacity-60">({items.length})</span>
          </button>

          {categories.map((cat) => {
            const count = items.filter((i) => i.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  selectedCategory === cat
                    ? "bg-yellow-400/10 text-yellow-400 font-medium border-r-2 border-yellow-400"
                    : "text-[#ababab] hover:bg-[#262626] hover:text-[#f5f5f5]"
                }`}
              >
                {cat}
                <span className="ml-1.5 text-xs opacity-60">({count})</span>
              </button>
            );
          })}

          {/* Category Manager */}
          {showCategoryManager && (
            <div className="mx-2 my-2 rounded border border-[#333] bg-[#262626] p-2">
              <p className="text-[10px] text-[#ababab] mb-1.5 font-medium">{t("menu.manageCategories")}</p>
              <div className="flex gap-1 mb-2">
                <input
                  type="text"
                  placeholder={t("menu.newCategory")}
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1 rounded bg-[#1f1f1f] border border-[#333] px-2 py-1 text-xs text-[#f5f5f5] focus:border-yellow-400 focus:outline-none"
                />
                <button
                  onClick={() => {
                    if (newCategoryName.trim()) {
                      setSelectedCategory(newCategoryName.trim());
                      setNewCategoryName("");
                    }
                  }}
                  className="rounded bg-yellow-400 px-2 py-1 text-xs font-bold text-gray-900 hover:bg-yellow-300"
                >
                  +
                </button>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-0.5">
                {categories.map((cat) => (
                  <div key={cat} className="flex items-center justify-between px-1 py-0.5 text-xs text-[#ababab]">
                    <span className="truncate">{cat}</span>
                  </div>
                ))}
                {categories.length === 0 && (
                  <p className="text-[10px] text-[#666] text-center py-1">{t("menu.noCategoriesYet")}</p>
                )}
              </div>
            </div>
          )}
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 overflow-y-auto px-4 py-4">
          {error && (
            <div className="mb-4 rounded border border-red-800 bg-red-900/30 px-4 py-2 text-sm text-red-300">
              {error}
              <button onClick={fetchItems} className="ml-3 underline hover:text-red-200">{t("common.retry")}</button>
            </div>
          )}

          {/* ── Add / Edit Form Panel ── */}
          {showForm && (
            <div ref={formRef} className="mb-6 rounded-lg border border-[#333] bg-[#262626] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#1f1f1f]">
                <h3 className="text-sm font-semibold text-[#f5f5f5]">
                  {editItem ? t("menu.editItemTitle", { name: editItem.name }) : t("menu.newMenuItem")}
                </h3>
                <button onClick={resetForm} className="text-[#ababab] hover:text-[#f5f5f5] text-lg leading-none">&times;</button>
              </div>

              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {/* Row 1: Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs text-[#ababab] mb-1">
                      {t("common.name")} <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      required
                      className="w-full rounded bg-[#1a1a1a] border border-[#333] px-3 py-2 text-sm text-[#f5f5f5] focus:border-yellow-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#ababab] mb-1">{t("common.category")}</label>
                    <input
                      type="text"
                      list="category-list"
                      value={form.category}
                      onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                      placeholder={t("menu.selectOrTypeNew")}
                      className="w-full rounded bg-[#1a1a1a] border border-[#333] px-3 py-2 text-sm text-[#f5f5f5] focus:border-yellow-400 focus:outline-none"
                    />
                    <datalist id="category-list">
                      {categories.map((c) => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-xs text-[#ababab] mb-1">
                      {t("menu.basePrice")} <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.basePrice}
                      onChange={(e) => setForm((p) => ({ ...p, basePrice: e.target.value }))}
                      required
                      className="w-full rounded bg-[#1a1a1a] border border-[#333] px-3 py-2 text-sm text-[#f5f5f5] focus:border-yellow-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Row 2: Scope */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-[#ababab] mb-1">{t("common.status")}</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                      className="w-full rounded bg-[#1a1a1a] border border-[#333] px-3 py-2 text-sm text-[#f5f5f5] focus:border-yellow-400 focus:outline-none"
                    >
                      {STATUSES.filter((s) => s !== "ALL").map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[#ababab] mb-1">{t("menu.locationId")}</label>
                    <select
                      value={form.locationId}
                      onChange={(e) => setForm((p) => ({ ...p, locationId: e.target.value }))}
                      className="w-full rounded bg-[#1a1a1a] border border-[#333] px-3 py-2 text-sm text-[#f5f5f5] focus:border-yellow-400 focus:outline-none"
                    >
                      {LOCATIONS.map((l) => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                    <p className="mt-0.5 text-[10px] text-[#666]">
                      {t("menu.hqGlobalNote")}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs text-[#ababab] mb-1">{t("common.channel")}</label>
                    <select
                      value={form.channelCode}
                      onChange={(e) => setForm((p) => ({ ...p, channelCode: e.target.value }))}
                      className="w-full rounded bg-[#1a1a1a] border border-[#333] px-3 py-2 text-sm text-[#f5f5f5] focus:border-yellow-400 focus:outline-none"
                    >
                      {CHANNELS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[#ababab] mb-1">{t("menu.versionTag")}</label>
                    <input
                      type="text"
                      value={form.versionTag}
                      onChange={(e) => setForm((p) => ({ ...p, versionTag: e.target.value }))}
                      placeholder="v1"
                      className="w-full rounded bg-[#1a1a1a] border border-[#333] px-3 py-2 text-sm text-[#f5f5f5] focus:border-yellow-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Row 3: Dates */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-[#ababab] mb-1">{t("menu.validFrom")}</label>
                    <input
                      type="date"
                      value={form.validFrom}
                      onChange={(e) => setForm((p) => ({ ...p, validFrom: e.target.value }))}
                      className="w-full rounded bg-[#1a1a1a] border border-[#333] px-3 py-2 text-sm text-[#f5f5f5] focus:border-yellow-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#ababab] mb-1">{t("menu.validTo")}</label>
                    <input
                      type="date"
                      value={form.validTo}
                      onChange={(e) => setForm((p) => ({ ...p, validTo: e.target.value }))}
                      className="w-full rounded bg-[#1a1a1a] border border-[#333] px-3 py-2 text-sm text-[#f5f5f5] focus:border-yellow-400 focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-[#ababab] mb-1">{t("menu.descriptionNotes")}</label>
                    <input
                      type="text"
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder={t("menu.optionalNotes")}
                      className="w-full rounded bg-[#1a1a1a] border border-[#333] px-3 py-2 text-sm text-[#f5f5f5] focus:border-yellow-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Day Parts */}
                <div className="border border-[#333] rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#ababab] uppercase tracking-wider">
                      {t("menu.dayPartsTimePricing")}
                    </span>
                    <button
                      type="button"
                      onClick={addDayPart}
                      className="rounded bg-[#333] px-2 py-1 text-xs text-yellow-400 hover:bg-[#444] transition-colors"
                    >
                      {t("menu.addDayPart")}
                    </button>
                  </div>

                  {form.dayParts.length === 0 && (
                    <p className="text-xs text-[#666] text-center py-2">
                      {t("menu.noDayParts")}
                    </p>
                  )}

                  {form.dayParts.map((dp, idx) => (
                    <div key={idx} className="flex flex-wrap items-end gap-2 mt-2 p-2 rounded bg-[#1a1a1a] border border-[#333]">
                      <div>
                        <label className="block text-[10px] text-[#666] mb-0.5">{t("common.start")}</label>
                        <input
                          type="time"
                          value={minutesToTime(dp.startMinute)}
                          onChange={(e) => updateDayPart(idx, "startMinute", timeToMinutes(e.target.value))}
                          className="rounded bg-[#262626] border border-[#333] px-2 py-1 text-xs text-[#f5f5f5] focus:border-yellow-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#666] mb-0.5">{t("common.end")}</label>
                        <input
                          type="time"
                          value={minutesToTime(dp.endMinute)}
                          onChange={(e) => updateDayPart(idx, "endMinute", timeToMinutes(e.target.value))}
                          className="rounded bg-[#262626] border border-[#333] px-2 py-1 text-xs text-[#f5f5f5] focus:border-yellow-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#666] mb-0.5">{t("common.price")}</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={dp.price}
                          onChange={(e) => updateDayPart(idx, "price", e.target.value)}
                          className="w-20 rounded bg-[#262626] border border-[#333] px-2 py-1 text-xs text-[#f5f5f5] focus:border-yellow-400 focus:outline-none"
                        />
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] text-[#666] mb-0.5">{t("menu.days")}</label>
                        <div className="flex gap-1">
                          {DAYS_OF_WEEK.map((day, dayIdx) => (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleDayOfWeek(idx, dayIdx)}
                              className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                                dp.daysOfWeek.includes(dayIdx)
                                  ? "bg-yellow-400 text-gray-900"
                                  : "bg-[#333] text-[#666] hover:text-[#ababab]"
                              }`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDayPart(idx)}
                        className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-900/30 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded bg-yellow-400 px-5 py-2 text-sm font-bold text-gray-900 hover:bg-yellow-300 disabled:opacity-50 transition-colors"
                  >
                    {saving ? t("common.saving") : editItem ? t("menu.updateItem") : t("menu.createItem")}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded border border-[#333] px-4 py-2 text-sm text-[#ababab] hover:bg-[#333] transition-colors"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Location Info Banner ── */}
          {locationId !== "default" && (
            <div className="mb-4 rounded border border-blue-800/40 bg-blue-900/20 px-4 py-2 text-xs text-blue-300 flex items-center gap-2">
              <span className="font-bold">📍 {locationLabel(locationId)}</span>
              <span className="text-blue-400/60">|</span>
              <span>
                {t("menu.showingStoreItems")}
              </span>
            </div>
          )}

          {/* ── Items Table ── */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-[#ababab] text-sm">{t("menu.loadingMenuItems")}</div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-3xl mb-3 opacity-30">🍽</div>
              <p className="text-[#ababab] text-sm mb-2">{t("menu.noMenuItems")}</p>
              <p className="text-[#666] text-xs mb-4">
                {search || statusFilter !== "ALL" || selectedCategory !== "ALL"
                  ? t("menu.tryAdjustingFilters")
                  : t("menu.clickAddFirstItem")}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[#333]">
              <table className="w-full text-sm">
                <thead className="bg-[#1f1f1f] text-[#ababab] text-xs">
                  <tr>
                    <th className="px-3 py-2.5 text-left w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.size > 0 && selectedIds.size === filteredItems.filter((i) => !i._inherited).length}
                        onChange={toggleSelectAll}
                        className="accent-yellow-400"
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left">{t("common.name")}</th>
                    <th className="px-3 py-2.5 text-left">{t("common.category")}</th>
                    <th className="px-3 py-2.5 text-right">{t("menu.basePrice")}</th>
                    <th className="px-3 py-2.5 text-center">{t("common.status")}</th>
                    <th className="px-3 py-2.5 text-center">{t("menu.dayParts")}</th>
                    <th className="px-3 py-2.5 text-left">{t("common.location")}</th>
                    <th className="px-3 py-2.5 text-left">{t("common.channel")}</th>
                    <th className="px-3 py-2.5 text-right">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#333]">
                  {filteredItems.map((item) => (
                    <tr
                      key={item._id}
                      className={`text-[#f5f5f5] transition-colors ${
                        item._inherited
                          ? "bg-[#1a1a2a]/30 hover:bg-[#1a1a2a]/50"
                          : "hover:bg-[#262626]"
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        {!item._inherited && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item._id)}
                            onChange={() => toggleSelect(item._id)}
                            className="accent-yellow-400"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.name}</span>
                          {item._inherited && (
                            <span className="rounded-full bg-blue-900/40 px-1.5 py-0.5 text-[10px] text-blue-300 whitespace-nowrap">
                              HQ
                            </span>
                          )}
                        </div>
                        {item.metadata?.description && (
                          <p className="text-[10px] text-[#666] mt-0.5 truncate max-w-[200px]">
                            {item.metadata.description}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[#ababab]">{item.category || "—"}</td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {item.basePrice != null ? item.basePrice.toFixed(2) : (item.price != null ? item.price.toFixed(2) : "—")}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[item.status] || "bg-gray-700 text-gray-300"}`}>
                          {item.status || "ACTIVE"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-[#ababab]">
                        {item.dayParts?.length || 0}
                      </td>
                      <td className="px-3 py-2.5 text-[#ababab] text-xs">
                        {locationLabel(item.locationId || "default")}
                      </td>
                      <td className="px-3 py-2.5 text-[#ababab] text-xs">
                        {item.channelCode || "ALL"}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {item._inherited ? (
                          <button
                            onClick={() => handleCreateOverride(item)}
                            className="text-blue-400 hover:text-blue-300 text-xs font-medium"
                          >
                            {t("menu.override")}
                          </button>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEdit(item)}
                              className="text-yellow-400 hover:text-yellow-300 text-xs"
                            >
                              {t("common.edit")}
                            </button>
                            <button
                              onClick={() => handleDuplicate(item)}
                              className="text-[#ababab] hover:text-[#f5f5f5] text-xs"
                            >
                              {t("common.copy")}
                            </button>
                            {item.status !== "ARCHIVED" && (
                              <button
                                onClick={() => handleArchive(item)}
                                className="text-red-400 hover:text-red-300 text-xs"
                              >
                                {t("common.archive")}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer stats */}
          {!loading && filteredItems.length > 0 && (
            <div className="mt-3 flex items-center justify-between text-xs text-[#666]">
              <span>
                {t("menu.itemCountLabel", { count: filteredItems.length })}
                {selectedCategory !== "ALL" && ` ${t("menu.inCategory", { category: selectedCategory })}`}
                {filteredItems.filter((i) => i._inherited).length > 0 &&
                  ` ${t("menu.fromHQ", { count: filteredItems.filter((i) => i._inherited).length })}`}
              </span>
              <span>{t("common.location")}: {locationLabel(locationId)}</span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default MenuItemsPage;
