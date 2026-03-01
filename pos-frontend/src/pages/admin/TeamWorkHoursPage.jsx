/**
 * 工时记录 - 团队管理 Phase 4
 * 2026-02-28: 签到/签出、手工补录
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  getWorkHourRecords,
  upsertWorkHourRecord,
  clockIn,
  clockOut,
  getEmployeesWithScopes,
} from "../../https";
import { format, subDays } from "date-fns";

const TeamWorkHoursPage = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [range, setRange] = useState({
    startDate: format(subDays(new Date(), 7), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });
  const [manualForm, setManualForm] = useState({
    userId: "",
    date: format(new Date(), "yyyy-MM-dd"),
    clockInAt: "09:00",
    clockOutAt: "17:00",
  });

  const { data: recordsRes } = useQuery({
    queryKey: ["work-hour-records", range.startDate, range.endDate],
    queryFn: () =>
      getWorkHourRecords({
        locationId: "default",
        startDate: range.startDate,
        endDate: range.endDate,
      }),
  });
  const { data: employeesRes } = useQuery({
    queryKey: ["employees-scopes"],
    queryFn: () => getEmployeesWithScopes({ locationId: "default" }),
  });

  const records = recordsRes?.data?.data || [];
  const employees = employeesRes?.data?.data || [];

  const clockInMutation = useMutation({
    mutationFn: () => clockIn({ locationId: "default" }),
    onSuccess: () => {
      enqueueSnackbar(t("team.clockedIn") || "Clocked in", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["work-hour-records"] });
    },
    onError: (e) => enqueueSnackbar(e.response?.data?.message || "Failed", { variant: "error" }),
  });

  const clockOutMutation = useMutation({
    mutationFn: () => clockOut({ locationId: "default" }),
    onSuccess: () => {
      enqueueSnackbar(t("team.clockedOut") || "Clocked out", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["work-hour-records"] });
    },
    onError: (e) => enqueueSnackbar(e.response?.data?.message || "Failed", { variant: "error" }),
  });

  const manualMutation = useMutation({
    mutationFn: (data) => {
      const date = data.date;
      const [hIn, mIn] = (data.clockInAt || "09:00").split(":").map(Number);
      const [hOut, mOut] = (data.clockOutAt || "17:00").split(":").map(Number);
      const clockInAt = new Date(date);
      clockInAt.setHours(hIn || 0, mIn || 0, 0, 0);
      const clockOutAt = new Date(date);
      clockOutAt.setHours(hOut || 0, mOut || 0, 0, 0);
      return upsertWorkHourRecord({
        userId: data.userId,
        date,
        clockInAt: clockInAt.toISOString(),
        clockOutAt: clockOutAt.toISOString(),
        locationId: "default",
      });
    },
    onSuccess: () => {
      enqueueSnackbar(t("team.recordSaved") || "Record saved", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["work-hour-records"] });
      setManualForm((prev) => ({ ...prev, userId: "", date: format(new Date(), "yyyy-MM-dd") }));
    },
    onError: (e) => enqueueSnackbar(e.response?.data?.message || "Failed", { variant: "error" }),
  });

  const getHours = (r) => {
    if (!r.clockInAt || !r.clockOutAt) return "-";
    const ms = new Date(r.clockOutAt) - new Date(r.clockInAt);
    return (ms / (1000 * 60 * 60)).toFixed(2);
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <h1 className="text-xl font-semibold text-[#f5f5f5]">{t("team.workHours")}</h1>

      <div className="mt-4 flex flex-wrap gap-4">
        <button
          onClick={() => clockInMutation.mutate()}
          disabled={clockInMutation.isPending}
          className="bg-[#2e4a40] text-[#9ef0bb] px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
        >
          {t("team.clockIn")}
        </button>
        <button
          onClick={() => clockOutMutation.mutate()}
          disabled={clockOutMutation.isPending}
          className="bg-[#5c2a2a] text-[#f5c6c6] px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
        >
          {t("team.clockOut")}
        </button>
      </div>

      <div className="mt-6 p-4 rounded-lg border border-[#333] bg-[#262626]">
        <h2 className="text-[#f5f5f5] font-medium mb-3">{t("team.manualEntry")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-[#ababab] mb-1">{t("team.employee")}</label>
            <select
              className="w-full bg-[#1f1f1f] text-[#f5f5f5] px-3 py-2 rounded-lg text-sm"
              value={manualForm.userId}
              onChange={(e) => setManualForm((prev) => ({ ...prev, userId: e.target.value }))}
            >
              <option value="">{t("team.selectEmployee")}</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#ababab] mb-1">{t("team.date")}</label>
            <input
              type="date"
              className="w-full bg-[#1f1f1f] text-[#f5f5f5] px-3 py-2 rounded-lg text-sm"
              value={manualForm.date}
              onChange={(e) => setManualForm((prev) => ({ ...prev, date: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-[#ababab] mb-1">{t("team.clockIn")}</label>
            <input
              type="time"
              className="w-full bg-[#1f1f1f] text-[#f5f5f5] px-3 py-2 rounded-lg text-sm"
              value={manualForm.clockInAt}
              onChange={(e) => setManualForm((prev) => ({ ...prev, clockInAt: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-[#ababab] mb-1">{t("team.clockOut")}</label>
            <input
              type="time"
              className="w-full bg-[#1f1f1f] text-[#f5f5f5] px-3 py-2 rounded-lg text-sm"
              value={manualForm.clockOutAt}
              onChange={(e) => setManualForm((prev) => ({ ...prev, clockOutAt: e.target.value }))}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => manualMutation.mutate(manualForm)}
              disabled={!manualForm.userId || manualMutation.isPending}
              className="w-full bg-[#2f4f7a] text-[#e6f0ff] px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {t("common.save")}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex gap-3 mb-3">
          <input
            type="date"
            className="bg-[#1f1f1f] text-[#f5f5f5] px-3 py-2 rounded-lg text-sm"
            value={range.startDate}
            onChange={(e) => setRange((prev) => ({ ...prev, startDate: e.target.value }))}
          />
          <input
            type="date"
            className="bg-[#1f1f1f] text-[#f5f5f5] px-3 py-2 rounded-lg text-sm"
            value={range.endDate}
            onChange={(e) => setRange((prev) => ({ ...prev, endDate: e.target.value }))}
          />
        </div>
        <div className="rounded border border-[#333] overflow-hidden">
          {records.length === 0 ? (
            <p className="p-4 text-[#8a8a8a] text-sm">{t("team.noRecords")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[#333]">
                <tr>
                  <th className="text-left py-2 px-3 text-[#ababab]">{t("team.employee")}</th>
                  <th className="text-left py-2 px-3 text-[#ababab]">{t("team.date")}</th>
                  <th className="text-left py-2 px-3 text-[#ababab]">{t("team.clockIn")}</th>
                  <th className="text-left py-2 px-3 text-[#ababab]">{t("team.clockOut")}</th>
                  <th className="text-left py-2 px-3 text-[#ababab]">{t("team.hours")}</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r._id} className="border-t border-[#333]">
                    <td className="py-2 px-3 text-[#f5f5f5]">{r.userId?.name}</td>
                    <td className="py-2 px-3 text-[#ababab]">
                      {format(new Date(r.date), "yyyy-MM-dd")}
                    </td>
                    <td className="py-2 px-3 text-[#ababab]">
                      {r.clockInAt ? format(new Date(r.clockInAt), "HH:mm") : "-"}
                    </td>
                    <td className="py-2 px-3 text-[#ababab]">
                      {r.clockOutAt ? format(new Date(r.clockOutAt), "HH:mm") : "-"}
                    </td>
                    <td className="py-2 px-3 text-[#ababab]">{getHours(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamWorkHoursPage;
