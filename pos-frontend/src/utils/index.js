const bgarr = [
  "#b73e3e",
  "#5b45b0",
  "#7f167f",
  "#735f32",
  "#1d2569",
  "#285430",
  "#f6b100",
  "#025cca",
  "#be3e3f",
  "#02ca3a",
];

const toSeedHash = (seed) => {
  const safeSeed = `${seed || ""}`.trim();
  if (!safeSeed) {
    return 0;
  }

  let hash = 0;
  for (let i = 0; i < safeSeed.length; i += 1) {
    hash = (hash << 5) - hash + safeSeed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const getBgColor = (seed) => {
  if (seed !== undefined && seed !== null && `${seed}`.trim()) {
    return bgarr[toSeedHash(seed) % bgarr.length];
  }

  const randomBg = Math.floor(Math.random() * bgarr.length);
  const color = bgarr[randomBg];
  return color;
};

export const getAvatarName = (name) => {
  if(!name) return "";

  return name.split(" ").map(word => word[0]).join("").toUpperCase();

}

export const formatDate = (date) => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${months[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}, ${date.getFullYear()}`;
};

export const formatDateAndTime = (date) => {
  const dateAndTime = new Date(date).toLocaleString("en-US", {
    month: "long",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata"
  })

  return dateAndTime;
}

export const formatReadableOrderId = (orderId) => {
  const raw = `${orderId || ""}`.trim();
  if (!raw) {
    return "ORD-UNKNOWN";
  }
  return `ORD-${raw.slice(-6).toUpperCase()}`;
};

const capitalizeWord = (word) => {
  if (!word) {
    return "";
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
};

export const getReadableCustomerName = (name, fallbackPhone = "") => {
  const raw = `${name || ""}`.trim();
  if (!raw) {
    return "Walk-in Guest";
  }

  const looksAutomated =
    /(^pw[_-]e2e[_-]\d+$)|(^phase\d+)|(^test[_-])/i.test(raw) || /_\d{8,}$/.test(raw);
  if (looksAutomated) {
    const phoneSuffix = `${fallbackPhone || ""}`.replace(/\D/g, "").slice(-4);
    return phoneSuffix ? `Guest ${phoneSuffix}` : "Walk-in Guest";
  }

  return raw
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(capitalizeWord)
    .join(" ");
};

export const getDefaultCartRowId = (row, index = 0) => {
  const base = `${row?.name || "item"}-${row?.seatNo || "na"}-${index}`;
  const hash = toSeedHash(base);
  return `cart-${hash.toString(16)}`;
};
