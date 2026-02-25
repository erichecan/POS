const dns = require("dns");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const resolveSrvWithRetry = async (recordName, retries = 30) => {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      // Use callback API; in this environment it has proven more reliable than dns.promises.
      const records = await new Promise((resolve, reject) => {
        dns.resolveSrv(recordName, (error, result) => {
          if (error) return reject(error);
          return resolve(result);
        });
      });

      if (Array.isArray(records) && records.length > 0) {
        return records;
      }

      lastError = new Error(`No SRV records returned for ${recordName}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < retries) {
      await wait(attempt * 200);
    }
  }

  throw lastError;
};

const resolveTxtBestEffort = async (host) => {
  try {
    return await new Promise((resolve, reject) => {
      dns.resolveTxt(host, (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      });
    });
  } catch (error) {
    return [];
  }
};

const buildAuthSegment = (url) => {
  if (!url.username) {
    return "";
  }

  const user = encodeURIComponent(decodeURIComponent(url.username));
  const password = encodeURIComponent(decodeURIComponent(url.password || ""));
  return `${user}:${password}@`;
};

const mergeQueryParams = (txtParamString, explicitParams) => {
  const merged = new URLSearchParams();

  if (txtParamString) {
    const txtParams = new URLSearchParams(txtParamString);
    for (const [key, value] of txtParams.entries()) {
      merged.set(key, value);
    }
  }

  for (const [key, value] of explicitParams.entries()) {
    merged.set(key, value);
  }

  if (!merged.has("tls") && !merged.has("ssl")) {
    merged.set("tls", "true");
  }

  return merged.toString();
};

const resolveMongoUri = async (mongodbUri) => {
  if (process.env.MONGODB_DIRECT_URI) {
    return process.env.MONGODB_DIRECT_URI;
  }

  if (!mongodbUri || !mongodbUri.startsWith("mongodb+srv://")) {
    return mongodbUri;
  }

  const parsed = new URL(mongodbUri);
  const srvHost = parsed.hostname;
  const dbName = parsed.pathname.replace(/^\//, "") || "admin";
  const authSegment = buildAuthSegment(parsed);

  const [srvRecords, txtRecords] = await Promise.all([
    resolveSrvWithRetry(`_mongodb._tcp.${srvHost}`),
    resolveTxtBestEffort(srvHost)
  ]);

  if (!srvRecords.length) {
    throw new Error(`No SRV records found for ${srvHost}`);
  }

  const hosts = srvRecords.map((record) => `${record.name}:${record.port}`).join(",");
  const txtParams = txtRecords.flat().join("&");
  const query = mergeQueryParams(txtParams, parsed.searchParams);

  return `mongodb://${authSegment}${hosts}/${dbName}?${query}`;
};

module.exports = { resolveMongoUri };
