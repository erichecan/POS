import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  bootstrapInventory,
  getInventoryItems,
  openCashShift,
  getCashShifts,
  getCashShiftById,
  addCashShiftMovement,
  closeCashShift,
  transferTableOrder,
  mergeTableOrders,
  splitTableOrder,
  splitTableOrderBySeat,
  unmergeTableOrders,
} from "../../https";

const cardClass = "bg-[#262626] rounded-lg p-4 border border-[#333]";
const inputClass =
  "w-full bg-[#1f1f1f] text-[#f5f5f5] border border-[#3b3b3b] rounded-md px-3 py-2 focus:outline-none";

const getRows = (response) => (Array.isArray(response?.data?.data) ? response.data.data : []);

const OperationsCenter = () => {
  const queryClient = useQueryClient();

  const [inventoryForm, setInventoryForm] = useState({
    locationId: "default",
    defaultQuantity: "100",
    lowStockThreshold: "10",
  });
  const [inventoryFilter, setInventoryFilter] = useState({
    locationId: "default",
    onlyLowStock: false,
  });

  const [shiftForm, setShiftForm] = useState({
    locationId: "default",
    openingFloat: "0",
  });
  const [closeShiftForm, setCloseShiftForm] = useState({
    shiftId: "",
    closingCounted: "0",
  });
  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [movementForm, setMovementForm] = useState({
    shiftId: "",
    type: "PAID_IN",
    direction: "IN",
    amount: "",
    reason: "",
  });

  const [transferForm, setTransferForm] = useState({
    fromTableId: "",
    toTableId: "",
  });
  const [mergeForm, setMergeForm] = useState({
    fromTableId: "",
    toTableId: "",
  });
  const [splitForm, setSplitForm] = useState({
    fromTableId: "",
    toTableId: "",
    splitGuests: "",
    itemsJson: '[{"name":"Paneer Tikka","quantity":1}]',
  });
  const [splitBySeatForm, setSplitBySeatForm] = useState({
    fromTableId: "",
    toTableId: "",
    seatNosCsv: "1,2",
  });
  const [unmergeForm, setUnmergeForm] = useState({
    targetOrderId: "",
    sourceOrderId: "",
    restoreTableId: "",
  });

  const inventoryQuery = useQuery({
    queryKey: ["inventory-items", inventoryFilter],
    queryFn: () =>
      getInventoryItems({
        locationId: inventoryFilter.locationId,
        onlyLowStock: inventoryFilter.onlyLowStock ? "true" : "false",
        limit: 200,
      }),
  });

  const shiftsQuery = useQuery({
    queryKey: ["cash-shifts", shiftForm.locationId],
    queryFn: () => getCashShifts({ locationId: shiftForm.locationId, limit: 50 }),
  });

  const shiftDetailQuery = useQuery({
    queryKey: ["cash-shift-detail", selectedShiftId],
    queryFn: () => getCashShiftById(selectedShiftId),
    enabled: Boolean(selectedShiftId),
  });

  const inventoryItems = useMemo(() => getRows(inventoryQuery.data), [inventoryQuery.data]);
  const shifts = useMemo(() => getRows(shiftsQuery.data), [shiftsQuery.data]);
  const selectedShift = useMemo(
    () => shiftDetailQuery.data?.data?.data || null,
    [shiftDetailQuery.data]
  );

  useEffect(() => {
    if (!Array.isArray(shifts) || shifts.length === 0) {
      setSelectedShiftId("");
      return;
    }

    const stillExists = shifts.some((shift) => shift._id === selectedShiftId);
    if (!stillExists) {
      const firstOpen = shifts.find((shift) => shift.status === "OPEN");
      setSelectedShiftId(firstOpen?._id || shifts[0]._id);
    }
  }, [shifts, selectedShiftId]);

  useEffect(() => {
    if (!selectedShiftId) {
      return;
    }

    setMovementForm((prev) => ({
      ...prev,
      shiftId: selectedShiftId,
    }));
  }, [selectedShiftId]);

  const handleError = (error, fallback) => {
    enqueueSnackbar(error?.response?.data?.message || fallback, { variant: "error" });
  };

  const bootstrapMutation = useMutation({
    mutationFn: bootstrapInventory,
    onSuccess: () => {
      enqueueSnackbar("Inventory bootstrapped", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
    },
    onError: (error) => handleError(error, "Failed to bootstrap inventory"),
  });

  const openShiftMutation = useMutation({
    mutationFn: openCashShift,
    onSuccess: () => {
      enqueueSnackbar("Cash shift opened", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["cash-shifts"] });
    },
    onError: (error) => handleError(error, "Failed to open shift"),
  });

  const closeShiftMutation = useMutation({
    mutationFn: closeCashShift,
    onSuccess: () => {
      enqueueSnackbar("Cash shift closed", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["cash-shifts"] });
      queryClient.invalidateQueries({ queryKey: ["cash-shift-detail"] });
      setCloseShiftForm({ shiftId: "", closingCounted: "0" });
    },
    onError: (error) => handleError(error, "Failed to close shift"),
  });

  const movementMutation = useMutation({
    mutationFn: addCashShiftMovement,
    onSuccess: () => {
      enqueueSnackbar("Cash movement recorded", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["cash-shifts"] });
      queryClient.invalidateQueries({ queryKey: ["cash-shift-detail"] });
      setMovementForm((prev) => ({
        ...prev,
        amount: "",
        reason: "",
      }));
    },
    onError: (error) => handleError(error, "Failed to add cash movement"),
  });

  const transferMutation = useMutation({
    mutationFn: transferTableOrder,
    onSuccess: () => {
      enqueueSnackbar("Table transfer completed", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setTransferForm({ fromTableId: "", toTableId: "" });
    },
    onError: (error) => handleError(error, "Failed to transfer table order"),
  });

  const mergeMutation = useMutation({
    mutationFn: mergeTableOrders,
    onSuccess: () => {
      enqueueSnackbar("Table orders merged", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setMergeForm({ fromTableId: "", toTableId: "" });
    },
    onError: (error) => handleError(error, "Failed to merge table orders"),
  });

  const splitMutation = useMutation({
    mutationFn: splitTableOrder,
    onSuccess: () => {
      enqueueSnackbar("Table order split completed", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setSplitForm({
        fromTableId: "",
        toTableId: "",
        splitGuests: "",
        itemsJson: '[{"name":"Paneer Tikka","quantity":1}]',
      });
    },
    onError: (error) => handleError(error, "Failed to split table order"),
  });

  const splitBySeatMutation = useMutation({
    mutationFn: splitTableOrderBySeat,
    onSuccess: () => {
      enqueueSnackbar("Table order split by seat completed", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setSplitBySeatForm({
        fromTableId: "",
        toTableId: "",
        seatNosCsv: "1,2",
      });
    },
    onError: (error) => handleError(error, "Failed to split order by seats"),
  });

  const unmergeMutation = useMutation({
    mutationFn: unmergeTableOrders,
    onSuccess: () => {
      enqueueSnackbar("Table orders unmerged", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setUnmergeForm({
        targetOrderId: "",
        sourceOrderId: "",
        restoreTableId: "",
      });
    },
    onError: (error) => handleError(error, "Failed to unmerge table orders"),
  });

  return (
    <div className="container mx-auto py-2 px-6 md:px-4 space-y-4">
      <div className={cardClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">Inventory Bootstrap</h2>
        <form
          className="grid grid-cols-4 gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            bootstrapMutation.mutate({
              locationId: inventoryForm.locationId,
              defaultQuantity: Number(inventoryForm.defaultQuantity || 0),
              lowStockThreshold: Number(inventoryForm.lowStockThreshold || 0),
            });
          }}
        >
          <input
            className={inputClass}
            placeholder="Location ID"
            value={inventoryForm.locationId}
            onChange={(e) => setInventoryForm((prev) => ({ ...prev, locationId: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Default Qty"
            value={inventoryForm.defaultQuantity}
            onChange={(e) =>
              setInventoryForm((prev) => ({ ...prev, defaultQuantity: e.target.value }))
            }
          />
          <input
            className={inputClass}
            placeholder="Low Stock Threshold"
            value={inventoryForm.lowStockThreshold}
            onChange={(e) =>
              setInventoryForm((prev) => ({ ...prev, lowStockThreshold: e.target.value }))
            }
          />
          <button type="submit" className="bg-[#025cca] text-white rounded-md py-2 font-semibold">
            Bootstrap
          </button>
        </form>
      </div>

      <div className={cardClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">Inventory Snapshot</h2>
        <div className="flex items-center gap-3 mb-3">
          <input
            className={inputClass}
            placeholder="Location ID"
            value={inventoryFilter.locationId}
            onChange={(e) => setInventoryFilter((prev) => ({ ...prev, locationId: e.target.value }))}
          />
          <label className="text-[#f5f5f5] text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={inventoryFilter.onlyLowStock}
              onChange={(e) =>
                setInventoryFilter((prev) => ({ ...prev, onlyLowStock: e.target.checked }))
              }
            />
            Only Low Stock
          </label>
        </div>
        <div className="space-y-2 max-h-[260px] overflow-auto">
          {inventoryItems.map((item) => (
            <div
              key={item._id}
              className="bg-[#1f1f1f] rounded-md px-3 py-2 flex items-center justify-between text-sm"
            >
              <div className="text-[#f5f5f5]">
                {item.displayName} <span className="text-[#ababab]">({item.itemCode})</span>
              </div>
              <div className="text-[#f5f5f5]">
                Qty {item.availableQuantity} · Threshold {item.lowStockThreshold} · {item.status} ·{" "}
                {item.isOutOfStock ? "86" : "On Sale"}
              </div>
            </div>
          ))}
          {inventoryItems.length === 0 && <p className="text-[#ababab] text-sm">No items found.</p>}
        </div>
      </div>

      <div className={cardClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">Cash Shifts</h2>
        <form
          className="grid grid-cols-3 gap-3 mb-4"
          onSubmit={(event) => {
            event.preventDefault();
            openShiftMutation.mutate({
              locationId: shiftForm.locationId,
              openingFloat: Number(shiftForm.openingFloat || 0),
            });
          }}
        >
          <input
            className={inputClass}
            placeholder="Location ID"
            value={shiftForm.locationId}
            onChange={(e) => setShiftForm((prev) => ({ ...prev, locationId: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Opening Float"
            value={shiftForm.openingFloat}
            onChange={(e) => setShiftForm((prev) => ({ ...prev, openingFloat: e.target.value }))}
          />
          <button type="submit" className="bg-[#025cca] text-white rounded-md py-2 font-semibold">
            Open Shift
          </button>
        </form>

        <form
          className="grid grid-cols-3 gap-3 mb-4"
          onSubmit={(event) => {
            event.preventDefault();
            closeShiftMutation.mutate({
              id: closeShiftForm.shiftId || selectedShiftId,
              closingCounted: Number(closeShiftForm.closingCounted || 0),
            });
          }}
        >
          <input
            className={inputClass}
            placeholder="Shift ID"
            value={closeShiftForm.shiftId}
            onChange={(e) => setCloseShiftForm((prev) => ({ ...prev, shiftId: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Closing Counted"
            value={closeShiftForm.closingCounted}
            onChange={(e) =>
              setCloseShiftForm((prev) => ({ ...prev, closingCounted: e.target.value }))
            }
          />
          <button type="submit" className="bg-[#f6b100] text-[#1f1f1f] rounded-md py-2 font-semibold">
            Close Shift
          </button>
        </form>

        <div className="space-y-2 max-h-[220px] overflow-auto">
          {shifts.map((shift) => (
            <div
              key={shift._id}
              className={`bg-[#1f1f1f] rounded-md px-3 py-2 text-sm text-[#f5f5f5] cursor-pointer border ${
                selectedShiftId === shift._id ? "border-[#025cca]" : "border-[#333]"
              }`}
              onClick={() => {
                setSelectedShiftId(shift._id);
                setCloseShiftForm((prev) => ({ ...prev, shiftId: shift._id }));
              }}
            >
              {shift._id} · {shift.locationId} · {shift.status} · Opening {shift.openingFloat}
            </div>
          ))}
          {shifts.length === 0 && <p className="text-[#ababab] text-sm">No shifts found.</p>}
        </div>

        <div className="mt-4 pt-4 border-t border-[#333]">
          <h3 className="text-[#f5f5f5] text-md font-semibold mb-2">Cash Movements</h3>
          <form
            className="grid grid-cols-6 gap-3 mb-3"
            onSubmit={(event) => {
              event.preventDefault();

              const shiftId = movementForm.shiftId || selectedShiftId;
              if (!shiftId) {
                enqueueSnackbar("Please select a shift first.", { variant: "warning" });
                return;
              }

              const payload = {
                id: shiftId,
                type: movementForm.type,
                amount: Number(movementForm.amount || 0),
                reason: movementForm.reason,
              };

              if (movementForm.type === "ADJUSTMENT") {
                payload.direction = movementForm.direction;
              }

              movementMutation.mutate(payload);
            }}
          >
            <input
              className={inputClass}
              placeholder="Shift ID"
              value={movementForm.shiftId}
              onChange={(e) => setMovementForm((prev) => ({ ...prev, shiftId: e.target.value }))}
            />
            <select
              className={inputClass}
              value={movementForm.type}
              onChange={(e) => setMovementForm((prev) => ({ ...prev, type: e.target.value }))}
            >
              <option value="PAID_IN">PAID_IN</option>
              <option value="PAID_OUT">PAID_OUT</option>
              <option value="ADJUSTMENT">ADJUSTMENT</option>
            </select>
            <select
              className={inputClass}
              value={movementForm.direction}
              onChange={(e) => setMovementForm((prev) => ({ ...prev, direction: e.target.value }))}
              disabled={movementForm.type !== "ADJUSTMENT"}
            >
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
            </select>
            <input
              className={inputClass}
              placeholder="Amount"
              value={movementForm.amount}
              onChange={(e) => setMovementForm((prev) => ({ ...prev, amount: e.target.value }))}
            />
            <input
              className={inputClass}
              placeholder="Reason"
              value={movementForm.reason}
              onChange={(e) => setMovementForm((prev) => ({ ...prev, reason: e.target.value }))}
            />
            <button type="submit" className="bg-[#025cca] text-white rounded-md py-2 font-semibold">
              Add Movement
            </button>
          </form>

          {selectedShift && (
            <>
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="bg-[#1f1f1f] rounded px-2 py-1 text-xs text-[#f5f5f5]">
                  Cash Sales: {Number(selectedShift.cashSalesTotal || 0).toFixed(2)}
                </div>
                <div className="bg-[#1f1f1f] rounded px-2 py-1 text-xs text-[#f5f5f5]">
                  Paid In: {Number(selectedShift.paidInTotal || 0).toFixed(2)}
                </div>
                <div className="bg-[#1f1f1f] rounded px-2 py-1 text-xs text-[#f5f5f5]">
                  Paid Out: {Number(selectedShift.paidOutTotal || 0).toFixed(2)}
                </div>
                <div className="bg-[#1f1f1f] rounded px-2 py-1 text-xs text-[#f5f5f5]">
                  Expected Close: {Number(selectedShift.closingExpectedPreview || 0).toFixed(2)}
                </div>
              </div>

              <div className="space-y-1 max-h-[220px] overflow-auto">
                {(selectedShift.movements || []).map((movement) => (
                  <div
                    key={movement._id}
                    className="bg-[#1f1f1f] rounded px-3 py-2 text-xs text-[#f5f5f5] border border-[#333]"
                  >
                    {movement.type} · {movement.direction} · {Number(movement.amount || 0).toFixed(2)} ·{" "}
                    {movement.reason || "-"} · {new Date(movement.createdAt).toLocaleString()}
                  </div>
                ))}
                {(!selectedShift.movements || selectedShift.movements.length === 0) && (
                  <p className="text-[#ababab] text-xs">No cash movements for selected shift.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className={cardClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">Table Transfer</h2>
        <form
          className="grid grid-cols-3 gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            transferMutation.mutate({
              fromTableId: transferForm.fromTableId,
              toTableId: transferForm.toTableId,
            });
          }}
        >
          <input
            className={inputClass}
            placeholder="From Table ID"
            value={transferForm.fromTableId}
            onChange={(e) => setTransferForm((prev) => ({ ...prev, fromTableId: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="To Table ID"
            value={transferForm.toTableId}
            onChange={(e) => setTransferForm((prev) => ({ ...prev, toTableId: e.target.value }))}
          />
          <button type="submit" className="bg-[#025cca] text-white rounded-md py-2 font-semibold">
            Transfer
          </button>
        </form>
      </div>

      <div className={cardClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">Table Merge (Cash Orders)</h2>
        <form
          className="grid grid-cols-3 gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            mergeMutation.mutate({
              fromTableId: mergeForm.fromTableId,
              toTableId: mergeForm.toTableId,
            });
          }}
        >
          <input
            className={inputClass}
            placeholder="Source Table ID"
            value={mergeForm.fromTableId}
            onChange={(e) => setMergeForm((prev) => ({ ...prev, fromTableId: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Target Table ID"
            value={mergeForm.toTableId}
            onChange={(e) => setMergeForm((prev) => ({ ...prev, toTableId: e.target.value }))}
          />
          <button type="submit" className="bg-[#025cca] text-white rounded-md py-2 font-semibold">
            Merge
          </button>
        </form>
        <p className="text-xs text-[#ababab] mt-2">
          Source and target tables must both be booked, and both orders must be active cash dine-in orders.
        </p>
      </div>

      <div className={cardClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">Table Split (Cash Orders)</h2>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();

            let parsedItems;
            try {
              parsedItems = JSON.parse(splitForm.itemsJson);
            } catch (error) {
              enqueueSnackbar("Split items JSON is invalid.", { variant: "error" });
              return;
            }

            if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
              enqueueSnackbar("Split items must be a non-empty JSON array.", { variant: "error" });
              return;
            }

            splitMutation.mutate({
              fromTableId: splitForm.fromTableId,
              toTableId: splitForm.toTableId,
              splitGuests: splitForm.splitGuests ? Number(splitForm.splitGuests) : undefined,
              items: parsedItems,
            });
          }}
        >
          <div className="grid grid-cols-3 gap-3">
            <input
              className={inputClass}
              placeholder="Source Table ID"
              value={splitForm.fromTableId}
              onChange={(e) => setSplitForm((prev) => ({ ...prev, fromTableId: e.target.value }))}
            />
            <input
              className={inputClass}
              placeholder="Target Table ID"
              value={splitForm.toTableId}
              onChange={(e) => setSplitForm((prev) => ({ ...prev, toTableId: e.target.value }))}
            />
            <input
              className={inputClass}
              placeholder="Split Guests (optional)"
              value={splitForm.splitGuests}
              onChange={(e) => setSplitForm((prev) => ({ ...prev, splitGuests: e.target.value }))}
            />
          </div>
          <textarea
            className={`${inputClass} min-h-[110px]`}
            value={splitForm.itemsJson}
            onChange={(e) => setSplitForm((prev) => ({ ...prev, itemsJson: e.target.value }))}
            placeholder='[{"name":"Paneer Tikka","quantity":1}]'
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#ababab]">
              Format: JSON array with item name and quantity. Optional field: pricePerQuantity.
            </p>
            <button type="submit" className="bg-[#025cca] text-white rounded-md py-2 px-4 font-semibold">
              Split
            </button>
          </div>
        </form>
      </div>

      <div className={cardClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">Table Split By Seats</h2>
        <form
          className="grid grid-cols-4 gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const seatNos = `${splitBySeatForm.seatNosCsv || ""}`
              .split(",")
              .map((item) => Number(item.trim()))
              .filter((value) => Number.isInteger(value) && value > 0);

            if (seatNos.length === 0) {
              enqueueSnackbar("Please provide valid seat numbers (e.g. 1,2).", {
                variant: "error",
              });
              return;
            }

            splitBySeatMutation.mutate({
              fromTableId: splitBySeatForm.fromTableId,
              toTableId: splitBySeatForm.toTableId,
              seatNos,
            });
          }}
        >
          <input
            className={inputClass}
            placeholder="Source Table ID"
            value={splitBySeatForm.fromTableId}
            onChange={(e) =>
              setSplitBySeatForm((prev) => ({ ...prev, fromTableId: e.target.value }))
            }
          />
          <input
            className={inputClass}
            placeholder="Target Table ID"
            value={splitBySeatForm.toTableId}
            onChange={(e) =>
              setSplitBySeatForm((prev) => ({ ...prev, toTableId: e.target.value }))
            }
          />
          <input
            className={inputClass}
            placeholder="Seat Nos CSV"
            value={splitBySeatForm.seatNosCsv}
            onChange={(e) =>
              setSplitBySeatForm((prev) => ({ ...prev, seatNosCsv: e.target.value }))
            }
          />
          <button type="submit" className="bg-[#025cca] text-white rounded-md py-2 font-semibold">
            Split By Seat
          </button>
        </form>
        <p className="text-xs text-[#ababab] mt-2">
          Source order items must already contain seatNo tags (e.g. seatNo: 1).
        </p>
      </div>

      <div className={cardClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">Table Unmerge (Reverse Merge)</h2>
        <form
          className="grid grid-cols-4 gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            unmergeMutation.mutate({
              targetOrderId: unmergeForm.targetOrderId,
              sourceOrderId: unmergeForm.sourceOrderId || undefined,
              restoreTableId: unmergeForm.restoreTableId || undefined,
            });
          }}
        >
          <input
            className={inputClass}
            placeholder="Target Order ID"
            value={unmergeForm.targetOrderId}
            onChange={(e) => setUnmergeForm((prev) => ({ ...prev, targetOrderId: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Source Order ID (optional)"
            value={unmergeForm.sourceOrderId}
            onChange={(e) => setUnmergeForm((prev) => ({ ...prev, sourceOrderId: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Restore Table ID (optional)"
            value={unmergeForm.restoreTableId}
            onChange={(e) => setUnmergeForm((prev) => ({ ...prev, restoreTableId: e.target.value }))}
          />
          <button type="submit" className="bg-[#025cca] text-white rounded-md py-2 font-semibold">
            Unmerge
          </button>
        </form>
        <p className="text-xs text-[#ababab] mt-2">
          Reverses latest active merge entry by default, restoring the source order to an available table.
        </p>
      </div>
    </div>
  );
};

export default OperationsCenter;
