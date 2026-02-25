const createHttpError = require("http-errors");
const config = require("../config/config");
const { getMenuOptionRuleByItemName } = require("../config/menuOptionRules");

const TAX_RATE = Number.isFinite(Number(config.taxRatePercent))
  ? Number(config.taxRatePercent)
  : 5.25;

const MENU_PRICE_MAP = Object.freeze({
  "paneer tikka": 250,
  "chicken tikka": 300,
  "tandoori chicken": 350,
  "samosa": 100,
  "aloo tikki": 120,
  "hara bhara kebab": 220,
  "butter chicken": 400,
  "paneer butter masala": 350,
  "chicken biryani": 450,
  "dal makhani": 180,
  "kadai paneer": 300,
  "rogan josh": 500,
  "masala chai": 50,
  "lemon soda": 80,
  "mango lassi": 120,
  "cold coffee": 150,
  "fresh lime water": 60,
  "iced tea": 100,
  "tomato soup": 120,
  "sweet corn soup": 130,
  "hot & sour soup": 140,
  "chicken clear soup": 160,
  "mushroom soup": 150,
  "lemon coriander soup": 110,
  "gulab jamun": 100,
  kulfi: 150,
  "chocolate lava cake": 250,
  "ras malai": 180,
  "margherita pizza": 350,
  "veg supreme pizza": 400,
  "pepperoni pizza": 450,
  beer: 200,
  whiskey: 500,
  vodka: 450,
  rum: 350,
  tequila: 600,
  cocktail: 400,
  "caesar salad": 200,
  "greek salad": 250,
  "fruit salad": 150,
  "chicken salad": 300,
  "tuna salad": 350,
});

const normalizeName = (value = "") => `${value}`.trim().toLowerCase();
const normalizeLocationId = (value = "") => `${value}`.trim() || "default";
const normalizeChannelCode = (value = "") => `${value || "ALL"}`.trim().toUpperCase() || "ALL";
const normalizeVersionTag = (value = "") => `${value || ""}`.trim();

const roundToTwo = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const MAX_ITEM_NOTE_LENGTH = 200;
const MAX_MODIFIER_COUNT = 20;
const normalizeToken = (value = "") => `${value || ""}`.trim().toLowerCase();

const normalizeSeatNo = (seatNoRaw) => {
  if (seatNoRaw === undefined || seatNoRaw === null || `${seatNoRaw}`.trim?.() === "") {
    return undefined;
  }

  const seatNo = Number(seatNoRaw);
  if (!Number.isInteger(seatNo) || seatNo < 1 || seatNo > 50) {
    throw createHttpError(400, "Invalid seatNo.");
  }

  return seatNo;
};

const buildCanonicalRuleModifier = (group, option) => ({
  groupId: `${group?.id || ""}`.trim(),
  groupName: `${group?.name || ""}`.trim(),
  optionId: `${option?.id || ""}`.trim(),
  name: `${option?.name || ""}`.trim(),
  priceDelta: roundToTwo(Number(option?.priceDelta || 0)),
});

