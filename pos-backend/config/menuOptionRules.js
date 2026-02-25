const normalizeName = (value = "") => `${value || ""}`.trim().toLowerCase();

const PORTION_SIZE_GROUP = {
  id: "portion_size",
  name: "规格",
  type: "single",
  required: true,
  options: [
    { id: "size_small", name: "小份", priceDelta: -20 },
    { id: "size_regular", name: "标准", priceDelta: 0, defaultSelected: true },
    { id: "size_large", name: "大份", priceDelta: 35 },
  ],
};

const SPICE_LEVEL_GROUP = {
  id: "spice_level",
  name: "辣度",
  type: "single",
  required: false,
  options: [
    { id: "spice_none", name: "不辣", priceDelta: 0, defaultSelected: true },
    { id: "spice_light", name: "微辣", priceDelta: 0 },
    { id: "spice_medium", name: "中辣", priceDelta: 0 },
    { id: "spice_hot", name: "重辣", priceDelta: 0 },
  ],
};

const OIL_LEVEL_GROUP = {
  id: "oil_level",
  name: "油量",
  type: "single",
  required: false,
  options: [
    { id: "oil_less", name: "少油", priceDelta: 0 },
    { id: "oil_normal", name: "正常", priceDelta: 0, defaultSelected: true },
    { id: "oil_more", name: "多油", priceDelta: 0 },
  ],
};

const COOKING_STYLE_GROUP = {
  id: "cooking_style",
  name: "做法",
  type: "single",
  required: false,
  options: [
    { id: "style_default", name: "默认做法", priceDelta: 0, defaultSelected: true },
    { id: "style_stir_fry", name: "清炒", priceDelta: 0 },
    { id: "style_dry_pot", name: "干锅", priceDelta: 10 },
    { id: "style_soup", name: "带汤汁", priceDelta: 5 },
  ],
};

const ADD_ON_GROUP = {
  id: "add_on",
  name: "加料",
  type: "multi",
  required: false,
  maxSelect: 3,
  options: [
    { id: "addon_egg", name: "加蛋", priceDelta: 20 },
    { id: "addon_tofu", name: "加豆腐", priceDelta: 30 },
    { id: "addon_rice", name: "加米饭", priceDelta: 15 },
  ],
};

const OPTION_RULES = [
  {
    name: "Paneer Tikka",
    optionGroups: [PORTION_SIZE_GROUP, SPICE_LEVEL_GROUP, OIL_LEVEL_GROUP, COOKING_STYLE_GROUP, ADD_ON_GROUP],
  },
  {
    name: "Chicken Tikka",
    optionGroups: [PORTION_SIZE_GROUP, SPICE_LEVEL_GROUP, OIL_LEVEL_GROUP, COOKING_STYLE_GROUP, ADD_ON_GROUP],
  },
  {
    name: "Tandoori Chicken",
    optionGroups: [PORTION_SIZE_GROUP, SPICE_LEVEL_GROUP, OIL_LEVEL_GROUP, COOKING_STYLE_GROUP],
  },
  {
    name: "Butter Chicken",
    optionGroups: [PORTION_SIZE_GROUP, SPICE_LEVEL_GROUP, OIL_LEVEL_GROUP, COOKING_STYLE_GROUP, ADD_ON_GROUP],
  },
  {
    name: "Paneer Butter Masala",
    optionGroups: [PORTION_SIZE_GROUP, SPICE_LEVEL_GROUP, OIL_LEVEL_GROUP, COOKING_STYLE_GROUP, ADD_ON_GROUP],
  },
  {
    name: "Chicken Biryani",
    optionGroups: [PORTION_SIZE_GROUP, SPICE_LEVEL_GROUP, COOKING_STYLE_GROUP, ADD_ON_GROUP],
  },
  {
    name: "Tomato Soup",
    optionGroups: [PORTION_SIZE_GROUP, SPICE_LEVEL_GROUP, COOKING_STYLE_GROUP],
  },
];

const OPTION_RULES_BY_ITEM = OPTION_RULES.reduce((acc, rule) => {
  acc.set(normalizeName(rule.name), rule);
  return acc;
}, new Map());

const getMenuOptionRuleByItemName = (itemName) => {
  const key = normalizeName(itemName);
  if (!key) {
    return null;
  }
  return OPTION_RULES_BY_ITEM.get(key) || null;
};

module.exports = {
  getMenuOptionRuleByItemName,
};
