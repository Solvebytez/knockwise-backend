"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nearbyPropertiesQueries = exports.zoneListQueries = exports.teamActivityListQueries = exports.activityListQueries = exports.listQueries = exports.optionalFloatBody = exports.optionalIntBody = exports.mongoIdArrayBody = exports.mongoIdQuery = exports.statusQuery = exports.locationQueries = exports.dateRangeQueries = exports.paginationQueries = exports.mongoIdParams = exports.mongoIdParam = void 0;
const express_validator_1 = require("express-validator");
// Common parameter validations
const mongoIdParam = (paramName = 'id') => (0, express_validator_1.param)(paramName).isMongoId().withMessage(`${paramName} must be a valid MongoDB ObjectId`);
exports.mongoIdParam = mongoIdParam;
const mongoIdParams = (paramNames) => paramNames.map(name => (0, exports.mongoIdParam)(name));
exports.mongoIdParams = mongoIdParams;
// Common query validations
exports.paginationQueries = [
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
];
exports.dateRangeQueries = [
    (0, express_validator_1.query)('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
    (0, express_validator_1.query)('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date'),
];
exports.locationQueries = [
    (0, express_validator_1.query)('latitude').isFloat().withMessage('Latitude must be a valid number'),
    (0, express_validator_1.query)('longitude').isFloat().withMessage('Longitude must be a valid number'),
    (0, express_validator_1.query)('maxDistance').optional().isFloat({ min: 0 }).withMessage('Max distance must be a positive number'),
];
const statusQuery = (allowedStatuses) => (0, express_validator_1.query)('status').optional().isIn(allowedStatuses).withMessage(`Status must be one of: ${allowedStatuses.join(', ')}`);
exports.statusQuery = statusQuery;
const mongoIdQuery = (fieldName) => (0, express_validator_1.query)(fieldName).optional().isMongoId().withMessage(`${fieldName} must be a valid MongoDB ObjectId`);
exports.mongoIdQuery = mongoIdQuery;
// Common body validations
const mongoIdArrayBody = (fieldName) => [
    (0, express_validator_1.body)(fieldName)
        .isArray()
        .notEmpty()
        .withMessage(`${fieldName} must be a non-empty array`),
    (0, express_validator_1.body)(`${fieldName}.*`)
        .isMongoId()
        .withMessage(`Each ${fieldName} must be a valid MongoDB ObjectId`),
];
exports.mongoIdArrayBody = mongoIdArrayBody;
const optionalIntBody = (fieldName, min = 1, max = 100) => (0, express_validator_1.body)(fieldName)
    .optional()
    .isInt({ min, max })
    .withMessage(`${fieldName} must be an integer between ${min} and ${max}`);
exports.optionalIntBody = optionalIntBody;
const optionalFloatBody = (fieldName, min = 0) => (0, express_validator_1.body)(fieldName)
    .optional()
    .isFloat({ min })
    .withMessage(`${fieldName} must be a number greater than or equal to ${min}`);
exports.optionalFloatBody = optionalFloatBody;
// Specific validation combinations
const listQueries = (additionalQueries = []) => [
    ...exports.paginationQueries,
    ...additionalQueries,
];
exports.listQueries = listQueries;
exports.activityListQueries = [
    ...exports.paginationQueries,
    (0, express_validator_1.query)('response').optional().isIn(['NO_ANSWER', 'NOT_INTERESTED', 'CALL_BACK', 'APPOINTMENT_SET', 'FOLLOW_UP', 'LEAD_CREATED']),
    (0, express_validator_1.query)('startDate').optional().isISO8601(),
    (0, express_validator_1.query)('endDate').optional().isISO8601(),
    (0, express_validator_1.query)('zoneId').optional().isMongoId(),
];
exports.teamActivityListQueries = [
    ...exports.paginationQueries,
    (0, express_validator_1.query)('agentId').optional().isMongoId(),
    (0, express_validator_1.query)('response').optional().isIn(['NO_ANSWER', 'NOT_INTERESTED', 'CALL_BACK', 'APPOINTMENT_SET', 'FOLLOW_UP', 'LEAD_CREATED']),
    (0, express_validator_1.query)('startDate').optional().isISO8601(),
    (0, express_validator_1.query)('endDate').optional().isISO8601(),
    (0, express_validator_1.query)('zoneId').optional().isMongoId(),
    (0, express_validator_1.query)('teamId').optional().isMongoId(),
];
exports.zoneListQueries = [
    ...exports.paginationQueries,
    (0, express_validator_1.query)('teamId').optional().isMongoId(),
    (0, express_validator_1.query)('status').optional().isIn(['ACTIVE', 'INACTIVE', 'DRAFT', 'SCHEDULED']),
];
exports.nearbyPropertiesQueries = [
    ...exports.locationQueries,
    (0, express_validator_1.query)('zoneId').optional().isMongoId(),
    (0, express_validator_1.query)('status').optional().isIn(['ACTIVE', 'INACTIVE']),
];
//# sourceMappingURL=common.validator.js.map