const normalizeItemModifiersByRule = ({ itemName, rawModifiers, rule }) => {
  const safeItemName = `${itemName || ""}`.trim();
  const safeModifiers = Array.isArray(rawModifiers) ? rawModifiers : [];
  const optionGroups = Array.isArray(rule?.optionGroups) ? rule.optionGroups : [];

  const groupsById = new Map();
  const groupsByName = new Map();
  optionGroups.forEach((group) => {
    const groupIdKey = normalizeToken(group?.id);
    const groupNameKey = normalizeToken(group?.name);
    if (groupIdKey) {
      groupsById.set(groupIdKey, group);
    }
    if (groupNameKey) {
      groupsByName.set(groupNameKey, group);
    }
  });

  const selectedCountByGroup = new Map();
  const selectedOptionKeys = new Set();
  const normalized = safeModifiers.map((modifier) => {
    const groupTokenId = normalizeToken(modifier?.groupId);
    const groupTokenName = normalizeToken(modifier?.groupName);
    const group = (groupTokenId && groupsById.get(groupTokenId)) || (groupTokenName && groupsByName.get(groupTokenName));
    if (!group) {
      throw createHttpError(
        400,
        `Unsupported modifier group for item ${safeItemName}.`
      );
    }

    const optionRows = Array.isArray(group.options) ? group.options : [];
    const optionsById = new Map();
    const optionsByName = new Map();
    optionRows.forEach((option) => {
      const optionIdKey = normalizeToken(option?.id);
      const optionNameKey = normalizeToken(option?.name);
      if (optionIdKey) {
        optionsById.set(optionIdKey, option);
      }
      if (optionNameKey) {
        optionsByName.set(optionNameKey, option);
      }
    });

    const optionTokenId = normalizeToken(modifier?.optionId);
    const optionTokenName = normalizeToken(modifier?.name);
    const option =
      (optionTokenId && optionsById.get(optionTokenId)) ||
      (optionTokenName && optionsByName.get(optionTokenName));
    if (!option) {
      throw createHttpError(
        400,
        `Unsupported modifier option in group ${group.name} for item ${safeItemName}.`
      );
    }

    const groupId = `${group?.id || ""}`.trim();
    const optionId = `${option?.id || ""}`.trim();
    const uniqueOptionKey = `${normalizeToken(groupId)}::${normalizeToken(optionId)}`;
    if (selectedOptionKeys.has(uniqueOptionKey)) {
      throw createHttpError(
        400,
        `Duplicate modifier option in group ${group.name} for item ${safeItemName}.`
      );
    }
    selectedOptionKeys.add(uniqueOptionKey);

    const groupCountKey = normalizeToken(groupId);
    selectedCountByGroup.set(groupCountKey, Number(selectedCountByGroup.get(groupCountKey) || 0) + 1);
    return buildCanonicalRuleModifier(group, option);
  });

  // Backward-compatibility: if required group omitted, auto-fill its default/first option.
  optionGroups.forEach((group) => {
    const groupCountKey = normalizeToken(group?.id);
    const selectedCount = Number(selectedCountByGroup.get(groupCountKey) || 0);
    if (!group?.required || selectedCount > 0) {
      return;
    }

    const optionRows = Array.isArray(group.options) ? group.options : [];
    const fallbackOption =
      optionRows.find((option) => Boolean(option?.defaultSelected)) || optionRows[0];
    if (!fallbackOption) {
      throw createHttpError(
        400,
        `Required modifier group ${group?.name || "unknown"} has no selectable options.`
      );
    }

    const uniqueOptionKey = `${normalizeToken(group?.id)}::${normalizeToken(fallbackOption?.id)}`;
    if (!selectedOptionKeys.has(uniqueOptionKey)) {
      normalized.push(buildCanonicalRuleModifier(group, fallbackOption));
      selectedOptionKeys.add(uniqueOptionKey);
      selectedCountByGroup.set(groupCountKey, selectedCount + 1);
    }
  });

  optionGroups.forEach((group) => {
    const groupCountKey = normalizeToken(group?.id);
    const selectedCount = Number(selectedCountByGroup.get(groupCountKey) || 0);
    const minSelect = Number(group?.minSelect);
    const maxSelect = Number(group?.maxSelect);

    if (group?.type !== "multi" && selectedCount > 1) {
      throw createHttpError(
        400,
        `Modifier group ${group?.name || group?.id} only supports single selection for item ${safeItemName}.`
      );
    }

    if (Number.isInteger(minSelect) && minSelect > 0 && selectedCount < minSelect) {
      throw createHttpError(
        400,
        `Modifier group ${group?.name || group?.id} requires at least ${minSelect} selections for item ${safeItemName}.`
      );
    }

    if (Number.isInteger(maxSelect) && maxSelect > 0 && selectedCount > maxSelect) {
      throw createHttpError(
        400,
        `Modifier group ${group?.name || group?.id} allows at most ${maxSelect} selections for item ${safeItemName}.`
      );
    }
  });

  return normalized;
};

