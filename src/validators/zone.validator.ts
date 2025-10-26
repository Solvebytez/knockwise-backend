import { body, param } from "express-validator";
import {
  zoneListQueries,
  nearbyPropertiesQueries,
  mongoIdParam,
  mongoIdQuery,
  locationQueries,
} from "./common.validator";

export const createZoneValidation = [
  body("name")
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Zone name must be between 2 and 100 characters"),
  body("description")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must be less than 500 characters"),
  body("boundary").isObject().withMessage("Boundary must be an object"),
  body("boundary.type")
    .isIn(["Polygon"])
    .withMessage("Boundary type must be Polygon"),
  body("boundary.coordinates")
    .isArray()
    .notEmpty()
    .withMessage("Boundary coordinates must be a non-empty array"),
  body("buildingData")
    .optional()
    .isObject()
    .withMessage("Building data must be an object"),
  body("buildingData.totalBuildings")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Total buildings must be a non-negative integer"),
  body("buildingData.residentialHomes")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Residential homes must be a non-negative integer"),
  body("buildingData.addresses")
    .optional()
    .isArray()
    .withMessage("Addresses must be an array"),
  body("buildingData.coordinates")
    .optional()
    .isArray()
    .withMessage("Coordinates must be an array"),
  body("teamId")
    .optional()
    .isMongoId()
    .withMessage("Team ID must be a valid MongoDB ObjectId"),
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

export const updateZoneValidation = [
  mongoIdParam(),
  body("name")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Zone name must be between 2 and 100 characters"),
  body("description")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must be less than 500 characters"),
  body("boundary")
    .optional()
    .isObject()
    .withMessage("Boundary must be an object"),
  body("boundary.type")
    .optional()
    .isIn(["Polygon"])
    .withMessage("Boundary type must be Polygon"),
  body("boundary.coordinates")
    .optional()
    .isArray()
    .notEmpty()
    .withMessage("Boundary coordinates must be a non-empty array"),
  body("buildingData")
    .optional()
    .isObject()
    .withMessage("Building data must be an object"),
  body("buildingData.totalBuildings")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Total buildings must be a non-negative integer"),
  body("buildingData.residentialHomes")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Residential homes must be a non-negative integer"),
  body("buildingData.addresses")
    .optional()
    .isArray()
    .withMessage("Addresses must be an array"),
  body("buildingData.coordinates")
    .optional()
    .isArray()
    .withMessage("Coordinates must be an array"),
  body("zoneType")
    .optional()
    .isIn(["MANUAL", "MAP"])
    .withMessage("Zone type must be either MANUAL or MAP"),
  body("status")
    .optional()
    .isIn(["DRAFT", "ACTIVE", "INACTIVE", "SCHEDULED", "COMPLETED"])
    .withMessage(
      "Status must be one of: DRAFT, ACTIVE, INACTIVE, SCHEDULED, COMPLETED"
    ),
  body("assignedAgentId")
    .optional()
    .isMongoId()
    .withMessage("Assigned Agent ID must be a valid MongoDB ObjectId"),
  body("teamId")
    .optional()
    .isMongoId()
    .withMessage("Team ID must be a valid MongoDB ObjectId"),
  body("effectiveFrom")
    .optional()
    .isISO8601()
    .withMessage("Effective From must be a valid date"),
  body("removeAssignment")
    .optional()
    .isBoolean()
    .withMessage("Remove Assignment must be a boolean"),
];

export const assignAgentToZoneValidation = [
  mongoIdParam("zoneId"),
  body("agentId")
    .isMongoId()
    .withMessage("Agent ID must be a valid MongoDB ObjectId"),
];

export const listZonesValidation = zoneListQueries;

export const getZoneByIdValidation = [mongoIdParam()];

export const deleteZoneValidation = [mongoIdParam()];

export const getZoneAssignmentsValidation = [mongoIdParam()];

export const removeAgentFromZoneValidation = [mongoIdParam("zoneId")];

export const getZonesByProximityValidation = nearbyPropertiesQueries;

export const getZoneStatisticsValidation = [mongoIdParam()];

export const getNearbyPropertiesValidation = [
  ...locationQueries,
  mongoIdQuery("zoneId"),
  mongoIdQuery("status"),
];
