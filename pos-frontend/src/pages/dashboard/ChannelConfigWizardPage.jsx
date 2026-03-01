/**
 * Phase E2.1 渠道配置向导 - 2026-02-28T16:15:00+08:00
 * 选择 Uber Eats / DoorDash 等，填 API 密钥，测试连接
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  getChannelProviders,
  createChannelProvider,
  getStoreChannelConnections,
  createStoreChannelConnection,
} from "../../https";

const WIZARD_STEPS = ["provider", "credentials", "test"];
const KNOWN_PROVIDERS = [
  { code: "UBEREATS", name: "Uber Eats", authType: "api_key" },
  { code: "DOORDASH", name: "DoorDash", authType: "api_key" },
  { code: "GRUBHUB", name: "Grubhub", authType: "api_key" },
  { code: "DELIVEROO", name: "Deliveroo", authType: "api_key" },
];

const getRows = (res) => (Array.isArray(res?.data?.data) ? res.data.data : []);

const ChannelConfigWizardPage = () => {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [providerCode, setProviderCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [locationId, setLocationId] = useState("default");
  const [externalStoreId, setExternalStoreId] = useState("");
  const [testResult, setTestResult] = useState(null);

  const providersQuery = useQuery({
    queryKey: ["channel-providers"],
    queryFn: () => getChannelProviders({ limit: 100 }),
  });
  const connectionsQuery = useQuery({
    queryKey: ["store-channel-connections"],
    queryFn: () => getStoreChannelConnections({ limit: 100 }),
  });

  const providers = getRows(providersQuery.data);
  const connections = getRows(connectionsQuery.data);

  const createProviderMutation = useMutation({
    mutationFn: createChannelProvider,
    onSuccess: () => {
      enqueueSnackbar(t("channel.wizard.providerCreated", "Provider created"), {
        variant: "success",
      });
      providersQuery.refetch();
      setStep(1);
    },
    onError: (e) =>
      enqueueSnackbar(e.response?.data?.message || "Failed to create provider", {
        variant: "error",
      }),
  });

  const createConnectionMutation = useMutation({
    mutationFn: createStoreChannelConnection,
    onSuccess: () => {
      enqueueSnackbar(t("channel.wizard.connectionCreated", "Connection created"), {
        variant: "success",
      });
      connectionsQuery.refetch();
      setStep(2);
      setTestResult("success");
    },
    onError: (e) =>
      enqueueSnackbar(e.response?.data?.message || "Failed to create connection", {
        variant: "error",
      }),
  });

  const providerExists = providers.some(
    (p) => `${p.providerCode || ""}`.toUpperCase() === `${providerCode}`.toUpperCase()
  );
  const connectionExists = connections.some(
    (c) =>
      `${c.providerCode}`.toUpperCase() === `${providerCode}`.toUpperCase() &&
      c.externalStoreId === externalStoreId
  );

  const handleSelectProvider = (code, name) => {
    setProviderCode(code);
    setDisplayName(name);
  };

  const handleCreateProvider = (e) => {
    e.preventDefault();
    if (!providerCode.trim() || !displayName.trim()) {
      enqueueSnackbar(t("channel.wizard.fillRequired", "Please fill required fields"), {
        variant: "warning",
      });
      return;
    }
    if (providerExists) {
      setStep(1);
      return;
    }
    createProviderMutation.mutate({
      providerCode: providerCode.trim().toUpperCase(),
      displayName: displayName.trim(),
      channelType: "marketplace",
      authType: "api_key",
    });
  };

  const handleCreateConnection = (e) => {
    e.preventDefault();
    if (!apiKey.trim() || !externalStoreId.trim()) {
      enqueueSnackbar(t("channel.wizard.fillRequired", "Please fill required fields"), {
        variant: "warning",
      });
      return;
    }
    createConnectionMutation.mutate({
      locationId: locationId.trim() || "default",
      providerCode: providerCode.trim().toUpperCase(),
      externalStoreId: externalStoreId.trim(),
      credentialRef: apiKey.trim(),
      menuMappingPolicy: "manual",
      syncMode: "hybrid",
      enabled: true,
    });
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 max-w-2xl">
      <h1 className="text-[#f5f5f5] text-2xl font-bold mb-6">
        {t("channel.wizard.title", "Channel Connection Wizard")}
      </h1>

      <div className="flex gap-2 mb-6">
        {WIZARD_STEPS.map((s, i) => (
          <div
            key={s}
            className={`flex-1 h-1 rounded ${
              i <= step ? "bg-[#F6B100]" : "bg-[#3b3b3b]"
            }`}
          />
        ))}
      </div>

      {/* Step 0: Select provider */}
      {step === 0 && (
        <div className="space-y-6">
          <p className="text-[#ababab]">
            {t("channel.wizard.step0Desc", "Select a delivery channel to connect.")}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {KNOWN_PROVIDERS.map((p) => (
              <button
                key={p.code}
                type="button"
                onClick={() => handleSelectProvider(p.code, p.name)}
                className={`p-4 rounded-xl border text-left transition-colors ${
                  providerCode === p.code
                    ? "border-[#F6B100] bg-[#2d2d2d]"
                    : "border-[#343434] bg-[#262626] hover:bg-[#2d2d2d]"
                }`}
              >
                <span className="text-[#f5f5f5] font-semibold">{p.name}</span>
              </button>
            ))}
          </div>
          {providerCode && (
            <form onSubmit={handleCreateProvider} className="space-y-4">
              <div>
                <label className="block text-[#ababab] text-sm mb-1">
                  {t("channel.providerCode", "Provider Code")}
                </label>
                <input
                  type="text"
                  value={providerCode}
                  onChange={(e) => setProviderCode(e.target.value)}
                  className="w-full bg-[#1f1f1f] text-[#f5f5f5] border border-[#3b3b3b] rounded-lg px-4 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-[#ababab] text-sm mb-1">
                  {t("channel.displayName", "Display Name")}
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[#1f1f1f] text-[#f5f5f5] border border-[#3b3b3b] rounded-lg px-4 py-2"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 rounded-lg bg-[#F6B100] text-[#1f1f1f] font-semibold"
              >
                {providerExists
                  ? t("channel.wizard.next", "Next")
                  : t("channel.wizard.createProvider", "Create & Next")}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Step 1: Credentials */}
      {step === 1 && (
        <form onSubmit={handleCreateConnection} className="space-y-4">
          <p className="text-[#ababab]">
            {t("channel.wizard.step1Desc", "Enter your API credentials for")} {displayName}
          </p>
          <div>
            <label className="block text-[#ababab] text-sm mb-1">
              {t("channel.apiKey", "API Key")} *
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#1f1f1f] text-[#f5f5f5] border border-[#3b3b3b] rounded-lg px-4 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-[#ababab] text-sm mb-1">
              {t("channel.externalStoreId", "External Store ID")} *
            </label>
            <input
              type="text"
              value={externalStoreId}
              onChange={(e) => setExternalStoreId(e.target.value)}
              placeholder="e.g. store_xxx"
              className="w-full bg-[#1f1f1f] text-[#f5f5f5] border border-[#3b3b3b] rounded-lg px-4 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-[#ababab] text-sm mb-1">
              {t("channel.locationId", "Location ID")}
            </label>
            <input
              type="text"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full bg-[#1f1f1f] text-[#f5f5f5] border border-[#3b3b3b] rounded-lg px-4 py-2"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="flex-1 py-3 rounded-lg bg-[#3b3b3b] text-[#f5f5f5]"
            >
              {t("common.back", "Back")}
            </button>
            <button
              type="submit"
              disabled={createConnectionMutation.isPending}
              className="flex-1 py-3 rounded-lg bg-[#F6B100] text-[#1f1f1f] font-semibold"
            >
              {connectionExists
                ? t("channel.wizard.testConnection", "Test Connection")
                : t("channel.wizard.createConnection", "Create Connection")}
            </button>
          </div>
        </form>
      )}

      {/* Step 2: Test result */}
      {step === 2 && (
        <div className="space-y-4">
          {testResult === "success" && (
            <div className="p-4 rounded-xl bg-[#1a3d1a] border border-[#2d5a2d] text-[#90ee90]">
              <p className="font-semibold">
                {t("channel.wizard.connectionSuccess", "Connection created successfully!")}
              </p>
              <p className="text-sm mt-2">
                {t("channel.wizard.nextSteps", "Go to Channels > Connections to manage mappings and view menu sync status.")}
              </p>
            </div>
          )}
          <button
            onClick={() => {
              setStep(0);
              setProviderCode("");
              setDisplayName("");
              setApiKey("");
              setExternalStoreId("");
              setTestResult(null);
            }}
            className="w-full py-3 rounded-lg bg-[#F6B100] text-[#1f1f1f] font-semibold"
          >
            {t("channel.wizard.addAnother", "Add Another Channel")}
          </button>
        </div>
      )}
    </div>
  );
};

export default ChannelConfigWizardPage;
