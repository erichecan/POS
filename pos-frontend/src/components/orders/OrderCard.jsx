// 2026-02-26T21:00:00+08:00: i18n
import React from "react";
import { useTranslation } from "react-i18next";
import { FaCheckDouble, FaLongArrowAltRight } from "react-icons/fa";
import { FaCircle } from "react-icons/fa";
import {
  formatDateAndTime,
  formatReadableOrderId,
  getAvatarName,
  getReadableCustomerName,
} from "../../utils/index";

const OrderCard = ({ order, onSelect }) => {
  const { t } = useTranslation();
  const readableName = getReadableCustomerName(
    order?.customerDetails?.name,
    order?.customerDetails?.phone
  );
  const readableOrderId = formatReadableOrderId(order?._id);

  return (
    <div
      className="w-full bg-[#262626] p-4 rounded-lg mb-3 cursor-pointer border border-transparent hover:border-[#555] active:scale-[0.995] transition-transform"
      onClick={() => onSelect?.(order)}
    >
      <div className="flex items-start md:items-center gap-3 md:gap-5">
        <button className="bg-[#f6b100] min-h-[44px] min-w-[44px] px-3 text-xl font-bold rounded-lg">
          {getAvatarName(readableName)}
        </button>
        <div className="flex items-start md:items-center justify-between w-[100%] gap-3">
          <div className="flex flex-col items-start gap-1">
            <h1 className="text-[#f5f5f5] text-lg font-semibold tracking-wide">
              {readableName}
            </h1>
            <p className="text-[#ababab] text-xs md:text-sm">{readableOrderId} / {t("tables.dineIn")}</p>
            <p className="text-[#ababab] text-xs md:text-sm">{t("tables.table")} <FaLongArrowAltRight className="text-[#ababab] ml-2 inline" /> {order.table?.tableNo || "N/A"}</p>
          </div>
          <div className="flex flex-col items-end gap-1 md:gap-2">
            {order.orderStatus === "Ready" ? (
              <>
                <p className="text-green-600 bg-[#2e4a40] px-2 py-1 rounded-lg text-xs md:text-sm">
                  <FaCheckDouble className="inline mr-2" /> {order.orderStatus}
                </p>
                <p className="text-[#ababab] text-xs md:text-sm">
                  <FaCircle className="inline mr-2 text-green-600" /> {t("tables.readyToServe")}
                </p>
              </>
            ) : (
              <>
                <p className="text-yellow-600 bg-[#4a452e] px-2 py-1 rounded-lg text-xs md:text-sm">
                  <FaCircle className="inline mr-2" /> {order.orderStatus}
                </p>
                <p className="text-[#ababab] text-xs md:text-sm">
                  <FaCircle className="inline mr-2 text-yellow-600" /> {t("tables.preparingOrder")}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex justify-between items-center mt-4 text-[#ababab] text-xs md:text-sm gap-2">
        <p className="truncate">{formatDateAndTime(order.orderDate)}</p>
        <p className="text-right">
          {order.items.length} {t("common.items")} · {order.sourceType || "POS"}
          {order.externalOrderId ? ` · ${order.externalOrderId}` : ""}
        </p>
      </div>
      <hr className="w-full mt-4 border-t-1 border-gray-500" />
      <div className="flex items-center justify-between mt-4">
        <h1 className="text-[#f5f5f5] text-lg font-semibold">{t("common.total")}</h1>
        <p className="text-[#f5f5f5] text-lg font-semibold">€{Number(order?.bills?.totalWithTax || 0).toFixed(2)}</p>
      </div>
      <p className="text-xs text-[#8bbcff] mt-2">{t("orders.clickToView")}</p>
    </div>
  );
};

export default OrderCard;
