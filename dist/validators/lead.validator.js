"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLeadStatusValidation = exports.createLeadValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createLeadValidation = [
    (0, express_validator_1.body)('propertyId')
        .isMongoId()
        .withMessage('Property ID must be a valid MongoDB ObjectId'),
    (0, express_validator_1.body)('status')
        .optional()
        .isIn(['NEW', 'CONTACTED', 'FOLLOW_UP', 'APPOINTMENT_SET', 'VISITED', 'NOT_INTERESTED', 'CONVERTED', 'LOST'])
        .withMessage('Status must be one of: NEW, CONTACTED, FOLLOW_UP, APPOINTMENT_SET, VISITED, NOT_INTERESTED, CONVERTED, LOST'),
];
exports.updateLeadStatusValidation = [
    (0, express_validator_1.param)('id')
        .isMongoId()
        .withMessage('Lead ID must be a valid MongoDB ObjectId'),
    (0, express_validator_1.body)('status')
        .isIn(['NEW', 'CONTACTED', 'FOLLOW_UP', 'APPOINTMENT_SET', 'VISITED', 'NOT_INTERESTED', 'CONVERTED', 'LOST'])
        .withMessage('Status must be one of: NEW, CONTACTED, FOLLOW_UP, APPOINTMENT_SET, VISITED, NOT_INTERESTED, CONVERTED, LOST'),
];
//# sourceMappingURL=lead.validator.js.map