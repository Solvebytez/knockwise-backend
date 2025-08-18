"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAssignmentValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createAssignmentValidation = [
    (0, express_validator_1.body)('zoneId')
        .isMongoId()
        .withMessage('Zone ID must be a valid MongoDB ObjectId'),
    (0, express_validator_1.body)('effectiveFrom')
        .isISO8601()
        .withMessage('Effective from date must be a valid ISO 8601 date'),
    (0, express_validator_1.body)()
        .custom((value, { req }) => {
        // Either agentId or teamId must be provided, but not both
        const hasAgentId = req.body.agentId;
        const hasTeamId = req.body.teamId;
        if (!hasAgentId && !hasTeamId) {
            throw new Error('Either agentId or teamId must be provided');
        }
        if (hasAgentId && hasTeamId) {
            throw new Error('Cannot provide both agentId and teamId');
        }
        return true;
    })
        .withMessage('Invalid assignment data'),
    (0, express_validator_1.body)('agentId')
        .optional()
        .isMongoId()
        .withMessage('Agent ID must be a valid MongoDB ObjectId'),
    (0, express_validator_1.body)('teamId')
        .optional()
        .isMongoId()
        .withMessage('Team ID must be a valid MongoDB ObjectId'),
];
//# sourceMappingURL=assignment.validator.js.map