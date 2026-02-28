// 2026-02-26T21:00:00+08:00: i18n
import React, { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { RiDeleteBin2Fill } from "react-icons/ri";
import { FaRegCopy } from "react-icons/fa6";
import { useDispatch, useSelector } from "react-redux";
import {
  duplicateItem,
  removeItem,
  updateItemModifiers,
  updateItemNote,
  updateItemQuantity,
} from "../../redux/slices/cartSlice";
import { getDefaultCartRowId } from "../../utils";

const getSelectedOptionIdsByGroup = (modifiers = []) => {
  return modifiers.reduce((acc, modifier) => {
    const groupId = `${modifier?.groupId || ""}`.trim();
    const optionId = `${modifier?.optionId || ""}`.trim();
    if (!groupId || !optionId) {
      return acc;
    }
    if (!acc[groupId]) {
      acc[groupId] = new Set();
    }
    acc[groupId].add(optionId);
    return acc;
  }, {});
};

const CartInfo = () => {
  const { t } = useTranslation();
  const cartData = useSelector((state) => state.cart);
  const scrolLRef = useRef();
  const dispatch = useDispatch();

  useEffect(() => {
    if (scrolLRef.current) {
      scrolLRef.current.scrollTo({
        top: scrolLRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [cartData]);

  const selectedMapByItem = useMemo(() => {
    const map = {};
    cartData.forEach((item, index) => {
      const rowId = item?.id || getDefaultCartRowId(item, index);
      map[rowId] = getSelectedOptionIdsByGroup(item.modifiers || []);
    });
    return map;
  }, [cartData]);

  const handleRemove = (itemId) => {
    dispatch(removeItem(itemId));
  };

  const handleDuplicate = (itemId) => {
    dispatch(duplicateItem(itemId));
  };

  const handleQtyDelta = (itemId, currentQty, delta) => {
    const nextQty = Math.min(Math.max(Number(currentQty || 1) + delta, 1), 50);
    dispatch(updateItemQuantity({ id: itemId, quantity: nextQty }));
  };

  const handleNoteChange = (itemId, value) => {
    dispatch(updateItemNote({ id: itemId, note: value }));
  };

  const handleUpdateModifiers = (itemId, item, group, selectedOptionIds) => {
    const groupId = `${group?.id || ""}`.trim();
    if (!groupId) {
      return;
    }

    const optionSet = new Set(Array.isArray(selectedOptionIds) ? selectedOptionIds : []);
    const groupOptions = Array.isArray(group?.options) ? group.options : [];
    const nextGroupModifiers = groupOptions
      .filter((option) => optionSet.has(`${option?.id || ""}`.trim()))
      .map((option) => ({
        groupId,
        groupName: `${group?.name || ""}`.trim(),
        optionId: `${option?.id || ""}`.trim(),
        name: `${option?.name || ""}`.trim(),
        priceDelta: Number(option?.priceDelta || 0),
      }));

    const existing = Array.isArray(item?.modifiers) ? item.modifiers : [];
    const kept = existing.filter((modifier) => `${modifier?.groupId || ""}`.trim() !== groupId);
    dispatch(
      updateItemModifiers({
        id: itemId,
        modifiers: [...kept, ...nextGroupModifiers],
      })
    );
  };

  return (
    <div className="px-4 py-2">
      <h1 className="text-lg text-[#e4e4e4] font-semibold tracking-wide">{t("cart.orderDetails")}</h1>
      <div className="mt-4 overflow-y-scroll scrollbar-hide h-[380px]" ref={scrolLRef}>
        {cartData.length === 0 ? (
          <p className="text-[#ababab] text-sm flex justify-center items-center h-[380px]">
            {t("cart.empty")}
          </p>
        ) : (
          cartData.map((item, index) => {
            const rowId = item?.id || getDefaultCartRowId(item, index);
            const optionGroups = Array.isArray(item.optionGroups) ? item.optionGroups : [];
            const selectedByGroup = selectedMapByItem[rowId] || {};
            return (
              <div key={rowId} className="bg-[#1f1f1f] rounded-lg px-4 py-4 mb-2 space-y-2">
                <div className="flex items-center justify-between">
                  <h1 className="text-[#f5f5f5] font-semibold text-md">{item.name}</h1>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleQtyDelta(rowId, item.quantity, -1)}
                      className="text-[#f5f5f5] bg-[#303030] rounded min-h-[40px] min-w-[40px] px-2"
                    >
                      -
                    </button>
                    <p className="text-[#ababab] font-semibold w-5 text-center">{item.quantity}</p>
                    <button
                      onClick={() => handleQtyDelta(rowId, item.quantity, 1)}
                      className="text-[#f5f5f5] bg-[#303030] rounded min-h-[40px] min-w-[40px] px-2"
                    >
                      +
                    </button>
                  </div>
                </div>

                {optionGroups.length > 0 && (
                  <div className="space-y-2">
                    {optionGroups.map((group) => {
                      const groupId = `${group?.id || ""}`.trim();
                      const options = Array.isArray(group?.options) ? group.options : [];
                      const selectedSet = selectedByGroup[groupId] || new Set();
                      if (!groupId || options.length === 0) {
                        return null;
                      }

                      if (group.type === "multi") {
                        return (
                          <div key={`${rowId}-${groupId}`}>
                            <p className="text-xs text-[#8aa2d6] mb-1">{group.name}</p>
                            <div className="grid grid-cols-2 gap-1">
                              {options.map((option) => {
                                const optionId = `${option?.id || ""}`.trim();
                                const checked = selectedSet.has(optionId);
                                const maxSelect = Number(group?.maxSelect || 0);
                                const disabled =
                                  !checked &&
                                  Number.isInteger(maxSelect) &&
                                  maxSelect > 0 &&
                                  selectedSet.size >= maxSelect;
                                return (
                                  <label key={optionId} className="text-xs text-[#cfd6e6] flex items-center gap-1">
                                    <input
                                      type="checkbox"
                                      disabled={disabled}
                                      checked={checked}
                                      className="min-h-[18px] min-w-[18px]"
                                      onChange={(event) => {
                                        const next = new Set(Array.from(selectedSet));
                                        if (event.target.checked) {
                                          next.add(optionId);
                                        } else {
                                          next.delete(optionId);
                                        }
                                        handleUpdateModifiers(rowId, item, group, Array.from(next));
                                      }}
                                    />
                                    <span>
                                      {option.name}
                                      {Number(option?.priceDelta || 0) > 0
                                        ? ` (+€${Number(option.priceDelta).toFixed(2)})`
                                        : ""}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={`${rowId}-${groupId}`}>
                          <p className="text-xs text-[#8aa2d6] mb-1">{group.name}</p>
                          <select
                            value={Array.from(selectedSet)[0] || ""}
                            onChange={(event) => {
                              const value = `${event.target.value || ""}`.trim();
                              if (!value && group.required) {
                                return;
                              }
                              handleUpdateModifiers(rowId, item, group, value ? [value] : []);
                            }}
                            className="w-full bg-[#2a2a2a] text-[#f5f5f5] rounded px-2 py-1 text-xs outline-none"
                          >
                            {!group.required && <option value="">{t("cart.defaultNote")}</option>}
                            {options.map((option) => (
                              <option key={`${option?.id || ""}`} value={`${option?.id || ""}`}>
                                {option.name}
                                {Number(option?.priceDelta || 0) > 0
                                  ? ` (+€${Number(option.priceDelta).toFixed(2)})`
                                  : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div>
                  <p className="text-xs text-[#8aa2d6] mb-1">{t("cart.remarkLabel")}</p>
                  <input
                    value={item.note || ""}
                    onChange={(event) => handleNoteChange(rowId, event.target.value)}
                    placeholder={t("cart.remarkPlaceholder")}
                    className="w-full bg-[#2a2a2a] text-[#f5f5f5] rounded px-2 py-1 text-xs outline-none"
                  />
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleRemove(rowId)}
                      className="min-h-[40px] min-w-[40px] rounded bg-[#2a2a2a] text-[#ababab] flex items-center justify-center"
                      title={t("cart.deleteRow")}
                    >
                      <RiDeleteBin2Fill size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicate(rowId)}
                      className="text-[#c8d5ee] text-xs bg-[#2a2a2a] rounded min-h-[40px] px-3 py-1 inline-flex items-center gap-1"
                      title={t("cart.duplicateRow")}
                    >
                      <FaRegCopy size={13} />
                      {t("cart.copy")}
                    </button>
                  </div>
                  <p className="text-[#f5f5f5] text-md font-bold">€{Number(item.price || 0).toFixed(2)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CartInfo;
