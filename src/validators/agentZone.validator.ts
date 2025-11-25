import { body, param, query } from "express-validator";

// Validation for creating an agent zone
export const createAgentZoneValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Zone name must be between 2 and 100 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must not exceed 500 characters"),

  body("boundary").isObject().withMessage("Boundary must be an object"),

  body("boundary.type")
    .equals("Polygon")
    .withMessage("Boundary type must be 'Polygon'"),

  body("boundary.coordinates")
    .isArray({ min: 1 })
    .withMessage(
      "Boundary coordinates must be an array with at least one polygon"
    ),

  body("boundary.coordinates.*")
    .isArray({ min: 3 })
    .withMessage("Each polygon must have at least 3 coordinates"),

  body("boundary.coordinates.*.*")
    .isArray({ min: 2, max: 2 })
    .withMessage("Each coordinate must be [longitude, latitude]"),

  body("boundary.coordinates.*.*.*")
    .isNumeric()
    .withMessage("Coordinate values must be numbers"),

  body("buildingData")
    .optional()
    .isObject()
    .withMessage("Building data must be an object"),

  body("buildingData.addresses")
    .optional()
    .isArray()
    .withMessage("Building addresses must be an array"),

  body("buildingData.coordinates")
    .optional()
    .isArray()
    .withMessage("Building coordinates must be an array"),

  body("communityId")
    .optional()
    .isMongoId()
    .withMessage("Community ID must be a valid MongoDB ObjectId"),

  body("areaId")
    .optional()
    .isMongoId()
    .withMessage("Area ID must be a valid MongoDB ObjectId"),

  body("municipalityId")
    .optional()
    .isMongoId()
    .withMessage("Municipality ID must be a valid MongoDB ObjectId"),
];

// Validation for updating an agent zone
export const updateAgentZoneValidation = [
  param("id")
    .isMongoId()
    .withMessage("Zone ID must be a valid MongoDB ObjectId"),

  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Zone name must be between 2 and 100 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must not exceed 500 characters"),

  body("boundary")
    .optional()
    .isObject()
    .withMessage("Boundary must be an object"),

  body("boundary.type")
    .optional()
    .equals("Polygon")
    .withMessage("Boundary type must be 'Polygon'"),

  body("boundary.coordinates")
    .optional()
    .isArray({ min: 1 })
    .withMessage(
      "Boundary coordinates must be an array with at least one polygon"
    ),

  body("buildingData")
    .optional()
    .isObject()
    .withMessage("Building data must be an object"),

  body("communityId")
    .optional()
    .isMongoId()
    .withMessage("Community ID must be a valid MongoDB ObjectId"),
];

// Validation for getting agent zones
export const getAgentZonesValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

// Validation for getting agent zone by ID
export const getAgentZoneByIdValidation = [
  param("id")
    .isMongoId()
    .withMessage("Zone ID must be a valid MongoDB ObjectId"),
];

// Validation for deleting agent zone
export const deleteAgentZoneValidation = [
  param("id")
    .isMongoId()
    .withMessage("Zone ID must be a valid MongoDB ObjectId"),
];

// Validation for creating a mobile manual zone (no boundary required)
export const createMobileManualZoneValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Zone name must be between 2 and 100 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must not exceed 500 characters"),

  body("areaId")
    .optional()
    .isMongoId()
    .withMessage("Area ID must be a valid MongoDB ObjectId"),

  body("municipalityId")
    .optional()
    .isMongoId()
    .withMessage("Municipality ID must be a valid MongoDB ObjectId"),

  body("communityId")
    .optional()
    .isMongoId()
    .withMessage("Community ID must be a valid MongoDB ObjectId"),
];