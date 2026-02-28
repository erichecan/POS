const normalize = (value = "") => `${value}`.trim().toLowerCase();

const includesAny = (value, keywords) => keywords.some((keyword) => value.includes(keyword));

// 2026-02-28: Chinese dish routing for demo
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
      // 中餐饮品/酒水
      "茶",
      "饮料",
      "酒",
      "啤",
      "白酒",
      "黄酒",
      "红酒",
      "奶茶",
      "酸梅",
      "柠檬",
      "橙汁",
    ])
  ) {
    return "BAR";
  }

  if (
    includesAny(normalized, [
      "gulab",
      "kulfi",
      "chocolate lava",
      "ras malai",
      "dessert",
      // 中餐甜品
      "甜",
      "糕",
      "甘露",
    ])
  ) {
    return "DESSERT";
  }

  if (includesAny(normalized, ["pizza"])) {
    return "PIZZA";
  }

  if (
    includesAny(normalized, [
      "salad",
      // 中餐凉菜/小吃
      "凉菜",
      "小吃",
    ])
  ) {
    return "COLD";
  }

  // 汤/羹/热菜/主食/包/饭/面/炒 等默认走热菜线
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
