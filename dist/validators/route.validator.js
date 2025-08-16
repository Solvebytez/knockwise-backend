"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTemplateValidation = exports.exportRouteValidation = exports.getRouteAnalyticsValidation = exports.listRoutesValidation = exports.updateStopStatusValidation = exports.shareRouteValidation = exports.duplicateRouteValidation = exports.optimizeRouteValidation = exports.updateRouteStatusValidation = exports.updateRouteValidation = exports.createRouteValidation = void 0;
const express_validator_1 = require("express-validator");
const common_validator_1 = require("./common.validator");
exports.createRouteValidation = [
    (0, express_validator_1.body)('name')
        .isString()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Route name must be between 1 and 100 characters'),
    (0, express_validator_1.body)('description')
        .optional()
        .isString()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description must be less than 500 characters'),
    (0, express_validator_1.body)('date')
        .isISO8601()
        .withMessage('Date must be a valid ISO 8601 date'),
    (0, express_validator_1.body)('priority')
        .optional()
        .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
        .withMessage('Priority must be one of: LOW, MEDIUM, HIGH, URGENT'),
    (0, express_validator_1.body)('zoneId')
        .optional()
        .isMongoId()
        .withMessage('Zone ID must be a valid MongoDB ObjectId'),
    (0, express_validator_1.body)('teamId')
        .optional()
        .isMongoId()
        .withMessage('Team ID must be a valid MongoDB ObjectId'),
    (0, express_validator_1.body)('startLocation')
        .optional()
        .isObject()
        .withMessage('Start location must be an object'),
    (0, express_validator_1.body)('startLocation.coordinates')
        .optional()
        .isArray({ min: 2, max: 2 })
        .withMessage('Start location coordinates must be an array of 2 numbers'),
    (0, express_validator_1.body)('startLocation.address')
        .optional()
        .isString()
        .withMessage('Start location address must be a string'),
    (0, express_validator_1.body)('endLocation')
        .optional()
        .isObject()
        .withMessage('End location must be an object'),
    (0, express_validator_1.body)('endLocation.coordinates')
        .optional()
        .isArray({ min: 2, max: 2 })
        .withMessage('End location coordinates must be an array of 2 numbers'),
    (0, express_validator_1.body)('endLocation.address')
        .optional()
        .isString()
        .withMessage('End location address must be a string'),
    (0, express_validator_1.body)('tags')
        .optional()
        .isArray()
        .withMessage('Tags must be an array'),
    (0, express_validator_1.body)('tags.*')
        .optional()
        .isString()
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('Each tag must be between 1 and 50 characters'),
    (0, express_validator_1.body)('isTemplate')
        .optional()
        .isBoolean()
        .withMessage('isTemplate must be a boolean'),
    (0, express_validator_1.body)('templateName')
        .optional()
        .isString()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Template name must be between 1 and 100 characters'),
];
exports.updateRouteValidation = [
    (0, common_validator_1.mongoIdParam)(),
    (0, express_validator_1.body)('name')
        .optional()
        .isString()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Route name must be between 1 and 100 characters'),
    (0, express_validator_1.body)('description')
        .optional()
        .isString()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description must be less than 500 characters'),
    (0, express_validator_1.body)('date')
        .optional()
        .isISO8601()
        .withMessage('Date must be a valid ISO 8601 date'),
    (0, express_validator_1.body)('priority')
        .optional()
        .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
        .withMessage('Priority must be one of: LOW, MEDIUM, HIGH, URGENT'),
    (0, express_validator_1.body)('status')
        .optional()
        .isIn(['DRAFT', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ARCHIVED'])
        .withMessage('Status must be one of: DRAFT, PLANNED, IN_PROGRESS, COMPLETED, CANCELLED, ARCHIVED'),
    (0, express_validator_1.body)('stops')
        .optional()
        .isArray()
        .withMessage('Stops must be an array'),
    (0, express_validator_1.body)('stops.*.propertyId')
        .optional()
        .isMongoId()
        .withMessage('Each stop propertyId must be a valid MongoDB ObjectId'),
    (0, express_validator_1.body)('stops.*.order')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Each stop order must be a positive integer'),
    (0, express_validator_1.body)('stops.*.estimatedDuration')
        .optional()
        .isInt({ min: 1, max: 480 })
        .withMessage('Each stop estimated duration must be between 1 and 480 minutes'),
    (0, express_validator_1.body)('stops.*.status')
        .optional()
        .isIn(['PENDING', 'COMPLETED', 'SKIPPED', 'RESCHEDULED'])
        .withMessage('Each stop status must be one of: PENDING, COMPLETED, SKIPPED, RESCHEDULED'),
    (0, express_validator_1.body)('stops.*.notes')
        .optional()
        .isString()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Each stop notes must be less than 1000 characters'),
];
exports.updateRouteStatusValidation = [
    (0, common_validator_1.mongoIdParam)(),
    (0, express_validator_1.body)('status')
        .isIn(['DRAFT', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ARCHIVED'])
        .withMessage('Status must be one of: DRAFT, PLANNED, IN_PROGRESS, COMPLETED, CANCELLED, ARCHIVED'),
];
exports.optimizeRouteValidation = [
    ...(0, common_validator_1.mongoIdArrayBody)('propertyIds'),
    (0, express_validator_1.body)('startLocation')
        .optional()
        .isArray({ min: 2, max: 2 })
        .withMessage('Start location must be an array of 2 numbers [longitude, latitude]'),
    (0, express_validator_1.body)('startLocation.*')
        .optional()
        .isFloat()
        .withMessage('Start location coordinates must be numbers'),
    (0, express_validator_1.body)('endLocation')
        .optional()
        .isArray({ min: 2, max: 2 })
        .withMessage('End location must be an array of 2 numbers [longitude, latitude]'),
    (0, express_validator_1.body)('endLocation.*')
        .optional()
        .isFloat()
        .withMessage('End location coordinates must be numbers'),
    (0, express_validator_1.body)('optimizationSettings.maxStops')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Max stops must be between 1 and 100'),
    (0, express_validator_1.body)('optimizationSettings.maxDistance')
        .optional()
        .isFloat({ min: 0.1, max: 500 })
        .withMessage('Max distance must be between 0.1 and 500 miles'),
    (0, express_validator_1.body)('optimizationSettings.optimizationType')
        .optional()
        .isIn(['FASTEST', 'SHORTEST', 'BALANCED'])
        .withMessage('Optimization type must be one of: FASTEST, SHORTEST, BALANCED'),
    (0, express_validator_1.body)('optimizationSettings.avoidFerries')
        .optional()
        .isBoolean()
        .withMessage('Avoid ferries must be a boolean'),
    (0, express_validator_1.body)('optimizationSettings.avoidHighways')
        .optional()
        .isBoolean()
        .withMessage('Avoid highways must be a boolean'),
    (0, express_validator_1.body)('optimizationSettings.avoidTolls')
        .optional()
        .isBoolean()
        .withMessage('Avoid tolls must be a boolean'),
    (0, express_validator_1.body)('optimizationSettings.avoidTraffic')
        .optional()
        .isBoolean()
        .withMessage('Avoid traffic must be a boolean'),
    (0, express_validator_1.body)('optimizationSettings.startFromOffice')
        .optional()
        .isBoolean()
        .withMessage('Start from office must be a boolean'),
    (0, express_validator_1.body)('optimizationSettings.returnToOffice')
        .optional()
        .isBoolean()
        .withMessage('Return to office must be a boolean'),
    (0, express_validator_1.body)('optimizationSettings.preferredTimeWindow.start')
        .optional()
        .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .withMessage('Start time must be in HH:MM format'),
    (0, express_validator_1.body)('optimizationSettings.preferredTimeWindow.end')
        .optional()
        .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .withMessage('End time must be in HH:MM format'),
];
exports.duplicateRouteValidation = [
    (0, common_validator_1.mongoIdParam)(),
    (0, express_validator_1.body)('name')
        .optional()
        .isString()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Route name must be between 1 and 100 characters'),
    (0, express_validator_1.body)('date')
        .optional()
        .isISO8601()
        .withMessage('Date must be a valid ISO 8601 date'),
];
exports.shareRouteValidation = [
    (0, common_validator_1.mongoIdParam)(),
    (0, express_validator_1.body)('sharedWith')
        .isArray({ min: 1 })
        .withMessage('Must share with at least one user'),
    (0, express_validator_1.body)('sharedWith.*')
        .isMongoId()
        .withMessage('Each shared user ID must be a valid MongoDB ObjectId'),
    (0, express_validator_1.body)('permissions')
        .optional()
        .isIn(['VIEW', 'EDIT', 'ADMIN'])
        .withMessage('Permissions must be one of: VIEW, EDIT, ADMIN'),
];
exports.updateStopStatusValidation = [
    (0, common_validator_1.mongoIdParam)('routeId'),
    (0, express_validator_1.body)('stopIndex')
        .isInt({ min: 0 })
        .withMessage('Stop index must be a non-negative integer'),
    (0, express_validator_1.body)('status')
        .isIn(['PENDING', 'COMPLETED', 'SKIPPED', 'RESCHEDULED'])
        .withMessage('Status must be one of: PENDING, COMPLETED, SKIPPED, RESCHEDULED'),
    (0, express_validator_1.body)('actualDuration')
        .optional()
        .isInt({ min: 1, max: 480 })
        .withMessage('Actual duration must be between 1 and 480 minutes'),
    (0, express_validator_1.body)('notes')
        .optional()
        .isString()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Notes must be less than 1000 characters'),
];
exports.listRoutesValidation = [
    ...common_validator_1.paginationQueries,
    ...common_validator_1.dateRangeQueries,
    (0, common_validator_1.statusQuery)(['DRAFT', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ARCHIVED']),
    (0, express_validator_1.query)('priority')
        .optional()
        .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
        .withMessage('Priority must be one of: LOW, MEDIUM, HIGH, URGENT'),
    (0, express_validator_1.query)('agentId')
        .optional()
        .isMongoId()
        .withMessage('Agent ID must be a valid MongoDB ObjectId'),
    (0, express_validator_1.query)('teamId')
        .optional()
        .isMongoId()
        .withMessage('Team ID must be a valid MongoDB ObjectId'),
    (0, express_validator_1.query)('zoneId')
        .optional()
        .isMongoId()
        .withMessage('Zone ID must be a valid MongoDB ObjectId'),
    (0, express_validator_1.query)('isTemplate')
        .optional()
        .isBoolean()
        .withMessage('isTemplate must be a boolean'),
    (0, express_validator_1.query)('tags')
        .optional()
        .isString()
        .withMessage('Tags must be a comma-separated string'),
];
exports.getRouteAnalyticsValidation = [
    (0, common_validator_1.mongoIdParam)(),
    (0, express_validator_1.query)('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be a valid ISO 8601 date'),
    (0, express_validator_1.query)('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be a valid ISO 8601 date'),
];
exports.exportRouteValidation = [
    (0, common_validator_1.mongoIdParam)(),
    (0, express_validator_1.query)('format')
        .optional()
        .isIn(['pdf', 'csv', 'json'])
        .withMessage('Export format must be one of: pdf, csv, json'),
];
exports.createTemplateValidation = [
    (0, express_validator_1.body)('name')
        .isString()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Template name must be between 1 and 100 characters'),
    (0, express_validator_1.body)('description')
        .optional()
        .isString()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description must be less than 500 characters'),
    (0, express_validator_1.body)('optimizationSettings')
        .optional()
        .isObject()
        .withMessage('Optimization settings must be an object'),
    (0, express_validator_1.body)('tags')
        .optional()
        .isArray()
        .withMessage('Tags must be an array'),
];
//# sourceMappingURL=route.validator.js.map