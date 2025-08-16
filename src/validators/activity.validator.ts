import { body, param } from 'express-validator';
import { 
  activityListQueries, 
  teamActivityListQueries, 
  mongoIdParam,
  dateRangeQueries,
  mongoIdQuery
} from './common.validator';

export const createActivityValidation = [
  body('propertyId')
    .isMongoId()
    .withMessage('Property ID must be a valid MongoDB ObjectId'),
  body('response')
    .isIn(['NO_ANSWER', 'NOT_INTERESTED', 'CALL_BACK', 'APPOINTMENT_SET', 'FOLLOW_UP', 'LEAD_CREATED'])
    .withMessage('Response must be one of: NO_ANSWER, NOT_INTERESTED, CALL_BACK, APPOINTMENT_SET, FOLLOW_UP, LEAD_CREATED'),
  body('notes')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Notes must be a string between 1 and 1000 characters'),
  body('followUpDate')
    .optional()
    .isISO8601()
    .withMessage('Follow-up date must be a valid ISO 8601 date'),
  body('appointmentDate')
    .optional()
    .isISO8601()
    .withMessage('Appointment date must be a valid ISO 8601 date'),
];

export const updateActivityValidation = [
  mongoIdParam(),
  body('response')
    .optional()
    .isIn(['NO_ANSWER', 'NOT_INTERESTED', 'CALL_BACK', 'APPOINTMENT_SET', 'FOLLOW_UP', 'LEAD_CREATED'])
    .withMessage('Response must be one of: NO_ANSWER, NOT_INTERESTED, CALL_BACK, APPOINTMENT_SET, FOLLOW_UP, LEAD_CREATED'),
  body('notes')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Notes must be a string between 1 and 1000 characters'),
  body('followUpDate')
    .optional()
    .isISO8601()
    .withMessage('Follow-up date must be a valid ISO 8601 date'),
  body('appointmentDate')
    .optional()
    .isISO8601()
    .withMessage('Appointment date must be a valid ISO 8601 date'),
];

export const listMyActivitiesValidation = activityListQueries;

export const listAllActivitiesValidation = teamActivityListQueries;

export const getActivityByIdValidation = [mongoIdParam()];

export const deleteActivityValidation = [mongoIdParam()];

export const getActivityStatsValidation = [
  ...dateRangeQueries,
  mongoIdQuery('agentId'),
  mongoIdQuery('zoneId'),
  mongoIdQuery('teamId'),
];

export const getMyActivityStatsValidation = [
  ...dateRangeQueries,
  mongoIdQuery('agentId'),
  mongoIdQuery('startDate'),
  mongoIdQuery('endDate'),
];