const normalizeItemModifiers = (rawModifiers, { itemName = "" } = {}) => {
  if (!Array.isArray(rawModifiers) || rawModifiers.length === 0) {
    const rule = getMenuOptionRuleByItemName(itemName);
    if (!rule) {
      return [];
    }
    return normalizeItemModifiersByRule({
      itemName,
      rawModifiers: [],
      rule,
    });
  }

  if (rawModifiers.length > MAX_MODIFIER_COUNT) {
    throw createHttpError(400, "Too many modifiers on a single item.");
  }

  const rule = getMenuOptionRuleByItemName(itemName);
  if (rule) {
    return normalizeItemModifiersByRule({
      itemName,
      rawModifiers,
      rule,
    });
  }

  return rawModifiers.map((modifier) => {
    const name = `${modifier?.name || ""}`.trim();
    if (!name) {
      throw createHttpError(400, "Modifier name is required.");
    }

    const priceDelta = Number(modifier?.priceDelta || 0);
    if (!Number.isFinite(priceDelta) || priceDelta < -9999 || priceDelta > 9999) {
      throw createHttpError(400, `Invalid modifier priceDelta for ${name}.`);
    }

    return {
      groupId: `${modifier?.groupId || ""}`.trim(),
      groupName: `${modifier?.groupName || ""}`.trim(),
      optionId: `${modifier?.optionId || ""}`.trim(),
      name,
      priceDelta: roundToTwo(priceDelta),
    };
  });
};

const normalizeItemNote = (note) => {
  const normalized = `${note || ""}`.trim();
  if (!normalized) {
    return "";
  }
  if (normalized.length > MAX_ITEM_NOTE_LENGTH) {
    throw createHttpError(400, `Item note exceeds ${MAX_ITEM_NOTE_LENGTH} characters.`);
  }
  return normalized;
};

const validateOrderItemsInput = (rawItems) => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw createHttpError(400, "At least one order item is required.");
  }

  return rawItems.map((item) => {
    const name = `${item?.name || ""}`.trim();
    const quantity = Number(item?.quantity);

    if (!name || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw createHttpError(400, "Invalid order item payload.");
    }

    return {
      name,
      normalizedName: normalizeName(name),
      quantity,
      seatNo: normalizeSeatNo(item?.seatNo),
      modifiers: normalizeItemModifiers(item?.modifiers, { itemName: name }),
      note: normalizeItemNote(item?.note),
    };
  });
};

const buildPricedOrderSummary = (validatedItems, getPrice) => {
  const items = validatedItems.map((item) => {
    const canonicalPrice = Number(getPrice(item));

    if (!Number.isFinite(canonicalPrice) || canonicalPrice < 0) {
      throw createHttpError(400, `Invalid price for item: ${item.name}`);
    }

    const modifierDelta = roundToTwo(
      (Array.isArray(item.modifiers) ? item.modifiers : []).reduce(
        (sum, modifier) => sum + Number(modifier?.priceDelta || 0),
        0
      )
    );

    const effectiveUnitPrice = roundToTwo(canonicalPrice + modifierDelta);
    if (effectiveUnitPrice < 0) {
      throw createHttpError(400, `Effective price cannot be negative for item: ${item.name}`);
    }

    const lineTotal = roundToTwo(effectiveUnitPrice * item.quantity);

    return {
      name: item.name,
      quantity: item.quantity,
      basePrice: canonicalPrice,
      pricePerQuantity: effectiveUnitPrice,
      price: lineTotal,
      seatNo: item.seatNo,
      note: item.note,
      modifiers: item.modifiers,
    };
  });

  const total = roundToTwo(items.reduce((sum, item) => sum + item.price, 0));
  const tax = roundToTwo((total * TAX_RATE) / 100);
  const totalWithTax = roundToTwo(total + tax);

  return {
    items,
    bills: {
      total,
      tax,
      totalWithTax,
    },
    totalInMinorUnit: Math.round(totalWithTax * 100),
    taxRate: TAX_RATE,
  };
};

