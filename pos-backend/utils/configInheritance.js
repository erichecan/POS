const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const deepMerge = (base = {}, override = {}) => {
  const output = { ...(isPlainObject(base) ? base : {}) };
  if (!isPlainObject(override)) {
    return output;
  }

  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value) && isPlainObject(output[key])) {
      output[key] = deepMerge(output[key], value);
    } else {
      output[key] = value;
    }
  }

  return output;
};

const resolveStoreSettings = ({ organizationDefaults = {}, regionDefaults = {}, storeOverrides = {} }) =>
  deepMerge(deepMerge(organizationDefaults, regionDefaults), storeOverrides);

module.exports = {
  isPlainObject,
  deepMerge,
  resolveStoreSettings,
};
