/**
 * Admin Team: 岗位、排班、请假、工时、工资
 * 2026-02-28: 集成岗位 API，快捷入口到排班/请假/工时/工资
 * 2026-02-24 14:30:00: 添加快捷入口卡片（排班/请假/工时/工资）、i18n 补全
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { MdSchedule, MdEventBusy, MdAccessTime, MdAttachMoney, MdWork } from "react-icons/md";
import { getPositions } from "../../https";

const SCOPE_LABELS = {
  TABLES: "admin.scopeTables",
  BAR: "admin.scopeBar",
  KITCHEN: "admin.scopeKitchen",
  RUNNER: "admin.scopeRunner",
  TAKEOUT: "admin.scopeTakeout",
  CASHIER: "admin.scopeCashier",
  MANAGER: "admin.scopeManager",
};

const TEAM_LINKS = [
  { path: "/dashboard/team/schedule", icon: MdSchedule, key: "team.schedule", descKey: "team.scheduleDesc" },
  { path: "/dashboard/team/leave", icon: MdEventBusy, key: "team.leave", descKey: "team.leaveDesc" },
  { path: "/dashboard/team/work-hours", icon: MdAccessTime, key: "team.workHours", descKey: "team.workHoursDesc" },
  { path: "/dashboard/team/wage", icon: MdAttachMoney, key: "team.wage", descKey: "team.wageDesc" },
];

const TeamPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: positionsRes, isLoading } = useQuery({
    queryKey: ["positions"],
    queryFn: () => getPositions({ locationId: "default" }),
  });
  const positions = positionsRes?.data?.data || [];

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <h1 className="text-xl font-semibold text-[#f5f5f5]">{t("admin.team")}</h1>
      <p className="text-sm text-[#ababab] mt-1">{t("admin.manageTeam")}</p>

      {/* 2026-02-28: 岗位列表 - Phase 2 */}
      <div className="mt-6 rounded-lg border border-[#333] bg-[#262626] p-4">
        <h2 className="text-[#f5f5f5] font-medium mb-3 flex items-center gap-2">
          <MdWork className="w-5 h-5 text-[#6b8c7a]" />
          {t("admin.positions")}
        </h2>
        {isLoading ? (
          <p className="text-sm text-[#8a8a8a]">{t("common.loading")}</p>
        ) : positions.length === 0 ? (
          <p className="text-sm text-[#8a8a8a]">{t("admin.noPositions")}</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {positions.map((p) => (
              <div
                key={p._id}
                className="rounded border border-[#444] bg-[#1f1f1f] p-3 text-sm"
              >
                <span className="text-[#f5f5f5] font-medium">{p.name}</span>
                <p className="text-xs text-[#8a8a8a] mt-1">
                  {t(SCOPE_LABELS[p.scopeType] || p.scopeType)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-[#333] bg-[#262626] p-4">
        <h2 className="text-[#f5f5f5] font-medium mb-3">{t("team.quickLinks")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TEAM_LINKS.map(({ path, icon: Icon, key, descKey }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="rounded-lg border border-[#444] bg-[#1f1f1f] p-4 flex flex-col gap-2 text-left hover:border-[#4e8a72] transition-colors"
            >
              <Icon className="text-[#6b8c7a] w-6 h-6" />
              <span className="text-[#d5d5d5] font-medium">{t(key)}</span>
              <span className="text-xs text-[#8a8a8a]">{t(descKey)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TeamPage;
