/**
 * 请假审批 - 团队管理 Phase 4
 * 2026-02-28
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  getLeaveRequests,
  createLeaveRequest,
  approveLeaveRequest,
  getEmployeesWithScopes,
} from "../../https";
import { format } from "date-fns";

const TeamLeavePage = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    type: "PERSONAL",
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [approveForm, setApproveForm] = useState({});

  const { data: leavesRes } = useQuery({
    queryKey: ["leave-requests"],
    queryFn: () => getLeaveRequests(),
  });
  const { data: employeesRes } = useQuery({
    queryKey: ["employees-scopes"],
    queryFn: () => getEmployeesWithScopes({ locationId: "default" }),
  });

  const leaves = leavesRes?.data?.data || [];
  const employees = employeesRes?.data?.data || [];
  const pendingLeaves = leaves.filter((l) => l.status === "PENDING");

  const createMutation = useMutation({
    mutationFn: createLeaveRequest,
    onSuccess: () => {
      enqueueSnackbar(t("team.leaveSubmitted") || "Leave submitted", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      setForm({ type: "PERSONAL", startDate: "", endDate: "", reason: "" });
    },
    onError: (e) => enqueueSnackbar(e.response?.data?.message || "Failed", { variant: "error" }),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, ...data }) => approveLeaveRequest(id, data),
    onSuccess: () => {
      enqueueSnackbar(t("team.leaveProcessed") || "Processed", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
    },
    onError: (e) => enqueueSnackbar(e.response?.data?.message || "Failed", { variant: "error" }),
  });

  const handleSubmit = () => {
    if (!form.startDate || !form.endDate) {
      enqueueSnackbar(t("team.enterDates") || "Enter start and end dates", { variant: "warning" });
      return;
    }
    createMutation.mutate(form);
  };

  const handleApprove = (id, status, replacementUserId) => {
    approveMutation.mutate({ id, status, replacementUserId });
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <h1 className="text-xl font-semibold text-[#f5f5f5]">{t("team.leave")}</h1>

      <div className="mt-4 p-4 rounded-lg border border-[#333] bg-[#262626]">
        <h2 className="text-[#f5f5f5] font-medium mb-3">{t("team.requestLeave")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-[#ababab] mb-1">{t("team.leaveType")}</label>
            <select
              className="w-full bg-[#1f1f1f] text-[#f5f5f5] px-3 py-2 rounded-lg text-sm"
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
            >
              <option value="PERSONAL">{t("team.leavePersonal")}</option>
              <option value="SICK">{t("team.leaveSick")}</option>
              <option value="OTHER">{t("team.leaveOther")}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#ababab] mb-1">{t("team.startDate")}</label>
            <input
              type="date"
              className="w-full bg-[#1f1f1f] text-[#f5f5f5] px-3 py-2 rounded-lg text-sm"
              value={form.startDate}
              onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-[#ababab] mb-1">{t("team.endDate")}</label>
            <input
              type="date"
              className="w-full bg-[#1f1f1f] text-[#f5f5f5] px-3 py-2 rounded-lg text-sm"
              value={form.endDate}
              onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-[#ababab] mb-1">{t("team.reason")}</label>
            <input
              type="text"
              placeholder={t("team.reasonOptional")}
              className="w-full bg-[#1f1f1f] text-[#f5f5f5] px-3 py-2 rounded-lg text-sm"
              value={form.reason}
              onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
            />
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={createMutation.isPending}
          className="mt-3 bg-[#2f4f7a] text-[#e6f0ff] px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          {createMutation.isPending ? t("common.submit") : t("team.submitLeave")}
        </button>
      </div>

      <div className="mt-6">
        <h2 className="text-[#f5f5f5] font-medium mb-3">
          {t("team.pendingApprovals")} ({pendingLeaves.length})
        </h2>
        <div className="space-y-2">
          {pendingLeaves.map((l) => (
            <div
              key={l._id}
              className="p-4 rounded-lg border border-[#444] bg-[#1f1f1f] flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <span className="text-[#f5f5f5] font-medium">{l.userId?.name}</span>
                <span className="text-[#ababab] ml-2">{l.type}</span>
                <p className="text-sm text-[#8a8a8a] mt-1">
                  {format(new Date(l.startDate), "yyyy-MM-dd")} ~ {format(new Date(l.endDate), "yyyy-MM-dd")}
                  {l.reason && ` · ${l.reason}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="bg-[#252525] text-[#f5f5f5] px-2 py-1 rounded text-sm"
                  value={approveForm[l._id]?.replacementUserId || ""}
                  onChange={(e) =>
                    setApproveForm((prev) => ({
                      ...prev,
                      [l._id]: { ...prev[l._id], replacementUserId: e.target.value || undefined },
                    }))
                  }
                >
                  <option value="">{t("team.noReplacement")}</option>
                  {employees.filter((e) => e._id !== l.userId?._id).map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleApprove(l._id, "APPROVED", approveForm[l._id]?.replacementUserId)}
                  className="bg-[#2e4a40] text-[#9ef0bb] px-3 py-1 rounded text-sm"
                >
                  {t("common.confirm")}
                </button>
                <button
                  onClick={() => handleApprove(l._id, "REJECTED")}
                  className="bg-[#5c2a2a] text-[#f5c6c6] px-3 py-1 rounded text-sm"
                >
                  {t("team.reject")}
                </button>
              </div>
            </div>
          ))}
          {pendingLeaves.length === 0 && (
            <p className="text-[#8a8a8a] text-sm">{t("team.noPendingLeaves")}</p>
          )}
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-[#f5f5f5] font-medium mb-3">{t("team.allLeaves")}</h2>
        <div className="space-y-1">
          {leaves.slice(0, 20).map((l) => (
            <div
              key={l._id}
              className="flex items-center justify-between py-2 px-3 rounded bg-[#1f1f1f] text-sm"
            >
              <span className="text-[#f5f5f5]">{l.userId?.name}</span>
              <span className="text-[#ababab]">
                {format(new Date(l.startDate), "MM/dd")}-{format(new Date(l.endDate), "MM/dd")}
              </span>
              <span
                className={
                  l.status === "APPROVED"
                    ? "text-[#9ef0bb]"
                    : l.status === "REJECTED"
                    ? "text-[#f5c6c6]"
                    : "text-yellow-400"
                }
              >
                {l.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TeamLeavePage;