const getPriceFromStaticMap = (normalizedName) => MENU_PRICE_MAP[normalizedName];

const isWithinDayPartWindow = (minuteOfDay, startMinute, endMinute) => {
  if (startMinute < endMinute) {
    return minuteOfDay >= startMinute && minuteOfDay < endMinute;
  }

  return minuteOfDay >= startMinute || minuteOfDay < endMinute;
};

const resolveDayPartPrice = (menuItem, at = new Date()) => {
  const safeDayParts = Array.isArray(menuItem?.dayParts) ? menuItem.dayParts : [];
  if (safeDayParts.length === 0) {
    return Number(menuItem?.basePrice);
  }

  const date = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(date.getTime())) {
    return Number(menuItem?.basePrice);
  }

  const minuteOfDay = date.getHours() * 60 + date.getMinutes();
  const dayOfWeek = date.getDay();

  const matched = safeDayParts.find((dayPart) => {
    const startMinute = Number(dayPart?.startMinute);
    const endMinute = Number(dayPart?.endMinute);

    if (!Number.isInteger(startMinute) || !Number.isInteger(endMinute)) {
      return false;
    }

    const daysOfWeek = Array.isArray(dayPart?.daysOfWeek)
      ? dayPart.daysOfWeek.map((day) => Number(day))
      : [];

    if (daysOfWeek.length > 0 && !daysOfWeek.includes(dayOfWeek)) {
      return false;
    }

    return isWithinDayPartWindow(minuteOfDay, startMinute, endMinute);
  });

  if (!matched) {
    return Number(menuItem?.basePrice);
  }

  const dayPartPrice = Number(matched.price);
  return Number.isFinite(dayPartPrice) ? dayPartPrice : Number(menuItem?.basePrice);
};

const scoreCatalogCandidate = ({ candidate, locationId, channelCode, versionTag }) => {
  let score = 0;
  if (`${candidate.locationId || ""}` === locationId) {
    score += 8;
  }
  if (`${candidate.channelCode || "ALL"}` === channelCode) {
    score += 4;
  }
  if (versionTag && `${candidate.versionTag || ""}` === versionTag) {
    score += 2;
  }
  if (`${candidate.status || ""}` === "ACTIVE") {
    score += 1;
  }
  return score;
};

const pickBestCatalogCandidate = ({ candidates, locationId, channelCode, versionTag }) => {
  const safeCandidates = Array.isArray(candidates) ? candidates : [];
  if (safeCandidates.length === 0) {
    return null;
  }

  const scored = safeCandidates
    .map((candidate) => ({
      candidate,
      score: scoreCatalogCandidate({ candidate, locationId, channelCode, versionTag }),
    }))
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return new Date(b.candidate.updatedAt || 0).getTime() - new Date(a.candidate.updatedAt || 0).getTime();
    });

  return scored[0].candidate;
};

const loadCatalogCandidates = async ({ normalizedName, locationId, channelCode, versionTag, at }) => {
  const MenuCatalogItem = require("../models/menuCatalogItemModel");

  const validAt = at instanceof Date ? at : new Date(at || Date.now());

  const query = {
    normalizedName,
    status: "ACTIVE",
    locationId: { $in: [locationId, "default"] },
    channelCode: { $in: [channelCode, "ALL"] },
    $and: [
      {
        $or: [
          { validFrom: { $exists: false } },
          { validFrom: null },
          { validFrom: { $lte: validAt } },
        ],
      },
      {
        $or: [
          { validTo: { $exists: false } },
          { validTo: null },
          { validTo: { $gt: validAt } },
        ],
      },
    ],
  };

  if (versionTag) {
    query.versionTag = versionTag;
  }

  return MenuCatalogItem.find(query).lean();
};

