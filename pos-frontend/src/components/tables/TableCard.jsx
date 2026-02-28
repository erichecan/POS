// 2026-02-26T21:00:00+08:00: i18n
import React from "react";
import { useTranslation } from "react-i18next";
import { getAvatarName, getBgColor, getReadableCustomerName } from "../../utils";
import { FaLongArrowAltRight } from "react-icons/fa";

const TableCard = ({ table, onOpen }) => {
  const { t } = useTranslation();
  const id = table?._id;
  const name = table?.tableNo;
  const status = table?.status;
  const seats = table?.seats;
  const customerName = table?.currentOrder?.customerDetails?.name;
  const readableCustomerName = getReadableCustomerName(
    customerName,
    table?.currentOrder?.customerDetails?.phone
  );
  const initials = getAvatarName(readableCustomerName);
  const avatarSeed = `${customerName || ""}-${table?.tableNo || ""}`;

  return (
    <div
      onClick={() => onOpen?.(table)}
      key={id}
      className="w-full hover:bg-[#2c2c2c] bg-[#262626] p-4 rounded-lg cursor-pointer border border-transparent hover:border-[#474747]"
    >
      <div className="flex items-center justify-between px-1">
        <h1 className="text-[#f5f5f5] text-xl font-semibold">{t("tables.table")} <FaLongArrowAltRight className="text-[#ababab] ml-2 inline" /> {name}</h1>
        <p className={`${status === "Booked" ? "text-green-600 bg-[#2e4a40]" : "bg-[#664a04] text-white"} px-2 py-1 rounded-lg`}>
          {status}
        </p>
      </div>
      <div className="flex items-center justify-center mt-5 mb-8">
        <h1
          className={`text-white rounded-full p-5 text-xl`}
          style={{ backgroundColor: initials ? getBgColor(avatarSeed) : "#1f1f1f" }}
        >
          {initials || "N/A"}
        </h1>
      </div>
      <p className="text-[#ababab] text-xs">{t("tables.seats")}: <span className="text-[#f5f5f5]">{seats}</span></p>
      {status === "Booked" && (
        <p className="text-[#d8e6ff] text-sm mt-2 truncate">{readableCustomerName}</p>
      )}
      {status === "Booked" && (
        <p className="text-[#8fd9a8] text-xs mt-2">{t("tables.tapViewBooking")}</p>
      )}
      {status === "Available" && (
        <p className="text-[#f6d27a] text-xs mt-2">{t("tables.tapOpenTable")}</p>
      )}
    </div>
  );
};

export default TableCard;
