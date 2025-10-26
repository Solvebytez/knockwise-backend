"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTeamValidation = exports.createTeamValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createTeamValidation = [
    (0, express_validator_1.body)('name')
        .isString()
        .isLength({ min: 2, max: 100 })
        .withMessage('Team name must be between 2 and 100 characters long')
        .trim(),
    (0, express_validator_1.body)('description')
        .optional()
        .isString()
        .isLength({ max: 500 })
        .withMessage('Description cannot exceed 500 characters')
        .trim(),
    (0, express_validator_1.oneOf)([
        (0, express_validator_1.body)('memberIds').isArray({ min: 1 }),
        (0, express_validator_1.body)('agentIds').isArray({ min: 1 })
    ]),
    (0, express_validator_1.body)('memberIds')
        .optional()
        .isArray({ min: 1 })
        .withMessage('At least one team member is required'),
    (0, express_validator_1.body)('memberIds.*')
        .optional()
        .isMongoId()
        .withMessage('Each member ID must be a valid MongoDB ObjectId'),
    (0, express_validator_1.body)('agentIds')
        .optional()
        .isArray({ min: 1 })
        .withMessage('At least one team member is required'),
    (0, express_validator_1.body)('agentIds.*')
        .optional()
        .isMongoId()
        .withMessage('Each member ID must be a valid MongoDB ObjectId'),
];
exports.updateTeamValidation = [
    (0, express_validator_1.body)('name')
        .optional()
        .isString()
        .isLength({ min: 2, max: 100 })
        .withMessage('Team name must be between 2 and 100 characters long')
        .trim(),
    (0, express_validator_1.body)('description')
        .optional()
        .isString()
        .isLength({ max: 500 })
        .withMessage('Description cannot exceed 500 characters')
        .trim(),
    (0, express_validator_1.body)('memberIds')
        .optional()
        .isArray({ min: 1 })
        .withMessage('At least one team member is required'),
    (0, express_validator_1.body)('memberIds.*')
        .optional()
        .isMongoId()
        .withMessage('Each member ID must be a valid MongoDB ObjectId'),
    (0, express_validator_1.body)('agentIds')
        .optional()
        .isArray({ min: 1 })
        .withMessage('At least one team member is required'),
    (0, express_validator_1.body)('agentIds.*')
        .optional()
        .isMongoId()
        .withMessage('Each member ID must be a valid MongoDB ObjectId'),
];
//# sourceMappingURL=team.validator.js.map