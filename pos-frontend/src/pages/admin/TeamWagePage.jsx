/**
 * 工资计算 - 团队管理 Phase 5
 * 2026-02-28
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { calculateWage } from "../../https";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";

const TeamWagePage = () => {
  const { t } = useTranslation();
  const now = new Date();
  const [range, setRange] = useState({
    startDate: format(startOfMonth(now), "yyyy-MM-dd"),
    endDate: format(endOfMonth(now), "yyyy-MM-dd"),
  });
  const [result, setResult] = useState(null);

  const calcMutation = useMutation({
    mutationFn: () =>
      calculateWage({
        locationId: "default",
        startDate: range.startDate,
        endDate: range.endDate,
      }),
    onSuccess: (res) => {
      setResult(res.data?.data || null);
      enqueueSnackbar(t("team.calcDone") || "Calculation done", { variant: "success" });
    },
    onError: (e) => enqueueSnackbar(e.response?.data?.message || "Failed", { variant: "error" }),
  });

  const handleExport = () => {
    if (!result?.summary?.length) return;
    const rows = [
      [t("team.employee"), t("team.totalHours"), t("team.totalWage")].join(","),
      ...result.summary.map((r) => [r.userName, r.totalHours, r.totalWage].join(",")),
      ["", "", result.totalWage?.toFixed(2) || "0"].join(","),
    ];
    const csv = rows.join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wage_${range.startDate}_${range.endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <h1 className="text-xl font-semibold text-[#f5f5f5]">{t("team.wage")}</h1>

      <div className="mt-4 p-4 rounded-lg border border-[#333] bg-[#262626]">
        <h2 className="text-[#f5f5f5] font-medium mb-3">{t("team.calcWage")}</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-[#ababab] mb-1">{t("team.startDate")}</label>
            <input
              type="date"
              className="bg-[#1f1f1f] text-[#f5f5f5] px-3 py-2 rounded-lg text-sm"
              value={range.startDate}
              onChange={(e) => setRange((prev) => ({ ...prev, startDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-[#ababab] mb-1">{t("team.endDate")}</label>
            <input
              type="date"
              className="bg-[#1f1f1f] text-[#f5f5f5] px-3 py-2 rounded-lg text-sm"
              value={range.endDate}
              onChange={(e) => setRange((prev) => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
          <button
            onClick={() => calcMutation.mutate()}
            disabled={calcMutation.isPending}
            className="bg-[#F6B100] text-[#1f1f1f] px-6 py-2 rounded-lg font-semibold disabled:opacity-50"
          >
            {calcMutation.isPending ? t("team.calculating") : t("team.calculate")}
          </button>
        </div>
      </div>

      {result && (
        <div className="mt-6 p-4 rounded-lg border border-[#333] bg-[#262626]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[#f5f5f5] font-medium">
              {t("team.result")} ({range.startDate} ~ {range.endDate})
            </h2>
            <button
              onClick={handleExport}
              className="bg-[#2f4f7a] text-[#e6f0ff] px-4 py-2 rounded-lg text-sm font-semibold"
            >
              {t("team.exportCsv")}
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#444]">
                <th className="text-left py-2 px-3 text-[#ababab]">{t("team.employee")}</th>
                <th className="text-right py-2 px-3 text-[#ababab]">{t("team.totalHours")}</th>
                <th className="text-right py-2 px-3 text-[#ababab]">{t("team.totalWage")}</th>
              </tr>
            </thead>
            <tbody>
              {result.summary?.map((r) => (
                <tr key={r.userId} className="border-t border-[#333]">
                  <td className="py-2 px-3 text-[#f5f5f5]">{r.userName}</td>
                  <td className="py-2 px-3 text-right text-[#ababab]">{r.totalHours}</td>
                  <td className="py-2 px-3 text-right text-[#f5f5f5]">€{r.totalWage?.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 pt-3 border-t border-[#444] flex justify-end">
            <span className="text-[#f5f5f5] font-semibold">
              {t("team.total")}: €{result.totalWage?.toFixed(2) || "0.00"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamWagePage;
