import { body, param } from 'express-validator';
import { 
  zoneListQueries, 
  nearbyPropertiesQueries, 
  mongoIdParam,
  mongoIdQuery,
  locationQueries
} from './common.validator';

export const createZoneValidation = [
  body('name')
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Zone name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('boundary')
    .isObject()
    .withMessage('Boundary must be an object'),
  body('boundary.type')
    .isIn(['Polygon'])
    .withMessage('Boundary type must be Polygon'),
  body('boundary.coordinates')
    .isArray()
    .notEmpty()
    .withMessage('Boundary coordinates must be a non-empty array'),
  body('teamId')
    .optional()
    .isMongoId()
    .withMessage('Team ID must be a valid MongoDB ObjectId'),
];

export const updateZoneValidation = [
  mongoIdParam(),
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Zone name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('boundary')
    .optional()
    .isObject()
    .withMessage('Boundary must be an object'),
  body('boundary.type')
    .optional()
    .isIn(['Polygon'])
    .withMessage('Boundary type must be Polygon'),
  body('boundary.coordinates')
    .optional()
    .isArray()
    .notEmpty()
    .withMessage('Boundary coordinates must be a non-empty array'),
];

export const assignAgentToZoneValidation = [
  mongoIdParam('zoneId'),
  body('agentId')
    .isMongoId()
    .withMessage('Agent ID must be a valid MongoDB ObjectId'),
];

export const listZonesValidation = zoneListQueries;

export const getZoneByIdValidation = [mongoIdParam()];

export const deleteZoneValidation = [mongoIdParam()];

export const getZoneAssignmentsValidation = [mongoIdParam()];

export const removeAgentFromZoneValidation = [mongoIdParam('zoneId')];

export const getZonesByProximityValidation = nearbyPropertiesQueries;

export const getZoneStatisticsValidation = [mongoIdParam()];

export const getNearbyPropertiesValidation = [
  ...locationQueries,
  mongoIdQuery('zoneId'),
  mongoIdQuery('status'),
];
