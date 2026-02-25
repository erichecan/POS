const createHttpError = require("http-errors");
const { VERTICAL_TEMPLATE_VERSION } = require("../config/verticalTemplateCatalog");
const {
  normalizeCountryCode,
  normalizeTemplateCode,
  getVerticalTemplateByCode,
  resolveVerticalTemplateConfig,
} = require("./verticalTemplateService");
const {
  normalizeProviderCode,
  validateHardwareSelection,
  suggestHardwareSelections,
} = require("./hardwareCatalogService");

const normalizeLocationId = (value) => `${value || ""}`.trim();

const normalizeStatus = (value, fallback = "ACTIVE") => `${value || fallback}`.trim().toUpperCase();

const toUniqueUppercaseArray = (value = []) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const output = [];
  const seen = new Set();
  value.forEach((item) => {
    const normalized = `${item || ""}`.trim().toUpperCase();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    output.push(normalized);
  });
  return output;
};

const toSafeObject = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
};

const toUniqueStringArray = (value = []) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const output = [];
  const seen = new Set();
  value.forEach((item) => {
    const normalized = `${item || ""}`.trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    output.push(normalized);
  });
  return output;
};

const buildVerticalDraft = ({ locationId, countryCode, provisioning = {} } = {}) => {
  const templateCode = normalizeTemplateCode(provisioning.verticalTemplateCode || provisioning.templateCode);
  if (!templateCode) {
    return {
      draft: null,
      resolvedTemplate: null,
    };
  }

  const matchedTemplate = getVerticalTemplateByCode(templateCode);
  if (!matchedTemplate) {
    throw createHttpError(400, `Unknown vertical template: ${templateCode}.`);
  }

  if (
    !Array.isArray(matchedTemplate.supportedCountries) ||
    !matchedTemplate.supportedCountries.includes(countryCode)
  ) {
    throw createHttpError(400, `Template ${templateCode} is not supported in ${countryCode}.`);
  }

  const overrides = toSafeObject(provisioning.verticalOverrides);
  const resolvedTemplate = resolveVerticalTemplateConfig({
    templateCode,
    overrides,
  });

  return {
    draft: {
      locationId,
      countryCode,
      templateCode,
      templateVersion: VERTICAL_TEMPLATE_VERSION,
      profileStatus: normalizeStatus(provisioning.verticalProfileStatus),
      overrides,
      metadata: toSafeObject(provisioning.verticalMetadata),
    },
    resolvedTemplate,
  };
};

const buildHardwareDraft = ({ locationId, countryCode, provisioning = {}, resolvedTemplate } = {}) => {
  const requestedCapabilities = toUniqueUppercaseArray(provisioning.capabilityTargets);
  const templateRequired = toUniqueUppercaseArray(resolvedTemplate?.requiredCapabilities || []);
  const templateRecommended = toUniqueUppercaseArray(resolvedTemplate?.recommendedCapabilities || []);
  const capabilityTargets = toUniqueUppercaseArray([
    ...requestedCapabilities,
    ...templateRequired,
    ...templateRecommended,
  ]);

  const hasExplicitSelections =
    Array.isArray(provisioning.hardwareSelections) && provisioning.hardwareSelections.length > 0;
  const shouldCreateHardwareProfile =
    provisioning.autoCreateHardwareProfile === true ||
    hasExplicitSelections ||
    capabilityTargets.length > 0;

  if (!shouldCreateHardwareProfile) {
    return {
      draft: null,
      summary: null,
    };
  }

  const providerPriority = toUniqueUppercaseArray(provisioning.providerPriority).map((providerCode) =>
    normalizeProviderCode(providerCode)
  );
  const autoSelectHardware = provisioning.autoSelectHardware !== false;

  let suggestion = { selections: [], unmatchedCapabilities: [], warnings: [] };
  let selectionInput = hasExplicitSelections ? provisioning.hardwareSelections : [];
  if (!hasExplicitSelections && autoSelectHardware && capabilityTargets.length > 0) {
    suggestion = suggestHardwareSelections({
      countryCode,
      capabilityTargets,
      providerPriority,
    });
    selectionInput = suggestion.selections;
  }

  const validation = validateHardwareSelection({
    countryCode,
    selections: selectionInput,
  });

  if (validation.errors.length > 0) {
    const error = createHttpError(400, "Invalid store provisioning hardware selections.");
    error.details = validation.errors;
    throw error;
  }

  const warnings = toUniqueStringArray([
    ...(validation.warnings || []),
    ...(suggestion.warnings || []),
  ]);
  const missingCapabilities = capabilityTargets.filter(
    (capability) => !validation.coveredCapabilities.includes(capability)
  );

  return {
    draft: {
      locationId,
      countryCode,
      businessType: `${provisioning.businessType || resolvedTemplate?.templateCode || ""}`
        .trim()
        .toUpperCase(),
      profileStatus: normalizeStatus(provisioning.hardwareProfileStatus),
      providerPriority,
      capabilityTargets,
      selections: validation.resolvedSelections,
      validationWarnings: warnings,
      metadata: toSafeObject(provisioning.hardwareMetadata),
    },
    summary: {
      missingCapabilities,
      coveredCapabilities: validation.coveredCapabilities,
      warnings,
      autoSelected: !hasExplicitSelections && autoSelectHardware,
    },
  };
};

const buildStoreProvisioningPlan = ({ locationId, defaultCountryCode = "US", provisioning = {} } = {}) => {
  const normalizedLocationId = normalizeLocationId(locationId);
  if (!normalizedLocationId) {
    throw createHttpError(400, "locationId is required for store provisioning.");
  }

  if (!provisioning || typeof provisioning !== "object" || Array.isArray(provisioning)) {
    return {
      enabled: false,
      countryCode: normalizeCountryCode(defaultCountryCode, "US"),
      locationId: normalizedLocationId,
      verticalProfileDraft: null,
      hardwareProfileDraft: null,
      summary: null,
    };
  }

  const hasProvisioningFields = Object.keys(provisioning).length > 0;
  const countryCode = normalizeCountryCode(provisioning.countryCode, normalizeCountryCode(defaultCountryCode, "US"));
  if (!hasProvisioningFields) {
    return {
      enabled: false,
      countryCode,
      locationId: normalizedLocationId,
      verticalProfileDraft: null,
      hardwareProfileDraft: null,
      summary: null,
    };
  }

  const { draft: verticalProfileDraft, resolvedTemplate } = buildVerticalDraft({
    locationId: normalizedLocationId,
    countryCode,
    provisioning,
  });
  const { draft: hardwareProfileDraft, summary: hardwareSummary } = buildHardwareDraft({
    locationId: normalizedLocationId,
    countryCode,
    provisioning,
    resolvedTemplate,
  });

  return {
    enabled: true,
    countryCode,
    locationId: normalizedLocationId,
    verticalProfileDraft,
    hardwareProfileDraft,
    summary: {
      templateCode: verticalProfileDraft?.templateCode || null,
      hardware: hardwareSummary,
    },
  };
};

module.exports = {
  buildStoreProvisioningPlan,
  __testables: {
    toUniqueUppercaseArray,
  },
};
