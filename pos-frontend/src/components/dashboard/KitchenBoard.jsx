// 2026-02-26T21:00:00+08:00: i18n
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  bootstrapKitchenStations,
  getKitchenStations,
  getKitchenTickets,
  getKitchenReplayEvents,
  getKitchenStats,
  updateKitchenTicketStatus,
  updateKitchenTicketPriority,
  updateKitchenTicketItemStatus,
  expediteKitchenTicket,
  handoffKitchenTicket,
} from "../../https";

const panelClass = "bg-[#262626] rounded-lg p-4 border border-[#333]";
const inputClass =
  "w-full bg-[#1f1f1f] text-[#f5f5f5] border border-[#3b3b3b] rounded-md px-3 py-2 focus:outline-none";

const getRows = (response) => (Array.isArray(response?.data?.data) ? response.data.data : []);

const statusButtons = ["NEW", "PREPARING", "READY", "EXPO_CONFIRMED", "SERVED", "CANCELLED"];

const getAlertStyle = (alertLevel) => {
  if (alertLevel === "OVERDUE") {
    return "bg-[#4e1f1f] text-[#ff8f8f]";
  }
  if (alertLevel === "WARNING") {
    return "bg-[#4f431e] text-[#ffd36a]";
  }
  if (alertLevel === "RESOLVED") {
    return "bg-[#1f3d2f] text-[#8fe6b2]";
  }
  return "bg-[#1f2f4f] text-[#9ac7ff]";
};

const toTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
};

const compactPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const text = JSON.stringify(payload);
  if (text.length <= 120) {
    return text;
  }
  return `${text.slice(0, 117)}...`;
};

