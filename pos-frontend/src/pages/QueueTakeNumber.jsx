/**
 * Phase C2 排队取号 - 消费者入口
 * 2026-02-28T16:35:00+08:00 扫码或点击取号
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { takeQueueNumber } from "../https";

const QueueTakeNumber = () => {
  const { t } = useTranslation();
  const [queueId, setQueueId] = useState("default");
  const [result, setResult] = useState(null);

  const takeMutation = useMutation({
    mutationFn: (data) => takeQueueNumber(data),
    onSuccess: (res) => {
      setResult(res.data?.data);
      enqueueSnackbar(t("queue.ticketReceived", "Ticket received!"), {
        variant: "success",
      });
    },
    onError: (err) => {
      enqueueSnackbar(
        err.response?.data?.message || t("queue.takeFailed", "Failed to get ticket"),
        { variant: "error" }
      );
    },
  });

  const handleTakeNumber = () => {
    takeMutation.mutate({ queueId, locationId: "default" });
  };

  return (
    <div className="min-h-screen bg-[#1f1f1f] flex flex-col items-center justify-center px-4">
      <h1 className="text-[#f5f5f5] text-2xl font-bold mb-2">
        {t("queue.takeNumber", "Queue - Take Number")}
      </h1>
      <p className="text-[#ababab] mb-8">
        {t("queue.takeSubtitle", "Click to get your queue number")}
      </p>

      {result ? (
        <div className="bg-[#1a1a1a] rounded-2xl p-8 text-center border-2 border-[#f6b100]">
          <p className="text-[#ababab] text-sm mb-2">{t("queue.yourNumber")}</p>
          <p className="text-[#f6b100] text-6xl font-bold">{result.ticketNo}</p>
          <p className="text-[#ababab] text-sm mt-4">
            {t("queue.waitNotice", "Please wait for your number to be called")}
          </p>
        </div>
      ) : (
        <button
          onClick={handleTakeNumber}
          disabled={takeMutation.isPending}
          className="bg-[#f6b100] text-[#1f1f1f] px-12 py-4 rounded-xl text-xl font-bold disabled:opacity-50"
        >
          {takeMutation.isPending
            ? t("common.loading")
            : t("queue.takeNumberBtn", "Take Number")}
        </button>
      )}
    </div>
  );
};

export default QueueTakeNumber;
