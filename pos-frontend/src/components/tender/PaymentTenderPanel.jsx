/**
 * 收银 tender 面板：快捷金额、数字键盘、现金优惠
 * 2026-03-01: iPad 点餐收银 UX 落地
 */
import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

const QUICK_AMOUNTS = [5, 10, 20, 50, 100];
const CASH_DISCOUNT_PERCENT = 5; // 现金可享 5% 优惠

const PaymentTenderPanel = ({
  total,
  onPayCash,
  onPayCard,
  currencySymbol = "€",
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [amountTendered, setAmountTendered] = useState(Number(total || 0).toFixed(2));

  const totalNum = Number(total || 0);
  const cashDiscountAmount = (totalNum * CASH_DISCOUNT_PERCENT) / 100;
  const cashPrice = Math.max(0, totalNum - cashDiscountAmount);

  const appendAmount = useCallback((val) => {
    setAmountTendered((prev) => {
      const str = `${prev}`.replace(/^0(?=\d)/, "");
      if (val === ".") {
        if (str.includes(".")) return prev;
        return str === "" || str === "0" ? "0." : str + ".";
      }
      if (val === "00") return str === "0" ? "0" : str + "00";
      if (val === "0" && str === "0") return "0";
      const next = str === "0" && val !== "." ? val : str + val;
      const parts = next.split(".");
      if (parts.length > 2) return prev;
      if (parts[1]?.length > 2) return prev;
      return next;
    });
  }, []);

  const backspace = useCallback(() => {
    setAmountTendered((prev) => {
      const str = `${prev}`;
      if (str.length <= 1) return "0";
      return str.slice(0, -1);
    });
  }, []);

  const setExact = useCallback(() => {
    setAmountTendered(totalNum.toFixed(2));
  }, [totalNum]);

  const handleQuickAmount = (n) => {
    const current = parseFloat(amountTendered) || 0;
    setAmountTendered((current + n).toFixed(2));
  };

  const num = parseFloat(amountTendered) || 0;

  return (
    <div className="flex flex-col gap-3 text-sm">
      {/* 金额与余额 */}
      <div className="flex justify-between items-center">
        <span className="text-[#ababab]">{t("tender.total")}</span>
        <span className="text-[#f5f5f5] font-bold">
          {currencySymbol}{totalNum.toFixed(2)}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-[#ababab]">{t("tender.balance")}</span>
        <span className="text-[#f5f5f5] font-bold">
          {currencySymbol}{totalNum.toFixed(2)}
        </span>
      </div>

      {/* Amount Tendered */}
      <div>
        <label className="block text-[#ababab] text-xs mb-1">{t("tender.amountTendered")}</label>
        <div className="bg-[#1f1f1f] border border-[#333] rounded-lg px-4 py-3 text-right">
          <span className="text-[#f5f5f5] text-xl font-bold">
            {currencySymbol}{amountTendered}
          </span>
        </div>
      </div>

      {/* 现金优惠 */}
      {CASH_DISCOUNT_PERCENT > 0 && (
        <button
          type="button"
          onClick={() => setAmountTendered(cashPrice.toFixed(2))}
          className="w-full py-2 rounded-lg bg-[#1f3d2f] text-[#8fe6b2] font-semibold border border-[#2e4a40]"
        >
          {t("tender.cashDiscount")} ({CASH_DISCOUNT_PERCENT}%): {currencySymbol}{cashPrice.toFixed(2)}
        </button>
      )}

      {/* 快捷金额 */}
      <div className="flex flex-wrap gap-2">
        {QUICK_AMOUNTS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => handleQuickAmount(n)}
            className="flex-1 min-w-[60px] py-2 rounded-lg bg-[#262626] text-[#f5f5f5] font-semibold border border-[#333] hover:bg-[#333]"
          >
            +{currencySymbol}{n}
          </button>
        ))}
      </div>

      {/* 数字键盘 */}
      <div className="grid grid-cols-4 gap-2">
        {["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "00", "0", "⌫"].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => (key === "⌫" ? backspace() : appendAmount(key))}
            className="py-3 rounded-lg bg-[#262626] text-[#f5f5f5] font-semibold border border-[#333] hover:bg-[#333]"
          >
            {key}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={setExact}
        className="py-2 rounded-lg bg-[#333] text-[#ababab] text-xs font-medium"
      >
        {t("tender.setExact")}
      </button>

      {/* 主操作 */}
      <button
        type="button"
        onClick={() => onPayCash?.({ amountTendered: num })}
        disabled={disabled}
        className="w-full py-4 rounded-lg bg-[#06b6d4] text-[#0f172a] font-bold text-lg disabled:opacity-50"
      >
        {t("tender.payCash")}
      </button>
      <button
        type="button"
        onClick={() => onPayCard?.()}
        disabled
        className="w-full py-3 rounded-lg bg-[#333] text-[#686868] font-semibold cursor-not-allowed"
        title="Enable after Stripe configuration"
      >
        {t("tender.creditCard")}
      </button>
    </div>
  );
};

export default PaymentTenderPanel;
