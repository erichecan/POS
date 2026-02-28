// 2026-02-26T21:00:00+08:00: i18n
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  getOpsSloSnapshot,
  runOpsEscalationSweep,
  getOpsIncidents,
  acknowledgeOpsIncident,
  resolveOpsIncident,
} from "../../https";

const panelClass = "bg-[#262626] rounded-lg p-4 border border-[#333]";
const inputClass =
  "w-full bg-[#1f1f1f] text-[#f5f5f5] border border-[#3b3b3b] rounded-md px-3 py-2 focus:outline-none";

const toDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
};

const getHealthClass = (status) => {
  if (status === "CRITICAL") {
    return "bg-[#4e1f1f] text-[#ff8f8f]";
  }
  if (status === "WARN") {
    return "bg-[#4f431e] text-[#ffd36a]";
  }
  return "bg-[#1f3d2f] text-[#8fe6b2]";
};

const getAlertClass = (severity) => {
  if (severity === "CRITICAL") {
    return "border-[#5a2a2a] bg-[#2a1717]";
  }
  return "border-[#5a4f2a] bg-[#2a2517]";
};

const getIncidentStatusClass = (status) => {
  if (status === "RESOLVED") {
    return "bg-[#1f3d2f] text-[#8fe6b2]";
  }
  if (status === "ACKED") {
    return "bg-[#1f2f4f] text-[#9ac7ff]";
  }
  return "bg-[#4f431e] text-[#ffd36a]";
};

