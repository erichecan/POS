/**
 * 订单操作工具栏：打印、拆分、折扣、附加费、小费、促销等
 * 2026-03-01: iPad 点餐 UX 落地 - 垂直图标栏
 */
import React from "react";
import { useTranslation } from "react-i18next";
import {
  MdPrint,
  MdCallSplit,
  MdPercent,
  MdAttachMoney,
  MdVolunteerActivism,
  MdReceiptLong,
  MdInventory,
  MdCampaign,
} from "react-icons/md";

const OrderActionToolbar = ({
  onPrintCheck,
  onSplit,
  onDiscount,
  onSurcharge,
  onAddTips,
  onTaxExempt,
  onDeposit,
  onPromotion,
  splitActive = false,
  promotionActive = false,
}) => {
  const { t } = useTranslation();
  const actions = [
    { key: "print", icon: MdPrint, label: t("orderActions.printCheck"), onClick: onPrintCheck },
    { key: "split", icon: MdCallSplit, label: t("orderActions.split"), onClick: onSplit, active: splitActive },
    { key: "discount", icon: MdPercent, label: t("orderActions.discount"), onClick: onDiscount },
    { key: "surcharge", icon: MdAttachMoney, label: t("orderActions.surcharge"), onClick: onSurcharge },
    { key: "tips", icon: MdVolunteerActivism, label: t("orderActions.addTips"), onClick: onAddTips },
    { key: "taxExempt", icon: MdReceiptLong, label: t("orderActions.taxExempt"), onClick: onTaxExempt },
    { key: "deposit", icon: MdInventory, label: t("orderActions.deposit"), onClick: onDeposit },
    { key: "promotion", icon: MdCampaign, label: t("orderActions.promotion"), onClick: onPromotion, active: promotionActive },
  ];

  return (
    <div className="flex flex-row flex-wrap gap-2">
      {actions.map(({ key, icon: Icon, label, onClick, active }) => (
        <button
          key={key}
          type="button"
          onClick={() => onClick?.()}
          className={`flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-lg min-w-[48px] text-[10px] font-medium transition-colors ${
            active ? "bg-[#06b6d4] text-[#0f172a]" : "bg-[#262626] text-[#ababab] hover:bg-[#333] hover:text-[#f5f5f5]"
          }`}
          title={label}
        >
          <Icon className="w-4 h-4" />
          <span className="truncate max-w-[56px] leading-tight">{label}</span>
        </button>
      ))}
    </div>
  );
};

export default OrderActionToolbar;
