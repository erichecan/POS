// 2026-02-26T21:00:00+08:00: i18n
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { menus } from "../../constants";
import { GrRadialSelected } from "react-icons/gr";
import { FaShoppingCart } from "react-icons/fa";
import { useDispatch } from "react-redux";
import { addItems } from "../../redux/slices/cartSlice";

const getCartItemId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const resolveDefaultModifiers = (optionGroups = []) => {
  if (!Array.isArray(optionGroups)) {
    return [];
  }

  const selected = [];
  optionGroups.forEach((group) => {
    const groupId = `${group?.id || ""}`.trim();
    const groupName = `${group?.name || ""}`.trim();
    const options = Array.isArray(group?.options) ? group.options : [];
    if (!groupId || options.length === 0) {
      return;
    }

    if (group.type === "multi") {
      options
        .filter((option) => option?.defaultSelected)
        .forEach((option) => {
          selected.push({
            groupId,
            groupName,
            optionId: `${option?.id || ""}`.trim(),
            name: `${option?.name || ""}`.trim(),
            priceDelta: Number(option?.priceDelta || 0),
          });
        });
      return;
    }

    const preferred = options.find((option) => option?.defaultSelected) || (group.required ? options[0] : null);
    if (!preferred) {
      return;
    }
    selected.push({
      groupId,
      groupName,
      optionId: `${preferred?.id || ""}`.trim(),
      name: `${preferred?.name || ""}`.trim(),
      priceDelta: Number(preferred?.priceDelta || 0),
    });
  });

  return selected;
};

const MenuContainer = () => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(menus[0]);
  const [itemCounts, setItemCounts] = useState({});
  const dispatch = useDispatch();

  const getCountKey = (menuId, itemId) => `${menuId}:${itemId}`;

  const increment = (menuId, itemId) => {
    const key = getCountKey(menuId, itemId);
    setItemCounts((prev) => {
      const nextCount = Math.min((prev[key] || 0) + 1, 4);
      return { ...prev, [key]: nextCount };
    });
  };

  const decrement = (menuId, itemId) => {
    const key = getCountKey(menuId, itemId);
    setItemCounts((prev) => {
      const nextCount = Math.max((prev[key] || 0) - 1, 0);
      return { ...prev, [key]: nextCount };
    });
  };

  const handleAddToCart = (menuId, item) => {
    const key = getCountKey(menuId, item.id);
    const quantity = Number(itemCounts[key] || 0);
    if(!Number.isInteger(quantity) || quantity <= 0) return;

    const {name, price} = item;
    const optionGroups = Array.isArray(item?.optionGroups) ? item.optionGroups : [];
    const modifiers = resolveDefaultModifiers(optionGroups);
    const modifierDelta = Number(
      modifiers.reduce((sum, modifier) => sum + Number(modifier?.priceDelta || 0), 0).toFixed(2)
    );
    const pricePerQuantity = Number((Number(price) + modifierDelta).toFixed(2));
    const newObj = {
      id: getCartItemId(),
      name,
      basePrice: price,
      pricePerQuantity,
      quantity,
      price: Number((pricePerQuantity * quantity).toFixed(2)),
      note: "",
      optionGroups,
      modifiers,
    };

    dispatch(addItems(newObj));
    setItemCounts((prev) => ({ ...prev, [key]: 0 }));
  };


  return (
    <>
      <div className="px-4 md:px-8 xl:px-10 py-4">
        <h2 className="text-[#f5f5f5] font-semibold mb-2">{t("menu.frequentPicks")}</h2>
        <div className="flex flex-wrap gap-2">
          {/* 2026-02-28: 热门推荐改为中餐菜品 */}
          {[
            { menuId: 1, itemName: "夫妻肺片" },
            { menuId: 2, itemName: "宫保鸡丁" },
            { menuId: 5, itemName: "珍珠奶茶" },
          ].map((pick) => {
            const parentMenu = menus.find((menu) => menu.id === pick.menuId);
            const pickedItem = parentMenu?.items?.find((item) => item.name === pick.itemName);
            if (!pickedItem || !parentMenu) {
              return null;
            }
            return (
              <button
                key={pick.itemName}
                onClick={() => {
                  setSelected(parentMenu);
                  const key = getCountKey(parentMenu.id, pickedItem.id);
                  setItemCounts((prev) => ({ ...prev, [key]: Math.max(Number(prev[key] || 0), 1) }));
                }}
                className="text-xs bg-[#2d3f5d] text-[#dcecff] px-3 py-2 min-h-[40px] rounded-lg"
              >
                {pick.itemName}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 px-4 md:px-8 xl:px-10 py-4 w-[100%]">
        {menus.map((menu) => {
          return (
            <div
              key={menu.id}
              className="flex flex-col items-start justify-between p-3 md:p-4 rounded-lg h-[96px] md:h-[100px] cursor-pointer active:scale-[0.99] transition-transform"
              style={{ backgroundColor: menu.bgColor }}
              onClick={() => {
                setSelected(menu);
              }}
            >
              <div className="flex items-center justify-between w-full">
                <h1 className="text-[#f5f5f5] text-lg font-semibold">
                  {menu.icon} {menu.name}
                </h1>
                {selected.id === menu.id && (
                  <GrRadialSelected className="text-white" size={20} />
                )}
              </div>
              <p className="text-[#ababab] text-sm font-semibold">
                {menu.items.length} {t("menu.items")}
              </p>
            </div>
          );
        })}
      </div>

      <hr className="border-[#2a2a2a] border-t-2 mt-4" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 md:gap-4 px-4 md:px-8 xl:px-10 py-4 w-[100%]">
        {selected?.items.map((item) => {
          const countKey = getCountKey(selected.id, item.id);
          const count = itemCounts[countKey] || 0;

          return (
            <div
              key={item.id}
              className="flex flex-col items-start justify-between p-4 rounded-lg min-h-[165px] cursor-pointer hover:bg-[#2a2a2a] bg-[#1a1a1a]"
            >
              <div className="flex items-start justify-between w-full">
                <h1 className="text-[#f5f5f5] text-lg font-semibold">
                  {item.name}
                </h1>
                <button
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleAddToCart(selected.id, item);
                  }}
                  disabled={count <= 0}
                    className={`min-h-[44px] min-w-[44px] p-2 rounded-lg ${
                      count > 0
                        ? "bg-[#2e4a40] text-[#02ca3a]"
                        : "bg-[#3a3a3a] text-[#7b7b7b] cursor-not-allowed"
                  }`}
                >
                  <FaShoppingCart size={20} />
                </button>
              </div>
              <div className="flex items-center justify-between w-full">
                <p className="text-[#f5f5f5] text-xl font-bold">
                  ¥{item.price}
                </p>
                <div className="flex items-center justify-between bg-[#1f1f1f] px-3 py-2 rounded-lg gap-4 min-w-[132px]">
                  <button
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      decrement(selected.id, item.id);
                    }}
                    className="text-yellow-500 text-2xl min-h-[44px] min-w-[32px]"
                  >
                    &minus;
                  </button>
                  <span className="text-white">
                    {count}
                  </span>
                  <button
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      increment(selected.id, item.id);
                    }}
                    className="text-yellow-500 text-2xl min-h-[44px] min-w-[32px]"
                  >
                    &#43;
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default MenuContainer;
