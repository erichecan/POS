import React, { useEffect, useMemo, useState } from "react";
import BackButton from "../components/shared/BackButton";
import BottomNav from "../components/shared/BottomNav";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { MdDashboard, MdTableBar, MdOutlineReorder, MdSettings, MdDevices, MdStorefront } from "react-icons/md";
import { LuLayoutGrid } from "react-icons/lu";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { getReceiptTemplate, upsertReceiptTemplate } from "../https";

const DEFAULT_RECEIPT_TEMPLATE = {
  storeName: "POS Store",
  headerTitle: "Order Receipt",
  footerMessage: "Thank you for your visit.",
  fields: {
    showOrderId: true,
    showOrderDate: true,
    showTableNo: true,
    showCustomerName: true,
    showCustomerPhone: false,
    showGuests: true,
    showItemNotes: true,
    showItemModifiers: true,
    showTaxBreakdown: true,
    showPaymentMethod: true,
  },
};

const More = () => {
  const navigate = useNavigate();
  const { role } = useSelector((state) => state.user);
  const normalizedRole = `${role || ""}`.trim().toLowerCase();
  const isAdmin = normalizedRole === "admin";
  const isCashier = normalizedRole === "cashier";
  const queryClient = useQueryClient();
  const canEditReceiptTemplate = isAdmin || isCashier;
  const [templateDraft, setTemplateDraft] = useState(DEFAULT_RECEIPT_TEMPLATE);

  useEffect(() => {
    document.title = "POS | More";
  }, []);

  const receiptTemplateQuery = useQuery({
    queryKey: ["receipt-template"],
    queryFn: async () => {
      const response = await getReceiptTemplate();
      return response.data?.data || DEFAULT_RECEIPT_TEMPLATE;
    },
  });

  useEffect(() => {
    if (!receiptTemplateQuery.data) {
      return;
    }
    setTemplateDraft({
      ...DEFAULT_RECEIPT_TEMPLATE,
      ...receiptTemplateQuery.data,
      fields: {
        ...DEFAULT_RECEIPT_TEMPLATE.fields,
        ...(receiptTemplateQuery.data?.fields || {}),
      },
    });
  }, [receiptTemplateQuery.data]);

  const saveTemplateMutation = useMutation({
    mutationFn: async () => upsertReceiptTemplate(templateDraft),
    onSuccess: () => {
      enqueueSnackbar("Receipt template updated.", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["receipt-template"] });
    },
    onError: (error) => {
      const message = error.response?.data?.message || "Failed to update receipt template.";
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  const actionItems = useMemo(() => {
    const baseItems = [
      {
        key: "tables",
        label: "Tables",
        description: "View table status, open table, and booked details.",
        icon: <MdTableBar size={22} />,
        route: "/tables",
      },
      {
        key: "orders",
        label: "Orders",
        description: "Track orders and open order detail cards.",
        icon: <MdOutlineReorder size={22} />,
        route: "/orders",
      },
      {
        key: "layout",
        label: "Table Layout",
        description: "Visualize seating map by table and seat capacity.",
        icon: <LuLayoutGrid size={22} />,
        route: "/tables/layout",
      },
    ];

    if (isAdmin) {
      baseItems.unshift({
        key: "vertical-templates",
        label: "Vertical Templates",
        description: "Apply and override store template profile by business type.",
        icon: <MdStorefront size={22} />,
        route: "/dashboard/templates",
      });
      baseItems.unshift({
        key: "hardware-center",
        label: "Hardware Center",
        description: "Configure hardware catalog and per-store hardware bundles.",
        icon: <MdDevices size={22} />,
        route: "/dashboard/hardware",
      });
      baseItems.unshift({
        key: "backend-config",
        label: "Backend Config",
        description: "Manage channels, market profiles, and partner/store mappings.",
        icon: <MdSettings size={22} />,
        route: "/dashboard/channels",
      });
      baseItems.unshift({
        key: "dashboard",
        label: "Dashboard",
        description: "Operational KPI and kitchen/payment monitoring.",
        icon: <MdDashboard size={22} />,
        route: "/dashboard",
      });
    }

    return baseItems;
  }, [isAdmin]);

  const toggleField = (fieldKey) => {
    setTemplateDraft((prev) => ({
      ...prev,
      fields: {
        ...(prev.fields || {}),
        [fieldKey]: !prev?.fields?.[fieldKey],
      },
    }));
  };

  return (
    <section className="bg-[#1f1f1f] h-[calc(100vh-5rem)] overflow-hidden">
      <div className="flex items-center gap-4 px-10 py-4">
        <BackButton />
        <h1 className="text-[#f5f5f5] text-2xl font-bold tracking-wider">More</h1>
      </div>

      <div className="px-10 py-4 overflow-y-auto h-[calc(100%-7rem)] pb-28 space-y-5">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {actionItems.map((item) => (
            <button
              key={item.key}
              onClick={() => navigate(item.route)}
              className="text-left bg-[#262626] border border-[#343434] rounded-xl p-5 hover:bg-[#2d2d2d] transition-colors"
            >
              <div className="flex items-center gap-3 text-[#f5f5f5]">
                <span className="text-[#F6B100]">{item.icon}</span>
                <h2 className="text-lg font-semibold">{item.label}</h2>
              </div>
              <p className="mt-3 text-sm text-[#ababab]">{item.description}</p>
            </button>
          ))}
        </div>

        <div className="bg-[#262626] border border-[#343434] rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[#f5f5f5] text-lg font-semibold">Receipt Template</h2>
              <p className="text-[#ababab] text-sm mt-1">Configure which fields appear in printed receipts.</p>
            </div>
            {canEditReceiptTemplate && (
              <button
                onClick={() => saveTemplateMutation.mutate()}
                disabled={saveTemplateMutation.isPending || receiptTemplateQuery.isLoading}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  saveTemplateMutation.isPending || receiptTemplateQuery.isLoading
                    ? "bg-[#555] text-[#a0a0a0] cursor-not-allowed"
                    : "bg-[#F6B100] text-[#1f1f1f]"
                }`}
              >
                {saveTemplateMutation.isPending ? "Saving..." : "Save Template"}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 mt-4">
            <label className="text-sm text-[#ababab]">
              Store Name
              <input
                disabled={!canEditReceiptTemplate}
                value={templateDraft.storeName || ""}
                onChange={(event) =>
                  setTemplateDraft((prev) => ({ ...prev, storeName: event.target.value.slice(0, 80) }))
                }
                className="mt-1 w-full bg-[#1f1f1f] text-[#f5f5f5] rounded px-3 py-2 outline-none"
              />
            </label>
            <label className="text-sm text-[#ababab]">
              Header Title
              <input
                disabled={!canEditReceiptTemplate}
                value={templateDraft.headerTitle || ""}
                onChange={(event) =>
                  setTemplateDraft((prev) => ({ ...prev, headerTitle: event.target.value.slice(0, 80) }))
                }
                className="mt-1 w-full bg-[#1f1f1f] text-[#f5f5f5] rounded px-3 py-2 outline-none"
              />
            </label>
            <label className="text-sm text-[#ababab]">
              Footer Message
              <input
                disabled={!canEditReceiptTemplate}
                value={templateDraft.footerMessage || ""}
                onChange={(event) =>
                  setTemplateDraft((prev) => ({ ...prev, footerMessage: event.target.value.slice(0, 120) }))
                }
                className="mt-1 w-full bg-[#1f1f1f] text-[#f5f5f5] rounded px-3 py-2 outline-none"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 mt-4">
            {[
              ["showOrderId", "Show Order ID"],
              ["showOrderDate", "Show Date"],
              ["showTableNo", "Show Table"],
              ["showCustomerName", "Show Customer"],
              ["showCustomerPhone", "Show Phone"],
              ["showGuests", "Show Guests"],
              ["showItemNotes", "Show Item Notes"],
              ["showItemModifiers", "Show Item Options"],
              ["showTaxBreakdown", "Show Tax"],
              ["showPaymentMethod", "Show Payment Method"],
            ].map(([fieldKey, label]) => (
              <label key={fieldKey} className="flex items-center gap-2 text-sm text-[#d8d8d8] bg-[#1f1f1f] rounded px-3 py-2">
                <input
                  type="checkbox"
                  disabled={!canEditReceiptTemplate}
                  checked={Boolean(templateDraft?.fields?.[fieldKey])}
                  onChange={() => toggleField(fieldKey)}
                />
                {label}
              </label>
            ))}
          </div>
          {!canEditReceiptTemplate && (
            <p className="text-xs text-[#9f9f9f] mt-3">Read-only for current role.</p>
          )}
        </div>
      </div>

      <BottomNav />
    </section>
  );
};

export default More;