const resolveCatalogPrice = async ({
  normalizedName,
  locationId,
  channelCode,
  versionTag,
  at,
}) => {
  const candidates = await loadCatalogCandidates({
    normalizedName,
    locationId,
    channelCode,
    versionTag,
    at,
  });
  const selected = pickBestCatalogCandidate({
    candidates,
    locationId,
    channelCode,
    versionTag,
  });

  if (!selected) {
    return null;
  }

  return {
    price: resolveDayPartPrice(selected, at),
    source: "catalog",
    metadata: {
      locationId: selected.locationId,
      channelCode: selected.channelCode,
      versionTag: selected.versionTag,
      menuItemId: selected._id,
    },
  };
};

const resolveItemPrice = async ({
  normalizedName,
  locationId,
  channelProviderCode,
  versionTag,
  at,
}) => {
  const normalizedLocationId = normalizeLocationId(locationId);
  const normalizedChannelCode = normalizeChannelCode(channelProviderCode || "ALL");
  const normalizedVersionTag = normalizeVersionTag(versionTag);

  const catalogResult = await resolveCatalogPrice({
    normalizedName,
    locationId: normalizedLocationId,
    channelCode: normalizedChannelCode,
    versionTag: normalizedVersionTag,
    at,
  });

  if (catalogResult) {
    return catalogResult;
  }

  const staticPrice = getPriceFromStaticMap(normalizedName);
  if (staticPrice === undefined) {
    throw createHttpError(400, `Unsupported menu item: ${normalizedName}`);
  }

  if (config.menuCatalogStrict) {
    throw createHttpError(409, `Menu catalog has no active price for item: ${normalizedName}`);
  }

  return {
    price: staticPrice,
    source: "static_fallback",
  };
};

const calculateOrderSummary = (rawItems) => {
  const validatedItems = validateOrderItemsInput(rawItems);
  return buildPricedOrderSummary(validatedItems, ({ normalizedName }) => {
    const canonicalPrice = getPriceFromStaticMap(normalizedName);
    if (canonicalPrice === undefined) {
      throw createHttpError(400, `Unsupported menu item: ${normalizedName}`);
    }
    return canonicalPrice;
  });
};

const calculateOrderSummaryFromCatalog = async (rawItems, options = {}) => {
  const validatedItems = validateOrderItemsInput(rawItems);
  const now = options.at instanceof Date ? options.at : new Date();
  const locationId = normalizeLocationId(options.locationId);
  const channelProviderCode = normalizeChannelCode(options.channelProviderCode || "ALL");
  const versionTag = normalizeVersionTag(options.versionTag);

  const priceCache = new Map();

  const pricedItems = await Promise.all(
    validatedItems.map(async (item) => {
      const cacheKey = `${item.normalizedName}::${locationId}::${channelProviderCode}::${versionTag || "*"}`;
      if (!priceCache.has(cacheKey)) {
        const resolved = await resolveItemPrice({
          normalizedName: item.normalizedName,
          locationId,
          channelProviderCode,
          versionTag,
          at: now,
        });
        priceCache.set(cacheKey, resolved);
      }

      return {
        ...item,
        __resolvedPrice: priceCache.get(cacheKey),
      };
    })
  );

  const summary = buildPricedOrderSummary(pricedItems, ({ __resolvedPrice }) => __resolvedPrice.price);
  summary.pricingSources = pricedItems.reduce((acc, item) => {
    const existing = acc[item.normalizedName];
    if (!existing) {
      acc[item.normalizedName] = item.__resolvedPrice;
    }
    return acc;
  }, {});

  return summary;
};

const getMenuItemEntries = () =>
  Object.entries(MENU_PRICE_MAP).map(([name, price]) => ({ name, price }));

module.exports = {
  calculateOrderSummary,
  calculateOrderSummaryFromCatalog,
  TAX_RATE,
  normalizeMenuItemName: normalizeName,
  getMenuItemEntries,
  __testables: {
    isWithinDayPartWindow,
    resolveDayPartPrice,
    pickBestCatalogCandidate,
    scoreCatalogCandidate,
    validateOrderItemsInput,
    normalizeItemModifiersByRule,
  },
};
