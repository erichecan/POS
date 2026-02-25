import { createSlice } from "@reduxjs/toolkit";

const initialState = [];

const toSeedHash = (seed) => {
    const safeSeed = `${seed || ""}`;
    let hash = 0;
    for (let i = 0; i < safeSeed.length; i += 1) {
        hash = (hash << 5) - hash + safeSeed.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

const getDerivedRowId = (item, index = 0) => {
    const base = `${item?.name || "item"}-${item?.seatNo || "na"}-${index}`;
    return `cart-${toSeedHash(base).toString(16)}`;
};

const ensureRowId = (item, index = 0) => {
    if (!item || typeof item !== "object") {
        return item;
    }
    const existingId = `${item.id || ""}`.trim();
    if (existingId) {
        return { ...item, id: existingId };
    }
    return { ...item, id: getDerivedRowId(item, index) };
};

const getSafeQuantity = (quantity) => {
    const parsed = Number(quantity);
    if (!Number.isInteger(parsed)) {
        return 1;
    }
    return Math.min(Math.max(parsed, 1), 50);
};

const getSafePricePerQuantity = (item) => {
    const parsed = Number(item?.pricePerQuantity);
    if (Number.isFinite(parsed)) {
        return parsed;
    }
    const fallback = Number(item?.basePrice);
    return Number.isFinite(fallback) ? fallback : 0;
};

const computeLinePrice = (item, quantityOverride) => {
    const quantity = getSafeQuantity(quantityOverride ?? item?.quantity);
    const unit = getSafePricePerQuantity(item);
    return Number((unit * quantity).toFixed(2));
};

const cartSlice = createSlice({
    name : "cart",
    initialState,
    reducers : {
        addItems : (state, action) => {
            const quantity = Number(action?.payload?.quantity || 0);
            if (!Number.isInteger(quantity) || quantity <= 0) {
                return;
            }
            state.push(ensureRowId(action.payload, state.length));
        },

        setItems: (state, action) => {
            if (!Array.isArray(action.payload)) {
                return [];
            }
            return action.payload.map((item, index) => ensureRowId(item, index));
        },

        updateItemQuantity: (state, action) => {
            const { id, quantity } = action.payload || {};
            const target = state.find((item) => `${item.id}` === `${id}`);
            if (!target) {
                return;
            }
            target.quantity = getSafeQuantity(quantity);
            target.price = computeLinePrice(target, target.quantity);
        },

        duplicateItem: (state, action) => {
            const target = state.find((item) => `${item.id}` === `${action.payload}`);
            if (!target) {
                return;
            }
            state.push({
                ...target,
                id: `${target.id}-dup-${Date.now()}`,
                price: computeLinePrice(target, target.quantity),
            });
        },

        updateItemNote: (state, action) => {
            const { id, note } = action.payload || {};
            const target = state.find((item) => `${item.id}` === `${id}`);
            if (!target) {
                return;
            }
            target.note = `${note || ""}`.slice(0, 200);
        },

        updateItemModifiers: (state, action) => {
            const { id, modifiers } = action.payload || {};
            const target = state.find((item) => `${item.id}` === `${id}`);
            if (!target) {
                return;
            }
            const safeModifiers = Array.isArray(modifiers) ? modifiers : [];
            target.modifiers = safeModifiers;
            const modifierDelta = Number(
                safeModifiers.reduce((sum, row) => sum + Number(row?.priceDelta || 0), 0).toFixed(2)
            );
            const basePrice = Number(target.basePrice || target.pricePerQuantity || 0);
            target.pricePerQuantity = Number((basePrice + modifierDelta).toFixed(2));
            target.price = computeLinePrice(target, target.quantity);
        },

        removeItem: (state, action) => {
            return state.filter(item => item.id != action.payload);
        },

        removeAllItems: (state) => {
            return [];
        }
    }
})

export const getTotalPrice = (state) => state.cart.reduce((total, item) => total + item.price, 0);
export const {
    addItems,
    setItems,
    updateItemQuantity,
    duplicateItem,
    updateItemNote,
    updateItemModifiers,
    removeItem,
    removeAllItems
} = cartSlice.actions;
export default cartSlice.reducer;
