import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  createChannelProvider,
  getChannelProviders,
  updateChannelProvider,
  createMarketProfile,
  getMarketProfiles,
  updateMarketProfile,
  createStoreChannelConnection,
  getStoreChannelConnections,
  updateStoreChannelConnection,
  createChannelMappingRule,
  getChannelMappingRules,
  updateChannelMappingRule,
  ingestChannelOrder,
  getChannelDeadLetters,
  getChannelDeadLetterInsights,
  replayChannelDeadLetter,
  discardChannelDeadLetter,
} from "../../https";

const cardClass = "bg-[#262626] rounded-lg p-4 border border-[#333]";
const inputClass =
  "w-full bg-[#1f1f1f] text-[#f5f5f5] border border-[#3b3b3b] rounded-md px-3 py-2 focus:outline-none";

const getRows = (response) => (Array.isArray(response?.data?.data) ? response.data.data : []);

/** 2026-02-26: initialSection for sub-page filtered view (providers|markets|connections|mappings) */
const ChannelConfig = ({ initialSection }) => {
  const queryClient = useQueryClient();
  const showSection = (key) => !initialSection || initialSection === key;

  const [providerForm, setProviderForm] = useState({
    providerCode: "",
    displayName: "",
    channelType: "marketplace",
    authType: "oauth",
    regionSupport: "",
  });

  const [marketForm, setMarketForm] = useState({
    countryCode: "",
    name: "",
    currency: "",
    timezone: "",
    defaultTaxMode: "exclusive",
    defaultTaxRate: "0",
    defaultDeliveryMode: "platform_delivery",
    defaultChannelSet: "",
  });

  const [connectionForm, setConnectionForm] = useState({
    locationId: "",
    providerCode: "",
    externalStoreId: "",
    credentialRef: "",
    menuMappingPolicy: "manual",
    syncMode: "hybrid",
    enabled: true,
  });

  const [mappingForm, setMappingForm] = useState({
    locationId: "",
    providerCode: "",
    entityType: "item",
    internalCode: "",
    externalCode: "",
    active: true,
  });

  const [ingressForm, setIngressForm] = useState({
    locationId: "",
    providerCode: "",
    externalOrderId: "",
    customerName: "",
    customerPhone: "",
    guests: "1",
    fulfillmentType: "DELIVERY",
    paymentMethod: "Online",
    itemName: "",
    itemExternalCode: "",
    itemQuantity: "1",
  });
  const [dlqFilter, setDlqFilter] = useState({
    locationId: "",
    providerCode: "",
    status: "OPEN",
    failureCategory: "",
    windowHours: "24",
  });

  const providersQuery = useQuery({
    queryKey: ["channel-providers"],
    queryFn: () => getChannelProviders({ limit: 100 }),
  });

  const marketsQuery = useQuery({
    queryKey: ["market-profiles"],
    queryFn: () => getMarketProfiles({ limit: 100 }),
  });

  const connectionsQuery = useQuery({
    queryKey: ["store-channel-connections"],
    queryFn: () => getStoreChannelConnections({ limit: 100 }),
  });

  const mappingRulesQuery = useQuery({
    queryKey: ["channel-mapping-rules"],
    queryFn: () => getChannelMappingRules({ limit: 100 }),
  });
  const dlqQuery = useQuery({
    queryKey: ["channel-dlq", dlqFilter.locationId, dlqFilter.providerCode, dlqFilter.status, dlqFilter.failureCategory],
    queryFn: () =>
      getChannelDeadLetters({
        limit: 200,
        locationId: dlqFilter.locationId || undefined,
        providerCode: dlqFilter.providerCode || undefined,
        status: dlqFilter.status || undefined,
        failureCategory: dlqFilter.failureCategory || undefined,
      }),
    refetchInterval: 12000,
  });
  const dlqInsightsQuery = useQuery({
    queryKey: [
      "channel-dlq-insights",
      dlqFilter.locationId,
      dlqFilter.providerCode,
      dlqFilter.status,
      dlqFilter.windowHours,
    ],
    queryFn: () =>
      getChannelDeadLetterInsights({
        windowHours: Number(dlqFilter.windowHours || 24),
        locationId: dlqFilter.locationId || undefined,
        providerCode: dlqFilter.providerCode || undefined,
        status: dlqFilter.status || undefined,
      }),
    refetchInterval: 15000,
  });

  const providers = useMemo(() => getRows(providersQuery.data), [providersQuery.data]);
  const markets = useMemo(() => getRows(marketsQuery.data), [marketsQuery.data]);
  const connections = useMemo(() => getRows(connectionsQuery.data), [connectionsQuery.data]);
  const mappingRules = useMemo(() => getRows(mappingRulesQuery.data), [mappingRulesQuery.data]);
  const deadLetters = useMemo(() => getRows(dlqQuery.data), [dlqQuery.data]);
  const dlqInsights = useMemo(() => dlqInsightsQuery.data?.data?.data || {}, [dlqInsightsQuery.data]);

  const onMutationError = (error, fallback) => {
    const message = error?.response?.data?.message || fallback;
    enqueueSnackbar(message, { variant: "error" });
  };

  const createProviderMutation = useMutation({
    mutationFn: createChannelProvider,
    onSuccess: () => {
      enqueueSnackbar("Provider created", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["channel-providers"] });
      setProviderForm((prev) => ({ ...prev, providerCode: "", displayName: "", regionSupport: "" }));
    },
    onError: (error) => onMutationError(error, "Failed to create provider"),
  });

  const updateProviderMutation = useMutation({
    mutationFn: updateChannelProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channel-providers"] });
    },
    onError: (error) => onMutationError(error, "Failed to update provider"),
  });

  const createMarketMutation = useMutation({
    mutationFn: createMarketProfile,
    onSuccess: () => {
      enqueueSnackbar("Market profile created", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["market-profiles"] });
    },
    onError: (error) => onMutationError(error, "Failed to create market profile"),
  });

  const updateMarketMutation = useMutation({
    mutationFn: updateMarketProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["market-profiles"] });
    },
    onError: (error) => onMutationError(error, "Failed to update market profile"),
  });

  const createConnectionMutation = useMutation({
    mutationFn: createStoreChannelConnection,
    onSuccess: () => {
      enqueueSnackbar("Store connection created", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["store-channel-connections"] });
    },
    onError: (error) => onMutationError(error, "Failed to create store connection"),
  });

  const updateConnectionMutation = useMutation({
    mutationFn: updateStoreChannelConnection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-channel-connections"] });
    },
    onError: (error) => onMutationError(error, "Failed to update store connection"),
  });

  const createMappingMutation = useMutation({
    mutationFn: createChannelMappingRule,
    onSuccess: () => {
      enqueueSnackbar("Mapping rule created", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["channel-mapping-rules"] });
    },
    onError: (error) => onMutationError(error, "Failed to create mapping rule"),
  });

  const updateMappingMutation = useMutation({
    mutationFn: updateChannelMappingRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channel-mapping-rules"] });
    },
    onError: (error) => onMutationError(error, "Failed to update mapping rule"),
  });

  const ingestMutation = useMutation({
    mutationFn: ingestChannelOrder,
    onSuccess: (response) => {
      const replayed = response?.data?.replayed;
      enqueueSnackbar(replayed ? "Order already ingested (replayed)" : "Channel order ingested", {
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setIngressForm((prev) => ({
        ...prev,
        externalOrderId: "",
        customerName: "",
        customerPhone: "",
        itemName: "",
        itemExternalCode: "",
      }));
    },
    onError: (error) => onMutationError(error, "Failed to ingest channel order"),
  });
  const replayDlqMutation = useMutation({
    mutationFn: replayChannelDeadLetter,
    onSuccess: () => {
      enqueueSnackbar("DLQ replay submitted", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["channel-dlq"] });
      queryClient.invalidateQueries({ queryKey: ["channel-dlq-insights"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => onMutationError(error, "Failed to replay dead-letter event"),
  });
  const discardDlqMutation = useMutation({
    mutationFn: discardChannelDeadLetter,
    onSuccess: () => {
      enqueueSnackbar("DLQ event discarded", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["channel-dlq"] });
      queryClient.invalidateQueries({ queryKey: ["channel-dlq-insights"] });
    },
    onError: (error) => onMutationError(error, "Failed to discard dead-letter event"),
  });

  const splitCsv = (value) =>
    `${value || ""}`
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const handleCreateProvider = (event) => {
    event.preventDefault();
    createProviderMutation.mutate({
      providerCode: providerForm.providerCode,
      displayName: providerForm.displayName,
      channelType: providerForm.channelType,
      authType: providerForm.authType,
      regionSupport: splitCsv(providerForm.regionSupport),
    });
  };

  const handleCreateMarket = (event) => {
    event.preventDefault();
    createMarketMutation.mutate({
      countryCode: marketForm.countryCode,
      name: marketForm.name,
      currency: marketForm.currency,
      timezone: marketForm.timezone,
      defaultTaxPolicy: {
        mode: marketForm.defaultTaxMode,
        rate: Number(marketForm.defaultTaxRate || 0),
      },
      defaultDeliveryMode: marketForm.defaultDeliveryMode,
      defaultChannelSet: splitCsv(marketForm.defaultChannelSet),
    });
  };

  const handleCreateConnection = (event) => {
    event.preventDefault();
    createConnectionMutation.mutate({
      locationId: connectionForm.locationId,
      providerCode: connectionForm.providerCode,
      externalStoreId: connectionForm.externalStoreId,
      credentialRef: connectionForm.credentialRef,
      menuMappingPolicy: connectionForm.menuMappingPolicy,
      syncMode: connectionForm.syncMode,
      enabled: connectionForm.enabled,
    });
  };

  const handleCreateMapping = (event) => {
    event.preventDefault();
    createMappingMutation.mutate({
      locationId: mappingForm.locationId,
      providerCode: mappingForm.providerCode,
      entityType: mappingForm.entityType,
      internalCode: mappingForm.internalCode,
      externalCode: mappingForm.externalCode,
      active: mappingForm.active,
    });
  };

  const handleIngressSubmit = (event) => {
    event.preventDefault();
    ingestMutation.mutate({
      locationId: ingressForm.locationId,
      providerCode: ingressForm.providerCode,
      externalOrderId: ingressForm.externalOrderId,
      customerDetails: {
        name: ingressForm.customerName,
        phone: ingressForm.customerPhone,
        guests: Number(ingressForm.guests || 1),
      },
      fulfillmentType: ingressForm.fulfillmentType,
      paymentMethod: ingressForm.paymentMethod,
      items: [
        {
          name: ingressForm.itemName || undefined,
          externalCode: ingressForm.itemExternalCode || undefined,
          quantity: Number(ingressForm.itemQuantity || 1),
        },
      ],
    });
  };

  return (
    <div className="container mx-auto py-2 px-6 md:px-4 space-y-4">
      {showSection("providers") && (
      <div className={cardClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">Channel Providers</h2>
        <form className="grid grid-cols-5 gap-3 mb-4" onSubmit={handleCreateProvider}>
          <input
            className={inputClass}
            placeholder="Provider Code (e.g. UBER_EATS)"
            value={providerForm.providerCode}
            onChange={(e) => setProviderForm((prev) => ({ ...prev, providerCode: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Display Name"
            value={providerForm.displayName}
            onChange={(e) => setProviderForm((prev) => ({ ...prev, displayName: e.target.value }))}
          />
          <select
            className={inputClass}
            value={providerForm.channelType}
            onChange={(e) => setProviderForm((prev) => ({ ...prev, channelType: e.target.value }))}
          >
            <option value="marketplace">marketplace</option>
            <option value="first_party">first_party</option>
            <option value="dispatch">dispatch</option>
            <option value="social">social</option>
            <option value="other">other</option>
          </select>
          <select
            className={inputClass}
            value={providerForm.authType}
            onChange={(e) => setProviderForm((prev) => ({ ...prev, authType: e.target.value }))}
          >
            <option value="oauth">oauth</option>
            <option value="api_key">api_key</option>
            <option value="jwt">jwt</option>
            <option value="signature">signature</option>
            <option value="custom">custom</option>
          </select>
          <input
            className={inputClass}
            placeholder="Regions (US,CA,IE)"
            value={providerForm.regionSupport}
            onChange={(e) => setProviderForm((prev) => ({ ...prev, regionSupport: e.target.value }))}
          />
          <button
            type="submit"
            className="col-span-5 bg-[#025cca] text-white rounded-md py-2 font-semibold"
          >
            Add Provider
          </button>
        </form>
        <div className="space-y-2">
          {providers.map((provider) => (
            <div
              key={provider._id}
              className="flex items-center justify-between bg-[#1f1f1f] px-3 py-2 rounded-md"
            >
              <div className="text-[#f5f5f5] text-sm">
                <span className="font-semibold">{provider.providerCode}</span> · {provider.displayName}
              </div>
              <button
                className="text-xs bg-[#333] text-[#f5f5f5] px-3 py-1 rounded-md"
                onClick={() =>
                  updateProviderMutation.mutate({
                    id: provider._id,
                    status: provider.status === "active" ? "inactive" : "active",
                  })
                }
              >
                {provider.status === "active" ? "Disable" : "Enable"}
              </button>
            </div>
          ))}
          {providers.length === 0 && <p className="text-[#ababab] text-sm">No providers yet.</p>}
        </div>
      </div>
      )}

      {showSection("markets") && (
      <div className={cardClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">Market Profiles</h2>
        <form className="grid grid-cols-4 gap-3 mb-4" onSubmit={handleCreateMarket}>
          <input
            className={inputClass}
            placeholder="Country Code (US)"
            value={marketForm.countryCode}
            onChange={(e) => setMarketForm((prev) => ({ ...prev, countryCode: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Market Name"
            value={marketForm.name}
            onChange={(e) => setMarketForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Currency (USD)"
            value={marketForm.currency}
            onChange={(e) => setMarketForm((prev) => ({ ...prev, currency: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Timezone"
            value={marketForm.timezone}
            onChange={(e) => setMarketForm((prev) => ({ ...prev, timezone: e.target.value }))}
          />
          <select
            className={inputClass}
            value={marketForm.defaultTaxMode}
            onChange={(e) => setMarketForm((prev) => ({ ...prev, defaultTaxMode: e.target.value }))}
          >
            <option value="exclusive">exclusive tax</option>
            <option value="inclusive">inclusive tax</option>
            <option value="none">no tax</option>
          </select>
          <input
            className={inputClass}
            placeholder="Tax Rate (%)"
            value={marketForm.defaultTaxRate}
            onChange={(e) => setMarketForm((prev) => ({ ...prev, defaultTaxRate: e.target.value }))}
          />
          <select
            className={inputClass}
            value={marketForm.defaultDeliveryMode}
            onChange={(e) =>
              setMarketForm((prev) => ({ ...prev, defaultDeliveryMode: e.target.value }))
            }
          >
            <option value="platform_delivery">platform_delivery</option>
            <option value="store_delivery">store_delivery</option>
            <option value="pickup">pickup</option>
            <option value="mixed">mixed</option>
          </select>
          <input
            className={inputClass}
            placeholder="Default Providers (UBER_EATS,DOORDASH)"
            value={marketForm.defaultChannelSet}
            onChange={(e) => setMarketForm((prev) => ({ ...prev, defaultChannelSet: e.target.value }))}
          />
          <button
            type="submit"
            className="col-span-4 bg-[#025cca] text-white rounded-md py-2 font-semibold"
          >
            Add Market Profile
          </button>
        </form>
        <div className="space-y-2">
          {markets.map((market) => (
            <div
              key={market._id}
              className="flex items-center justify-between bg-[#1f1f1f] px-3 py-2 rounded-md"
            >
              <div className="text-[#f5f5f5] text-sm">
                <span className="font-semibold">{market.countryCode}</span> · {market.currency} ·{" "}
                {market.timezone}
              </div>
              <button
                className="text-xs bg-[#333] text-[#f5f5f5] px-3 py-1 rounded-md"
                onClick={() =>
                  updateMarketMutation.mutate({
                    id: market._id,
                    status: market.status === "active" ? "inactive" : "active",
                  })
                }
              >
                {market.status === "active" ? "Disable" : "Enable"}
              </button>
            </div>
          ))}
          {markets.length === 0 && <p className="text-[#ababab] text-sm">No market profiles yet.</p>}
        </div>
      </div>
      )}

      {showSection("connections") && (
      <div className={cardClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">Store Channel Connections</h2>
        <form className="grid grid-cols-4 gap-3 mb-4" onSubmit={handleCreateConnection}>
          <input
            className={inputClass}
            placeholder="Location ID"
            value={connectionForm.locationId}
            onChange={(e) => setConnectionForm((prev) => ({ ...prev, locationId: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Provider Code"
            value={connectionForm.providerCode}
            onChange={(e) => setConnectionForm((prev) => ({ ...prev, providerCode: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="External Store ID"
            value={connectionForm.externalStoreId}
            onChange={(e) =>
              setConnectionForm((prev) => ({ ...prev, externalStoreId: e.target.value }))
            }
          />
          <input
            className={inputClass}
            placeholder="Credential Ref"
            value={connectionForm.credentialRef}
            onChange={(e) =>
              setConnectionForm((prev) => ({ ...prev, credentialRef: e.target.value }))
            }
          />
          <select
            className={inputClass}
            value={connectionForm.menuMappingPolicy}
            onChange={(e) =>
              setConnectionForm((prev) => ({ ...prev, menuMappingPolicy: e.target.value }))
            }
          >
            <option value="manual">manual</option>
            <option value="auto">auto</option>
            <option value="hybrid">hybrid</option>
          </select>
          <select
            className={inputClass}
            value={connectionForm.syncMode}
            onChange={(e) => setConnectionForm((prev) => ({ ...prev, syncMode: e.target.value }))}
          >
            <option value="hybrid">hybrid</option>
            <option value="pull">pull</option>
            <option value="push">push</option>
          </select>
          <label className="flex items-center gap-2 text-[#f5f5f5] text-sm">
            <input
              type="checkbox"
              checked={connectionForm.enabled}
              onChange={(e) => setConnectionForm((prev) => ({ ...prev, enabled: e.target.checked }))}
            />
            Enabled
          </label>
          <button
            type="submit"
            className="bg-[#025cca] text-white rounded-md py-2 font-semibold"
          >
            Add Connection
          </button>
        </form>
        <div className="space-y-2">
          {connections.map((connection) => (
            <div
              key={connection._id}
              className="flex items-center justify-between bg-[#1f1f1f] px-3 py-2 rounded-md"
            >
              <div className="text-[#f5f5f5] text-sm">
                <span className="font-semibold">{connection.locationId}</span> ·{" "}
                {connection.providerCode} · {connection.externalStoreId}
              </div>
              <button
                className="text-xs bg-[#333] text-[#f5f5f5] px-3 py-1 rounded-md"
                onClick={() =>
                  updateConnectionMutation.mutate({
                    id: connection._id,
                    enabled: !connection.enabled,
                  })
                }
              >
                {connection.enabled ? "Disable" : "Enable"}
              </button>
            </div>
          ))}
          {connections.length === 0 && <p className="text-[#ababab] text-sm">No connections yet.</p>}
        </div>
      </div>
      )}

      {showSection("mappings") && (
      <div className={cardClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">Mapping Rules</h2>
        <form className="grid grid-cols-5 gap-3 mb-4" onSubmit={handleCreateMapping}>
          <input
            className={inputClass}
            placeholder="Location ID"
            value={mappingForm.locationId}
            onChange={(e) => setMappingForm((prev) => ({ ...prev, locationId: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Provider Code"
            value={mappingForm.providerCode}
            onChange={(e) => setMappingForm((prev) => ({ ...prev, providerCode: e.target.value }))}
          />
          <select
            className={inputClass}
            value={mappingForm.entityType}
            onChange={(e) => setMappingForm((prev) => ({ ...prev, entityType: e.target.value }))}
          >
            <option value="item">item</option>
            <option value="modifier">modifier</option>
            <option value="status">status</option>
            <option value="tax">tax</option>
            <option value="refund_reason">refund_reason</option>
            <option value="service_fee">service_fee</option>
          </select>
          <input
            className={inputClass}
            placeholder="Internal Code"
            value={mappingForm.internalCode}
            onChange={(e) => setMappingForm((prev) => ({ ...prev, internalCode: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="External Code"
            value={mappingForm.externalCode}
            onChange={(e) => setMappingForm((prev) => ({ ...prev, externalCode: e.target.value }))}
          />
          <button
            type="submit"
            className="col-span-5 bg-[#025cca] text-white rounded-md py-2 font-semibold"
          >
            Add Mapping Rule
          </button>
        </form>
        <div className="space-y-2">
          {mappingRules.map((rule) => (
            <div
              key={rule._id}
              className="flex items-center justify-between bg-[#1f1f1f] px-3 py-2 rounded-md"
            >
              <div className="text-[#f5f5f5] text-sm">
                [{rule.entityType}] {rule.externalCode} → {rule.internalCode}
              </div>
              <button
                className="text-xs bg-[#333] text-[#f5f5f5] px-3 py-1 rounded-md"
                onClick={() =>
                  updateMappingMutation.mutate({
                    id: rule._id,
                    active: !rule.active,
                  })
                }
              >
                {rule.active ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))}
          {mappingRules.length === 0 && <p className="text-[#ababab] text-sm">No mapping rules yet.</p>}
        </div>
      </div>
      )}

      {!initialSection && (
      <>
      <div className={cardClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">Channel Order Ingress Tester</h2>
        <form className="grid grid-cols-4 gap-3" onSubmit={handleIngressSubmit}>
          <input
            className={inputClass}
            placeholder="Location ID"
            value={ingressForm.locationId}
            onChange={(e) => setIngressForm((prev) => ({ ...prev, locationId: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Provider Code"
            value={ingressForm.providerCode}
            onChange={(e) => setIngressForm((prev) => ({ ...prev, providerCode: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="External Order ID"
            value={ingressForm.externalOrderId}
            onChange={(e) =>
              setIngressForm((prev) => ({ ...prev, externalOrderId: e.target.value }))
            }
          />
          <select
            className={inputClass}
            value={ingressForm.fulfillmentType}
            onChange={(e) =>
              setIngressForm((prev) => ({ ...prev, fulfillmentType: e.target.value }))
            }
          >
            <option value="DELIVERY">DELIVERY</option>
            <option value="PICKUP">PICKUP</option>
            <option value="DINE_IN">DINE_IN</option>
            <option value="OTHER">OTHER</option>
          </select>
          <input
            className={inputClass}
            placeholder="Customer Name"
            value={ingressForm.customerName}
            onChange={(e) => setIngressForm((prev) => ({ ...prev, customerName: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Customer Phone"
            value={ingressForm.customerPhone}
            onChange={(e) => setIngressForm((prev) => ({ ...prev, customerPhone: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Guests"
            value={ingressForm.guests}
            onChange={(e) => setIngressForm((prev) => ({ ...prev, guests: e.target.value }))}
          />
          <select
            className={inputClass}
            value={ingressForm.paymentMethod}
            onChange={(e) => setIngressForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
          >
            <option value="Online">Online</option>
            <option value="Cash">Cash</option>
          </select>
          <input
            className={inputClass}
            placeholder="Item Name (optional if mapped by external code)"
            value={ingressForm.itemName}
            onChange={(e) => setIngressForm((prev) => ({ ...prev, itemName: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Item External Code"
            value={ingressForm.itemExternalCode}
            onChange={(e) =>
              setIngressForm((prev) => ({ ...prev, itemExternalCode: e.target.value }))
            }
          />
          <input
            className={inputClass}
            placeholder="Quantity"
            value={ingressForm.itemQuantity}
            onChange={(e) => setIngressForm((prev) => ({ ...prev, itemQuantity: e.target.value }))}
          />
          <button
            type="submit"
            className="bg-[#f6b100] text-[#1f1f1f] rounded-md py-2 font-semibold"
          >
            Ingest Order
          </button>
        </form>
      </div>

      <div className={cardClass}>
        <h2 className="text-[#f5f5f5] text-lg font-semibold mb-3">Channel Governance (DLQ & Retry)</h2>
        <div className="grid grid-cols-5 gap-3 mb-4">
          <input
            className={inputClass}
            placeholder="Location ID"
            value={dlqFilter.locationId}
            onChange={(e) => setDlqFilter((prev) => ({ ...prev, locationId: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Provider Code"
            value={dlqFilter.providerCode}
            onChange={(e) => setDlqFilter((prev) => ({ ...prev, providerCode: e.target.value }))}
          />
          <select
            className={inputClass}
            value={dlqFilter.status}
            onChange={(e) => setDlqFilter((prev) => ({ ...prev, status: e.target.value }))}
          >
            <option value="">All Status</option>
            <option value="OPEN">OPEN</option>
            <option value="REPLAYED">REPLAYED</option>
            <option value="DISCARDED">DISCARDED</option>
          </select>
          <select
            className={inputClass}
            value={dlqFilter.failureCategory}
            onChange={(e) => setDlqFilter((prev) => ({ ...prev, failureCategory: e.target.value }))}
          >
            <option value="">All Categories</option>
            {[
              "AUTH",
              "SIGNATURE",
              "THROTTLE",
              "VALIDATION",
              "MAPPING",
              "INVENTORY",
              "PAYMENT",
              "UPSTREAM",
              "DUPLICATE",
              "UNKNOWN",
            ].map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <input
            className={inputClass}
            placeholder="Window Hours"
            value={dlqFilter.windowHours}
            onChange={(e) => setDlqFilter((prev) => ({ ...prev, windowHours: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-5 gap-3 mb-4">
          <div className="bg-[#1f1f1f] rounded-md px-3 py-2">
            <p className="text-xs text-[#ababab]">DLQ Total</p>
            <p className="text-[#f5f5f5] font-semibold">{Number(dlqInsights.total || 0)}</p>
          </div>
          <div className="bg-[#1f1f1f] rounded-md px-3 py-2">
            <p className="text-xs text-[#ababab]">Retry Window Open</p>
            <p className="text-[#7ce2a8] font-semibold">{Number(dlqInsights.retryWindowOpenCount || 0)}</p>
          </div>
          <div className="bg-[#1f1f1f] rounded-md px-3 py-2">
            <p className="text-xs text-[#ababab]">Retry Blocked</p>
            <p className="text-[#ffd38a] font-semibold">{Number(dlqInsights.retryBlockedCount || 0)}</p>
          </div>
          <div className="bg-[#1f1f1f] rounded-md px-3 py-2">
            <p className="text-xs text-[#ababab]">AUTH Errors</p>
            <p className="text-[#ffb3b3] font-semibold">
              {Number((dlqInsights.byCategory || {}).AUTH || 0)}
            </p>
          </div>
          <div className="bg-[#1f1f1f] rounded-md px-3 py-2">
            <p className="text-xs text-[#ababab]">MAPPING Errors</p>
            <p className="text-[#9ac7ff] font-semibold">
              {Number((dlqInsights.byCategory || {}).MAPPING || 0)}
            </p>
          </div>
        </div>

        <div className="space-y-2 max-h-[360px] overflow-auto">
          {deadLetters.map((event) => {
            const retryWindow = event.retryWindow || {};
            return (
              <div
                key={event._id}
                className="bg-[#1f1f1f] px-3 py-2 rounded-md border border-[#333]"
              >
                <div className="flex items-center justify-between text-[#f5f5f5] text-sm">
                  <p className="font-semibold">
                    {event.providerCode} · {event.locationId} · {event.externalOrderId || "-"}
                  </p>
                  <p>{event.status}</p>
                </div>
                <div className="text-xs text-[#ababab] mt-1">
                  {event.failureCategory || "UNKNOWN"} · {event.failureCode || "-"} ·{" "}
                  {event.failureMessage || "-"}
                </div>
                <div className="text-xs text-[#ababab] mt-1">
                  Replay {Number(event.replayCount || 0)} / {Number(retryWindow.maxRetries || 0)} ·
                  {" "}
                  {retryWindow.retryable
                    ? retryWindow.windowOpen
                      ? "Retry window OPEN"
                      : `Wait ${Number(retryWindow.waitSeconds || 0)}s`
                    : "Not retryable"}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    className="text-xs px-3 py-1 rounded-md bg-[#2f5a45] text-[#d0ffe8] disabled:opacity-50"
                    disabled={
                      replayDlqMutation.isPending ||
                      !retryWindow.retryable ||
                      !retryWindow.windowOpen
                    }
                    onClick={() => replayDlqMutation.mutate({ id: event._id })}
                  >
                    Replay
                  </button>
                  <button
                    className="text-xs px-3 py-1 rounded-md bg-[#5a2f2f] text-[#ffd8d8] disabled:opacity-50"
                    disabled={discardDlqMutation.isPending || event.status === "DISCARDED"}
                    onClick={() => discardDlqMutation.mutate({ id: event._id })}
                  >
                    Discard
                  </button>
                </div>
              </div>
            );
          })}
          {deadLetters.length === 0 && (
            <p className="text-[#ababab] text-sm">No dead-letter events in current filter.</p>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
};

export default ChannelConfig;
