// 2026-02-26T21:00:00+08:00: i18n
import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FaSearch } from "react-icons/fa";
import OrderList from "./OrderList";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { getOrders } from "../../https/index";

const RecentOrders = () => {
  const { t } = useTranslation();
  const { data: resData, isError } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      return await getOrders();
    },
    placeholderData: keepPreviousData,
  });

  const orders = useMemo(
    () => (Array.isArray(resData?.data?.data) ? resData.data.data : []),
    [resData]
  );

  useEffect(() => {
    if (isError) {
      enqueueSnackbar("Something went wrong!", { variant: "error" });
    }
  }, [isError]);

  return (
    <div className="px-4 md:px-8 mt-6">
      <div className="bg-[#1a1a1a] w-full rounded-lg">
        <div className="flex justify-between items-center px-6 py-4">
          <h1 className="text-[#f5f5f5] text-lg font-semibold tracking-wide">
            {t("home.recentOrders")}
          </h1>
          <a href="" className="text-[#025cca] text-sm font-semibold">
            {t("home.viewAll")}
          </a>
        </div>

        <div className="flex items-center gap-3 bg-[#1f1f1f] rounded-[15px] px-4 py-3 mx-4 md:mx-6">
          <FaSearch className="text-[#f5f5f5]" />
          <input
            type="text"
            placeholder={t("home.searchRecentOrders")}
            className="bg-[#1f1f1f] outline-none text-[#f5f5f5] w-full"
          />
        </div>

        {/* Order list */}
        <div className="mt-4 px-4 md:px-6 overflow-y-scroll h-[300px] scrollbar-hide pb-3">
          {orders.length > 0 ? (
            orders.map((order) => {
              return <OrderList key={order._id} order={order} />;
            })
          ) : (
            <p className="col-span-3 text-gray-500">{t("home.noOrdersAvailable")}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecentOrders;