const SLOCenter = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState({
    locationId: "default",
    windowMinutes: "240",
  });
  const [incidentFilter, setIncidentFilter] = useState({
    status: "OPEN,ACKED",
    severity: "",
  });
  const [lastSweep, setLastSweep] = useState(null);

  const sloQuery = useQuery({
    queryKey: ["ops-slo", filter],
    queryFn: () =>
      getOpsSloSnapshot({
        locationId: filter.locationId,
        windowMinutes: Number(filter.windowMinutes || 240),
      }),
    refetchInterval: 10000,
  });

  const incidentsQuery = useQuery({
    queryKey: ["ops-incidents", filter.locationId, incidentFilter],
    queryFn: () =>
      getOpsIncidents({
        locationId: filter.locationId,
        status: incidentFilter.status || undefined,
        severity: incidentFilter.severity || undefined,
        limit: 200,
      }),
    refetchInterval: 8000,
  });

  const data = useMemo(() => sloQuery.data?.data?.data || {}, [sloQuery.data]);
  const alerts = Array.isArray(data.alerts) ? data.alerts : [];
  const alertSummary = data.alertSummary || {};
  const inventory = data.inventory || {};
  const kitchen = data.kitchen || {};
  const payment = data.payment || {};
  const cash = data.cash || {};
  const incidents = useMemo(
    () => (Array.isArray(incidentsQuery.data?.data?.data) ? incidentsQuery.data.data.data : []),
    [incidentsQuery.data]
  );
  const incidentPagination = useMemo(
    () => incidentsQuery.data?.data?.pagination || {},
    [incidentsQuery.data]
  );

  const invalidateOpsViews = () => {
    queryClient.invalidateQueries({ queryKey: ["ops-slo"] });
    queryClient.invalidateQueries({ queryKey: ["ops-incidents"] });
  };

  const onError = (error, fallback) => {
    const message = error?.response?.data?.message || fallback;
    enqueueSnackbar(message, { variant: "error" });
  };

  const runSweepMutation = useMutation({
    mutationFn: runOpsEscalationSweep,
    onSuccess: (response) => {
      setLastSweep(response?.data?.data || null);
      const sync = response?.data?.data?.syncResult || {};
      enqueueSnackbar(
        `Escalation sweep done · created ${sync.createdCount || 0}, escalated ${
          sync.escalatedCount || 0
        }, auto-resolved ${sync.autoResolvedCount || 0}`,
        { variant: "success" }
      );
      invalidateOpsViews();
    },
    onError: (error) => onError(error, "Failed to run escalation sweep"),
  });

  const ackIncidentMutation = useMutation({
    mutationFn: acknowledgeOpsIncident,
    onSuccess: () => {
      enqueueSnackbar("Incident acknowledged", { variant: "success" });
      invalidateOpsViews();
    },
    onError: (error) => onError(error, "Failed to acknowledge incident"),
  });

  const resolveIncidentMutation = useMutation({
    mutationFn: resolveOpsIncident,
    onSuccess: () => {
      enqueueSnackbar("Incident resolved", { variant: "success" });
      invalidateOpsViews();
    },
    onError: (error) => onError(error, "Failed to resolve incident"),
  });

  const cards = [
    {
      label: t("slo.inventoryOOS"),
      value: inventory.outOfStockCount ?? 0,
      sub: `Low ${inventory.lowStockCount ?? 0} (${inventory.lowStockRate ?? 0}%)`,
      color: "bg-[#1f2f4f] text-[#9ac7ff]",
    },
    {
      label: t("slo.kitchenOverdue"),
      value: kitchen.overdueCount ?? 0,
      sub: `Open ${kitchen.openTickets ?? 0} · Avg ${kitchen.avgReadyMinutes ?? 0}m`,
      color: "bg-[#4e1f1f] text-[#ff8f8f]",
    },
    {
      label: t("slo.paymentFailure"),
      value: `${payment.failureRate ?? 0}%`,
      sub: `Unverified ${payment.unverifiedAgingCount ?? 0}`,
      color: "bg-[#4f431e] text-[#ffd36a]",
    },
    {
      label: t("slo.pendingRefundReviews"),
      value: payment.pendingRefundApprovals ?? 0,
      sub: `Verified ${payment.verificationRate ?? 0}%`,
      color: "bg-[#2a1f4f] text-[#c8b5ff]",
    },
    {
      label: t("slo.cashVarianceAlerts"),
      value: cash.highVarianceShiftCount ?? 0,
      sub: `Open Shift ${cash.openShiftCount ?? 0}`,
      color: "bg-[#1f3d2f] text-[#8fe6b2]",
    },
  ];

  return (
    <div className="container mx-auto py-2 px-6 md:px-4 space-y-4">
      {/* 2026-02-26: SLO description section */}
      <div className="mb-6 rounded-lg border border-[#333] bg-[#262626] p-4">
        <h2 className="text-lg font-semibold text-[#f5f5f5] mb-2">{t("slo.title")}</h2>
        <p className="text-sm text-[#ababab] leading-relaxed">
          {t("slo.description")}
          <strong className="text-[#f5f5f5]"> Inventory</strong> (out-of-stock & low stock rates),
          <strong className="text-[#f5f5f5]"> Kitchen</strong> (overdue tickets & average completion time),
          <strong className="text-[#f5f5f5]"> Payments</strong> (failure rates & unverified transactions),
          <strong className="text-[#f5f5f5]"> Refunds</strong> (pending approvals), and
          <strong className="text-[#f5f5f5]"> Cash</strong> (variance alerts from cash shifts).
          {t("slo.descLegend")}
        </p>
      </div>

      <div className={panelClass}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[#f5f5f5] text-lg font-semibold">{t("slo.opsSloSnapshot")}</h2>
          <span
            className={`text-xs font-semibold px-3 py-1 rounded ${getHealthClass(
              data.healthStatus || "OK"
            )}`}
          >
            {data.healthStatus || "OK"}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-3">
          <input
            className={inputClass}
            placeholder={t("kitchen.locationId")}
            value={filter.locationId}
            onChange={(e) => setFilter((prev) => ({ ...prev, locationId: e.target.value }))}
          />
          <select
            className={inputClass}
            value={filter.windowMinutes}
            onChange={(e) => setFilter((prev) => ({ ...prev, windowMinutes: e.target.value }))}
          >
            <option value="60">{t("slo.last60Min")}</option>
            <option value="240">{t("slo.last4Hours")}</option>
            <option value="720">{t("slo.last12Hours")}</option>
            <option value="1440">{t("slo.last24Hours")}</option>
          </select>
          <div className="bg-[#1f1f1f] rounded-md px-3 py-2 text-xs text-[#f5f5f5] border border-[#333]">
            {t("slo.generated")} {toDateTime(data.generatedAt)}
          </div>
          <button
            className="bg-[#025cca] text-white rounded-md py-2 px-3 text-sm font-semibold disabled:opacity-60"
            disabled={runSweepMutation.isPending}
            onClick={() =>
              runSweepMutation.mutate({
                locationId: filter.locationId,
                windowMinutes: Number(filter.windowMinutes || 240),
              })
            }
          >
            {t("slo.runEscalation")}
          </button>
        </div>

        <div className="text-xs text-[#ababab]">
          {t("slo.alerts")} {alertSummary.total ?? 0} · Critical {alertSummary.critical ?? 0} · Warn{" "}
          {alertSummary.warn ?? 0}
        </div>
        {lastSweep?.policy && (
          <div className="text-xs text-[#ababab] mt-1">
            Policy: L1 → {lastSweep.policy.levelRoles?.[1]} · L2 (
            {lastSweep.policy.level2Minutes}m) → {lastSweep.policy.levelRoles?.[2]} · L3 (
            {lastSweep.policy.level3Minutes}m) → {lastSweep.policy.levelRoles?.[3]}
          </div>
        )}
      </div>

      <div className={panelClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">{t("slo.sloKeyMetrics")}</h2>
        <div className="grid grid-cols-5 gap-3">
          {cards.map((card) => (
            <div key={card.label} className={`rounded-md px-3 py-2 ${card.color}`}>
              <p className="text-xs">{card.label}</p>
              <p className="font-semibold text-lg">{card.value}</p>
              <p className="text-[11px] opacity-90 mt-1">{card.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={panelClass}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[#f5f5f5] text-lg font-semibold">{t("slo.onCallIncidentPool")}</h2>
          <p className="text-xs text-[#ababab]">
            {incidentPagination.total ?? incidents.length} {t("slo.incidents")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <select
            className={inputClass}
            value={incidentFilter.status}
            onChange={(e) => setIncidentFilter((prev) => ({ ...prev, status: e.target.value }))}
          >
            <option value="OPEN,ACKED">{t("slo.openAcked")}</option>
            <option value="OPEN">{t("slo.openOnly")}</option>
            <option value="ACKED">{t("slo.ackedOnly")}</option>
            <option value="RESOLVED">{t("slo.resolvedOnly")}</option>
            <option value="OPEN,ACKED,RESOLVED">{t("slo.all")}</option>
          </select>
          <select
            className={inputClass}
            value={incidentFilter.severity}
            onChange={(e) => setIncidentFilter((prev) => ({ ...prev, severity: e.target.value }))}
          >
            <option value="">{t("slo.allSeverity")}</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="WARN">WARN</option>
          </select>
        </div>

        <div className="space-y-2 max-h-[360px] overflow-auto">
          {incidents.map((incident) => (
            <div key={incident._id} className="bg-[#1f1f1f] rounded-md p-3 border border-[#333]">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm text-[#f5f5f5] font-semibold">
                  {incident.title} · L{incident.escalationLevel} → {incident.currentTargetRole}
                </p>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] px-2 py-1 rounded ${getHealthClass(
                      incident.severity || "WARN"
                    )}`}
                  >
                    {incident.severity}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-1 rounded ${getIncidentStatusClass(
                      incident.status
                    )}`}
                  >
                    {incident.status}
                  </span>
                </div>
              </div>
              <p className="text-xs text-[#d8d8d8]">{incident.message || "-"}</p>
              <p className="text-xs text-[#ababab] mt-1">
                Code {incident.alertCode} · Open {incident.openMinutes ?? 0}m · First{" "}
                {toDateTime(incident.firstSeenAt)} · Last {toDateTime(incident.lastSeenAt)}
              </p>
              <p className="text-xs text-[#ababab] mt-1">
                Value {incident.value}
                {incident.unit || ""} · Threshold {incident.threshold}
                {incident.unit || ""}
              </p>

              {incident.status !== "RESOLVED" && (
                <div className="flex items-center gap-2 mt-2">
                  {incident.status === "OPEN" && (
                    <button
                      className="text-xs px-2 py-1 rounded bg-[#1f2f4f] text-[#9ac7ff]"
                      disabled={ackIncidentMutation.isPending}
                      onClick={() => {
                        const note = window.prompt("Ack note (optional):", "") || "";
                        ackIncidentMutation.mutate({ id: incident._id, note });
                      }}
                    >
                      {t("slo.ackIncident")}
                    </button>
                  )}
                  <button
                    className="text-xs px-2 py-1 rounded bg-[#2f5a45] text-[#d0ffe8]"
                    disabled={resolveIncidentMutation.isPending}
                    onClick={() => {
                      const note = window.prompt("Resolve note (optional):", "") || "";
                      resolveIncidentMutation.mutate({ id: incident._id, note });
                    }}
                  >
                    {t("slo.resolve")}
                  </button>
                </div>
              )}
            </div>
          ))}
          {incidents.length === 0 && (
            <p className="text-[#ababab] text-sm">{t("slo.noIncidents")}</p>
          )}
        </div>
      </div>

      <div className={panelClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">{t("slo.alertFeed")}</h2>
        <div className="space-y-2 max-h-[420px] overflow-auto">
          {alerts.map((alert, index) => (
            <div
              key={`${alert.code}-${index}`}
              className={`border rounded-md px-3 py-2 ${getAlertClass(alert.severity)}`}
            >
              <div className="flex items-center justify-between text-sm text-[#f5f5f5]">
                <p className="font-semibold">
                  {alert.title} · {alert.severity}
                </p>
                <p className="text-xs text-[#ababab]">
                  {alert.category} · {alert.code}
                </p>
              </div>
              <p className="text-xs text-[#d8d8d8] mt-1">{alert.message}</p>
              <p className="text-xs text-[#ababab] mt-1">
                Value {alert.value}
                {alert.unit || ""} · Threshold {alert.threshold}
                {alert.unit || ""}
              </p>
            </div>
          ))}
          {alerts.length === 0 && (
            <p className="text-[#ababab] text-sm">{t("slo.noAlerts")}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SLOCenter;
