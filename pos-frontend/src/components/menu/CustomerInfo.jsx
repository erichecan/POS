// 2026-02-26T21:00:00+08:00: i18n
// 2026-02-28T12:25:00+08:00: PRD 7.22 - operatingModes 差异化展示
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { formatDate, getAvatarName } from "../../utils";
import { updateCustomerDraft } from "../../redux/slices/customerSlice";
import { useVerticalProfile } from "../../contexts/VerticalProfileContext";

const CustomerInfo = () => {
  const { t } = useTranslation();
  const [dateTime, setDateTime] = useState(new Date());
  const [isEditing, setIsEditing] = useState(false);
  const customerData = useSelector((state) => state.customer);
  const dispatch = useDispatch();
  const { resolved } = useVerticalProfile();
  const modes = resolved?.operatingModes || ["DINE_IN"];
  const hasDineIn = modes.includes("DINE_IN");
  const hasTakeaway = modes.includes("TAKEAWAY") || modes.includes("SELF_PICKUP");
  const hasDelivery = modes.includes("DELIVERY");
  const isDineInContext = Boolean(customerData?.table);
  const modeLabel = isDineInContext && hasDineIn
    ? t("customerInfo.dineIn")
    : hasTakeaway
      ? t("customerInfo.takeaway")
      : hasDelivery
        ? t("customerInfo.delivery")
        : t("customerInfo.dineIn");
  const [draft, setDraft] = useState({
    name: customerData.customerName || "",
    phone: customerData.customerPhone || "",
    guests: customerData.guests || 1,
  });

  const saveDraft = () => {
    const guests = Number(draft.guests);
    if (!`${draft.name || ""}`.trim()) {
      return;
    }
    if (!/^\+?[0-9]{6,15}$/.test(`${draft.phone || ""}`.trim())) {
      return;
    }
    if (!Number.isInteger(guests) || guests < 1 || guests > 20) {
      return;
    }

    dispatch(updateCustomerDraft({
      name: `${draft.name || ""}`.trim(),
      phone: `${draft.phone || ""}`.trim(),
      guests,
    }));
    setIsEditing(false);
  };

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex flex-col items-start">
        {!isEditing ? (
          <h1 className="text-md text-[#f5f5f5] font-semibold tracking-wide">
            {customerData.customerName || t("customerInfo.customerName")}
          </h1>
        ) : (
          <input
            value={draft.name}
            onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
            placeholder={t("customerInfo.customerName")}
            className="bg-[#1f1f1f] text-[#f5f5f5] text-sm rounded px-2 py-1 focus:outline-none"
          />
        )}
        <p className="text-xs text-[#ababab] font-medium mt-1">
          #{customerData.orderId || t("customerInfo.na")} / {modeLabel}
        </p>
        {!isEditing ? (
          <>
            <p className="text-xs text-[#ababab] font-medium mt-1">
              {customerData.customerPhone || t("customerInfo.phoneNA")} · {customerData.guests || 0} {t("customerInfo.guests")}
            </p>
            <button
              onClick={() => {
                setDraft({
                  name: customerData.customerName || "",
                  phone: customerData.customerPhone || "",
                  guests: customerData.guests || 1,
                });
                setIsEditing(true);
              }}
              className="text-xs text-[#7eb4ff] mt-1"
            >
              {t("customerInfo.editCustomer")}
            </button>
          </>
        ) : (
          <div className="mt-1 space-y-1">
            <input
              value={draft.phone}
              onChange={(event) => setDraft((prev) => ({ ...prev, phone: event.target.value }))}
              placeholder={t("customerInfo.customerPhone")}
              className="bg-[#1f1f1f] text-[#f5f5f5] text-xs rounded px-2 py-1 focus:outline-none"
            />
            <input
              value={draft.guests}
              onChange={(event) => setDraft((prev) => ({ ...prev, guests: event.target.value }))}
              placeholder={t("customerInfo.guests")}
              className="bg-[#1f1f1f] text-[#f5f5f5] text-xs rounded px-2 py-1 focus:outline-none w-[100px]"
            />
            <div className="flex items-center gap-2">
              <button onClick={saveDraft} className="text-xs text-[#8de8ad]">{t("customerInfo.save")}</button>
              <button onClick={() => setIsEditing(false)} className="text-xs text-[#f0a5a5]">{t("customerInfo.cancel")}</button>
            </div>
          </div>
        )}
        <p className="text-xs text-[#ababab] font-medium mt-2">
          {formatDate(dateTime)}
        </p>
      </div>
      <button className="bg-[#f6b100] p-3 text-xl font-bold rounded-lg">
        {getAvatarName(customerData.customerName) || t("customerInfo.cn")}
      </button>
    </div>
  );
};

export default CustomerInfo;
