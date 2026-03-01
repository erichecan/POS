// 2026-02-26T21:00:00+08:00: i18n
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
// 2026-02-24T12:01:10Z: 转台/并台/拆台/撤销并台已迁移至 Tables 页
import {
  bootstrapInventory,
  getInventoryItems,
  openCashShift,
  getCashShifts,
  getCashShiftById,
  addCashShiftMovement,
  closeCashShift,
} from "../../https";

const cardClass = "bg-[#262626] rounded-lg p-4 border border-[#333]";
const inputClass =
  "w-full bg-[#1f1f1f] text-[#f5f5f5] border border-[#3b3b3b] rounded-md px-3 py-2 focus:outline-none";

const getRows = (response) => (Array.isArray(response?.data?.data) ? response.data.data : []);

const OperationsCenter = () => {
  const { t } = useTranslation();
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

  return (
    <div className="container mx-auto py-2 px-6 md:px-4 space-y-4">
      <div className={cardClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">{t("operations.inventoryBootstrap")}</h2>
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
            placeholder={t("operations.locationId")}
            value={inventoryForm.locationId}
            onChange={(e) => setInventoryForm((prev) => ({ ...prev, locationId: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder={t("operations.defaultQty")}
            value={inventoryForm.defaultQuantity}
            onChange={(e) =>
              setInventoryForm((prev) => ({ ...prev, defaultQuantity: e.target.value }))
            }
          />
          <input
            className={inputClass}
            placeholder={t("operations.lowStockThreshold")}
            value={inventoryForm.lowStockThreshold}
            onChange={(e) =>
              setInventoryForm((prev) => ({ ...prev, lowStockThreshold: e.target.value }))
            }
          />
          <button type="submit" className="bg-[#025cca] text-white rounded-md py-2 font-semibold">
            {t("operations.bootstrap")}
          </button>
        </form>
      </div>

      <div className={cardClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">{t("operations.inventorySnapshot")}</h2>
        <div className="flex items-center gap-3 mb-3">
          <input
            className={inputClass}
            placeholder={t("operations.locationId")}
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
            {t("operations.onlyLowStock")}
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
                {t("operations.qty")} {item.availableQuantity} · {t("operations.threshold")} {item.lowStockThreshold} · {item.status} ·{" "}
                {item.isOutOfStock ? "86" : t("operations.onSale")}
              </div>
            </div>
          ))}
          {inventoryItems.length === 0 && <p className="text-[#ababab] text-sm">{t("operations.noItems")}</p>}
        </div>
      </div>

      <div className={cardClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">{t("operations.cashShifts")}</h2>
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
            placeholder={t("operations.locationId")}
            value={shiftForm.locationId}
            onChange={(e) => setShiftForm((prev) => ({ ...prev, locationId: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder={t("operations.openingFloat")}
            value={shiftForm.openingFloat}
            onChange={(e) => setShiftForm((prev) => ({ ...prev, openingFloat: e.target.value }))}
          />
          <button type="submit" className="bg-[#025cca] text-white rounded-md py-2 font-semibold">
            {t("operations.openShift")}
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
            placeholder={t("operations.shiftId")}
            value={closeShiftForm.shiftId}
            onChange={(e) => setCloseShiftForm((prev) => ({ ...prev, shiftId: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder={t("operations.closingCounted")}
            value={closeShiftForm.closingCounted}
            onChange={(e) =>
              setCloseShiftForm((prev) => ({ ...prev, closingCounted: e.target.value }))
            }
          />
          <button type="submit" className="bg-[#f6b100] text-[#1f1f1f] rounded-md py-2 font-semibold">
            {t("operations.closeShift")}
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
              {shift._id} · {shift.locationId} · {shift.status} · {t("operations.opening")} {shift.openingFloat}
            </div>
          ))}
          {shifts.length === 0 && <p className="text-[#ababab] text-sm">{t("operations.noShifts")}</p>}
        </div>

        <div className="mt-4 pt-4 border-t border-[#333]">
          <h3 className="text-[#f5f5f5] text-md font-semibold mb-2">{t("operations.cashMovements")}</h3>
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
            placeholder={t("operations.shiftId")}
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
            placeholder={t("operations.amount")}
            value={movementForm.amount}
              onChange={(e) => setMovementForm((prev) => ({ ...prev, amount: e.target.value }))}
            />
            <input
              className={inputClass}
              placeholder={t("operations.reason")}
              value={movementForm.reason}
              onChange={(e) => setMovementForm((prev) => ({ ...prev, reason: e.target.value }))}
            />
            <button type="submit" className="bg-[#025cca] text-white rounded-md py-2 font-semibold">
              {t("operations.addMovement")}
            </button>
          </form>

          {selectedShift && (
            <>
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="bg-[#1f1f1f] rounded px-2 py-1 text-xs text-[#f5f5f5]">
                  {t("operations.cashSales")} {Number(selectedShift.cashSalesTotal || 0).toFixed(2)}
                </div>
                <div className="bg-[#1f1f1f] rounded px-2 py-1 text-xs text-[#f5f5f5]">
                  {t("operations.paidIn")} {Number(selectedShift.paidInTotal || 0).toFixed(2)}
                </div>
                <div className="bg-[#1f1f1f] rounded px-2 py-1 text-xs text-[#f5f5f5]">
                  {t("operations.paidOut")} {Number(selectedShift.paidOutTotal || 0).toFixed(2)}
                </div>
                <div className="bg-[#1f1f1f] rounded px-2 py-1 text-xs text-[#f5f5f5]">
                  {t("operations.expectedClose")} {Number(selectedShift.closingExpectedPreview || 0).toFixed(2)}
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
                  <p className="text-[#ababab] text-xs">{t("operations.noMovements")}</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  );
};

export default OperationsCenter;
