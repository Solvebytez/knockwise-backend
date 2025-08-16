"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchProperties = searchProperties;
exports.getPropertyById = getPropertyById;
exports.bulkImportProperties = bulkImportProperties;
exports.updatePropertyScores = updatePropertyScores;
const PropertyData_1 = __importDefault(require("../models/PropertyData"));
async function searchProperties(req, res) {
    const { query, city, state, postalCode, minValue, maxValue, propertyType, minLeadScore, limit = 50, page = 1, } = req.query;
    const filter = {};
    if (query) {
        filter.$or = [
            { addressLine1: { $regex: query, $options: 'i' } },
            { ownerName: { $regex: query, $options: 'i' } },
            { mlsId: { $regex: query, $options: 'i' } },
        ];
    }
    if (city)
        filter.city = { $regex: city, $options: 'i' };
    if (state)
        filter.state = { $regex: state, $options: 'i' };
    if (postalCode)
        filter.postalCode = postalCode;
    if (propertyType)
        filter.propertyType = propertyType;
    if (minValue || maxValue) {
        filter.estimatedValue = {};
        if (minValue)
            filter.estimatedValue.$gte = Number(minValue);
        if (maxValue)
            filter.estimatedValue.$lte = Number(maxValue);
    }
    if (minLeadScore) {
        filter.leadScore = { $gte: Number(minLeadScore) };
    }
    const skip = (Number(page) - 1) * Number(limit);
    const properties = await PropertyData_1.default.find(filter)
        .sort({ leadScore: -1, estimatedValue: -1 })
        .skip(skip)
        .limit(Number(limit));
    const total = await PropertyData_1.default.countDocuments(filter);
    res.json({
        properties,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
        },
    });
}
async function getPropertyById(req, res) {
    const { id } = req.params;
    const property = await PropertyData_1.default.findById(id);
    if (!property) {
        res.status(404).json({ message: 'Property not found' });
        return;
    }
    res.json(property);
}
async function bulkImportProperties(req, res) {
    const { properties } = req.body;
    if (!Array.isArray(properties) || properties.length === 0) {
        res.status(400).json({ message: 'Properties array is required' });
        return;
    }
    const results = {
        imported: 0,
        updated: 0,
        errors: 0,
        errorsList: [],
    };
    for (const prop of properties) {
        try {
            const existing = await PropertyData_1.default.findOne({
                addressLine1: prop.addressLine1,
                city: prop.city,
                state: prop.state,
                postalCode: prop.postalCode,
            });
            if (existing) {
                await PropertyData_1.default.findByIdAndUpdate(existing._id, {
                    ...prop,
                    lastUpdated: new Date(),
                });
                results.updated++;
            }
            else {
                await PropertyData_1.default.create({
                    ...prop,
                    lastUpdated: new Date(),
                });
                results.imported++;
            }
        }
        catch (error) {
            results.errors++;
            results.errorsList.push(`Error processing ${prop.addressLine1}: ${error}`);
        }
    }
    res.json(results);
}
async function updatePropertyScores(req, res) {
    const { id } = req.params;
    const { leadScore, motivationScore, equityScore } = req.body;
    const property = await PropertyData_1.default.findByIdAndUpdate(id, {
        ...(leadScore !== undefined && { leadScore }),
        ...(motivationScore !== undefined && { motivationScore }),
        ...(equityScore !== undefined && { equityScore }),
        lastUpdated: new Date(),
    }, { new: true });
    if (!property) {
        res.status(404).json({ message: 'Property not found' });
        return;
    }
    res.json(property);
}
//# sourceMappingURL=property.controller.js.map