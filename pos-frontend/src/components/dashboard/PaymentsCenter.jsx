import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  getPayments,
  getPaymentStats,
  refundPayment,
  getPaymentReconciliationGaps,
  repairOrderPaymentLink,
  retryVerifyPaymentStripe,
  getRefundApprovals,
  approveRefundApproval,
  rejectRefundApproval,
} from "../../https";

const panelClass = "bg-[#262626] rounded-lg p-4 border border-[#333]";
const inputClass =
  "w-full bg-[#1f1f1f] text-[#f5f5f5] border border-[#3b3b3b] rounded-md px-3 py-2 focus:outline-none";

const getRows = (response) => (Array.isArray(response?.data?.data) ? response.data.data : []);

const truncate = (value, size = 12) => {
  const text = `${value || ""}`;
  if (text.length <= size) {
    return text;
  }
  return `${text.slice(0, size)}...`;
};

const toDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
};

const PaymentsCenter = () => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState({
    status: "",
    verified: "",
    refundStatus: "",
    paymentId: "",
    orderId: "",
  });
  const [refundForm, setRefundForm] = useState({
    paymentId: "",
    amount: "",
    reason: "",
  });
  const [reconciliationForm, setReconciliationForm] = useState({
    orderId: "",
    stripeSessionId: "",
  });

  const paymentsQuery = useQuery({
    queryKey: ["payments", filter],
    queryFn: () =>
      getPayments({
        status: filter.status || undefined,
        verified: filter.verified || undefined,
        refundStatus: filter.refundStatus || undefined,
        paymentId: filter.paymentId || undefined,
        orderId: filter.orderId || undefined,
        limit: 200,
      }),
    refetchInterval: 8000,
  });

  const statsQuery = useQuery({
    queryKey: ["payment-stats", filter],
    queryFn: () =>
      getPaymentStats({
        status: filter.status || undefined,
        verified: filter.verified || undefined,
        refundStatus: filter.refundStatus || undefined,
      }),
    refetchInterval: 10000,
  });

  const reconciliationQuery = useQuery({
    queryKey: ["payment-reconciliation-gaps"],
    queryFn: () => getPaymentReconciliationGaps({ limit: 100 }),
    refetchInterval: 12000,
  });

  const refundApprovalsQuery = useQuery({
    queryKey: ["refund-approvals"],
    queryFn: () => getRefundApprovals({ status: "PENDING", limit: 200 }),
    refetchInterval: 10000,
  });

  const payments = useMemo(() => getRows(paymentsQuery.data), [paymentsQuery.data]);
  const stats = useMemo(() => statsQuery.data?.data?.data || {}, [statsQuery.data]);
  const reconciliation = useMemo(
    () => reconciliationQuery.data?.data?.data || { summary: {}, orderIssues: [], unlinkedPayments: [] },
    [reconciliationQuery.data]
  );
  const approvalRows = useMemo(() => getRows(refundApprovalsQuery.data), [refundApprovalsQuery.data]);

  const onError = (error, fallback) => {
    const message = error?.response?.data?.message || fallback;
    enqueueSnackbar(message, { variant: "error" });
  };

  const invalidatePaymentViews = () => {
    queryClient.invalidateQueries({ queryKey: ["payments"] });
    queryClient.invalidateQueries({ queryKey: ["payment-stats"] });
    queryClient.invalidateQueries({ queryKey: ["payment-reconciliation-gaps"] });
    queryClient.invalidateQueries({ queryKey: ["refund-approvals"] });
  };

  const refundMutation = useMutation({
    mutationFn: refundPayment,
    onSuccess: (response) => {
      const approvalRequired = Boolean(response?.data?.data?.approvalRequired);
      enqueueSnackbar(
        approvalRequired ? "Refund approval request created" : "Refund submitted successfully",
        {
          variant: "success",
        }
      );
      invalidatePaymentViews();
    },
    onError: (error) => onError(error, "Refund failed"),
  });

  const repairMutation = useMutation({
    mutationFn: repairOrderPaymentLink,
    onSuccess: () => {
      enqueueSnackbar("Payment link repaired", { variant: "success" });
      invalidatePaymentViews();
    },
    onError: (error) => onError(error, "Failed to repair payment link"),
  });

  const retryVerifyMutation = useMutation({
    mutationFn: retryVerifyPaymentStripe,
    onSuccess: () => {
      enqueueSnackbar("Payment verify retry completed", { variant: "success" });
      invalidatePaymentViews();
    },
    onError: (error) => onError(error, "Failed to retry payment verification"),
  });

  const approveApprovalMutation = useMutation({
    mutationFn: approveRefundApproval,
    onSuccess: () => {
      enqueueSnackbar("Refund approval submitted", { variant: "success" });
      invalidatePaymentViews();
    },
    onError: (error) => onError(error, "Failed to approve refund request"),
  });

  const rejectApprovalMutation = useMutation({
    mutationFn: rejectRefundApproval,
    onSuccess: () => {
      enqueueSnackbar("Refund approval rejected", { variant: "success" });
      invalidatePaymentViews();
    },
    onError: (error) => onError(error, "Failed to reject refund request"),
  });

  const submitRefund = (paymentId, amount, reason) => {
    const payload = {
      paymentId,
      reason: reason || "",
    };
    if (amount !== undefined && amount !== null && `${amount}`.trim() !== "") {
      payload.amount = Number(amount);
    }
    refundMutation.mutate(payload);
  };

  const summaryCards = [
    {
      label: "Total Payments",
      value: stats.totalPayments ?? 0,
      color: "bg-[#1f2f4f] text-[#9ac7ff]",
    },
    {
      label: "Gross Amount",
      value: `€${(stats.grossAmount ?? 0).toFixed(2)}`,
      color: "bg-[#1f3d2f] text-[#8fe6b2]",
    },
    {
      label: "Refunded",
      value: `€${(stats.refundedAmount ?? 0).toFixed(2)}`,
      color: "bg-[#4e1f1f] text-[#ff8f8f]",
    },
    {
      label: "Net Amount",
      value: `€${(stats.netAmount ?? 0).toFixed(2)}`,
      color: "bg-[#4f431e] text-[#ffd36a]",
    },
    {
      label: "Pending Approvals",
      value: stats.pendingRefundApprovals ?? 0,
      color: "bg-[#2a1f4f] text-[#c8b5ff]",
    },
  ];

  return (
    <div className="container mx-auto py-2 px-6 md:px-4 space-y-4">
      <div className={panelClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">Payment Summary</h2>
        <div className="grid grid-cols-5 gap-3 mb-3">
          {summaryCards.map((card) => (
            <div key={card.label} className={`rounded-md px-3 py-2 ${card.color}`}>
              <p className="text-xs">{card.label}</p>
              <p className="font-semibold text-lg">{card.value}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-[#ababab]">
          Verification Rate: {stats.verificationRate ?? 0}% · Refund Rate: {stats.refundRate ?? 0}%
        </p>
        {(stats.gatewayBreakdown || []).length > 0 && (
          <p className="text-xs text-[#ababab] mt-1">
            Gateways:{" "}
            {(stats.gatewayBreakdown || [])
              .map((row) => `${row.gatewayCode}:${row.count}`)
              .join(" · ")}
          </p>
        )}
      </div>

      <div className={panelClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">Filters</h2>
        <div className="grid grid-cols-5 gap-3">
          <select
            className={inputClass}
            value={filter.status}
            onChange={(e) => setFilter((prev) => ({ ...prev, status: e.target.value }))}
          >
            <option value="">All Status</option>
            {["succeeded", "requires_capture", "pending", "failed", "refunded"].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            className={inputClass}
            value={filter.verified}
            onChange={(e) => setFilter((prev) => ({ ...prev, verified: e.target.value }))}
          >
            <option value="">All Verified</option>
            <option value="true">Verified</option>
            <option value="false">Unverified</option>
          </select>
          <select
            className={inputClass}
            value={filter.refundStatus}
            onChange={(e) => setFilter((prev) => ({ ...prev, refundStatus: e.target.value }))}
          >
            <option value="">All Refund Status</option>
            <option value="NONE">NONE</option>
            <option value="PARTIAL">PARTIAL</option>
            <option value="FULL">FULL</option>
          </select>
          <input
            className={inputClass}
            placeholder="Payment ID"
            value={filter.paymentId}
            onChange={(e) => setFilter((prev) => ({ ...prev, paymentId: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Order/Session ID"
            value={filter.orderId}
            onChange={(e) => setFilter((prev) => ({ ...prev, orderId: e.target.value }))}
          />
        </div>
      </div>

      <div className={panelClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">Manual Refund</h2>
        <form
          className="grid grid-cols-4 gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            submitRefund(
              refundForm.paymentId.trim(),
              refundForm.amount.trim() ? refundForm.amount : undefined,
              refundForm.reason.trim()
            );
          }}
        >
          <input
            className={inputClass}
            placeholder="Payment ID"
            value={refundForm.paymentId}
            onChange={(e) => setRefundForm((prev) => ({ ...prev, paymentId: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Amount (optional)"
            value={refundForm.amount}
            onChange={(e) => setRefundForm((prev) => ({ ...prev, amount: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Reason (optional)"
            value={refundForm.reason}
            onChange={(e) => setRefundForm((prev) => ({ ...prev, reason: e.target.value }))}
          />
          <button
            type="submit"
            className="bg-[#f6b100] text-[#1f1f1f] rounded-md py-2 font-semibold"
            disabled={refundMutation.isPending}
          >
            Submit Refund
          </button>
        </form>
      </div>

      <div className={panelClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">Refund Approvals (Dual Review)</h2>
        <div className="space-y-2 max-h-[260px] overflow-auto">
          {approvalRows.map((row, index) => {
            const approval = row.approval || {};
            const approvedCount = Array.isArray(approval.approvals) ? approval.approvals.length : 0;
            return (
              <div
                key={`${row.paymentId}-${approval.approvalId || index}`}
                className="bg-[#1f1f1f] rounded-md px-3 py-2 border border-[#333]"
              >
                <div className="flex items-center justify-between text-sm text-[#f5f5f5]">
                  <p className="font-semibold">
                    {truncate(row.paymentId, 20)} · {approval.status}
                  </p>
                  <p>{toDateTime(approval.requestedAt)}</p>
                </div>
                <div className="text-xs text-[#ababab] mt-1">
                  Approval {truncate(approval.approvalId, 18)} · Amount €
                  {Number(approval.amount || 0).toFixed(2)} · Progress {approvedCount}/
                  {Number(approval.requiredApprovals || 2)}
                </div>
                <div className="text-xs text-[#ababab] mt-1">
                  Requested By {approval.requestedByRole || "Unknown"} · Reason{" "}
                  {approval.reason || "-"}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    className="text-xs px-2 py-1 rounded bg-[#2f5a45] text-[#d0ffe8]"
                    disabled={approveApprovalMutation.isPending}
                    onClick={() =>
                      approveApprovalMutation.mutate({
                        approvalId: approval.approvalId,
                        paymentId: row.paymentId,
                      })
                    }
                  >
                    Approve
                  </button>
                  <button
                    className="text-xs px-2 py-1 rounded bg-[#5a2f2f] text-[#ffd8d8]"
                    disabled={rejectApprovalMutation.isPending}
                    onClick={() => {
                      const reason = window.prompt("Reject reason (optional):", "") || "";
                      rejectApprovalMutation.mutate({
                        approvalId: approval.approvalId,
                        paymentId: row.paymentId,
                        reason,
                      });
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
          {approvalRows.length === 0 && (
            <p className="text-[#ababab] text-sm">No pending refund approvals.</p>
          )}
        </div>
      </div>

      <div className={panelClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">Reconciliation</h2>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="bg-[#1f1f1f] rounded px-3 py-2 text-xs text-[#f5f5f5]">
            Unlinked Payments: {reconciliation.summary?.unlinkedPayments ?? 0}
          </div>
          <div className="bg-[#1f1f1f] rounded px-3 py-2 text-xs text-[#f5f5f5]">
            Order Issues: {reconciliation.summary?.orderIssues ?? 0}
          </div>
          <div className="bg-[#1f1f1f] rounded px-3 py-2 text-xs text-[#f5f5f5]">
            Last Refresh: {new Date().toLocaleTimeString()}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <input
            className={inputClass}
            placeholder="Order ID (repair link)"
            value={reconciliationForm.orderId}
            onChange={(e) =>
              setReconciliationForm((prev) => ({ ...prev, orderId: e.target.value }))
            }
          />
          <input
            className={inputClass}
            placeholder="Stripe Session ID (retry verify)"
            value={reconciliationForm.stripeSessionId}
            onChange={(e) =>
              setReconciliationForm((prev) => ({ ...prev, stripeSessionId: e.target.value }))
            }
          />
          <div className="flex gap-2">
            <button
              className="w-full bg-[#025cca] text-white rounded-md py-2 text-sm font-semibold"
              onClick={() =>
                repairMutation.mutate({ orderId: reconciliationForm.orderId.trim() })
              }
            >
              Repair Link
            </button>
            <button
              className="w-full bg-[#333] text-[#f5f5f5] rounded-md py-2 text-sm font-semibold"
              onClick={() =>
                retryVerifyMutation.mutate({
                  stripe_session_id: reconciliationForm.stripeSessionId.trim(),
                })
              }
            >
              Retry Verify
            </button>
          </div>
        </div>

        <div className="space-y-1 max-h-[180px] overflow-auto">
          {(reconciliation.orderIssues || []).map((issue, index) => (
            <div
              key={`${issue.orderId}-${issue.issue}-${index}`}
              className="bg-[#1f1f1f] rounded px-3 py-2 text-xs text-[#f5f5f5] border border-[#333]"
            >
              {issue.orderId} · {issue.issue}
              {issue.paymentIntentId ? ` · ${truncate(issue.paymentIntentId, 20)}` : ""}
            </div>
          ))}
          {(reconciliation.orderIssues || []).length === 0 && (
            <p className="text-[#ababab] text-xs">No order reconciliation issues.</p>
          )}
        </div>
      </div>

      <div className={panelClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">Payment Ledger</h2>
        <div className="space-y-2 max-h-[520px] overflow-auto">
          {payments.map((payment) => {
            const remaining = Number(
              (Number(payment.amount || 0) - Number(payment.refundAmountTotal || 0)).toFixed(2)
            );
            const pendingApprovals = (payment.refundApprovals || []).filter(
              (entry) => `${entry.status || ""}`.toUpperCase() === "PENDING"
            ).length;
            return (
              <div
                key={payment._id}
                className="bg-[#1f1f1f] rounded-md px-3 py-2 border border-[#333]"
              >
                <div className="flex items-center justify-between text-sm text-[#f5f5f5]">
                  <p className="font-semibold">
                    {truncate(payment.paymentId, 20)} · {payment.status}
                  </p>
                  <p>{toDateTime(payment.createdAt)}</p>
                </div>
                <div className="text-xs text-[#ababab] mt-1">
                  Session {truncate(payment.orderId, 22)} · Gateway {payment.gatewayCode || "-"} · Method{" "}
                  {payment.method || "card"} · Verified {payment.verified ? "Yes" : "No"} · Refund{" "}
                  {payment.refundStatus || "NONE"}
                </div>
                <div className="text-xs text-[#ababab] mt-1">
                  Amount €{Number(payment.amount || 0).toFixed(2)} · Refunded €
                  {Number(payment.refundAmountTotal || 0).toFixed(2)} · Remaining €
                  {remaining.toFixed(2)}
                </div>
                {pendingApprovals > 0 && (
                  <div className="text-xs text-[#c8b5ff] mt-1">
                    Pending Refund Approvals: {pendingApprovals}
                  </div>
                )}
                {remaining > 0 && payment.verified && (
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      className="text-xs px-2 py-1 rounded bg-[#5a2f2f] text-[#ffd8d8]"
                      onClick={() => {
                        const amountInput = window.prompt(
                          `Refund amount for ${payment.paymentId} (max ${remaining.toFixed(2)}):`,
                          remaining.toFixed(2)
                        );
                        if (amountInput === null) {
                          return;
                        }
                        const reason = window.prompt("Refund reason (optional):", "") || "";
                        submitRefund(payment.paymentId, amountInput, reason);
                      }}
                    >
                      Refund Amount
                    </button>
                    <button
                      className="text-xs px-2 py-1 rounded bg-[#333] text-[#f5f5f5]"
                      onClick={() => submitRefund(payment.paymentId, undefined, "full_refund")}
                    >
                      Refund Full
                    </button>
                    <button
                      className="text-xs px-2 py-1 rounded bg-[#2f4a5a] text-[#d0ecff]"
                      onClick={() =>
                        retryVerifyMutation.mutate({ stripe_session_id: payment.orderId })
                      }
                    >
                      Retry Verify
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {payments.length === 0 && <p className="text-[#ababab] text-sm">No payments found.</p>}
        </div>
      </div>
    </div>
  );
};

export default PaymentsCenter;
