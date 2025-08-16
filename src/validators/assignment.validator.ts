import { body } from 'express-validator';

export const createAssignmentValidation = [
  body('agentId')
    .isMongoId()
    .withMessage('Agent ID must be a valid MongoDB ObjectId'),
  body('zoneId')
    .isMongoId()
    .withMessage('Zone ID must be a valid MongoDB ObjectId'),
  body('effectiveFrom')
    .isISO8601()
    .withMessage('Effective from date must be a valid ISO 8601 date'),
];
