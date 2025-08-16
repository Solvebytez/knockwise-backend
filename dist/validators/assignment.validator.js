"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAssignmentValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createAssignmentValidation = [
    (0, express_validator_1.body)('agentId')
        .isMongoId()
        .withMessage('Agent ID must be a valid MongoDB ObjectId'),
    (0, express_validator_1.body)('zoneId')
        .isMongoId()
        .withMessage('Zone ID must be a valid MongoDB ObjectId'),
    (0, express_validator_1.body)('effectiveFrom')
        .isISO8601()
        .withMessage('Effective from date must be a valid ISO 8601 date'),
];
//# sourceMappingURL=assignment.validator.js.map