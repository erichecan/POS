import React from "react";
import { FaCheckDouble, FaLongArrowAltRight } from "react-icons/fa";
import { FaCircle } from "react-icons/fa";
import { getAvatarName } from "../../utils/index";

const OrderList = ({ order }) => {
  return (
    <div className="flex items-start md:items-center gap-3 md:gap-5 mb-3">
      <button className="bg-[#f6b100] min-h-[44px] min-w-[44px] px-3 text-xl font-bold rounded-lg">
        {getAvatarName(order.customerDetails.name)}
      </button>
      <div className="flex items-start md:items-center justify-between w-[100%] gap-2">
        <div className="flex flex-col items-start gap-1">
          <h1 className="text-[#f5f5f5] text-base md:text-lg font-semibold tracking-wide">
            {order.customerDetails.name}
          </h1>
          <p className="text-[#ababab] text-xs md:text-sm">{order.items.length} Items</p>
        </div>

        <h1 className="text-[#f6b100] text-xs md:text-sm font-semibold border border-[#f6b100] rounded-lg px-2 py-1 text-center">
          Table <FaLongArrowAltRight className="text-[#ababab] ml-2 inline" />{" "}
          {order.table?.tableNo || "N/A"}
        </h1>

        <div className="flex flex-col items-end gap-1 md:gap-2">
          {order.orderStatus === "Ready" ? (
            <>
              <p className="text-green-600 text-xs md:text-sm bg-[#2e4a40] px-2 py-1 rounded-lg">
                <FaCheckDouble className="inline mr-2" /> {order.orderStatus}
              </p>
            </>
          ) : (
            <>
              <p className="text-yellow-600 text-xs md:text-sm bg-[#4a452e] px-2 py-1 rounded-lg">
                <FaCircle className="inline mr-2" /> {order.orderStatus}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderList;
