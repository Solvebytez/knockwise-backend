"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyActivityStatsValidation = exports.getActivityStatsValidation = exports.deleteActivityValidation = exports.getActivityByIdValidation = exports.listAllActivitiesValidation = exports.listMyActivitiesValidation = exports.updateActivityValidation = exports.createActivityValidation = void 0;
const express_validator_1 = require("express-validator");
const common_validator_1 = require("./common.validator");
exports.createActivityValidation = [
    (0, express_validator_1.body)('propertyId')
        .isMongoId()
        .withMessage('Property ID must be a valid MongoDB ObjectId'),
    (0, express_validator_1.body)('response')
        .isIn(['NO_ANSWER', 'NOT_INTERESTED', 'CALL_BACK', 'APPOINTMENT_SET', 'FOLLOW_UP', 'LEAD_CREATED'])
        .withMessage('Response must be one of: NO_ANSWER, NOT_INTERESTED, CALL_BACK, APPOINTMENT_SET, FOLLOW_UP, LEAD_CREATED'),
    (0, express_validator_1.body)('notes')
        .optional()
        .isString()
        .trim()
        .isLength({ min: 1, max: 1000 })
        .withMessage('Notes must be a string between 1 and 1000 characters'),
    (0, express_validator_1.body)('followUpDate')
        .optional()
        .isISO8601()
        .withMessage('Follow-up date must be a valid ISO 8601 date'),
    (0, express_validator_1.body)('appointmentDate')
        .optional()
        .isISO8601()
        .withMessage('Appointment date must be a valid ISO 8601 date'),
];
exports.updateActivityValidation = [
    (0, common_validator_1.mongoIdParam)(),
    (0, express_validator_1.body)('response')
        .optional()
        .isIn(['NO_ANSWER', 'NOT_INTERESTED', 'CALL_BACK', 'APPOINTMENT_SET', 'FOLLOW_UP', 'LEAD_CREATED'])
        .withMessage('Response must be one of: NO_ANSWER, NOT_INTERESTED, CALL_BACK, APPOINTMENT_SET, FOLLOW_UP, LEAD_CREATED'),
    (0, express_validator_1.body)('notes')
        .optional()
        .isString()
        .trim()
        .isLength({ min: 1, max: 1000 })
        .withMessage('Notes must be a string between 1 and 1000 characters'),
    (0, express_validator_1.body)('followUpDate')
        .optional()
        .isISO8601()
        .withMessage('Follow-up date must be a valid ISO 8601 date'),
    (0, express_validator_1.body)('appointmentDate')
        .optional()
        .isISO8601()
        .withMessage('Appointment date must be a valid ISO 8601 date'),
];
exports.listMyActivitiesValidation = common_validator_1.activityListQueries;
exports.listAllActivitiesValidation = common_validator_1.teamActivityListQueries;
exports.getActivityByIdValidation = [(0, common_validator_1.mongoIdParam)()];
exports.deleteActivityValidation = [(0, common_validator_1.mongoIdParam)()];
exports.getActivityStatsValidation = [
    ...common_validator_1.dateRangeQueries,
    (0, common_validator_1.mongoIdQuery)('agentId'),
    (0, common_validator_1.mongoIdQuery)('zoneId'),
    (0, common_validator_1.mongoIdQuery)('teamId'),
];
exports.getMyActivityStatsValidation = [
    ...common_validator_1.dateRangeQueries,
    (0, common_validator_1.mongoIdQuery)('agentId'),
    (0, common_validator_1.mongoIdQuery)('startDate'),
    (0, common_validator_1.mongoIdQuery)('endDate'),
];
//# sourceMappingURL=activity.validator.js.map