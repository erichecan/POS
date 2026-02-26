/** Menu Versions Management. 2026-02-26 */
import React, { useState, useEffect, useCallback } from "react";
import { axiosWrapper } from "../../https/axiosWrapper";

const MenuVersionsPage = () => {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchVersions = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axiosWrapper.get("/api/menu/versions");
      setVersions(data.data || []);
    } catch (e) {
      console.error("Failed to load menu versions:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVersions(); }, [fetchVersions]);

  const handlePublish = async () => {
    try {
      await axiosWrapper.post("/api/menu/versions/publish");
      fetchVersions();
    } catch (err) {
      alert(err.response?.data?.message || "Publish failed");
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-[#f5f5f5]">Menu Versions</h2>
        <button onClick={handlePublish} className="rounded bg-yellow-400 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-yellow-300">
          Publish New Version
        </button>
      </div>
      {loading ? (
        <p className="text-[#ababab]">Loading...</p>
      ) : versions.length === 0 ? (
        <p className="text-[#ababab]">No published versions yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#333]">
          <table className="w-full text-sm">
            <thead className="bg-[#262626] text-[#ababab]">
              <tr>
                <th className="px-4 py-3 text-left">Version</th>
                <th className="px-4 py-3 text-left">Published At</th>
                <th className="px-4 py-3 text-right">Items</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#333]">
              {versions.map((v, i) => (
                <tr key={v._id || i} className="text-[#f5f5f5] hover:bg-[#262626]">
                  <td className="px-4 py-3 font-mono">{v.version || i + 1}</td>
                  <td className="px-4 py-3 text-[#ababab]">{v.publishedAt ? new Date(v.publishedAt).toLocaleString() : "-"}</td>
                  <td className="px-4 py-3 text-right">{v.itemCount ?? v.items?.length ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${i === 0 ? "bg-green-900 text-green-300" : "bg-[#333] text-[#ababab]"}`}>
                      {i === 0 ? "Current" : "Archived"}
                    </span>
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

export default MenuVersionsPage;
