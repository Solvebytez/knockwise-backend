"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAppointmentValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createAppointmentValidation = [
    (0, express_validator_1.body)('agentId')
        .isMongoId()
        .withMessage('Agent ID must be a valid MongoDB ObjectId'),
    (0, express_validator_1.body)('start')
        .isISO8601()
        .withMessage('Start time must be a valid ISO 8601 date'),
    (0, express_validator_1.body)('end')
        .isISO8601()
        .withMessage('End time must be a valid ISO 8601 date'),
    (0, express_validator_1.body)('status')
        .optional()
        .isIn(['SCHEDULED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'])
        .withMessage('Status must be one of: SCHEDULED, RESCHEDULED, CANCELLED, COMPLETED, NO_SHOW'),
];
//# sourceMappingURL=appointment.validator.js.map