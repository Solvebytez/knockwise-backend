import { body } from 'express-validator';

export const createAppointmentValidation = [
  body('agentId')
    .isMongoId()
    .withMessage('Agent ID must be a valid MongoDB ObjectId'),
  body('start')
    .isISO8601()
    .withMessage('Start time must be a valid ISO 8601 date'),
  body('end')
    .isISO8601()
    .withMessage('End time must be a valid ISO 8601 date'),
  body('status')
    .optional()
    .isIn(['SCHEDULED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'])
    .withMessage('Status must be one of: SCHEDULED, RESCHEDULED, CANCELLED, COMPLETED, NO_SHOW'),
];
