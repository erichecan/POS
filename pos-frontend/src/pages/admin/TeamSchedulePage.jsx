/**
 * 排班管理 - 团队管理 Phase 3
 * 2026-02-28: 周视图、班次列表、批量排班
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  getScheduleSlots,
  getShiftTemplates,
  getEmployeesWithScopes,
  createScheduleSlot,
  bulkCreateScheduleSlots,
  deleteScheduleSlot,
  updateScheduleSlot,
} from "../../https";
import { addDays, format, startOfWeek, isSameDay, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";

const LOCATION_ID = "default";

const TeamSchedulePage = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [bulkForm, setBulkForm] = useState({
    userIds: [],
    shiftTemplateId: "",
    startDate: format(weekStart, "yyyy-MM-dd"),
    endDate: format(addDays(weekStart, 6), "yyyy-MM-dd"),
  });

  const { data: slotsRes } = useQuery({
    queryKey: ["schedule-slots", LOCATION_ID, format(weekStart, "yyyy-MM-dd"), format(addDays(weekStart, 6), "yyyy-MM-dd")],
    queryFn: () =>
      getScheduleSlots({
        locationId: LOCATION_ID,
        startDate: format(weekStart, "yyyy-MM-dd"),
        endDate: format(addDays(weekStart, 6), "yyyy-MM-dd"),
      }),
  });
  const { data: templatesRes } = useQuery({
    queryKey: ["shift-templates", LOCATION_ID],
    queryFn: () => getShiftTemplates({ locationId: LOCATION_ID }),
  });
  const { data: employeesRes } = useQuery({
    queryKey: ["employees-scopes"],
    queryFn: () => getEmployeesWithScopes({ locationId: LOCATION_ID }),
  });

  const slots = slotsRes?.data?.data || [];
  const templates = templatesRes?.data?.data || [];
  const employees = employeesRes?.data?.data || [];

  const bulkMutation = useMutation({
    mutationFn: (data) => bulkCreateScheduleSlots(data),
    onSuccess: () => {
      enqueueSnackbar(t("team.scheduleBulkSuccess") || "Bulk schedule created.", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["schedule-slots"] });
    },
    onError: (e) => enqueueSnackbar(e.response?.data?.message || "Failed", { variant: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteScheduleSlot(id),
    onSuccess: () => {
      enqueueSnackbar(t("common.deleted") || "Deleted", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["schedule-slots"] });
    },
  });

  const handleBulkCreate = () => {
    if (!bulkForm.shiftTemplateId || bulkForm.userIds.length === 0) {
      enqueueSnackbar(t("team.selectEmployeesAndTemplate") || "Select employees and template", { variant: "warning" });
      return;
    }
    bulkMutation.mutate({
      locationId: LOCATION_ID,
      userIds: bulkForm.userIds,
      shiftTemplateId: bulkForm.shiftTemplateId,
      startDate: bulkForm.startDate,
      endDate: bulkForm.endDate,
    });
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const slotsByDayUser = {};
  slots.forEach((s) => {
    const d = format(new Date(s.date), "yyyy-MM-dd");
    const u = s.userId?._id || s.userId;
    if (!slotsByDayUser[d]) slotsByDayUser[d] = {};
    if (!slotsByDayUser[d][u]) slotsByDayUser[d][u] = [];
    slotsByDayUser[d][u].push(s);
  });

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <h1 className="text-xl font-semibold text-[#f5f5f5]">{t("team.schedule")}</h1>

      <div className="mt-4 p-4 rounded-lg border border-[#333] bg-[#262626]">
        <h2 className="text-[#f5f5f5] font-medium mb-3">{t("team.bulkSchedule")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-[#ababab] mb-1">{t("team.employees")}</label>
            <select
              multiple
              className="w-full bg-[#1f1f1f] text-[#f5f5f5] px-3 py-2 rounded-lg text-sm h-24"
              value={bulkForm.userIds}
              onChange={(e) =>
                setBulkForm((prev) => ({
                  ...prev,
                  userIds: Array.from(e.target.selectedOptions, (o) => o.value),
                }))
              }
            >
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#ababab] mb-1">{t("team.shiftTemplate")}</label>
            <select
              className="w-full bg-[#1f1f1f] text-[#f5f5f5] px-3 py-2 rounded-lg text-sm"
              value={bulkForm.shiftTemplateId}
              onChange={(e) => setBulkForm((prev) => ({ ...prev, shiftTemplateId: e.target.value }))}
            >
              <option value="">{t("team.selectTemplate")}</option>
              {templates.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} ({t.startTime}-{t.endTime})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#ababab] mb-1">{t("team.startDate")}</label>
            <input
              type="date"
              className="w-full bg-[#1f1f1f] text-[#f5f5f5] px-3 py-2 rounded-lg text-sm"
              value={bulkForm.startDate}
              onChange={(e) => setBulkForm((prev) => ({ ...prev, startDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-[#ababab] mb-1">{t("team.endDate")}</label>
            <input
              type="date"
              className="w-full bg-[#1f1f1f] text-[#f5f5f5] px-3 py-2 rounded-lg text-sm"
              value={bulkForm.endDate}
              onChange={(e) => setBulkForm((prev) => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
        </div>
        <button
          onClick={handleBulkCreate}
          disabled={bulkMutation.isPending}
          className="mt-3 bg-[#2f4f7a] text-[#e6f0ff] px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          {bulkMutation.isPending ? t("common.creating") : t("team.createBulk")}
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => setWeekStart((d) => addDays(d, -7))}
          className="bg-[#333] text-[#f5f5f5] px-3 py-2 rounded text-sm"
        >
          ←
        </button>
        <span className="text-[#f5f5f5] text-sm">
          {format(weekStart, "yyyy-MM-dd")} ~ {format(addDays(weekStart, 6), "yyyy-MM-dd")}
        </span>
        <button
          onClick={() => setWeekStart((d) => addDays(d, 7))}
          className="bg-[#333] text-[#f5f5f5] px-3 py-2 rounded text-sm"
        >
          →
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-[#444]">
              <th className="text-left py-2 px-2 text-[#ababab] w-24">{t("team.employee")}</th>
              {days.map((d) => (
                <th key={d} className="text-center py-2 px-2 text-[#ababab] font-normal">
                  {format(d, "EEE dd", { locale: zhCN })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp._id} className="border-b border-[#333]">
                <td className="py-2 px-2 text-[#f5f5f5]">{emp.name}</td>
                {days.map((d) => {
                  const dStr = format(d, "yyyy-MM-dd");
                  const daySlots = slotsByDayUser[dStr]?.[emp._id] || [];
                  return (
                    <td key={dStr} className="py-2 px-2 align-top">
                      {daySlots.map((s) => (
                        <div
                          key={s._id}
                          className="mb-1 rounded px-2 py-1 bg-[#2b4f40] border border-[#4e8a72] text-xs flex justify-between items-center"
                        >
                          <span>
                            {s.shiftTemplateId?.name || "-"} {format(new Date(s.plannedStart), "HH:mm")}-
                            {format(new Date(s.plannedEnd), "HH:mm")}
                          </span>
                          <button
                            onClick={() => deleteMutation.mutate(s._id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TeamSchedulePage;
