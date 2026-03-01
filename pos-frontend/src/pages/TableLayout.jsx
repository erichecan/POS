import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import BackButton from "../components/shared/BackButton";
import BottomNav from "../components/shared/BottomNav";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addTable, getTables, updateTable, generateTableQrSession } from "../https";
import { enqueueSnackbar } from "notistack";

// 2026-02-24T13:00:00+08:00: 家具面板 - 不同形状桌子/椅子拖拽填满区域，保留新建表单

const LAYOUT_STORAGE_KEY = "pos_table_layout_v2";

/** 可拖拽的桌型/椅型（从面板拖到区域即创建） */
const PALETTE_ITEMS = [
  { id: "round2", shape: "round", seats: 2, labelKey: "tableLayout.round2Seats" },
  { id: "round4", shape: "round", seats: 4, labelKey: "tableLayout.round4Seats" },
  { id: "round6", shape: "round", seats: 6, labelKey: "tableLayout.round6Seats" },
  { id: "square4", shape: "square", seats: 4, labelKey: "tableLayout.square4Seats" },
  { id: "rect6", shape: "long", seats: 6, labelKey: "tableLayout.rect6Seats" },
  { id: "oval4", shape: "oval", seats: 4, labelKey: "tableLayout.oval4Seats" },
  { id: "stool1", shape: "stool", seats: 1, labelKey: "tableLayout.barStool" },
];
const ZONES = [
  { id: "ALL", nameKey: "tableLayout.allZones" },
  { id: "MAIN", nameKey: "tableLayout.mainHall" },
  { id: "TERRACE", nameKey: "tableLayout.terrace" },
  { id: "BAR", nameKey: "tableLayout.bar" },
  { id: "CORNER", nameKey: "tableLayout.corner" },
];

const getDefaultPosition = (index) => {
  const column = index % 6;
  const row = Math.floor(index / 6);
  return {
    x: 40 + column * 180,
    y: 40 + row * 130,
    zone: "MAIN",
  };
};

const getShapeSizeBySeats = (seats) => {
  const seatCount = Number(seats || 1);
  if (seatCount <= 2) {
    return { width: 92, height: 92, radius: "999px" };
  }
  if (seatCount <= 4) {
    return { width: 130, height: 88, radius: "14px" };
  }
  if (seatCount <= 6) {
    return { width: 168, height: 92, radius: "18px" };
  }
  return { width: 220, height: 96, radius: "20px" };
};

const getTableSize = (seats, shape) => {
  const seatCount = Number(seats || 1);
  const base = seatCount <= 2 ? 92 : seatCount <= 4 ? 110 : seatCount <= 6 ? 130 : 150;
  switch (shape) {
    case "round":
      return { width: base, height: base, radius: "999px" };
    case "square":
      return { width: base, height: base, radius: "14px" };
    case "long":
      return { width: Math.round(base * 1.7), height: base - 4, radius: "14px" };
    case "oval":
      return { width: Math.round(base * 1.3), height: Math.round(base * 0.85), radius: "999px" };
    case "stool":
      return { width: 56, height: 56, radius: "999px" };
    default:
      return getShapeSizeBySeats(seats);
  }
};

/** 计算桌子周围椅子/座位的相对位置（用于视觉示意） */
const getChairOffsets = (seats, tableW, tableH, shape) => {
  const n = Math.min(Math.max(Number(seats) || 0, 0), 12);
  if (n <= 0) return [];
  const radius = Math.max(tableW, tableH) * 0.65;
  return Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  });
};

