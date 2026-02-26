// 2026-02-26T19:58:00+08:00: Menu category management page with hierarchical CRUD, drag reorder
import React, { useState, useEffect, useCallback } from "react";
import { axiosWrapper } from "../../https/axiosWrapper";

const LOCATIONS = [
  { value: "default", label: "HQ (Master)" },
  { value: "LOC-001", label: "NYC Downtown" },
  { value: "LOC-002", label: "Los Angeles" },
  { value: "LOC-003", label: "Tokyo" },
];

const STATUS_STYLES = {
  ACTIVE: "bg-green-900/60 text-green-400",
  INACTIVE: "bg-yellow-900/60 text-yellow-400",
  ARCHIVED: "bg-red-900/60 text-red-400",
};

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#78716c",
];

const MenuCategoriesPage = () => {
  const [categories, setCategories] = useState([]);
  const [hqCategories, setHqCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationId, setLocationId] = useState("default");
  const [showForm, setShowForm] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [dragOverId, setDragOverId] = useState(null);
  const [dragItem, setDragItem] = useState(null);

  const defaultForm = {
    name: "",
    description: "",
    parentId: "",
    icon: "",
    color: "",
    status: "ACTIVE",
  };
  const [form, setForm] = useState(defaultForm);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axiosWrapper.get("/api/menu/categories", {
        params: { locationId },
      });
      setCategories(res.data?.data || []);

      if (locationId !== "default") {
        const hqRes = await axiosWrapper.get("/api/menu/categories", {
          params: { locationId: "default" },
        });
        setHqCategories(hqRes.data?.data || []);
      } else {
        setHqCategories([]);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const buildTree = (cats) => {
    const map = {};
    const roots = [];
    cats.forEach((c) => { map[c._id] = { ...c, children: [] }; });
    cats.forEach((c) => {
      if (c.parentId && map[c.parentId]) {
        map[c.parentId].children.push(map[c._id]);
      } else {
        roots.push(map[c._id]);
      }
    });
    return roots;
  };

  const tree = buildTree(categories);
  const hqTree = locationId !== "default" ? buildTree(hqCategories) : [];

  const allCatsForParent = categories.filter((c) => !c.parentId);

  const openForm = (cat = null) => {
    if (cat) {
      setEditCat(cat);
      setForm({
        name: cat.name || "",
        description: cat.description || "",
        parentId: cat.parentId || "",
        icon: cat.icon || "",
        color: cat.color || "",
        status: cat.status || "ACTIVE",
      });
    } else {
      setEditCat(null);
      setForm(defaultForm);
    }
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditCat(null);
    setForm(defaultForm);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editCat) {
        await axiosWrapper.put(`/api/menu/categories/${editCat._id}`, {
          ...form,
          parentId: form.parentId || null,
        });
      } else {
        await axiosWrapper.post("/api/menu/categories", {
          ...form,
          locationId,
          parentId: form.parentId || null,
        });
      }
      closeForm();
      fetchCategories();
    } catch (err) {
      setError(err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this category?")) return;
    try {
      await axiosWrapper.delete(`/api/menu/categories/${id}`);
      fetchCategories();
    } catch (err) {
      setError(err.response?.data?.message || "Delete failed");
    }
  };

  const handleDragStart = (cat) => { setDragItem(cat); };
  const handleDragOver = (e, catId) => { e.preventDefault(); setDragOverId(catId); };
  const handleDragLeave = () => { setDragOverId(null); };
  const handleDrop = async (targetCat) => {
    if (!dragItem || dragItem._id === targetCat._id) {
      setDragItem(null);
      setDragOverId(null);
      return;
    }

    const siblings = categories
      .filter((c) => (c.parentId || null) === (targetCat.parentId || null))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const fromIdx = siblings.findIndex((s) => s._id === dragItem._id);
    const toIdx = siblings.findIndex((s) => s._id === targetCat._id);

    if (fromIdx === -1) {
      setDragItem(null);
      setDragOverId(null);
      return;
    }

    const reordered = [...siblings];
    reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, dragItem);

    try {
      await axiosWrapper.post("/api/menu/categories/reorder", {
        orderedIds: reordered.map((c) => c._id),
      });
      fetchCategories();
    } catch (err) {
      setError("Reorder failed");
    }

    setDragItem(null);
    setDragOverId(null);
  };

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const importFromHq = async (hqCat) => {
    try {
      await axiosWrapper.post("/api/menu/categories", {
        locationId,
        name: hqCat.name,
        description: hqCat.description,
        icon: hqCat.icon,
        color: hqCat.color,
        status: "ACTIVE",
      });
      fetchCategories();
    } catch (err) {
      setError(err.response?.data?.message || "Import failed");
    }
  };

  const renderCatRow = (cat, depth = 0) => {
    const hasChildren = cat.children && cat.children.length > 0;
    const isExpanded = expandedIds.has(cat._id);
    const isDragOver = dragOverId === cat._id;

    return (
      <React.Fragment key={cat._id}>
        <div
          draggable
          onDragStart={() => handleDragStart(cat)}
          onDragOver={(e) => handleDragOver(e, cat._id)}
          onDragLeave={handleDragLeave}
          onDrop={() => handleDrop(cat)}
          className={`flex items-center gap-3 px-4 py-3 border-b border-[#333] hover:bg-[#2a2a2a] transition-colors cursor-grab ${
            isDragOver ? "bg-[#2f4f7a]/30 border-l-2 border-l-blue-400" : ""
          }`}
          style={{ paddingLeft: `${16 + depth * 28}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(cat._id)}
              className="w-5 h-5 flex items-center justify-center text-[#ababab] hover:text-[#f5f5f5] text-xs"
            >
              {isExpanded ? "▼" : "▶"}
            </button>
          ) : (
            <span className="w-5" />
          )}

          {cat.color && (
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: cat.color }}
            />
          )}

          <span className="text-[#f5f5f5] font-medium flex-1 min-w-0 truncate">
            {cat.icon && <span className="mr-1">{cat.icon}</span>}
            {cat.name}
          </span>

          {cat.description && (
            <span className="text-xs text-[#8a8a8a] max-w-[200px] truncate hidden md:inline">
              {cat.description}
            </span>
          )}

          <span className={`text-xs px-2 py-0.5 rounded ${STATUS_STYLES[cat.status] || "bg-gray-700 text-gray-300"}`}>
            {cat.status}
          </span>

          <span className="text-xs text-[#666] w-8 text-right">#{cat.sortOrder}</span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => openForm(cat)}
              className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-[#333]"
            >
              Edit
            </button>
            <button
              onClick={() => {
                setForm({ ...defaultForm, parentId: cat._id });
                setEditCat(null);
                setShowForm(true);
              }}
              className="text-xs text-green-400 hover:text-green-300 px-2 py-1 rounded hover:bg-[#333]"
            >
              +Sub
            </button>
            <button
              onClick={() => handleDelete(cat._id)}
              className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-[#333]"
            >
              Del
            </button>
          </div>
        </div>

        {hasChildren && isExpanded && cat.children.map((child) => renderCatRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#1a1a1a] text-[#f5f5f5]">
      {/* Top toolbar */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-[#333] bg-[#1f1f1f]">
        <h1 className="text-xl font-bold mr-4">Menu Categories</h1>

        <select
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          className="bg-[#262626] text-[#f5f5f5] border border-[#444] rounded-lg px-3 py-2 text-sm"
        >
          {LOCATIONS.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>

        <div className="flex-1" />

        <span className="text-sm text-[#8a8a8a]">
          {categories.length} categories
        </span>

        <button
          onClick={() => openForm()}
          className="bg-[#f6b100] hover:bg-[#d49a00] text-black font-semibold px-4 py-2 rounded-lg text-sm"
        >
          + Add Category
        </button>
      </div>

      {error && (
        <div className="mx-6 mt-3 bg-red-900/40 text-red-300 px-4 py-2 rounded-lg text-sm">
          {error}
          <button onClick={() => setError("")} className="ml-3 text-red-400 hover:text-red-200">×</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-[#8a8a8a]">Loading...</div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-[#8a8a8a]">
            <p className="text-lg mb-2">No categories yet</p>
            <p className="text-sm mb-4">Create your first category to organize menu items.</p>
            <button
              onClick={() => openForm()}
              className="bg-[#f6b100] hover:bg-[#d49a00] text-black font-semibold px-4 py-2 rounded-lg text-sm"
            >
              + Add Category
            </button>
          </div>
        ) : (
          <div className="bg-[#1f1f1f] border border-[#333] rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-[#444] bg-[#262626] text-xs text-[#8a8a8a] font-semibold uppercase tracking-wider">
              <span className="w-5" />
              <span className="flex-1">Name</span>
              <span className="hidden md:inline w-[200px]">Description</span>
              <span className="w-16 text-center">Status</span>
              <span className="w-8 text-right">Sort</span>
              <span className="w-[130px] text-right">Actions</span>
            </div>
            {tree.map((cat) => renderCatRow(cat, 0))}
          </div>
        )}

        {/* HQ categories for store locations */}
        {locationId !== "default" && hqTree.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-[#8a8a8a] uppercase tracking-wider mb-3">
              HQ Categories (available for import)
            </h2>
            <div className="bg-[#1f1f1f] border border-[#333] rounded-xl overflow-hidden">
              {hqTree.map((hqCat) => {
                const alreadyImported = categories.some(
                  (c) => c.normalizedName === hqCat.normalizedName
                );
                return (
                  <div
                    key={hqCat._id}
                    className="flex items-center gap-3 px-4 py-3 border-b border-[#333] last:border-b-0"
                  >
                    {hqCat.color && (
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: hqCat.color }}
                      />
                    )}
                    <span className="text-[#ababab] flex-1">{hqCat.name}</span>
                    <span className="text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded">HQ</span>
                    {alreadyImported ? (
                      <span className="text-xs text-green-400">Imported</span>
                    ) : (
                      <button
                        onClick={() => importFromHq(hqCat)}
                        className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded"
                      >
                        Import
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit form overlay */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#1f1f1f] border border-[#444] rounded-2xl w-full max-w-lg p-6 mx-4">
            <h2 className="text-lg font-bold mb-4">
              {editCat ? "Edit Category" : "New Category"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#ababab] mb-1">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-[#262626] border border-[#444] text-[#f5f5f5] rounded-lg px-3 py-2 text-sm focus:border-[#f6b100] outline-none"
                  placeholder="e.g. Appetizers, Main Course, Beverages"
                />
              </div>

              <div>
                <label className="block text-xs text-[#ababab] mb-1">Description</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-[#262626] border border-[#444] text-[#f5f5f5] rounded-lg px-3 py-2 text-sm focus:border-[#f6b100] outline-none"
                  placeholder="Optional description"
                />
              </div>

              {!editCat && (
                <div>
                  <label className="block text-xs text-[#ababab] mb-1">Parent Category</label>
                  <select
                    value={form.parentId}
                    onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                    className="w-full bg-[#262626] border border-[#444] text-[#f5f5f5] rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">— None (top level) —</option>
                    {allCatsForParent.map((c) => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs text-[#ababab] mb-1">Icon (emoji)</label>
                <input
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  className="w-full bg-[#262626] border border-[#444] text-[#f5f5f5] rounded-lg px-3 py-2 text-sm focus:border-[#f6b100] outline-none"
                  placeholder="e.g. 🍕 🥗 🍺"
                />
              </div>

              <div>
                <label className="block text-xs text-[#ababab] mb-1">Color</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setForm({ ...form, color: c })}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        form.color === c ? "border-white scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={form.color || "#6b7280"}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#ababab] mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full bg-[#262626] border border-[#444] text-[#f5f5f5] rounded-lg px-3 py-2 text-sm"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={closeForm}
                className="px-4 py-2 rounded-lg text-sm text-[#ababab] hover:text-[#f5f5f5] hover:bg-[#333]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="bg-[#f6b100] hover:bg-[#d49a00] disabled:opacity-50 text-black font-semibold px-6 py-2 rounded-lg text-sm"
              >
                {saving ? "Saving..." : editCat ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuCategoriesPage;
