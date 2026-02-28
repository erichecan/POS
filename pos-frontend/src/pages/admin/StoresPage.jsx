/**
 * Admin Stores: list stores (Organization). 2026-02-24 SaaS admin.
 * Uses organization listStores API.
 * // 2026-02-26T21:00:00+08:00: i18n
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { listStores } from "../../https";

const StoresPage = () => {
  const { t } = useTranslation();
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["organization-stores", { limit, offset }],
    queryFn: async () => {
      const res = await listStores({ limit, offset });
      return res.data;
    },
  });

  const rows = data?.data ?? [];
  const pagination = data?.pagination ?? { total: 0, limit: 20, offset: 0 };
  const total = pagination.total || 0;
  const pageSize = pagination.limit || 20;
  const currentOffset = pagination.offset || 0;

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <h1 className="text-xl font-semibold text-[#f5f5f5]">{t("admin.stores")}</h1>
      <p className="text-sm text-[#ababab] mt-1">{t("admin.manageStores")}</p>

      <div className="mt-6 rounded-lg border border-[#333] bg-[#262626] overflow-hidden">
        {isLoading && (
          <div className="p-6 text-[#ababab]">{t("admin.loadingStores")}</div>
        )}
        {isError && (
          <div className="p-6 text-red-400">
            {error?.response?.data?.message || error?.message || t("admin.failedLoadStores")}
          </div>
        )}
        {!isLoading && !isError && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#333] bg-[#1f1f1f]">
                    <th className="px-4 py-3 font-medium text-[#ababab]">{t("dashboard.locationId")}</th>
                    <th className="px-4 py-3 font-medium text-[#ababab]">{t("common.code")}</th>
                    <th className="px-4 py-3 font-medium text-[#ababab]">{t("common.name")}</th>
                    <th className="px-4 py-3 font-medium text-[#ababab]">{t("common.status")}</th>
                    <th className="px-4 py-3 font-medium text-[#ababab]">{t("admin.organization")}</th>
                    <th className="px-4 py-3 font-medium text-[#ababab]">{t("common.region")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[#ababab]">
                        {t("admin.noStoresFound")}
                      </td>
                    </tr>
                  ) : (
                    rows.map((store) => (
                      <tr key={store._id} className="border-b border-[#333] hover:bg-[#2a2a2a]">
                        <td className="px-4 py-3 text-[#f5f5f5]">{store.locationId || "—"}</td>
                        <td className="px-4 py-3 text-[#f5f5f5]">{store.code || "—"}</td>
                        <td className="px-4 py-3 text-[#f5f5f5]">{store.name || "—"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded px-2 py-0.5 text-xs ${
                              store.status === "ACTIVE"
                                ? "bg-green-900/40 text-green-300"
                                : "bg-[#333] text-[#ababab]"
                            }`}
                          >
                            {store.status || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#ababab]">
                          {store.organizationId?.name ?? store.organizationId ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-[#ababab]">
                          {store.regionId?.name ?? store.regionId ?? "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {total > pageSize && (
              <div className="flex items-center justify-between border-t border-[#333] px-4 py-3">
                <span className="text-sm text-[#ababab]">
                  {currentOffset + 1}–{Math.min(currentOffset + pageSize, total)} of {total}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={currentOffset === 0}
                    onClick={() => setOffset((o) => Math.max(0, o - pageSize))}
                    className="rounded px-3 py-1.5 text-sm bg-[#333] text-[#f5f5f5] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#444]"
                  >
                    {t("common.previous")}
                  </button>
                  <button
                    type="button"
                    disabled={currentOffset + pageSize >= total}
                    onClick={() => setOffset((o) => o + pageSize)}
                    className="rounded px-3 py-1.5 text-sm bg-[#333] text-[#f5f5f5] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#444]"
                  >
                    {t("common.next")}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default StoresPage;
