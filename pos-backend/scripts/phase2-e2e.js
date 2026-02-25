/* eslint-disable no-console */
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const BASE_URL = `${process.env.PHASE2_E2E_BASE_URL || "http://localhost:8000"}`.replace(
  /\/$/,
  ""
);
const LOCATION_ID = `${process.env.PHASE2_E2E_LOCATION_ID || "default"}`.trim() || "default";
const ADMIN_EMAIL = `${process.env.PHASE2_E2E_ADMIN_EMAIL || "admin@restro.local"}`.trim();
const ADMIN_PASSWORD = `${process.env.PHASE2_E2E_ADMIN_PASSWORD || "Admin@12345"}`.trim();

let cookieHeader = "";

const buildQuery = (query) => {
  if (!query || typeof query !== "object") {
    return "";
  }
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    params.set(key, `${value}`);
  });
  const text = params.toString();
  return text ? `?${text}` : "";
};

const extractCookie = (response) => {
  const raw = response.headers.get("set-cookie");
  if (!raw) {
    return;
  }
  const match = raw.match(/accessToken=[^;]+/);
  if (match?.[0]) {
    cookieHeader = match[0];
  }
};

const request = async (method, path, options = {}) => {
  const url = `${BASE_URL}${path}${buildQuery(options.query)}`;
  const headers = {
    Accept: "application/json",
    ...options.headers,
  };

  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
    headers["x-idempotency-key"] = options.idempotencyKey || crypto.randomUUID();
  }

  const response = await fetch(url, {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(options.body || {}),
  });

  extractCookie(response);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message = data?.message || data?.error || response.statusText || "request failed";
    throw new Error(`${method} ${path} failed (${response.status}): ${message}`);
  }

  return data;
};

const pickTables = (rows = []) => {
  if (!Array.isArray(rows) || rows.length < 2) {
    throw new Error("Need at least two tables in system.");
  }

  const available = rows.filter((row) => row.status === "Available");
  if (available.length >= 2) {
    return [available[0], available[1]];
  }

  return [rows[0], rows[1]];
};

const ensureOpenShift = async () => {
  const list = await request("GET", "/api/cash/shifts", {
    query: { locationId: LOCATION_ID, status: "OPEN", limit: 1 },
  });
  const openRows = Array.isArray(list?.data) ? list.data : [];
  if (openRows.length > 0) {
    return openRows[0];
  }

  const created = await request("POST", "/api/cash/shifts", {
    body: {
      locationId: LOCATION_ID,
      openingFloat: 200,
      notes: "phase2 e2e bootstrap",
    },
  });
  return created?.data;
};

const createCashOrder = async (tableId) => {
  const payload = {
    locationId: LOCATION_ID,
    customerDetails: {
      name: "Phase2 Cash User",
      phone: "9123456789",
      guests: 2,
    },
    table: tableId,
    paymentMethod: "Cash",
    items: [
      { name: "Masala Chai", quantity: 2 },
      { name: "Paneer Tikka", quantity: 1 },
    ],
  };
  const created = await request("POST", "/api/order", { body: payload });
  return created?.data;
};

const createOnlineOrder = async (tableId) => {
  const items = [
    { name: "Margherita Pizza", quantity: 1 },
    { name: "Lemon Soda", quantity: 2 },
  ];

  const paymentOrder = await request("POST", "/api/payment/create-order", {
    body: {
      locationId: LOCATION_ID,
      sourceType: "POS",
      currency: "EUR",
      gatewayCode: "MOCK_STRIPE",
      items,
    },
  });

  const verify = await request("POST", "/api/payment/verify-payment", {
    body: {
      stripe_session_id: paymentOrder?.sessionId || paymentOrder?.order?.id,
      gatewayCode: paymentOrder?.gatewayCode || "MOCK_STRIPE",
    },
  });

  const paymentData = verify?.data || {};
  assert.ok(paymentData?.stripe_payment_intent_id, "missing payment intent from verify response");

  const createdOrder = await request("POST", "/api/order", {
    body: {
      locationId: LOCATION_ID,
      customerDetails: {
        name: "Phase2 Online User",
        phone: "9234567890",
        guests: 2,
      },
      table: tableId,
      paymentMethod: "Online",
      paymentData: {
        stripe_session_id: paymentData.stripe_session_id,
        stripe_payment_intent_id: paymentData.stripe_payment_intent_id,
        stripe_charge_id: paymentData.stripe_charge_id,
      },
      items,
    },
  });

  return {
    order: createdOrder?.data,
    paymentData,
  };
};

