import { body, param } from 'express-validator';
import { mongoIdParam } from './common.validator';

export const createPropertyValidation = [
  body('address')
    .isString()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Address must be between 5 and 200 characters'),
  body('city')
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('City must be between 2 and 100 characters'),
  body('state')
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('State must be between 2 and 50 characters'),
  body('zipCode')
    .isString()
    .trim()
    .isLength({ min: 5, max: 10 })
    .withMessage('ZIP code must be between 5 and 10 characters'),
  body('propertyType')
    .isIn(['SINGLE_FAMILY', 'MULTI_FAMILY', 'CONDO', 'TOWNHOUSE', 'COMMERCIAL'])
    .withMessage('Property type must be one of: SINGLE_FAMILY, MULTI_FAMILY, CONDO, TOWNHOUSE, COMMERCIAL'),
  body('bedrooms')
    .optional()
    .isInt({ min: 0, max: 20 })
    .withMessage('Bedrooms must be between 0 and 20'),
  body('bathrooms')
    .optional()
    .isFloat({ min: 0, max: 20 })
    .withMessage('Bathrooms must be between 0 and 20'),
  body('squareFootage')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Square footage must be a positive integer'),
  body('yearBuilt')
    .optional()
    .isInt({ min: 1800, max: new Date().getFullYear() })
    .withMessage('Year built must be between 1800 and current year'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('zoneId')
    .optional()
    .isMongoId()
    .withMessage('Zone ID must be a valid MongoDB ObjectId'),
];

export const updatePropertyValidation = [
  mongoIdParam(),
  body('address')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Address must be between 5 and 200 characters'),
  body('city')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('City must be between 2 and 100 characters'),
  body('state')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('State must be between 2 and 50 characters'),
  body('zipCode')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 5, max: 10 })
    .withMessage('ZIP code must be between 5 and 10 characters'),
  body('propertyType')
    .optional()
    .isIn(['SINGLE_FAMILY', 'MULTI_FAMILY', 'CONDO', 'TOWNHOUSE', 'COMMERCIAL'])
    .withMessage('Property type must be one of: SINGLE_FAMILY, MULTI_FAMILY, CONDO, TOWNHOUSE, COMMERCIAL'),
  body('bedrooms')
    .optional()
    .isInt({ min: 0, max: 20 })
    .withMessage('Bedrooms must be between 0 and 20'),
  body('bathrooms')
    .optional()
    .isFloat({ min: 0, max: 20 })
    .withMessage('Bathrooms must be between 0 and 20'),
  body('squareFootage')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Square footage must be a positive integer'),
  body('yearBuilt')
    .optional()
    .isInt({ min: 1800, max: new Date().getFullYear() })
    .withMessage('Year built must be between 1800 and current year'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('zoneId')
    .optional()
    .isMongoId()
    .withMessage('Zone ID must be a valid MongoDB ObjectId'),
];

export const bulkImportPropertiesValidation = [
  body('properties')
    .isArray()
    .notEmpty()
    .withMessage('Properties must be a non-empty array'),
  body('properties.*.address')
    .isString()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Each property address must be between 5 and 200 characters'),
  body('properties.*.city')
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Each property city must be between 2 and 100 characters'),
  body('properties.*.state')
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Each property state must be between 2 and 100 characters'),
  body('properties.*.zipCode')
    .isString()
    .trim()
    .isLength({ min: 5, max: 10 })
    .withMessage('Each property ZIP code must be between 5 and 10 characters'),
];

export const updatePropertyScoresValidation = [
  mongoIdParam(),
  body('leadScore')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Lead score must be between 1 and 100'),
  body('motivationScore')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Motivation score must be between 1 and 100'),
  body('equityScore')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Equity score must be between 1 and 100'),
];

export const getPropertyByIdValidation = [mongoIdParam()];
