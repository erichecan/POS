/**
 * Phase C2 排队叫号 - 后台管理（叫号/过号）
 * 2026-02-28T16:38:00+08:00 POS 内叫号
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import BackButton from "../components/shared/BackButton";
import BottomNav from "../components/shared/BottomNav";
import { getQueueTickets, updateQueueTicket } from "../https";
import { enqueueSnackbar } from "notistack";

const QueueManage = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queueId = "default";

  const { data: tickets = [] } = useQuery({
    queryKey: ["queue-tickets", queueId, "waiting"],
    queryFn: async () => {
      const res = await getQueueTickets({ queueId, status: "waiting" });
      return res.data?.data || [];
    },
  });

  const { data: missedTickets = [] } = useQuery({
    queryKey: ["queue-tickets", queueId, "missed"],
    queryFn: async () => {
      const res = await getQueueTickets({ queueId, status: "missed" });
      return res.data?.data || [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => updateQueueTicket({ id, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue-tickets", queueId] });
      queryClient.invalidateQueries({ queryKey: ["queue-display", queueId] });
    },
  });

  const handleCall = (ticket) => {
    updateMutation.mutate({ id: ticket._id, status: "called" });
    enqueueSnackbar(t("queue.called", `#${ticket.ticketNo} called`), {
      variant: "success",
    });
  };

  const handleMiss = (ticket) => {
    updateMutation.mutate({ id: ticket._id, status: "missed" });
    enqueueSnackbar(t("queue.missed", `#${ticket.ticketNo} missed`), {
      variant: "info",
    });
  };

  const handleRecall = (ticket) => {
    updateMutation.mutate({ id: ticket._id, status: "called" });
    enqueueSnackbar(t("queue.recalled", `#${ticket.ticketNo} recalled`), {
      variant: "success",
    });
  };

  return (
    <section className="bg-[#1f1f1f] min-h-screen pb-20">
      <div className="flex items-center gap-4 px-4 py-4">
        <BackButton />
        <h1 className="text-[#f5f5f5] text-xl font-bold">
          {t("queue.manage", "Queue Management")}
        </h1>
      </div>

      <div className="px-4 space-y-3">
        {tickets.length === 0 ? (
          <p className="text-[#ababab]">{t("queue.noWaiting", "No one waiting.")}</p>
        ) : (
          [...tickets, ...missedTickets].map((ticket) => (
            <div
              key={ticket._id}
              className="flex justify-between items-center bg-[#262626] rounded-lg p-4"
            >
              <span className="text-[#f6b100] text-2xl font-bold">#{ticket.ticketNo}</span>
              <div className="flex gap-2">
                {ticket.status === "missed" ? (
                  <button
                    onClick={() => handleRecall(ticket)}
                    disabled={updateMutation.isPending}
                    className="px-4 py-2 rounded-lg bg-[#f6b100] text-[#1f1f1f] font-semibold"
                  >
                    {t("queue.recall", "Recall")}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleCall(ticket)}
                      disabled={updateMutation.isPending}
                      className="px-4 py-2 rounded-lg bg-[#02ca3a] text-[#1f1f1f] font-semibold"
                    >
                      {t("queue.call", "Call")}
                    </button>
                    <button
                      onClick={() => handleMiss(ticket)}
                      disabled={updateMutation.isPending}
                      className="px-4 py-2 rounded-lg bg-[#ef4444] text-white font-semibold"
                    >
                      {t("queue.miss", "Miss")}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <BottomNav />
    </section>
  );
};

export default QueueManage;
