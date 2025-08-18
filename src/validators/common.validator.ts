import { body, param, query } from 'express-validator';

// Common parameter validations
export const mongoIdParam = (paramName: string = 'id') => 
  param(paramName).isMongoId().withMessage(`${paramName} must be a valid MongoDB ObjectId`);

export const mongoIdParams = (paramNames: string[]) => 
  paramNames.map(name => mongoIdParam(name));

// Common query validations
export const paginationQueries = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
];

export const dateRangeQueries = [
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date'),
];

export const locationQueries = [
  query('latitude').isFloat().withMessage('Latitude must be a valid number'),
  query('longitude').isFloat().withMessage('Longitude must be a valid number'),
  query('maxDistance').optional().isFloat({ min: 0 }).withMessage('Max distance must be a positive number'),
];

export const statusQuery = (allowedStatuses: string[]) =>
  query('status').optional().isIn(allowedStatuses).withMessage(`Status must be one of: ${allowedStatuses.join(', ')}`);

export const mongoIdQuery = (fieldName: string) =>
  query(fieldName).optional().isMongoId().withMessage(`${fieldName} must be a valid MongoDB ObjectId`);

// Common body validations
export const mongoIdArrayBody = (fieldName: string) => [
  body(fieldName)
    .isArray()
    .notEmpty()
    .withMessage(`${fieldName} must be a non-empty array`),
  body(`${fieldName}.*`)
    .isMongoId()
    .withMessage(`Each ${fieldName} must be a valid MongoDB ObjectId`),
];

export const optionalIntBody = (fieldName: string, min: number = 1, max: number = 100) =>
  body(fieldName)
    .optional()
    .isInt({ min, max })
    .withMessage(`${fieldName} must be an integer between ${min} and ${max}`);

export const optionalFloatBody = (fieldName: string, min: number = 0) =>
  body(fieldName)
    .optional()
    .isFloat({ min })
    .withMessage(`${fieldName} must be a number greater than or equal to ${min}`);

// Specific validation combinations
export const listQueries = (additionalQueries: any[] = []) => [
  ...paginationQueries,
  ...additionalQueries,
];

export const activityListQueries = [
  ...paginationQueries,
  query('response').optional().isIn(['NO_ANSWER', 'NOT_INTERESTED', 'CALL_BACK', 'APPOINTMENT_SET', 'FOLLOW_UP', 'LEAD_CREATED']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('zoneId').optional().isMongoId(),
];

export const teamActivityListQueries = [
  ...paginationQueries,
  query('agentId').optional().isMongoId(),
  query('response').optional().isIn(['NO_ANSWER', 'NOT_INTERESTED', 'CALL_BACK', 'APPOINTMENT_SET', 'FOLLOW_UP', 'LEAD_CREATED']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('zoneId').optional().isMongoId(),
  query('teamId').optional().isMongoId(),
];

export const zoneListQueries = [
  ...paginationQueries,
  query('teamId').optional().isMongoId(),
  query('status').optional().isIn(['ACTIVE', 'INACTIVE', 'DRAFT', 'SCHEDULED']),
];

export const nearbyPropertiesQueries = [
  ...locationQueries,
  query('zoneId').optional().isMongoId(),
  query('status').optional().isIn(['ACTIVE', 'INACTIVE']),
];
