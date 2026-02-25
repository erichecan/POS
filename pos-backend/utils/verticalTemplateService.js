const { VERTICAL_TEMPLATES } = require("../config/verticalTemplateCatalog");

const normalizeCountryCode = (value, fallback = "") => {
  const code = `${value || ""}`.trim().toUpperCase();
  return code || fallback;
};

const normalizeTemplateCode = (value, fallback = "") => {
  const code = `${value || ""}`.trim().toUpperCase();
  return code || fallback;
};

const isTemplateAllowedInCountry = (template, countryCode) => {
  if (!countryCode) {
    return true;
  }
  const supportedCountries = Array.isArray(template?.supportedCountries) ? template.supportedCountries : [];
  return supportedCountries.includes(countryCode);
};

const listVerticalTemplates = ({ countryCode = "", typeGroup = "", keyword = "" } = {}) => {
  const normalizedCountry = normalizeCountryCode(countryCode);
  const normalizedTypeGroup = `${typeGroup || ""}`.trim().toUpperCase();
  const normalizedKeyword = `${keyword || ""}`.trim().toLowerCase();

  return VERTICAL_TEMPLATES.filter((template) => {
    if (!isTemplateAllowedInCountry(template, normalizedCountry)) {
      return false;
    }

    if (normalizedTypeGroup && `${template.typeGroup || ""}`.trim().toUpperCase() !== normalizedTypeGroup) {
      return false;
    }

    if (!normalizedKeyword) {
      return true;
    }

    const searchable = [
      template.templateCode,
      template.displayName,
      template.displayNameEn,
      template.typeGroup,
    ]
      .map((value) => `${value || ""}`.toLowerCase())
      .join(" ");
    return searchable.includes(normalizedKeyword);
  });
};

const getVerticalTemplateByCode = (templateCode) => {
  const normalizedCode = normalizeTemplateCode(templateCode);
  if (!normalizedCode) {
    return null;
  }

  return VERTICAL_TEMPLATES.find((template) => template.templateCode === normalizedCode) || null;
};

const deepMergeObject = (baseValue, overrideValue) => {
  if (
    typeof baseValue !== "object" ||
    baseValue === null ||
    Array.isArray(baseValue) ||
    typeof overrideValue !== "object" ||
    overrideValue === null ||
    Array.isArray(overrideValue)
  ) {
    return overrideValue === undefined ? baseValue : overrideValue;
  }

  const output = { ...baseValue };
  Object.keys(overrideValue).forEach((key) => {
    output[key] = deepMergeObject(baseValue[key], overrideValue[key]);
  });
  return output;
};

const resolveVerticalTemplateConfig = ({ templateCode, overrides = {} } = {}) => {
  const template = getVerticalTemplateByCode(templateCode);
  if (!template) {
    return null;
  }

  return deepMergeObject(template, overrides || {});
};

module.exports = {
  normalizeCountryCode,
  normalizeTemplateCode,
  listVerticalTemplates,
  getVerticalTemplateByCode,
  resolveVerticalTemplateConfig,
};
