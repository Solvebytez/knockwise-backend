import { body } from 'express-validator';

export const registerValidation = [
  body('name')
    .isString()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address'),
  body('password')
    .isString()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('role')
    .isIn(['SUPERADMIN', 'SUBADMIN', 'AGENT'])
    .withMessage('Role must be one of: SUPERADMIN, SUBADMIN, AGENT'),
  body('teamId')
    .optional()
    .isMongoId()
    .withMessage('Team ID must be a valid MongoDB ObjectId'),
  body('zoneId')
    .optional()
    .isMongoId()
    .withMessage('Zone ID must be a valid MongoDB ObjectId'),
];

export const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address'),
  body('password')
    .isString()
    .withMessage('Password is required'),
];

export const refreshValidation = [
  body('refreshToken')
    .isString()
    .withMessage('Refresh token is required'),
];

export const logoutValidation = [
  body('refreshToken')
    .optional()
    .isString()
    .withMessage('Refresh token must be a string if provided'),
];
