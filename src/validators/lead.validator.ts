import { body, param } from 'express-validator';

export const createLeadValidation = [
  body('propertyId')
    .isMongoId()
    .withMessage('Property ID must be a valid MongoDB ObjectId'),
  body('status')
    .optional()
    .isIn(['NEW', 'CONTACTED', 'FOLLOW_UP', 'APPOINTMENT_SET', 'VISITED', 'NOT_INTERESTED', 'CONVERTED', 'LOST'])
    .withMessage('Status must be one of: NEW, CONTACTED, FOLLOW_UP, APPOINTMENT_SET, VISITED, NOT_INTERESTED, CONVERTED, LOST'),
];

export const updateLeadStatusValidation = [
  param('id')
    .isMongoId()
    .withMessage('Lead ID must be a valid MongoDB ObjectId'),
  body('status')
    .isIn(['NEW', 'CONTACTED', 'FOLLOW_UP', 'APPOINTMENT_SET', 'VISITED', 'NOT_INTERESTED', 'CONVERTED', 'LOST'])
    .withMessage('Status must be one of: NEW, CONTACTED, FOLLOW_UP, APPOINTMENT_SET, VISITED, NOT_INTERESTED, CONVERTED, LOST'),
];
