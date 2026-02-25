const { HARDWARE_PROVIDERS, CAPABILITIES } = require("../config/hardwareCatalog");

const normalizeCountryCode = (value, fallback = "") => {
  const code = `${value || ""}`.trim().toUpperCase();
  return code || fallback;
};

const normalizeProviderCode = (value, fallback = "") => {
  const code = `${value || ""}`.trim().toUpperCase();
  return code || fallback;
};

const normalizeCapability = (value) => `${value || ""}`.trim().toUpperCase();
const normalizeDeviceClass = (value) => `${value || ""}`.trim().toUpperCase();
const normalizeRoleKey = (value) => `${value || ""}`.trim().toUpperCase();

const isCountryAllowed = (provider, countryCode) => {
  if (!countryCode) {
    return true;
  }
  const supported = Array.isArray(provider?.countryCodes) ? provider.countryCodes : [];
  return supported.includes(countryCode);
};

const listHardwareCatalog = ({ countryCode = "", providerCode = "", capability = "", deviceClass = "" } = {}) => {
  const normalizedCountry = normalizeCountryCode(countryCode);
  const normalizedProvider = normalizeProviderCode(providerCode);
  const normalizedCapability = normalizeCapability(capability);
  const normalizedDeviceClass = normalizeDeviceClass(deviceClass);

  return HARDWARE_PROVIDERS.filter((provider) => {
    if (normalizedProvider && provider.providerCode !== normalizedProvider) {
      return false;
    }
    return isCountryAllowed(provider, normalizedCountry);
  })
    .map((provider) => {
      const devices = Array.isArray(provider.devices) ? provider.devices : [];
      const filteredDevices = devices.filter((device) => {
        if (normalizedDeviceClass && `${device.deviceClass || ""}`.toUpperCase() !== normalizedDeviceClass) {
          return false;
        }
        if (
          normalizedCapability &&
          !Array.isArray(device.capabilityTags)
        ) {
          return false;
        }
        if (normalizedCapability) {
          return device.capabilityTags.map((tag) => `${tag}`.toUpperCase()).includes(normalizedCapability);
        }
        return true;
      });

      return {
        ...provider,
        devices: filteredDevices,
      };
    })
    .filter((provider) => provider.devices.length > 0);
};

const findCatalogDevice = ({ providerCode, modelCode }) => {
  const normalizedProvider = normalizeProviderCode(providerCode);
  const normalizedModelCode = `${modelCode || ""}`.trim().toUpperCase();
  if (!normalizedProvider || !normalizedModelCode) {
    return null;
  }

  const provider = HARDWARE_PROVIDERS.find((row) => row.providerCode === normalizedProvider);
  if (!provider) {
    return null;
  }

  const device = (provider.devices || []).find(
    (row) => `${row?.modelCode || ""}`.trim().toUpperCase() === normalizedModelCode
  );
  if (!device) {
    return null;
  }

  return {
    provider,
    device,
  };
};

const DEFAULT_PROVIDER_PRIORITY = Object.freeze(["TOAST", "SQUARE", "CUSTOM"]);

const DEVICE_CLASS_ROLE_MAP = Object.freeze({
  POS_TERMINAL: "FRONT_COUNTER_POS",
  MOBILE_POS: "TABLESIDE_MOBILE_POS",
  PAYMENT_TERMINAL: "PAYMENT_TERMINAL",
  RECEIPT_PRINTER: "FRONT_RECEIPT_PRINTER",
  KITCHEN_PRINTER: "KITCHEN_PRINTER",
  KDS: "KDS_SCREEN",
  CASH_DRAWER: "CASH_DRAWER",
  KIOSK: "SELF_ORDER_KIOSK",
  CUSTOMER_DISPLAY: "CUSTOMER_DISPLAY",
  QUEUE_DISPLAY: "QUEUE_DISPLAY",
  DIGITAL_SIGNAGE: "DIGITAL_SIGNAGE",
  NETWORK: "NETWORK_INFRA",
  OTHER: "GENERIC_DEVICE",
});