/** 2026-02-26: initialSection for sub-page filtered view (stations|tickets|replay) */
const KitchenBoard = ({ initialSection }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const showSection = (key) => !initialSection || initialSection === key;
  const [filter, setFilter] = useState({
    locationId: "default",
    status: "",
    stationCode: "",
  });
  const [replayFilter, setReplayFilter] = useState({
    ticketId: "",
    orderId: "",
    eventType: "",
    limit: "100",
  });

  const stationsQuery = useQuery({
    queryKey: ["kitchen-stations", filter.locationId],
    queryFn: () => getKitchenStations({ locationId: filter.locationId }),
    refetchInterval: 10000,
  });

  const ticketsQuery = useQuery({
    queryKey: ["kitchen-tickets", filter],
    queryFn: () =>
      getKitchenTickets({
        locationId: filter.locationId,
        status: filter.status || undefined,
        stationCode: filter.stationCode || undefined,
        limit: 200,
      }),
    refetchInterval: 5000,
  });

  const statsQuery = useQuery({
    queryKey: ["kitchen-stats", filter.locationId],
    queryFn: () => getKitchenStats({ locationId: filter.locationId }),
    refetchInterval: 5000,
  });

  const replayQuery = useQuery({
    queryKey: ["kitchen-replay-events", filter.locationId, replayFilter],
    queryFn: () =>
      getKitchenReplayEvents({
        locationId: filter.locationId,
        ticketId: replayFilter.ticketId || undefined,
        orderId: replayFilter.orderId || undefined,
        eventType: replayFilter.eventType || undefined,
        limit: replayFilter.limit || undefined,
      }),
    refetchInterval: 10000,
  });

  const stations = useMemo(() => getRows(stationsQuery.data), [stationsQuery.data]);
  const tickets = useMemo(() => getRows(ticketsQuery.data), [ticketsQuery.data]);
  const stats = useMemo(() => statsQuery.data?.data?.data || {}, [statsQuery.data]);
  const replayEvents = useMemo(() => getRows(replayQuery.data), [replayQuery.data]);
  const replayMeta = useMemo(() => replayQuery.data?.data?.replay || {}, [replayQuery.data]);

  const onError = (error, fallback) => {
    const message = error?.response?.data?.message || fallback;
    enqueueSnackbar(message, { variant: "error" });
  };

  const invalidateKitchenQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["kitchen-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["kitchen-stats"] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  };

  const bootstrapMutation = useMutation({
    mutationFn: bootstrapKitchenStations,
    onSuccess: () => {
      enqueueSnackbar("Kitchen stations bootstrapped", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["kitchen-stations"] });
    },
    onError: (error) => onError(error, "Failed to bootstrap stations"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: updateKitchenTicketStatus,
    onSuccess: invalidateKitchenQueries,
    onError: (error) => onError(error, "Failed to update ticket status"),
  });

  const updatePriorityMutation = useMutation({
    mutationFn: updateKitchenTicketPriority,
    onSuccess: invalidateKitchenQueries,
    onError: (error) => onError(error, "Failed to update ticket priority"),
  });

  const updateItemStatusMutation = useMutation({
    mutationFn: updateKitchenTicketItemStatus,
    onSuccess: invalidateKitchenQueries,
    onError: (error) => onError(error, "Failed to update item status"),
  });

  const expediteMutation = useMutation({
    mutationFn: expediteKitchenTicket,
    onSuccess: () => {
      enqueueSnackbar("Expedite requested", { variant: "success" });
      invalidateKitchenQueries();
    },
    onError: (error) => onError(error, "Failed to request expedite"),
  });

  const handoffMutation = useMutation({
    mutationFn: handoffKitchenTicket,
    onSuccess: invalidateKitchenQueries,
    onError: (error) => onError(error, "Failed to confirm handoff"),
  });

  const requestExpedite = (ticketId) => {
    const reason = window.prompt("Expedite reason (optional):", "");
    expediteMutation.mutate({ id: ticketId, reason: reason || "" });
  };

  const summaryCards = [
    {
      label: t("kitchen.openTickets"),
      value: stats.openTickets ?? 0,
      color: "bg-[#1f2f4f] text-[#9ac7ff]",
    },
    {
      label: t("kitchen.overdue"),
      value: stats.overdueCount ?? 0,
      color: "bg-[#4e1f1f] text-[#ff8f8f]",
    },
    {
      label: t("kitchen.warning"),
      value: stats.warningCount ?? 0,
      color: "bg-[#4f431e] text-[#ffd36a]",
    },
    {
      label: t("kitchen.avgReadyMin"),
      value: stats.avgReadyMinutes ?? 0,
      color: "bg-[#1f3d2f] text-[#8fe6b2]",
    },
  ];

  return (
    <div className="container mx-auto py-2 px-6 md:px-4 space-y-4">
      {showSection("stations") && (
      <div className={panelClass}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[#f5f5f5] text-lg font-semibold">{t("kitchen.stations")}</h2>
          <button
            className="bg-[#025cca] text-white rounded-md px-3 py-2 text-sm font-semibold"
            onClick={() => bootstrapMutation.mutate({ locationId: filter.locationId })}
          >
            {t("kitchen.bootstrapStations")}
          </button>
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
            value={filter.status}
            onChange={(e) => setFilter((prev) => ({ ...prev, status: e.target.value }))}
          >
            <option value="">{t("kitchen.allStatus")}</option>
            {statusButtons.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <input
            className={inputClass}
            placeholder={t("kitchen.stationCodePlaceholder")}
            value={filter.stationCode}
            onChange={(e) => setFilter((prev) => ({ ...prev, stationCode: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-4 gap-3 mb-3">
          {summaryCards.map((card) => (
            <div key={card.label} className={`rounded-md px-3 py-2 ${card.color}`}>
              <p className="text-xs">{card.label}</p>
              <p className="font-semibold text-lg">{card.value}</p>
            </div>
          ))}
        </div>

        {(stats.queueByStation || []).length > 0 && (
          <div className="text-xs text-[#ababab] mb-3">
            {t("kitchen.queueByStation")}{" "}
            {stats.queueByStation.map((row) => `${row.stationCode}:${row.count}`).join(" · ")}
          </div>
        )}

        {(stats.stationLoad || []).length > 0 && (
          <div className="text-xs text-[#ababab] mb-3">
            {t("kitchen.utilization")}{" "}
            {stats.stationLoad
              .map(
                (row) =>
                  `${row.stationCode}:${Math.round((Number(row.utilization || 0) * 100))}%(${row.queueCount}/${
                    row.maxConcurrentTickets
                  })`
              )
              .join(" · ")}
          </div>
        )}

        <div className="space-y-2">
          {stations.map((station) => (
            <div
              key={station._id}
              className="bg-[#1f1f1f] rounded-md px-3 py-2 text-sm text-[#f5f5f5]"
            >
              {station.code} · {station.displayName} · {station.type} · {station.status}
            </div>
          ))}
          {stations.length === 0 && <p className="text-[#ababab] text-sm">{t("kitchen.noStations")}</p>}
        </div>
      </div>
      )}

      {showSection("tickets") && (
      <div className={panelClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">{t("kitchen.tickets")}</h2>
        <div className="space-y-3 max-h-[680px] overflow-auto">
          {tickets.map((ticket) => (
            <div key={ticket._id} className="bg-[#1f1f1f] rounded-md p-3 border border-[#333]">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[#f5f5f5] text-sm font-semibold">
                  #{ticket._id.slice(-8)} · {ticket.customerName || "Guest"} · {ticket.status}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] px-2 py-1 rounded ${getAlertStyle(
                      ticket?.sla?.alertLevel || "ON_TRACK"
                    )}`}
                  >
                    {ticket?.sla?.alertLevel || "ON_TRACK"}
                  </span>
                  <button
                    className="text-xs bg-[#333] text-[#f5f5f5] px-2 py-1 rounded"
                    onClick={() =>
                      updatePriorityMutation.mutate({
                        id: ticket._id,
                        priority: ticket.priority === "RUSH" ? "NORMAL" : "RUSH",
                      })
                    }
                  >
                    {ticket.priority === "RUSH" ? t("kitchen.setNormal") : t("kitchen.setRush")}
                  </button>
                </div>
              </div>

              <div className="text-xs text-[#ababab] mb-2">
                {ticket.sourceType} · {ticket.fulfillmentType} · SLA {ticket?.sla?.slaMinutes || "-"}m ·
                Elapsed {ticket?.sla?.elapsedMinutes ?? "-"}m · Remaining{" "}
                {ticket?.sla?.remainingMinutes ?? "-"}m
              </div>

              <div className="text-xs text-[#ababab] mb-2">
                Station Mix: {[...new Set((ticket.items || []).map((item) => item.stationCode))].join(", ") || "N/A"}
                {ticket.expediteCount ? ` · Expedite x${ticket.expediteCount}` : ""}
              </div>

              <div className="space-y-1 mb-2">
                {(ticket.items || []).map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between text-sm text-[#f5f5f5] bg-[#262626] rounded px-2 py-1"
                  >
                    <span>
                      {item.name} x{item.quantity} · {item.stationCode} · {item.status}
                    </span>
                    <div className="flex gap-1">
                      {["NEW", "PREPARING", "READY", "CANCELLED"].map((status) => (
                        <button
                          key={status}
                          className={`text-[10px] px-2 py-1 rounded ${
                            item.status === status ? "bg-[#025cca] text-white" : "bg-[#333] text-[#f5f5f5]"
                          }`}
                          onClick={() =>
                            updateItemStatusMutation.mutate({
                              id: ticket._id,
                              itemId: item._id,
                              status,
                            })
                          }
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 mb-2">
                {statusButtons.map((status) => (
                  <button
                    key={status}
                    className={`text-xs px-2 py-1 rounded ${
                      ticket.status === status ? "bg-[#f6b100] text-[#1f1f1f]" : "bg-[#333] text-[#f5f5f5]"
                    }`}
                    onClick={() => updateStatusMutation.mutate({ id: ticket._id, status })}
                  >
                    {status}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  className="text-xs px-2 py-1 rounded bg-[#5a2f2f] text-[#ffd8d8]"
                  onClick={() => requestExpedite(ticket._id)}
                >
                  {t("kitchen.expedite")}
                </button>
                <button
                  className="text-xs px-2 py-1 rounded bg-[#2f4a5a] text-[#d0ecff]"
                  onClick={() => handoffMutation.mutate({ id: ticket._id, stage: "EXPO" })}
                >
                  {t("kitchen.confirmExpo")}
                </button>
                <button
                  className="text-xs px-2 py-1 rounded bg-[#2f5a45] text-[#d0ffe8]"
                  onClick={() => handoffMutation.mutate({ id: ticket._id, stage: "SERVED" })}
                >
                  {t("kitchen.confirmServed")}
                </button>
              </div>
            </div>
          ))}
          {tickets.length === 0 && <p className="text-[#ababab] text-sm">{t("kitchen.noTickets")}</p>}
        </div>
      </div>
      )}

      {showSection("replay") && (
      <div className={panelClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">{t("kitchen.ticketEventReplay")}</h2>
        <div className="grid grid-cols-4 gap-3 mb-3">
          <input
            className={inputClass}
            placeholder={t("kitchen.ticketId")}
            value={replayFilter.ticketId}
            onChange={(e) => setReplayFilter((prev) => ({ ...prev, ticketId: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder={t("kitchen.orderId")}
            value={replayFilter.orderId}
            onChange={(e) => setReplayFilter((prev) => ({ ...prev, orderId: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder={t("kitchen.eventTypes")}
            value={replayFilter.eventType}
            onChange={(e) => setReplayFilter((prev) => ({ ...prev, eventType: e.target.value }))}
          />
          <select
            className={inputClass}
            value={replayFilter.limit}
            onChange={(e) => setReplayFilter((prev) => ({ ...prev, limit: e.target.value }))}
          >
            {["50", "100", "200", "500"].map((value) => (
              <option key={value} value={value}>
                Limit {value}
              </option>
            ))}
          </select>
        </div>

        <p className="text-xs text-[#ababab] mb-2">
          {t("kitchen.replayWindow")} {toTime(replayMeta.firstEventAt)} ~ {toTime(replayMeta.lastEventAt)} · {t("kitchen.hasMore")}{" "}
          {replayMeta.hasMore ? "Yes" : "No"}
        </p>

        <div className="space-y-2 max-h-[280px] overflow-auto">
          {replayEvents.map((event) => (
            <div
              key={event._id}
              className="bg-[#1f1f1f] rounded-md px-3 py-2 border border-[#333] text-xs text-[#f5f5f5]"
            >
              <p className="font-semibold">
                #{event.sequence} · {event.eventType} · {toTime(event.createdAt)}
              </p>
              <p className="text-[#ababab] mt-1">
                Ticket {event.ticketId ? `${event.ticketId}`.slice(-8) : "-"} · Order{" "}
                {event.orderId ? `${event.orderId}`.slice(-8) : "-"} · Actor{" "}
                {event.actorId?.name || event.actorRole || "SYSTEM"}
              </p>
              {compactPayload(event.payload) && (
                <p className="text-[#8fa1b3] mt-1">Payload: {compactPayload(event.payload)}</p>
              )}
            </div>
          ))}
          {replayEvents.length === 0 && (
            <p className="text-[#ababab] text-sm">{t("kitchen.noReplayEvents")}</p>
          )}
        </div>
      </div>
      )}
    </div>
  );
};

export default KitchenBoard;