const TableLayout = () => {
  // 2026-02-26T21:00:00+08:00: i18n internationalization
  const { t } = useTranslation();
  const floorRef = useRef(null);
  const [layoutMap, setLayoutMap] = useState({});
  const [activeZone, setActiveZone] = useState("ALL");
  const [selectedTableId, setSelectedTableId] = useState("");
  const [draggingTableId, setDraggingTableId] = useState("");
  const [draggingFromPalette, setDraggingFromPalette] = useState(null); // { shape, seats }
  const [touchPlacementMode, setTouchPlacementMode] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormData, setAddFormData] = useState({ tableNo: "", seats: "4", shape: "round", zone: "MAIN" });
  // 2026-02-28T18:52:00+08:00 Phase B2 - 桌码 QR: { tableId -> { token, tableNo } }
  const [qrSessions, setQrSessions] = useState({});
  const queryClient = useQueryClient();

  useEffect(() => {
    document.title = `POS | ${t("tableLayout.title")}`;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const pointerCoarse = window.matchMedia?.("(pointer: coarse)")?.matches;
    const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    setTouchPlacementMode(Boolean(pointerCoarse || hasTouch));
  }, []);

  const { data: resData, isError } = useQuery({
    queryKey: ["tables-layout"],
    queryFn: async () => {
      return await getTables();
    },
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (isError) {
      enqueueSnackbar("Failed to load table layout.", { variant: "error" });
    }
  }, [isError]);

  const addTableMutation = useMutation({
    mutationFn: (data) => addTable(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables-layout"] });
      enqueueSnackbar("Table created successfully.", { variant: "success" });
    },
    onError: () => {
      enqueueSnackbar("Failed to create table.", { variant: "error" });
    },
  });

  const updateTableMutation = useMutation({
    mutationFn: (data) => updateTable(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables-layout"] });
      enqueueSnackbar("Table updated.", { variant: "success" });
    },
    onError: () => {
      enqueueSnackbar("Failed to update table.", { variant: "error" });
    },
  });

  // 2026-02-28T18:53:00+08:00 Phase B2 - 生成桌码
  const qrSessionMutation = useMutation({
    mutationFn: ({ tableId }) =>
      generateTableQrSession({ tableId, locationId: "default", expiresMinutes: 24 * 60 }),
    onSuccess: (res, { tableId }) => {
      const { token, tableNo } = res?.data?.data || {};
      if (token) {
        setQrSessions((prev) => ({ ...prev, [tableId]: { token, tableNo } }));
        enqueueSnackbar(`QR generated for Table ${tableNo}`, { variant: "success" });
      }
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || "Failed to generate QR";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const tables = useMemo(() => {
    const rows = Array.isArray(resData?.data?.data) ? resData.data.data : [];
    return [...rows].sort((a, b) => Number(a.tableNo || 0) - Number(b.tableNo || 0));
  }, [resData]);

  const nextTableNo = useMemo(() => {
    if (!tables.length) return "1";
    const maxNo = Math.max(...tables.map((t) => Number(t.tableNo || 0)));
    return String(maxNo + 1);
  }, [tables]);

  useEffect(() => {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setLayoutMap(parsed);
      }
    } catch (_error) {
      localStorage.removeItem(LAYOUT_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!tables.length) {
      return;
    }
    setLayoutMap((prev) => {
      const next = { ...prev };
      tables.forEach((table, index) => {
        if (!next[table._id]) {
          next[table._id] = getDefaultPosition(index);
        }
      });
      return next;
    });
  }, [tables]);

  useEffect(() => {
    if (!Object.keys(layoutMap).length) {
      return;
    }
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layoutMap));
  }, [layoutMap]);

  const tableRows = useMemo(() => {
    return tables
      .map((table) => {
        const layout = layoutMap[table._id];
        if (!layout) {
          return null;
        }
        return { table, layout };
      })
      .filter(Boolean)
      .filter((row) => (activeZone === "ALL" ? true : row.layout.zone === activeZone));
  }, [tables, layoutMap, activeZone]);

  const selectedTable = tables.find((table) => `${table._id}` === `${selectedTableId}`);

  const moveTableTo = (tableId, x, y) => {
    setLayoutMap((prev) => {
      const current = prev[tableId] || getDefaultPosition(0);
      return {
        ...prev,
        [tableId]: {
          ...current,
          x: Math.max(0, x),
          y: Math.max(0, y),
        },
      };
    });
  };

  const moveTableBy = (tableId, dx, dy) => {
    if (!tableId) {
      return;
    }
    const current = layoutMap[tableId];
    if (!current) {
      return;
    }
    moveTableTo(tableId, Number(current.x || 0) + dx, Number(current.y || 0) + dy);
  };

  const handleFloorDrop = async (event) => {
    event.preventDefault();
    if (!floorRef.current) return;

    const rect = floorRef.current.getBoundingClientRect();
    const centerX = event.clientX - rect.left;
    const centerY = event.clientY - rect.top;

    const paletteData = event.dataTransfer.getData("application/json");
    if (paletteData) {
      try {
        const { shape, seats } = JSON.parse(paletteData);
        if (shape && seats >= 1 && seats <= 20) {
          const size = getTableSize(seats, shape);
          const x = Math.max(0, centerX - size.width / 2);
          const y = Math.max(0, centerY - size.height / 2);
          const zone = activeZone === "ALL" ? "MAIN" : activeZone;
          try {
            const res = await addTableMutation.mutateAsync({
              tableNo: Number(nextTableNo),
              seats: Number(seats),
            });
            const newTableId = res?.data?.data?._id;
            if (newTableId) {
              setLayoutMap((prev) => ({
                ...prev,
                [newTableId]: { x, y, zone, shape },
              }));
            }
          } catch (_) {
            // mutation onError handles
          }
          setDraggingFromPalette(null);
          return;
        }
      } catch (_) {
        // ignore invalid json
      }
    }

    const tableId = event.dataTransfer.getData("text/table-id") || draggingTableId;
    if (tableId) {
      const size = getTableSize(
        tables.find((t) => t._id === tableId)?.seats || 4,
        layoutMap[tableId]?.shape || "round"
      );
      const x = Math.max(0, centerX - size.width / 2);
      const y = Math.max(0, centerY - size.height / 2);
      moveTableTo(tableId, x, y);
      setDraggingTableId("");
    }
  };

  const handleFloorTap = (event) => {
    if (!touchPlacementMode || !selectedTableId || !floorRef.current) {
      return;
    }
    const tapOnShape = event.target?.closest?.("[data-table-shape='true']");
    if (tapOnShape) {
      return;
    }

    const selectedRow = tableRows.find((row) => `${row.table?._id}` === `${selectedTableId}`);
    if (!selectedRow) {
      return;
    }
    const size = getTableSize(selectedRow.table?.seats, selectedRow.layout?.shape);
    const rect = floorRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left - size.width / 2;
    const y = event.clientY - rect.top - size.height / 2;
    moveTableTo(selectedTableId, x, y);
  };

  const updateSelectedZone = (zoneId) => {
    if (!selectedTable?._id) {
      return;
    }
    setLayoutMap((prev) => {
      const current = prev[selectedTable._id] || getDefaultPosition(0);
      return {
        ...prev,
        [selectedTable._id]: {
          ...current,
          zone: zoneId,
        },
      };
    });
  };

  const resetLayout = () => {
    const resetMap = {};
    tables.forEach((table, index) => {
      resetMap[table._id] = getDefaultPosition(index);
    });
    setLayoutMap(resetMap);
    enqueueSnackbar("Layout reset to default grid.", { variant: "info" });
  };

  const openAddForm = () => {
    setAddFormData({ tableNo: nextTableNo, seats: "4", shape: "round", zone: activeZone === "ALL" ? "MAIN" : activeZone });
    setShowAddForm(true);
  };

  const handleCreateTable = async () => {
    const { tableNo, seats, shape, zone } = addFormData;
    if (!tableNo) {
      enqueueSnackbar("Please enter a table number.", { variant: "warning" });
      return;
    }
    try {
      const res = await addTableMutation.mutateAsync({ tableNo: Number(tableNo), seats: Number(seats) });
      const newTableId = res?.data?.data?._id;
      if (newTableId) {
        setLayoutMap((prev) => ({
          ...prev,
          [newTableId]: { ...getDefaultPosition(tables.length), zone, shape },
        }));
      }
      setShowAddForm(false);
    } catch (_) {
      // handled by mutation onError
    }
  };

  const updateSelectedShape = (shape) => {
    if (!selectedTable?._id) return;
    setLayoutMap((prev) => ({
      ...prev,
      [selectedTable._id]: {
        ...(prev[selectedTable._id] || getDefaultPosition(0)),
        shape,
      },
    }));
  };

  const handleUpdateSeats = (newSeats) => {
    if (!selectedTable?._id) return;
    updateTableMutation.mutate({ tableId: selectedTable._id, seats: Number(newSeats) });
  };

  return (
    <section className="bg-[#1f1f1f] h-[calc(100vh-5rem)] min-h-[calc(100vh-5rem)] flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-8 xl:px-10 py-4">
        <div className="flex items-center gap-3 md:gap-4">
          <BackButton />
          <div>
            <h1 className="text-[#f5f5f5] text-xl md:text-2xl font-bold tracking-wider">{t("tableLayout.title")}</h1>
            <p className="text-sm text-[#ababab]">
              {t("tableLayout.subtitle")}
            </p>
          </div>
        </div>
        <button
          onClick={resetLayout}
          className="bg-[#353535] hover:bg-[#414141] text-[#f5f5f5] min-h-[44px] px-4 py-2 rounded-lg text-sm"
        >
          {t("tableLayout.resetLayout")}
        </button>
      </div>

      <div className="px-4 md:px-8 xl:px-10 pb-24 h-[calc(100%-6rem)] flex flex-col lg:flex-row gap-4 min-h-0">
        <div className="w-full lg:w-[260px] bg-[#252525] rounded-xl border border-[#333] p-3 overflow-y-auto">
          <h2 className="text-[#f5f5f5] font-semibold mb-3">{t("tableLayout.zones")}</h2>
          <div className="space-y-2">
            {ZONES.map((zone) => (
              <button
                key={zone.id}
                onClick={() => setActiveZone(zone.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                  activeZone === zone.id
                    ? "bg-[#2f4f7a] text-[#dfefff]"
                    : "bg-[#1f1f1f] text-[#ababab]"
                }`}
              >
                {t(zone.nameKey)}
              </button>
            ))}
          </div>

          {/* 2026-02-24T13:00:10Z: 家具面板 - 拖拽到区域创建桌台 */}
          <div className="mt-3 pt-3 border-t border-[#333]">
            <h3 className="text-[#f5f5f5] text-sm font-semibold mb-2">{t("tableLayout.furniturePalette")}</h3>
            <p className="text-xs text-[#8a8a8a] mb-2">{t("tableLayout.dragToFloor")}</p>
            <div className="grid grid-cols-2 gap-2">
              {PALETTE_ITEMS.map((item) => {
                const size = getTableSize(item.seats, item.shape);
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/json", JSON.stringify({ shape: item.shape, seats: item.seats }));
                      e.dataTransfer.effectAllowed = "copy";
                      setDraggingFromPalette({ shape: item.shape, seats: item.seats });
                    }}
                    onDragEnd={() => setDraggingFromPalette(null)}
                    className="flex flex-col items-center justify-center cursor-grab active:cursor-grabbing bg-[#1f1f1f] border border-[#444] hover:border-[#F6B100] rounded-lg p-2 min-h-[64px]"
                  >
                    <div
                      className="border border-[#4e8a72] bg-[#2b4f40] flex items-center justify-center"
                      style={{
                        width: Math.min(size.width, 48),
                        height: Math.min(size.height, 48),
                        borderRadius: size.radius,
                      }}
                    >
                      <span className="text-[10px] text-[#e8f5e9] font-medium">{item.seats}</span>
                    </div>
                    <span className="text-[10px] text-[#ababab] mt-1 truncate max-w-full">{t(item.labelKey)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3">
            <button
              onClick={openAddForm}
              className="w-full bg-[#f6b100] hover:bg-[#d99e00] text-[#1f1f1f] font-semibold px-3 py-2 rounded-lg text-sm min-h-[44px]"
            >
              {t("tableLayout.addTable")}
            </button>
          </div>

          {showAddForm && (
            <div className="mt-3 p-3 bg-[#1f1f1f] rounded-lg border border-[#333] space-y-2">
              <h3 className="text-[#f5f5f5] text-sm font-semibold">{t("tableLayout.newTable")}</h3>
              <div>
                <label className="block text-xs text-[#ababab] mb-1">{t("tableLayout.tableNumber")}</label>
                <input
                  type="number"
                  value={addFormData.tableNo}
                  onChange={(e) => setAddFormData((prev) => ({ ...prev, tableNo: e.target.value }))}
                  className="w-full bg-[#252525] text-[#f5f5f5] px-3 py-2 rounded-lg outline-none text-sm"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-xs text-[#ababab] mb-1">{t("tableLayout.seats")}</label>
                <select
                  value={addFormData.seats}
                  onChange={(e) => setAddFormData((prev) => ({ ...prev, seats: e.target.value }))}
                  className="w-full bg-[#252525] text-[#f5f5f5] px-3 py-2 rounded-lg outline-none text-sm"
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="4">4</option>
                  <option value="6">6</option>
                  <option value="8">8</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#ababab] mb-1">{t("tableLayout.shape")}</label>
                <select
                  value={addFormData.shape}
                  onChange={(e) => setAddFormData((prev) => ({ ...prev, shape: e.target.value }))}
                  className="w-full bg-[#252525] text-[#f5f5f5] px-3 py-2 rounded-lg outline-none text-sm"
                >
                  <option value="round">{t("tableLayout.round")}</option>
                  <option value="square">{t("tableLayout.square")}</option>
                  <option value="long">{t("tableLayout.rectangle")}</option>
                  <option value="oval">{t("tableLayout.oval")}</option>
                  <option value="stool">{t("tableLayout.barStool")}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#ababab] mb-1">{t("tableLayout.zone")}</label>
                <select
                  value={addFormData.zone}
                  onChange={(e) => setAddFormData((prev) => ({ ...prev, zone: e.target.value }))}
                  className="w-full bg-[#252525] text-[#f5f5f5] px-3 py-2 rounded-lg outline-none text-sm"
                >
                  {ZONES.filter((z) => z.id !== "ALL").map((z) => (
                    <option key={z.id} value={z.id}>{t(z.nameKey)}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleCreateTable}
                  disabled={addTableMutation.isPending}
                  className="flex-1 bg-[#f6b100] hover:bg-[#d99e00] text-[#1f1f1f] font-semibold px-3 py-2 rounded-lg text-sm min-h-[44px] disabled:opacity-50"
                >
                  {addTableMutation.isPending ? t("common.creating") : t("tableLayout.create")}
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 bg-[#353535] hover:bg-[#414141] text-[#f5f5f5] px-3 py-2 rounded-lg text-sm min-h-[44px]"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-t-[#333]">
            <h3 className="text-[#f5f5f5] text-sm font-semibold mb-2">{t("tableLayout.selectedTable")}</h3>
            {!selectedTable ? (
              <p className="text-xs text-[#8a8a8a]">{t("tableLayout.clickTableToEdit")}</p>
            ) : (
              <div className="space-y-2 text-sm">
                <p className="text-[#d8e6ff]">{t("tables.table")} #{selectedTable.tableNo}</p>
                <div>
                  <label className="block text-xs text-[#ababab] mb-1">{t("tableLayout.seats")}</label>
                  <select
                    value={selectedTable.seats}
                    onChange={(e) => handleUpdateSeats(e.target.value)}
                    className="w-full bg-[#1f1f1f] text-[#f5f5f5] px-3 py-2 rounded-lg outline-none text-sm"
                    disabled={updateTableMutation.isPending}
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="4">4</option>
                    <option value="6">6</option>
                    <option value="8">8</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#ababab] mb-1">{t("tableLayout.shape")}</label>
                  <select
                    value={layoutMap[selectedTable._id]?.shape || ""}
                    onChange={(e) => updateSelectedShape(e.target.value)}
                    className="w-full bg-[#1f1f1f] text-[#f5f5f5] px-3 py-2 rounded-lg outline-none text-sm"
                  >
                    <option value="">{t("tableLayout.shapeAuto")}</option>
                    <option value="round">{t("tableLayout.round")}</option>
                    <option value="square">{t("tableLayout.square")}</option>
                    <option value="long">{t("tableLayout.rectangle")}</option>
                    <option value="oval">{t("tableLayout.oval")}</option>
                    <option value="stool">{t("tableLayout.barStool")}</option>
                  </select>
                </div>
                <label className="block text-xs text-[#ababab]">{t("tableLayout.assignZone")}</label>
                <select
                  value={layoutMap[selectedTable._id]?.zone || "MAIN"}
                  onChange={(event) => updateSelectedZone(event.target.value)}
                  className="w-full bg-[#1f1f1f] text-[#f5f5f5] px-3 py-2 rounded-lg outline-none"
                >
                  {ZONES.filter((zone) => zone.id !== "ALL").map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {t(zone.nameKey)}
                    </option>
                  ))}
                </select>
                <div className="pt-2 border-t border-t-[#333] mt-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#ababab]">{t("tableLayout.touchPlacement")}</p>
                    <button
                      onClick={() => setTouchPlacementMode((prev) => !prev)}
                      className={`text-xs rounded px-2 py-1 min-h-[36px] ${
                        touchPlacementMode ? "bg-[#2e4a40] text-[#9ef0bb]" : "bg-[#333] text-[#f5f5f5]"
                      }`}
                    >
                      {touchPlacementMode ? t("common.on") : t("common.off")}
                    </button>
                  </div>
                  {touchPlacementMode && (
                    <p className="text-xs text-[#9ec7ff] mt-1">
                      {t("tableLayout.touchPlacementHint")}
                    </p>
                  )}
                </div>
                {/* 2026-02-28T18:54:00+08:00 Phase B2 - 桌码 QR */}
                <div className="pt-2 border-t border-t-[#333] mt-2">
                  <p className="text-xs text-[#ababab] mb-2">{t("tableLayout.tableQr") || "Table QR"}</p>
                  <button
                    onClick={() => qrSessionMutation.mutate({ tableId: selectedTable._id })}
                    disabled={qrSessionMutation.isPending}
                    className="w-full bg-[#2e4a40] hover:bg-[#3d5c50] text-[#9ef0bb] px-3 py-2 rounded-lg text-sm min-h-[40px] disabled:opacity-50"
                  >
                    {qrSessionMutation.isPending ? t("common.creating") || "..." : (t("tableLayout.generateQr") || "Generate QR")}
                  </button>
                  {qrSessions[selectedTable._id] && (
                    <div className="mt-2 p-2 bg-[#1a1a1a] rounded-lg flex flex-col items-center">
                      <QRCodeSVG
                        value={`${typeof window !== "undefined" ? window.location.origin : ""}/order/qr?token=${qrSessions[selectedTable._id].token}`}
                        size={120}
                        level="M"
                      />
                      <p className="text-[#8a8a8a] text-xs mt-1">Table {qrSessions[selectedTable._id].tableNo}</p>
                    </div>
                  )}
                </div>
                <div className="pt-2 border-t border-t-[#333]">
                  <p className="text-xs text-[#ababab] mb-2">{t("tableLayout.fineTune")}</p>
                  <div className="grid grid-cols-3 gap-2 max-w-[180px]">
                    <span />
                    <button
                      onClick={() => moveTableBy(selectedTable._id, 0, -10)}
                      className="bg-[#1f1f1f] text-[#f5f5f5] rounded min-h-[36px]"
                    >
                      ↑
                    </button>
                    <span />
                    <button
                      onClick={() => moveTableBy(selectedTable._id, -10, 0)}
                      className="bg-[#1f1f1f] text-[#f5f5f5] rounded min-h-[36px]"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => moveTableBy(selectedTable._id, 0, 10)}
                      className="bg-[#1f1f1f] text-[#f5f5f5] rounded min-h-[36px]"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => moveTableBy(selectedTable._id, 10, 0)}
                      className="bg-[#1f1f1f] text-[#f5f5f5] rounded min-h-[36px]"
                    >
                      →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          ref={floorRef}
          className={`flex-1 min-h-[420px] rounded-xl relative overflow-hidden transition-colors ${
            draggingFromPalette ? "bg-[#1e3329] border-2 border-dashed border-[#4e8a72]" : "bg-[#1b1b1b] border border-[#333]"
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            if (draggingFromPalette) event.dataTransfer.dropEffect = "copy";
          }}
          onDrop={handleFloorDrop}
          onClick={handleFloorTap}
        >
          <div className="absolute inset-0 pointer-events-none opacity-15">
            <div className="w-full h-full bg-[linear-gradient(to_right,#666_1px,transparent_1px),linear-gradient(to_bottom,#666_1px,transparent_1px)] bg-[size:40px_40px]" />
          </div>

          {activeZone !== "ALL" && tableRows.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="text-center p-6">
                <p className="text-[#ababab] text-lg mb-2">{t("tableLayout.emptyZone")}</p>
                <p className="text-[#8a8a8a] text-sm">{t("tableLayout.emptyZoneHint")}</p>
              </div>
            </div>
          )}

          {tableRows.map(({ table, layout }) => {
            const size = getTableSize(table.seats, layout.shape);
            const isBooked = table.status === "Booked";
            const isSelected = `${selectedTableId}` === `${table._id}`;
            const zoneLabel = t(ZONES.find((zone) => zone.id === layout.zone)?.nameKey || "tableLayout.mainHall");
            const chairOffsets = getChairOffsets(table.seats, size.width, size.height, layout.shape);
            const showChairs = table.seats <= 8 && table.seats >= 2 && layout.shape !== "stool";
            return (
              <div
                key={table._id}
                data-table-shape="true"
                draggable={!touchPlacementMode}
                onDragStart={(event) => {
                  if (touchPlacementMode) return;
                  event.dataTransfer.setData("text/table-id", table._id);
                  setDraggingTableId(table._id);
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedTableId(table._id);
                }}
                className={`absolute cursor-move border ${
                  isBooked ? "bg-[#5a4020] border-[#987039]" : "bg-[#2b4f40] border-[#4e8a72]"
                } ${isSelected ? "ring-2 ring-[#F6B100]" : ""}`}
                style={{
                  left: layout.x,
                  top: layout.y,
                  width: `${size.width}px`,
                  height: `${size.height}px`,
                  borderRadius: size.radius,
                }}
              >
                {/* 2026-02-24T13:00:15Z: 椅子/座位示意（小圆点围绕桌边） */}
                {showChairs && (
                  <div className="absolute inset-0 pointer-events-none">
                    {chairOffsets.map((off, idx) => (
                      <div
                        key={idx}
                        className="absolute w-3 h-3 rounded-full bg-[#3d6b5a] border border-[#5a9a82]"
                        style={{
                          left: `calc(50% + ${off.x}px - 6px)`,
                          top: `calc(50% + ${off.y}px - 6px)`,
                        }}
                      />
                    ))}
                  </div>
                )}
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-2 relative z-[1]">
                  <p className="text-[#f5f5f5] font-semibold text-sm">#{table.tableNo}</p>
                  <p className="text-[#d5d5d5] text-xs">{table.seats} {t("tableLayout.seats")}</p>
                  <p className="text-[#c9e5ff] text-[10px] truncate max-w-full">{zoneLabel}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <BottomNav />
    </section>
  );
};

export default TableLayout;
