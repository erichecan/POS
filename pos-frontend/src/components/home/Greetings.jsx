// 2026-02-26T21:00:00+08:00: i18n
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

const Greetings = () => {
  const { t } = useTranslation();
  const userData = useSelector(state => state.user);
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${months[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}, ${date.getFullYear()}`;
  };

  const formatTime = (date) =>
    `${String(date.getHours()).padStart(2, "0")}:${String(
      date.getMinutes()
    ).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;

  return (
    <div className="flex flex-wrap justify-between items-start md:items-center gap-3 px-4 md:px-8 mt-5">
      <div>
        <h1 className="text-[#f5f5f5] text-xl md:text-2xl font-semibold tracking-wide">
          {t("home.goodMorning")} {userData.name || "TEST USER"}
        </h1>
        <p className="text-[#ababab] text-sm">
          {t("home.serviceSlogan")} 😀
        </p>
      </div>
      <div>
        <h1 className="text-[#f5f5f5] text-2xl md:text-3xl font-bold tracking-wide w-[130px]">{formatTime(dateTime)}</h1>
        <p className="text-[#ababab] text-sm">{formatDate(dateTime)}</p>
      </div>
    </div>
  );
};

export default Greetings;
