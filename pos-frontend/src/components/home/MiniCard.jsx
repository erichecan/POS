// 2026-02-26T21:00:00+08:00: i18n
import React from 'react'
import { useTranslation } from "react-i18next";

const MiniCard = ({title, icon, number, footerNum}) => {
  const { t } = useTranslation();
  return (
    <div className='bg-[#1a1a1a] py-5 px-4 md:px-5 rounded-lg flex-1 min-w-0'>
        <div className='flex items-start justify-between'>
            <h1 className='text-[#f5f5f5] text-base md:text-lg font-semibold tracking-wide'>{title}</h1>
            <button className={`${title === t("home.totalEarnings") ? "bg-[#02ca3a]" : "bg-[#f6b100]"} min-h-[44px] min-w-[44px] rounded-lg text-[#f5f5f5] text-xl flex items-center justify-center`}>{icon}</button>
        </div>
        <div>
            <h1 className='text-[#f5f5f5] text-3xl md:text-4xl font-bold mt-5'>{
              title === t("home.totalEarnings") ? `€${number}` : number}</h1>
            <h1 className='text-[#f5f5f5] text-sm md:text-lg mt-2'><span className='text-[#02ca3a]'>{footerNum}%</span> {t("home.thanYesterday")}</h1>
        </div>
    </div>
  )
}

export default MiniCard
