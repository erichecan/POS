/**
 * Phase E1 手持 POS - 2026-02-28T15:40:00+08:00
 * 单列大按钮、底部操作栏、扫码点单、适配手机竖屏
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Html5Qrcode } from "html5-qrcode";
import BackButton from "../components/shared/BackButton";
import { resolveTableByToken } from "../https";
import { enqueueSnackbar } from "notistack";
import { updateTable, setCustomer } from "../redux/slices/customerSlice";
import { addItems } from "../redux/slices/cartSlice";
import { menus } from "../constants";
import { MdQrCodeScanner, MdRestaurantMenu, MdShoppingCart, MdAttachMoney } from "react-icons/md";

const HANDHELD_ACTION = {
  SCAN_TABLE: "scan_table",
  SCAN_ITEM: "scan_item",
  MENU: "menu",
  CART: "cart",
};

const HandheldPos = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const customerData = useSelector((state) => state.customer);
  const cartCount = useSelector((state) => state.cart.length);

  const [scanMode, setScanMode] = useState(null);
  const [manualInput, setManualInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef(null);
  const scanRegionRef = useRef(null);

  useEffect(() => {
    document.title = `POS | ${t("handheld.title", "Handheld POS")}`;
  }, [t]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current?.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsScanning(false);
    setScanMode(null);
  }, []);

  const handleDecodedTable = useCallback(
    async (token) => {
      try {
        const res = await resolveTableByToken(token);
        const data = res?.data?.data;
        if (!data?.tableId || !data?.tableNo) {
          enqueueSnackbar(t("handheld.invalidToken", "Invalid or expired table code."), {
            variant: "error",
          });
          return;
        }
        dispatch(
          updateTable({
            table: {
              _id: data.tableId,
              tableNo: data.tableNo,
              seats: data.seats || 4,
            },
          })
        );
        dispatch(
          setCustomer({
            name: `Table ${data.tableNo}`,
            phone: "000000",
            guests: 1,
          })
        );
        enqueueSnackbar(t("handheld.tableLinked", "Table linked. Go to order."), {
          variant: "success",
        });
        stopScanner();
        navigate("/menu");
      } catch (err) {
        enqueueSnackbar(
          err.response?.data?.message || t("handheld.resolveFailed", "Failed to resolve table."),
          { variant: "error" }
        );
      }
    },
    [dispatch, navigate, stopScanner, t]
  );

  const handleDecodedItem = useCallback(
    (decodedText) => {
      const code = `${decodedText}`.trim();
      if (!code) return;

      const flatItems = menus.flatMap((m) =>
        (m.items || []).map((item) => ({
          ...item,
          menuId: m.id,
          menuName: m.name,
        }))
      );
      const match =
        flatItems.find((i) => `${i.id}` === code) ||
        flatItems.find((i) => (i.barcode || i.sku) === code) ||
        flatItems.find((i) => i.name?.toLowerCase().includes(code?.toLowerCase()));

      if (match) {
        const qty = 1;
        const pricePerQty = Number(match.price || 0);
        const cartItem = {
          id: typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `cart-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: match.name,
          basePrice: pricePerQty,
          pricePerQuantity: pricePerQty,
          quantity: qty,
          price: Number((pricePerQty * qty).toFixed(2)),
          note: "",
          optionGroups: match.optionGroups || [],
          modifiers: [],
        };
        dispatch(addItems(cartItem));
        enqueueSnackbar(`${match.name} ${t("handheld.addedToCart", "added to cart")}`, {
          variant: "success",
        });
      } else {
        enqueueSnackbar(t("handheld.itemNotFound", "Item not found."), { variant: "warning" });
      }
      stopScanner();
    },
    [dispatch, stopScanner, t]
  );

  const startTableScan = useCallback(() => {
    setScanMode(HANDHELD_ACTION.SCAN_TABLE);
    setManualInput("");
  }, []);

  const startItemScan = useCallback(() => {
    setScanMode(HANDHELD_ACTION.SCAN_ITEM);
    setManualInput("");
  }, []);

  useEffect(() => {
    if (scanMode !== HANDHELD_ACTION.SCAN_TABLE && scanMode !== HANDHELD_ACTION.SCAN_ITEM) {
      return;
    }

    const config = {
      fps: 8,
      qrbox: { width: 220, height: 220 },
    };

    const html5Qr = new Html5Qrcode("handheld-scan-region");
    scannerRef.current = html5Qr;

    html5Qr
      .start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          if (scanMode === HANDHELD_ACTION.SCAN_TABLE) {
            handleDecodedTable(decodedText);
          } else {
            handleDecodedItem(decodedText);
          }
        },
        () => {}
      )
      .then(() => setIsScanning(true))
      .catch((err) => {
        enqueueSnackbar(
          t("handheld.cameraError", "Camera access denied or not available."),
          { variant: "error" }
        );
        setScanMode(null);
      });

    return () => {
      html5Qr.stop().catch(() => {});
    };
  }, [scanMode, handleDecodedTable, handleDecodedItem, t]);

  const handleManualSubmit = useCallback(() => {
    const text = manualInput.trim();
    if (!text) return;

    if (scanMode === HANDHELD_ACTION.SCAN_TABLE) {
      handleDecodedTable(text);
    } else if (scanMode === HANDHELD_ACTION.SCAN_ITEM) {
      handleDecodedItem(text);
    }
  }, [manualInput, scanMode, handleDecodedTable, handleDecodedItem]);

  const actionButtons = [
    {
      key: HANDHELD_ACTION.SCAN_TABLE,
      label: t("handheld.scanTable", "Scan Table"),
      icon: <MdQrCodeScanner size={32} />,
      onClick: startTableScan,
    },
    {
      key: HANDHELD_ACTION.SCAN_ITEM,
      label: t("handheld.scanItem", "Scan Item"),
      icon: <MdQrCodeScanner size={32} />,
      onClick: startItemScan,
    },
    {
      key: HANDHELD_ACTION.MENU,
      label: t("menu.title", "Menu"),
      icon: <MdRestaurantMenu size={32} />,
      onClick: () => navigate("/menu"),
    },
    {
      key: HANDHELD_ACTION.CART,
      label: `${t("cart.title", "Cart")} (${cartCount})`,
      icon: <MdShoppingCart size={32} />,
      onClick: () => navigate("/menu"),
    },
  ];

  return (
    <section className="bg-[#1f1f1f] min-h-screen safe-area-pb flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0">
        <BackButton />
        <h1 className="text-[#f5f5f5] text-xl font-bold">
          {t("handheld.title", "Handheld POS")}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {customerData?.table && (
          <div className="mb-4 rounded-xl bg-[#262626] border border-[#343434] p-4">
            <p className="text-[#ababab] text-sm">
              {t("tables.table", "Table")}: {customerData.table.tableNo}
            </p>
          </div>
        )}

        {!scanMode ? (
          <div className="grid grid-cols-1 gap-4">
            {actionButtons.map((btn) => (
              <button
                key={btn.key}
                onClick={btn.onClick}
                className="flex items-center gap-4 rounded-xl bg-[#262626] border border-[#343434] p-6 text-left hover:bg-[#2d2d2d] active:scale-[0.98] transition-all min-h-[72px]"
              >
                <span className="text-[#F6B100]">{btn.icon}</span>
                <span className="text-[#f5f5f5] text-lg font-semibold">{btn.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div
              id="handheld-scan-region"
              ref={scanRegionRef}
              className="rounded-xl overflow-hidden bg-black min-h-[240px]"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder={
                  scanMode === HANDHELD_ACTION.SCAN_TABLE
                    ? t("handheld.enterTableCode", "Enter table code")
                    : t("handheld.enterItemCode", "Enter item code / barcode")
                }
                className="flex-1 bg-[#262626] text-[#f5f5f5] border border-[#3b3b3b] rounded-lg px-4 py-3"
              />
              <button
                onClick={handleManualSubmit}
                className="px-4 py-3 rounded-lg bg-[#F6B100] text-[#1f1f1f] font-semibold"
              >
                {t("common.submit", "Submit")}
              </button>
            </div>
            <button
              onClick={stopScanner}
              className="w-full py-3 rounded-lg bg-[#3b3b3b] text-[#f5f5f5] font-semibold"
            >
              {t("handheld.cancelScan", "Cancel")}
            </button>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-[#343434] bg-[#1a1a1a] px-4 py-3 safe-area-pb">
        <div className="flex justify-around">
          <button
            onClick={() => navigate("/tables")}
            className="px-4 py-2 rounded-lg text-[#ababab] text-sm"
          >
            {t("nav.tables", "Tables")}
          </button>
          <button
            onClick={() => navigate("/orders")}
            className="px-4 py-2 rounded-lg text-[#ababab] text-sm"
          >
            {t("nav.orders", "Orders")}
          </button>
          <button
            onClick={() => navigate("/cashier")}
            className="px-4 py-2 rounded-lg text-[#F6B100] text-sm font-semibold"
          >
            <MdAttachMoney size={20} className="inline" /> {t("cashier.title", "Cashier")}
          </button>
        </div>
      </div>
    </section>
  );
};

export default HandheldPos;
