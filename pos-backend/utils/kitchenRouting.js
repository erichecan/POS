const normalize = (value = "") => `${value}`.trim().toLowerCase();

const includesAny = (value, keywords) => keywords.some((keyword) => value.includes(keyword));

const routeItemToStationCode = (itemName) => {
  const normalized = normalize(itemName);

  if (
    includesAny(normalized, [
      "chai",
      "soda",
      "lassi",
      "coffee",
      "tea",
      "water",
      "cocktail",
      "whiskey",
      "vodka",
      "rum",
      "tequila",
      "beer",
      "iced",
      "lemon",
    ])
  ) {
    return "BAR";
  }

  if (
    includesAny(normalized, ["gulab", "kulfi", "chocolate lava", "ras malai", "dessert"])
  ) {
    return "DESSERT";
  }

  if (includesAny(normalized, ["pizza"])) {
    return "PIZZA";
  }

  if (includesAny(normalized, ["salad"])) {
    return "COLD";
  }

  return "HOT_LINE";
};

const deriveTicketStatusFromItems = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return "NEW";
  }

  const statuses = items.map((item) => item.status);

  if (statuses.every((status) => status === "CANCELLED")) {
    return "CANCELLED";
  }

  if (statuses.every((status) => status === "READY" || status === "CANCELLED")) {
    return "READY";
  }

  if (statuses.some((status) => status === "PREPARING")) {
    return "PREPARING";
  }

  return "NEW";
};

module.exports = {
  routeItemToStationCode,
  deriveTicketStatusFromItems,
};
