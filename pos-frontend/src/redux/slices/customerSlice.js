import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    orderId: "",
    activeOrderId: "",
    customerName: "",
    customerPhone: "",
    guests: 0,
    table: null,
    mergedTables: []
}


const customerSlice = createSlice({
    name : "customer",
    initialState,
    reducers : {
        setCustomer: (state, action) => {
            const { name, phone, guests, activeOrderId } = action.payload;
            state.orderId = `${Date.now()}`;
            state.activeOrderId = `${activeOrderId || ""}`;
            state.customerName = name;
            state.customerPhone = phone;
            state.guests = guests;
        },

        removeCustomer: (state) => {
            state.orderId = "";
            state.activeOrderId = "";
            state.customerName = "";
            state.customerPhone = "";
            state.guests = 0;
            state.table = null;
            state.mergedTables = [];
        },

        updateTable: (state, action) => {
            state.table = action.payload.table;
            state.mergedTables = Array.isArray(action.payload?.mergedTables) ? action.payload.mergedTables : [];
        },

        updateCustomerDraft: (state, action) => {
            const { name, phone, guests } = action.payload || {};
            if (name !== undefined) {
                state.customerName = `${name}`;
            }
            if (phone !== undefined) {
                state.customerPhone = `${phone}`;
            }
            if (guests !== undefined) {
                const nextGuests = Number(guests);
                state.guests = Number.isInteger(nextGuests) && nextGuests > 0 ? nextGuests : state.guests;
            }
        }

    }
})


export const { setCustomer, removeCustomer, updateTable, updateCustomerDraft } = customerSlice.actions;
export default customerSlice.reducer;
