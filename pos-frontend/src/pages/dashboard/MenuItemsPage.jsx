/** Menu Items Management. 2026-02-26 */
import React, { useState, useEffect, useCallback } from "react";
import { axiosWrapper } from "../../https/axiosWrapper";

const MenuItemsPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({
    name: "", description: "", category: "", price: "", taxPercent: "", imageUrl: "",
  });

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axiosWrapper.get("/api/menu/items");
      setItems(data.data || []);
    } catch (e) {
      console.error("Failed to load menu items:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const resetForm = () => {
    setForm({ name: "", description: "", category: "", price: "", taxPercent: "", imageUrl: "" });
    setEditItem(null);
    setShowForm(false);
  };

  const handleEdit = (item) => {
    setForm({
      name: item.name || "",
      description: item.description || "",
      category: item.category || "",
      price: String(item.price ?? ""),
      taxPercent: String(item.taxPercent ?? ""),
      imageUrl: item.imageUrl || "",
    });
    setEditItem(item);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        taxPercent: form.taxPercent ? Number(form.taxPercent) : undefined,
      };
      if (editItem) payload._id = editItem._id;
      await axiosWrapper.put("/api/menu/items", payload);
      resetForm();
      fetchItems();
    } catch (err) {
      alert(err.response?.data?.message || "Save failed");
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-[#f5f5f5]">Menu Items</h2>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="rounded bg-yellow-400 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-yellow-300"
        >
          + Add Item
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 rounded-lg border border-[#333] bg-[#262626] p-4 space-y-3">
          <h3 className="text-sm font-medium text-[#f5f5f5]">{editItem ? "Edit Item" : "New Item"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: "Name", key: "name", required: true },
              { label: "Category", key: "category", required: true },
              { label: "Price", key: "price", type: "number", required: true },
              { label: "Tax %", key: "taxPercent", type: "number" },
              { label: "Image URL", key: "imageUrl" },
            ].map((f) => (
              <div key={f.key}>
                <label className="block text-xs text-[#ababab] mb-1">{f.label}</label>
                <input
                  type={f.type || "text"}
                  value={form[f.key]}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  required={f.required}
                  className="w-full rounded bg-[#1f1f1f] border border-[#333] px-3 py-2 text-sm text-[#f5f5f5] focus:border-yellow-400 focus:outline-none"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs text-[#ababab] mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={2}
              className="w-full rounded bg-[#1f1f1f] border border-[#333] px-3 py-2 text-sm text-[#f5f5f5] focus:border-yellow-400 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="rounded bg-yellow-400 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-yellow-300">
              {editItem ? "Update" : "Create"}
            </button>
            <button type="button" onClick={resetForm} className="rounded border border-[#333] px-4 py-2 text-sm text-[#ababab] hover:bg-[#333]">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-[#ababab]">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-[#ababab]">No menu items. Click "Add Item" to create one.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#333]">
          <table className="w-full text-sm">
            <thead className="bg-[#262626] text-[#ababab]">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#333]">
              {items.map((item) => (
                <tr key={item._id} className="text-[#f5f5f5] hover:bg-[#262626]">
                  <td className="px-4 py-3">{item.name}</td>
                  <td className="px-4 py-3 text-[#ababab]">{item.category}</td>
                  <td className="px-4 py-3 text-right">{item.price?.toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${item.available !== false ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}>
                      {item.available !== false ? "Available" : "Unavailable"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleEdit(item)} className="text-yellow-400 hover:text-yellow-300 text-xs mr-3">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MenuItemsPage;
