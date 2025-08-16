"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPropertyByIdValidation = exports.updatePropertyScoresValidation = exports.bulkImportPropertiesValidation = exports.updatePropertyValidation = exports.createPropertyValidation = void 0;
const express_validator_1 = require("express-validator");
const common_validator_1 = require("./common.validator");
exports.createPropertyValidation = [
    (0, express_validator_1.body)('address')
        .isString()
        .trim()
        .isLength({ min: 5, max: 200 })
        .withMessage('Address must be between 5 and 200 characters'),
    (0, express_validator_1.body)('city')
        .isString()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('City must be between 2 and 100 characters'),
    (0, express_validator_1.body)('state')
        .isString()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('State must be between 2 and 50 characters'),
    (0, express_validator_1.body)('zipCode')
        .isString()
        .trim()
        .isLength({ min: 5, max: 10 })
        .withMessage('ZIP code must be between 5 and 10 characters'),
    (0, express_validator_1.body)('propertyType')
        .isIn(['SINGLE_FAMILY', 'MULTI_FAMILY', 'CONDO', 'TOWNHOUSE', 'COMMERCIAL'])
        .withMessage('Property type must be one of: SINGLE_FAMILY, MULTI_FAMILY, CONDO, TOWNHOUSE, COMMERCIAL'),
    (0, express_validator_1.body)('bedrooms')
        .optional()
        .isInt({ min: 0, max: 20 })
        .withMessage('Bedrooms must be between 0 and 20'),
    (0, express_validator_1.body)('bathrooms')
        .optional()
        .isFloat({ min: 0, max: 20 })
        .withMessage('Bathrooms must be between 0 and 20'),
    (0, express_validator_1.body)('squareFootage')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Square footage must be a positive integer'),
    (0, express_validator_1.body)('yearBuilt')
        .optional()
        .isInt({ min: 1800, max: new Date().getFullYear() })
        .withMessage('Year built must be between 1800 and current year'),
    (0, express_validator_1.body)('price')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Price must be a positive number'),
    (0, express_validator_1.body)('latitude')
        .optional()
        .isFloat({ min: -90, max: 90 })
        .withMessage('Latitude must be between -90 and 90'),
    (0, express_validator_1.body)('longitude')
        .optional()
        .isFloat({ min: -180, max: 180 })
        .withMessage('Longitude must be between -180 and 180'),
    (0, express_validator_1.body)('zoneId')
        .optional()
        .isMongoId()
        .withMessage('Zone ID must be a valid MongoDB ObjectId'),
];
exports.updatePropertyValidation = [
    (0, common_validator_1.mongoIdParam)(),
    (0, express_validator_1.body)('address')
        .optional()
        .isString()
        .trim()
        .isLength({ min: 5, max: 200 })
        .withMessage('Address must be between 5 and 200 characters'),
    (0, express_validator_1.body)('city')
        .optional()
        .isString()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('City must be between 2 and 100 characters'),
    (0, express_validator_1.body)('state')
        .optional()
        .isString()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('State must be between 2 and 50 characters'),
    (0, express_validator_1.body)('zipCode')
        .optional()
        .isString()
        .trim()
        .isLength({ min: 5, max: 10 })
        .withMessage('ZIP code must be between 5 and 10 characters'),
    (0, express_validator_1.body)('propertyType')
        .optional()
        .isIn(['SINGLE_FAMILY', 'MULTI_FAMILY', 'CONDO', 'TOWNHOUSE', 'COMMERCIAL'])
        .withMessage('Property type must be one of: SINGLE_FAMILY, MULTI_FAMILY, CONDO, TOWNHOUSE, COMMERCIAL'),
    (0, express_validator_1.body)('bedrooms')
        .optional()
        .isInt({ min: 0, max: 20 })
        .withMessage('Bedrooms must be between 0 and 20'),
    (0, express_validator_1.body)('bathrooms')
        .optional()
        .isFloat({ min: 0, max: 20 })
        .withMessage('Bathrooms must be between 0 and 20'),
    (0, express_validator_1.body)('squareFootage')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Square footage must be a positive integer'),
    (0, express_validator_1.body)('yearBuilt')
        .optional()
        .isInt({ min: 1800, max: new Date().getFullYear() })
        .withMessage('Year built must be between 1800 and current year'),
    (0, express_validator_1.body)('price')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Price must be a positive number'),
    (0, express_validator_1.body)('latitude')
        .optional()
        .isFloat({ min: -90, max: 90 })
        .withMessage('Latitude must be between -90 and 90'),
    (0, express_validator_1.body)('longitude')
        .optional()
        .isFloat({ min: -180, max: 180 })
        .withMessage('Longitude must be between -180 and 180'),
    (0, express_validator_1.body)('zoneId')
        .optional()
        .isMongoId()
        .withMessage('Zone ID must be a valid MongoDB ObjectId'),
];
exports.bulkImportPropertiesValidation = [
    (0, express_validator_1.body)('properties')
        .isArray()
        .notEmpty()
        .withMessage('Properties must be a non-empty array'),
    (0, express_validator_1.body)('properties.*.address')
        .isString()
        .trim()
        .isLength({ min: 5, max: 200 })
        .withMessage('Each property address must be between 5 and 200 characters'),
    (0, express_validator_1.body)('properties.*.city')
        .isString()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Each property city must be between 2 and 100 characters'),
    (0, express_validator_1.body)('properties.*.state')
        .isString()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Each property state must be between 2 and 100 characters'),
    (0, express_validator_1.body)('properties.*.zipCode')
        .isString()
        .trim()
        .isLength({ min: 5, max: 10 })
        .withMessage('Each property ZIP code must be between 5 and 10 characters'),
];
exports.updatePropertyScoresValidation = [
    (0, common_validator_1.mongoIdParam)(),
    (0, express_validator_1.body)('leadScore')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Lead score must be between 1 and 100'),
    (0, express_validator_1.body)('motivationScore')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Motivation score must be between 1 and 100'),
    (0, express_validator_1.body)('equityScore')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Equity score must be between 1 and 100'),
];
exports.getPropertyByIdValidation = [(0, common_validator_1.mongoIdParam)()];
//# sourceMappingURL=property.validator.js.map