const CAPABILITY_ROLE_HINTS = Object.freeze({
  COUNTER_CHECKOUT: "FRONT_COUNTER_POS",
  TABLESIDE_ORDERING: "TABLESIDE_MOBILE_POS",
  EMV_NFC_PAYMENT: "PAYMENT_TERMINAL",
  FRONT_RECEIPT_PRINT: "FRONT_RECEIPT_PRINTER",
  KITCHEN_TICKET_PRINT: "KITCHEN_PRINTER",
  KDS_PRODUCTION: "KDS_SCREEN",
  CASH_MANAGEMENT: "CASH_DRAWER",
  SELF_ORDER_KIOSK: "SELF_ORDER_KIOSK",
  CUSTOMER_FACING_DISPLAY: "CUSTOMER_DISPLAY",
  QUEUE_CALLING: "QUEUE_DISPLAY",
  MENU_AD_SIGNAGE: "DIGITAL_SIGNAGE",
  OFFLINE_TOLERANCE: "NETWORK_INFRA",
});

const toUniqueUppercase = (values = []) => {
  if (!Array.isArray(values)) {
    return [];
  }

  const rows = [];
  const seen = new Set();
  values.forEach((value) => {
    const normalized = `${value || ""}`.trim().toUpperCase();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    rows.push(normalized);
  });
  return rows;
};

const resolveProviderPriority = (providerPriority = []) => {
  const custom = toUniqueUppercase(providerPriority).map((code) => normalizeProviderCode(code)).filter(Boolean);
  const set = new Set(custom);
  DEFAULT_PROVIDER_PRIORITY.forEach((code) => set.add(code));
  return Array.from(set);
};

const resolveRoleKey = ({ capability, deviceClass }) => {
  const capabilityRole = normalizeRoleKey(CAPABILITY_ROLE_HINTS[normalizeCapability(capability)]);
  if (capabilityRole) {
    return capabilityRole;
  }
  return normalizeRoleKey(DEVICE_CLASS_ROLE_MAP[normalizeDeviceClass(deviceClass)] || "GENERIC_DEVICE");
};

const pickDeviceForCapability = ({ providers = [], capability, providerPriority = [] }) => {
  const normalizedCapability = normalizeCapability(capability);
  if (!normalizedCapability) {
    return null;
  }

  const providerMap = new Map(
    providers.map((provider) => [normalizeProviderCode(provider.providerCode), provider])
  );

  const priorityList = resolveProviderPriority(providerPriority);
  for (const providerCode of priorityList) {
    const provider = providerMap.get(providerCode);
    if (!provider) {
      continue;
    }

    const matchedDevice = (provider.devices || []).find((device) =>
      (device.capabilityTags || []).map((tag) => normalizeCapability(tag)).includes(normalizedCapability)
    );
    if (matchedDevice) {
      return {
        provider,
        device: matchedDevice,
      };
    }
  }

  for (const provider of providers) {
    const matchedDevice = (provider.devices || []).find((device) =>
      (device.capabilityTags || []).map((tag) => normalizeCapability(tag)).includes(normalizedCapability)
    );
    if (matchedDevice) {
      return {
        provider,
        device: matchedDevice,
      };
    }
  }

  return null;
};

