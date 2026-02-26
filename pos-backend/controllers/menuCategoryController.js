// 2026-02-26T19:55:00+08:00: CRUD controller for menu categories
const createHttpError = require("http-errors");
const mongoose = require("mongoose");
const MenuCategory = require("../models/menuCategoryModel");
const { logAuditEvent } = require("../utils/auditLogger");

const normalizeLocationId = (val) => `${val || ""}`.trim() || "default";

const createCategory = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.body.locationId);
    const name = `${req.body.name || ""}`.trim();
    if (!name) {
      return next(createHttpError(400, "name is required."));
    }

    const parentId = req.body.parentId || null;
    if (parentId && !mongoose.Types.ObjectId.isValid(parentId)) {
      return next(createHttpError(400, "Invalid parentId."));
    }

    const existing = await MenuCategory.findOne({
      locationId,
      normalizedName: name.toLowerCase(),
      parentId: parentId || null,
    });
    if (existing) {
      return next(createHttpError(409, "Category already exists at this level."));
    }

    const maxSort = await MenuCategory.findOne({ locationId, parentId: parentId || null })
      .sort({ sortOrder: -1 })
      .select("sortOrder")
      .lean();

    const cat = await MenuCategory.create({
      locationId,
      name,
      normalizedName: name.toLowerCase(),
      parentId: parentId || null,
      description: `${req.body.description || ""}`.trim(),
      sortOrder: (maxSort?.sortOrder ?? -1) + 1,
      icon: `${req.body.icon || ""}`.trim(),
      color: `${req.body.color || ""}`.trim(),
      status: `${req.body.status || "ACTIVE"}`.trim().toUpperCase(),
    });

    await logAuditEvent({
      req,
      action: "MENU_CATEGORY_CREATED",
      resourceType: "MenuCategory",
      resourceId: cat._id,
      statusCode: 201,
      metadata: { locationId, name },
    });

    return res.status(201).json({ success: true, data: cat });
  } catch (error) {
    if (error?.code === 11000) {
      return next(createHttpError(409, "Category already exists."));
    }
    return next(error);
  }
};

const listCategories = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.locationId) {
      query.locationId = normalizeLocationId(req.query.locationId);
    }
    if (req.query.status) {
      query.status = `${req.query.status}`.trim().toUpperCase();
    }
    if (req.query.parentId === "null" || req.query.parentId === "") {
      query.parentId = null;
    } else if (req.query.parentId) {
      query.parentId = req.query.parentId;
    }

    const rows = await MenuCategory.find(query)
      .sort({ sortOrder: 1, createdAt: 1 })
      .limit(500)
      .lean();

    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid category id."));
    }

    const cat = await MenuCategory.findById(id);
    if (!cat) {
      return next(createHttpError(404, "Category not found."));
    }

    if (req.body.name !== undefined) {
      cat.name = `${req.body.name}`.trim();
      cat.normalizedName = cat.name.toLowerCase();
    }
    if (req.body.description !== undefined) {
      cat.description = `${req.body.description}`.trim();
    }
    if (req.body.sortOrder !== undefined) {
      cat.sortOrder = Number(req.body.sortOrder) || 0;
    }
    if (req.body.icon !== undefined) {
      cat.icon = `${req.body.icon}`.trim();
    }
    if (req.body.color !== undefined) {
      cat.color = `${req.body.color}`.trim();
    }
    if (req.body.status !== undefined) {
      cat.status = `${req.body.status}`.trim().toUpperCase();
    }

    await cat.save();

    await logAuditEvent({
      req,
      action: "MENU_CATEGORY_UPDATED",
      resourceType: "MenuCategory",
      resourceId: cat._id,
      statusCode: 200,
      metadata: { name: cat.name },
    });

    return res.status(200).json({ success: true, data: cat });
  } catch (error) {
    return next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid category id."));
    }

    const children = await MenuCategory.countDocuments({ parentId: id });
    if (children > 0) {
      return next(createHttpError(400, "Cannot delete category with sub-categories. Remove children first."));
    }

    const cat = await MenuCategory.findByIdAndDelete(id);
    if (!cat) {
      return next(createHttpError(404, "Category not found."));
    }

    await logAuditEvent({
      req,
      action: "MENU_CATEGORY_DELETED",
      resourceType: "MenuCategory",
      resourceId: id,
      statusCode: 200,
      metadata: { name: cat.name },
    });

    return res.status(200).json({ success: true, message: "Category deleted." });
  } catch (error) {
    return next(error);
  }
};

const reorderCategories = async (req, res, next) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return next(createHttpError(400, "orderedIds must be a non-empty array."));
    }

    const ops = orderedIds.map((catId, index) => ({
      updateOne: {
        filter: { _id: catId },
        update: { $set: { sortOrder: index } },
      },
    }));

    await MenuCategory.bulkWrite(ops);

    return res.status(200).json({ success: true, message: "Categories reordered." });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createCategory,
  listCategories,
  updateCategory,
  deleteCategory,
  reorderCategories,
};
