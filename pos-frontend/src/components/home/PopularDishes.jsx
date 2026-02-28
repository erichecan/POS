// 2026-02-26T21:00:00+08:00: i18n
import React from "react";
import { useTranslation } from "react-i18next";
import { popularDishes } from "../../constants";

const PopularDishes = () => {
  const { t } = useTranslation();
  return (
    <div className="mt-6 px-4 md:px-6">
      <div className="bg-[#1a1a1a] w-full rounded-lg">
        <div className="flex justify-between items-center px-6 py-4">
          <h1 className="text-[#f5f5f5] text-lg font-semibold tracking-wide">
            {t("home.popularDishes")}
          </h1>
          <a href="" className="text-[#025cca] text-sm font-semibold">
            {t("home.viewAll")}
          </a>
        </div>

        <div className="overflow-y-scroll h-[520px] xl:h-[680px] scrollbar-hide pb-4">
          {popularDishes.map((dish) => {
            return (
              <div
                key={dish.id}
                className="flex items-center gap-3 bg-[#1f1f1f] rounded-[15px] px-4 py-3 mt-3 mx-4 md:mx-6"
              >
                <h1 className="text-[#f5f5f5] font-bold text-lg md:text-xl mr-2">{dish.id < 10 ? `0${dish.id}` : dish.id}</h1>
                <img
                  src={dish.image}
                  alt={dish.name}
                  className="w-[50px] h-[50px] rounded-full"
                />
                <div>
                  <h1 className="text-[#f5f5f5] font-semibold tracking-wide">{dish.name}</h1>
                  <p className="text-[#f5f5f5] text-sm font-semibold mt-1">
                    <span className="text-[#ababab]">{t("home.ordersCount")} </span>
                    {dish.numberOfOrders}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PopularDishes;
