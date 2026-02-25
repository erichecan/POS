import React, { useEffect, useMemo, useRef, useState } from "react";
import BackButton from "../components/shared/BackButton";
import BottomNav from "../components/shared/BottomNav";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getTables } from "../https";
import { enqueueSnackbar } from "notistack";

const LAYOUT_STORAGE_KEY = "pos_table_layout_v2";
const ZONES = [
  { id: "ALL", name: "All Zones" },
  { id: "MAIN", name: "Main Hall" },
  { id: "TERRACE", name: "Terrace" },
  { id: "BAR", name: "Bar" },
  { id: "CORNER", name: "Corner" },
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

const TableLayout = () => {
  const floorRef = useRef(null);
  const [layoutMap, setLayoutMap] = useState({});
  const [activeZone, setActiveZone] = useState("ALL");
  const [selectedTableId, setSelectedTableId] = useState("");
  const [draggingTableId, setDraggingTableId] = useState("");
  const [touchPlacementMode, setTouchPlacementMode] = useState(false);

  useEffect(() => {
    document.title = "POS | Table Layout";
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

  const tables = useMemo(() => {
    const rows = Array.isArray(resData?.data?.data) ? resData.data.data : [];
    return [...rows].sort((a, b) => Number(a.tableNo || 0) - Number(b.tableNo || 0));
  }, [resData]);

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

  const handleFloorDrop = (event) => {
    event.preventDefault();
    const tableId = event.dataTransfer.getData("text/table-id") || draggingTableId;
    if (!tableId || !floorRef.current) {
      return;
    }
    const rect = floorRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left - 70;
    const y = event.clientY - rect.top - 45;
    moveTableTo(tableId, x, y);
    setDraggingTableId("");
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
    const size = getShapeSizeBySeats(selectedRow.table?.seats);
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

  return (
    <section className="bg-[#1f1f1f] h-[calc(100vh-5rem)] min-h-[calc(100vh-5rem)] flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-8 xl:px-10 py-4">
        <div className="flex items-center gap-3 md:gap-4">
          <BackButton />
          <div>
            <h1 className="text-[#f5f5f5] text-xl md:text-2xl font-bold tracking-wider">Table Layout</h1>
            <p className="text-sm text-[#ababab]">
              Drag on desktop, or tap table then tap floor on iPad/touch.
            </p>
          </div>
        </div>
        <button
          onClick={resetLayout}
          className="bg-[#353535] hover:bg-[#414141] text-[#f5f5f5] min-h-[44px] px-4 py-2 rounded-lg text-sm"
        >
          Reset Layout
        </button>
      </div>

      <div className="px-4 md:px-8 xl:px-10 pb-24 h-[calc(100%-6rem)] flex flex-col lg:flex-row gap-4 min-h-0">
        <div className="w-full lg:w-[260px] bg-[#252525] rounded-xl border border-[#333] p-3 overflow-y-auto">
          <h2 className="text-[#f5f5f5] font-semibold mb-3">Zones</h2>
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
                {zone.name}
              </button>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-t-[#333]">
            <h3 className="text-[#f5f5f5] text-sm font-semibold mb-2">Selected Table</h3>
            {!selectedTable ? (
              <p className="text-xs text-[#8a8a8a]">Click a table shape to edit zone.</p>
            ) : (
              <div className="space-y-2 text-sm">
                <p className="text-[#d8e6ff]">Table #{selectedTable.tableNo}</p>
                <p className="text-[#ababab]">Seats: {selectedTable.seats}</p>
                <label className="block text-xs text-[#ababab]">Assign Zone</label>
                <select
                  value={layoutMap[selectedTable._id]?.zone || "MAIN"}
                  onChange={(event) => updateSelectedZone(event.target.value)}
                  className="w-full bg-[#1f1f1f] text-[#f5f5f5] px-3 py-2 rounded-lg outline-none"
                >
                  {ZONES.filter((zone) => zone.id !== "ALL").map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
                <div className="pt-2 border-t border-t-[#333] mt-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#ababab]">Touch placement mode</p>
                    <button
                      onClick={() => setTouchPlacementMode((prev) => !prev)}
                      className={`text-xs rounded px-2 py-1 min-h-[36px] ${
                        touchPlacementMode ? "bg-[#2e4a40] text-[#9ef0bb]" : "bg-[#333] text-[#f5f5f5]"
                      }`}
                    >
                      {touchPlacementMode ? "ON" : "OFF"}
                    </button>
                  </div>
                  {touchPlacementMode && (
                    <p className="text-xs text-[#9ec7ff] mt-1">
                      先点中桌子，再点地面放置位置。
                    </p>
                  )}
                </div>
                <div className="pt-2 border-t border-t-[#333]">
                  <p className="text-xs text-[#ababab] mb-2">Fine tune</p>
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
          className="flex-1 min-h-[420px] bg-[#1b1b1b] border border-[#333] rounded-xl relative overflow-hidden"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleFloorDrop}
          onClick={handleFloorTap}
        >
          <div className="absolute inset-0 pointer-events-none opacity-15">
            <div className="w-full h-full bg-[linear-gradient(to_right,#666_1px,transparent_1px),linear-gradient(to_bottom,#666_1px,transparent_1px)] bg-[size:40px_40px]" />
          </div>

          {tableRows.map(({ table, layout }) => {
            const size = getShapeSizeBySeats(table.seats);
            const isBooked = table.status === "Booked";
            const isSelected = `${selectedTableId}` === `${table._id}`;
            const zoneLabel = ZONES.find((zone) => zone.id === layout.zone)?.name || "Main Hall";
            return (
              <div
                key={table._id}
                data-table-shape="true"
                draggable={!touchPlacementMode}
                onDragStart={(event) => {
                  if (touchPlacementMode) {
                    return;
                  }
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
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-2">
                  <p className="text-[#f5f5f5] font-semibold text-sm">#{table.tableNo}</p>
                  <p className="text-[#d5d5d5] text-xs">{table.seats} seats</p>
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