const verifyKitchenLink = async (orderId) => {
  const tickets = await request("GET", "/api/kitchen/tickets", {
    query: {
      locationId: LOCATION_ID,
      limit: 200,
    },
  });
  const rows = Array.isArray(tickets?.data) ? tickets.data : [];
  const ticket = rows.find((row) => `${row?.orderId?._id || row?.orderId || ""}` === `${orderId}`);
  assert.ok(ticket, "kitchen ticket not found for order");

  await request("POST", `/api/kitchen/tickets/${ticket._id}/status`, {
    body: { status: "PREPARING" },
  });

  const replay = await request("GET", "/api/kitchen/events/replay", {
    query: {
      locationId: LOCATION_ID,
      ticketId: ticket._id,
      limit: 20,
    },
  });
  const events = Array.isArray(replay?.data) ? replay.data : [];
  assert.ok(events.length > 0, "ticket replay events should not be empty");
  return {
    ticketId: ticket._id,
    replayEvents: events.length,
  };
};

const run = async () => {
  console.log("[phase2-e2e] base url:", BASE_URL);
  console.log("[phase2-e2e] location:", LOCATION_ID);

  await request("POST", "/api/user/login", {
    body: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    },
  });
  assert.ok(cookieHeader, "login did not set access token cookie");

  const shift = await ensureOpenShift();
  assert.ok(shift?._id, "open shift is required");

  const tableResponse = await request("GET", "/api/table");
  const [tableA, tableB] = pickTables(tableResponse?.data || []);

  const cashOrder = await createCashOrder(tableA._id);
  assert.ok(cashOrder?._id, "cash order should be created");

  const kitchenLink = await verifyKitchenLink(cashOrder._id);

  const onlineResult = await createOnlineOrder(tableB._id);
  assert.ok(onlineResult?.order?._id, "online order should be created");
  assert.ok(onlineResult?.paymentData?.stripe_payment_intent_id, "online payment should verify");

  const reconciliation = await request("GET", "/api/payment/reconciliation/gaps", {
    query: { limit: 50 },
  });
  const reconciliationSummary = reconciliation?.data?.summary || {};

  const slo = await request("GET", "/api/ops/slo", {
    query: { locationId: LOCATION_ID, windowMinutes: 240 },
  });
  assert.ok(slo?.data?.healthStatus, "slo response missing healthStatus");

  const sweep = await request("POST", "/api/ops/escalations/run", {
    body: { locationId: LOCATION_ID, windowMinutes: 240 },
  });
  assert.ok(sweep?.data?.policy, "escalation sweep should return policy");

  const incidentsResponse = await request("GET", "/api/ops/incidents", {
    query: { locationId: LOCATION_ID, status: "OPEN,ACKED,RESOLVED", limit: 100 },
  });
  const incidents = Array.isArray(incidentsResponse?.data) ? incidentsResponse.data : [];
  const activeIncident = incidents.find((incident) => incident.status !== "RESOLVED");
  let handledIncidentId = null;

  if (activeIncident) {
    if (activeIncident.status === "OPEN") {
      await request("POST", `/api/ops/incidents/${activeIncident._id}/ack`, {
        body: { note: "phase2 e2e ack" },
      });
    }

    await request("POST", `/api/ops/incidents/${activeIncident._id}/resolve`, {
      body: { note: "phase2 e2e resolve" },
    });
    handledIncidentId = activeIncident._id;
  }

  const output = {
    shiftId: shift._id,
    cashOrderId: cashOrder._id,
    onlineOrderId: onlineResult.order._id,
    kitchenTicketId: kitchenLink.ticketId,
    replayEvents: kitchenLink.replayEvents,
    reconciliationSummary,
    healthStatus: slo.data.healthStatus,
    alertCount: Number(slo?.data?.alertSummary?.total || 0),
    sweepSyncResult: sweep?.data?.syncResult || {},
    incidentCount: incidents.length,
    handledIncidentId,
  };

  console.log("[phase2-e2e] SUCCESS");
  console.log(JSON.stringify(output, null, 2));
};

run().catch((error) => {
  console.error("[phase2-e2e] FAILED:", error.message);
  process.exitCode = 1;
});
