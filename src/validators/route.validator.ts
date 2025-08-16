import { body, param, query } from 'express-validator';
import { 
  mongoIdArrayBody, 
  optionalIntBody, 
  optionalFloatBody,
  mongoIdParam,
  paginationQueries,
  dateRangeQueries,
  statusQuery
} from './common.validator';

export const createRouteValidation = [
  body('name')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Route name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('date')
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date'),
  body('priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .withMessage('Priority must be one of: LOW, MEDIUM, HIGH, URGENT'),
  body('zoneId')
    .optional()
    .isMongoId()
    .withMessage('Zone ID must be a valid MongoDB ObjectId'),
  body('teamId')
    .optional()
    .isMongoId()
    .withMessage('Team ID must be a valid MongoDB ObjectId'),
  body('startLocation')
    .optional()
    .isObject()
    .withMessage('Start location must be an object'),
  body('startLocation.coordinates')
    .optional()
    .isArray({ min: 2, max: 2 })
    .withMessage('Start location coordinates must be an array of 2 numbers'),
  body('startLocation.address')
    .optional()
    .isString()
    .withMessage('Start location address must be a string'),
  body('endLocation')
    .optional()
    .isObject()
    .withMessage('End location must be an object'),
  body('endLocation.coordinates')
    .optional()
    .isArray({ min: 2, max: 2 })
    .withMessage('End location coordinates must be an array of 2 numbers'),
  body('endLocation.address')
    .optional()
    .isString()
    .withMessage('End location address must be a string'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),
  body('isTemplate')
    .optional()
    .isBoolean()
    .withMessage('isTemplate must be a boolean'),
  body('templateName')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Template name must be between 1 and 100 characters'),
];

export const updateRouteValidation = [
  mongoIdParam(),
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Route name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date'),
  body('priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .withMessage('Priority must be one of: LOW, MEDIUM, HIGH, URGENT'),
  body('status')
    .optional()
    .isIn(['DRAFT', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ARCHIVED'])
    .withMessage('Status must be one of: DRAFT, PLANNED, IN_PROGRESS, COMPLETED, CANCELLED, ARCHIVED'),
  body('stops')
    .optional()
    .isArray()
    .withMessage('Stops must be an array'),
  body('stops.*.propertyId')
    .optional()
    .isMongoId()
    .withMessage('Each stop propertyId must be a valid MongoDB ObjectId'),
  body('stops.*.order')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each stop order must be a positive integer'),
  body('stops.*.estimatedDuration')
    .optional()
    .isInt({ min: 1, max: 480 })
    .withMessage('Each stop estimated duration must be between 1 and 480 minutes'),
  body('stops.*.status')
    .optional()
    .isIn(['PENDING', 'COMPLETED', 'SKIPPED', 'RESCHEDULED'])
    .withMessage('Each stop status must be one of: PENDING, COMPLETED, SKIPPED, RESCHEDULED'),
  body('stops.*.notes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Each stop notes must be less than 1000 characters'),
];

export const updateRouteStatusValidation = [
  mongoIdParam(),
  body('status')
    .isIn(['DRAFT', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ARCHIVED'])
    .withMessage('Status must be one of: DRAFT, PLANNED, IN_PROGRESS, COMPLETED, CANCELLED, ARCHIVED'),
];

export const optimizeRouteValidation = [
  ...mongoIdArrayBody('propertyIds'),
  body('startLocation')
    .optional()
    .isArray({ min: 2, max: 2 })
    .withMessage('Start location must be an array of 2 numbers [longitude, latitude]'),
  body('startLocation.*')
    .optional()
    .isFloat()
    .withMessage('Start location coordinates must be numbers'),
  body('endLocation')
    .optional()
    .isArray({ min: 2, max: 2 })
    .withMessage('End location must be an array of 2 numbers [longitude, latitude]'),
  body('endLocation.*')
    .optional()
    .isFloat()
    .withMessage('End location coordinates must be numbers'),
  body('optimizationSettings.maxStops')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Max stops must be between 1 and 100'),
  body('optimizationSettings.maxDistance')
    .optional()
    .isFloat({ min: 0.1, max: 500 })
    .withMessage('Max distance must be between 0.1 and 500 miles'),
  body('optimizationSettings.optimizationType')
    .optional()
    .isIn(['FASTEST', 'SHORTEST', 'BALANCED'])
    .withMessage('Optimization type must be one of: FASTEST, SHORTEST, BALANCED'),
  body('optimizationSettings.avoidFerries')
    .optional()
    .isBoolean()
    .withMessage('Avoid ferries must be a boolean'),
  body('optimizationSettings.avoidHighways')
    .optional()
    .isBoolean()
    .withMessage('Avoid highways must be a boolean'),
  body('optimizationSettings.avoidTolls')
    .optional()
    .isBoolean()
    .withMessage('Avoid tolls must be a boolean'),
  body('optimizationSettings.avoidTraffic')
    .optional()
    .isBoolean()
    .withMessage('Avoid traffic must be a boolean'),
  body('optimizationSettings.startFromOffice')
    .optional()
    .isBoolean()
    .withMessage('Start from office must be a boolean'),
  body('optimizationSettings.returnToOffice')
    .optional()
    .isBoolean()
    .withMessage('Return to office must be a boolean'),
  body('optimizationSettings.preferredTimeWindow.start')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),
  body('optimizationSettings.preferredTimeWindow.end')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format'),
];

export const duplicateRouteValidation = [
  mongoIdParam(),
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Route name must be between 1 and 100 characters'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date'),
];

export const shareRouteValidation = [
  mongoIdParam(),
  body('sharedWith')
    .isArray({ min: 1 })
    .withMessage('Must share with at least one user'),
  body('sharedWith.*')
    .isMongoId()
    .withMessage('Each shared user ID must be a valid MongoDB ObjectId'),
  body('permissions')
    .optional()
    .isIn(['VIEW', 'EDIT', 'ADMIN'])
    .withMessage('Permissions must be one of: VIEW, EDIT, ADMIN'),
];

export const updateStopStatusValidation = [
  mongoIdParam('routeId'),
  body('stopIndex')
    .isInt({ min: 0 })
    .withMessage('Stop index must be a non-negative integer'),
  body('status')
    .isIn(['PENDING', 'COMPLETED', 'SKIPPED', 'RESCHEDULED'])
    .withMessage('Status must be one of: PENDING, COMPLETED, SKIPPED, RESCHEDULED'),
  body('actualDuration')
    .optional()
    .isInt({ min: 1, max: 480 })
    .withMessage('Actual duration must be between 1 and 480 minutes'),
  body('notes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),
];

export const listRoutesValidation = [
  ...paginationQueries,
  ...dateRangeQueries,
  statusQuery(['DRAFT', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ARCHIVED']),
  query('priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .withMessage('Priority must be one of: LOW, MEDIUM, HIGH, URGENT'),
  query('agentId')
    .optional()
    .isMongoId()
    .withMessage('Agent ID must be a valid MongoDB ObjectId'),
  query('teamId')
    .optional()
    .isMongoId()
    .withMessage('Team ID must be a valid MongoDB ObjectId'),
  query('zoneId')
    .optional()
    .isMongoId()
    .withMessage('Zone ID must be a valid MongoDB ObjectId'),
  query('isTemplate')
    .optional()
    .isBoolean()
    .withMessage('isTemplate must be a boolean'),
  query('tags')
    .optional()
    .isString()
    .withMessage('Tags must be a comma-separated string'),
];

export const getRouteAnalyticsValidation = [
  mongoIdParam(),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
];

export const exportRouteValidation = [
  mongoIdParam(),
  query('format')
    .optional()
    .isIn(['pdf', 'csv', 'json'])
    .withMessage('Export format must be one of: pdf, csv, json'),
];

export const createTemplateValidation = [
  body('name')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Template name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('optimizationSettings')
    .optional()
    .isObject()
    .withMessage('Optimization settings must be an object'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
];
