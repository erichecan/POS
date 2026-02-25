import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { formatDate, getAvatarName } from "../../utils";
import { updateCustomerDraft } from "../../redux/slices/customerSlice";

const CustomerInfo = () => {
  const [dateTime, setDateTime] = useState(new Date());
  const [isEditing, setIsEditing] = useState(false);
  const customerData = useSelector((state) => state.customer);
  const dispatch = useDispatch();
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
            {customerData.customerName || "Customer Name"}
          </h1>
        ) : (
          <input
            value={draft.name}
            onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Customer Name"
            className="bg-[#1f1f1f] text-[#f5f5f5] text-sm rounded px-2 py-1 focus:outline-none"
          />
        )}
        <p className="text-xs text-[#ababab] font-medium mt-1">
          #{customerData.orderId || "N/A"} / Dine in
        </p>
        {!isEditing ? (
          <>
            <p className="text-xs text-[#ababab] font-medium mt-1">
              {customerData.customerPhone || "Phone N/A"} · {customerData.guests || 0} Guests
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
              Edit Customer
            </button>
          </>
        ) : (
          <div className="mt-1 space-y-1">
            <input
              value={draft.phone}
              onChange={(event) => setDraft((prev) => ({ ...prev, phone: event.target.value }))}
              placeholder="Customer Phone"
              className="bg-[#1f1f1f] text-[#f5f5f5] text-xs rounded px-2 py-1 focus:outline-none"
            />
            <input
              value={draft.guests}
              onChange={(event) => setDraft((prev) => ({ ...prev, guests: event.target.value }))}
              placeholder="Guests"
              className="bg-[#1f1f1f] text-[#f5f5f5] text-xs rounded px-2 py-1 focus:outline-none w-[100px]"
            />
            <div className="flex items-center gap-2">
              <button onClick={saveDraft} className="text-xs text-[#8de8ad]">Save</button>
              <button onClick={() => setIsEditing(false)} className="text-xs text-[#f0a5a5]">Cancel</button>
            </div>
          </div>
        )}
        <p className="text-xs text-[#ababab] font-medium mt-2">
          {formatDate(dateTime)}
        </p>
      </div>
      <button className="bg-[#f6b100] p-3 text-xl font-bold rounded-lg">
        {getAvatarName(customerData.customerName) || "CN"}
      </button>
    </div>
  );
};

export default CustomerInfo;
