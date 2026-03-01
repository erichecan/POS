/**
 * Phase C2 叫号大屏 - 大屏展示当前叫号、等待人数
 * 2026-02-28T16:36:00+08:00
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { getQueueDisplay } from "../https";

const QueueDisplay = () => {
  const { t } = useTranslation();
  const queueId = "default";

  const { data } = useQuery({
    queryKey: ["queue-display", queueId],
    queryFn: async () => {
      const res = await getQueueDisplay({ queueId });
      return res.data?.data;
    },
    refetchInterval: 3000,
  });

  const currentNo = data?.currentNo ?? "—";
  const waitingCount = data?.waitingCount ?? 0;

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-8">
      <h1 className="text-white/80 text-2xl mb-8">
        {t("queue.displayTitle", "Now Serving")}
      </h1>
      <div className="text-[#f6b100] text-[12vw] font-bold tabular-nums">
        {currentNo}
      </div>
      <p className="text-white/60 text-xl mt-8">
        {t("queue.waitingCount", "Waiting")}: {waitingCount}
      </p>
    </div>
  );
};

export default QueueDisplay;