const suggestHardwareSelections = ({ countryCode = "", capabilityTargets = [], providerPriority = [] } = {}) => {
  const normalizedCountry = normalizeCountryCode(countryCode);
  const targets = toUniqueUppercase(capabilityTargets);
  const providers = listHardwareCatalog({ countryCode: normalizedCountry });
  const selectionMap = new Map();
  const unmatchedCapabilities = [];

  targets.forEach((capability) => {
    const matched = pickDeviceForCapability({
      providers,
      capability,
      providerPriority,
    });

    if (!matched) {
      unmatchedCapabilities.push(capability);
      return;
    }

    const selectionKey = `${normalizeProviderCode(matched.provider.providerCode)}::${`${matched.device.modelCode || ""}`
      .trim()
      .toUpperCase()}::${resolveRoleKey({ capability, deviceClass: matched.device.deviceClass })}`;

    if (!selectionMap.has(selectionKey)) {
      selectionMap.set(selectionKey, {
        roleKey: resolveRoleKey({ capability, deviceClass: matched.device.deviceClass }),
        providerCode: normalizeProviderCode(matched.provider.providerCode),
        modelCode: `${matched.device.modelCode || ""}`.trim().toUpperCase(),
        quantity: 1,
        zone: "",
        metadata: {
          autoSelected: true,
          matchedCapabilities: [capability],
        },
      });
      return;
    }

    const current = selectionMap.get(selectionKey);
    const capabilities = toUniqueUppercase([
      ...(current.metadata?.matchedCapabilities || []),
      capability,
    ]);
    current.metadata = {
      ...(current.metadata || {}),
      autoSelected: true,
      matchedCapabilities: capabilities,
    };
    selectionMap.set(selectionKey, current);
  });

  const selections = Array.from(selectionMap.values());
  const warnings = unmatchedCapabilities.map(
    (capability) => `No hardware model found for capability ${capability} in ${normalizedCountry || "selected country"}.`
  );

  return {
    selections,
    unmatchedCapabilities,
    warnings,
  };
};

const validateHardwareSelection = ({ countryCode = "", selections = [] } = {}) => {
  const normalizedCountry = normalizeCountryCode(countryCode);
  const rows = Array.isArray(selections) ? selections : [];
  const errors = [];
  const warnings = [];
  const resolvedSelections = [];
  const coveredCapabilities = new Set();

  rows.forEach((selection, index) => {
    const providerCode = normalizeProviderCode(selection.providerCode);
    const modelCode = `${selection.modelCode || ""}`.trim().toUpperCase();
    const quantity = Number(selection.quantity || 1);
    const roleKey = `${selection.roleKey || ""}`.trim().toUpperCase();

    if (!providerCode || !modelCode || !roleKey) {
      errors.push({
        index,
        reason: "providerCode, modelCode and roleKey are required.",
      });
      return;
    }

    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 200) {
      errors.push({
        index,
        reason: "quantity must be between 1 and 200.",
      });
      return;
    }

    const matched = findCatalogDevice({ providerCode, modelCode });
    if (!matched) {
      errors.push({
        index,
        reason: `Unknown provider/model: ${providerCode}/${modelCode}.`,
      });
      return;
    }

    if (!isCountryAllowed(matched.provider, normalizedCountry)) {
      errors.push({
        index,
        reason: `${providerCode}/${modelCode} is not supported in ${normalizedCountry || "current country profile"}.`,
      });
      return;
    }

    (matched.device.capabilityTags || []).forEach((tag) => coveredCapabilities.add(`${tag}`.toUpperCase()));

    resolvedSelections.push({
      roleKey,
      providerCode,
      modelCode,
      quantity,
      zone: `${selection.zone || ""}`.trim(),
      metadata: selection.metadata || {},
      resolvedDisplayName: matched.device.displayName,
      resolvedDeviceClass: matched.device.deviceClass,
      capabilityTags: matched.device.capabilityTags || [],
    });
  });

  if (resolvedSelections.length > 0 && !coveredCapabilities.has("EMV_NFC_PAYMENT")) {
    warnings.push("No payment terminal capability (EMV_NFC_PAYMENT) selected.");
  }
  if (resolvedSelections.length > 0 && !coveredCapabilities.has("FRONT_RECEIPT_PRINT")) {
    warnings.push("No front receipt printer selected.");
  }

  return {
    errors,
    warnings,
    resolvedSelections,
    coveredCapabilities: Array.from(coveredCapabilities),
  };
};

module.exports = {
  CAPABILITIES,
  normalizeCountryCode,
  normalizeProviderCode,
  listHardwareCatalog,
  findCatalogDevice,
  validateHardwareSelection,
  suggestHardwareSelections,
};
