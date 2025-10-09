"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNearbyPropertiesValidation = exports.getZoneStatisticsValidation = exports.getZonesByProximityValidation = exports.removeAgentFromZoneValidation = exports.getZoneAssignmentsValidation = exports.deleteZoneValidation = exports.getZoneByIdValidation = exports.listZonesValidation = exports.assignAgentToZoneValidation = exports.updateZoneValidation = exports.createZoneValidation = void 0;
const express_validator_1 = require("express-validator");
const common_validator_1 = require("./common.validator");
exports.createZoneValidation = [
    (0, express_validator_1.body)('name')
        .isString()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Zone name must be between 2 and 100 characters'),
    (0, express_validator_1.body)('description')
        .optional()
        .isString()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description must be less than 500 characters'),
    (0, express_validator_1.body)('boundary')
        .isObject()
        .withMessage('Boundary must be an object'),
    (0, express_validator_1.body)('boundary.type')
        .isIn(['Polygon'])
        .withMessage('Boundary type must be Polygon'),
    (0, express_validator_1.body)('boundary.coordinates')
        .isArray()
        .notEmpty()
        .withMessage('Boundary coordinates must be a non-empty array'),
    (0, express_validator_1.body)('buildingData')
        .optional()
        .isObject()
        .withMessage('Building data must be an object'),
    (0, express_validator_1.body)('buildingData.totalBuildings')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Total buildings must be a non-negative integer'),
    (0, express_validator_1.body)('buildingData.residentialHomes')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Residential homes must be a non-negative integer'),
    (0, express_validator_1.body)('buildingData.addresses')
        .optional()
        .isArray()
        .withMessage('Addresses must be an array'),
    (0, express_validator_1.body)('buildingData.coordinates')
        .optional()
        .isArray()
        .withMessage('Coordinates must be an array'),
    (0, express_validator_1.body)('teamId')
        .optional()
        .isMongoId()
        .withMessage('Team ID must be a valid MongoDB ObjectId'),
];
exports.updateZoneValidation = [
    (0, common_validator_1.mongoIdParam)(),
    (0, express_validator_1.body)('name')
        .optional()
        .isString()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Zone name must be between 2 and 100 characters'),
    (0, express_validator_1.body)('description')
        .optional()
        .isString()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description must be less than 500 characters'),
    (0, express_validator_1.body)('boundary')
        .optional()
        .isObject()
        .withMessage('Boundary must be an object'),
    (0, express_validator_1.body)('boundary.type')
        .optional()
        .isIn(['Polygon'])
        .withMessage('Boundary type must be Polygon'),
    (0, express_validator_1.body)('boundary.coordinates')
        .optional()
        .isArray()
        .notEmpty()
        .withMessage('Boundary coordinates must be a non-empty array'),
    (0, express_validator_1.body)('buildingData')
        .optional()
        .isObject()
        .withMessage('Building data must be an object'),
    (0, express_validator_1.body)('buildingData.totalBuildings')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Total buildings must be a non-negative integer'),
    (0, express_validator_1.body)('buildingData.residentialHomes')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Residential homes must be a non-negative integer'),
    (0, express_validator_1.body)('buildingData.addresses')
        .optional()
        .isArray()
        .withMessage('Addresses must be an array'),
    (0, express_validator_1.body)('buildingData.coordinates')
        .optional()
        .isArray()
        .withMessage('Coordinates must be an array'),
    (0, express_validator_1.body)('zoneType')
        .optional()
        .isIn(['MANUAL', 'MAP'])
        .withMessage('Zone type must be either MANUAL or MAP'),
    (0, express_validator_1.body)('status')
        .optional()
        .isIn(['DRAFT', 'ACTIVE', 'INACTIVE', 'SCHEDULED', 'COMPLETED'])
        .withMessage('Status must be one of: DRAFT, ACTIVE, INACTIVE, SCHEDULED, COMPLETED'),
    (0, express_validator_1.body)('assignedAgentId')
        .optional()
        .isMongoId()
        .withMessage('Assigned Agent ID must be a valid MongoDB ObjectId'),
    (0, express_validator_1.body)('teamId')
        .optional()
        .isMongoId()
        .withMessage('Team ID must be a valid MongoDB ObjectId'),
    (0, express_validator_1.body)('effectiveFrom')
        .optional()
        .isISO8601()
        .withMessage('Effective From must be a valid date'),
    (0, express_validator_1.body)('removeAssignment')
        .optional()
        .isBoolean()
        .withMessage('Remove Assignment must be a boolean'),
];
exports.assignAgentToZoneValidation = [
    (0, common_validator_1.mongoIdParam)('zoneId'),
    (0, express_validator_1.body)('agentId')
        .isMongoId()
        .withMessage('Agent ID must be a valid MongoDB ObjectId'),
];
exports.listZonesValidation = common_validator_1.zoneListQueries;
exports.getZoneByIdValidation = [(0, common_validator_1.mongoIdParam)()];
exports.deleteZoneValidation = [(0, common_validator_1.mongoIdParam)()];
exports.getZoneAssignmentsValidation = [(0, common_validator_1.mongoIdParam)()];
exports.removeAgentFromZoneValidation = [(0, common_validator_1.mongoIdParam)('zoneId')];
exports.getZonesByProximityValidation = common_validator_1.nearbyPropertiesQueries;
exports.getZoneStatisticsValidation = [(0, common_validator_1.mongoIdParam)()];
exports.getNearbyPropertiesValidation = [
    ...common_validator_1.locationQueries,
    (0, common_validator_1.mongoIdQuery)('zoneId'),
    (0, common_validator_1.mongoIdQuery)('status'),
];
//# sourceMappingURL=zone.validator.js.map