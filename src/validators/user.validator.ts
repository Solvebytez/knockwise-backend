import { body, query, param } from 'express-validator';

export const createUserValidation = [
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

export const createAgentValidation = [
  body('name')
    .isString()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address'),
  body('username')
    .optional()
    .isString()
    .isLength({ min: 3 })
    .withMessage('Username must be at least 3 characters long'),
  body('contactNumber')
    .optional()
    .isString()
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Please enter a valid phone number (e.g., +1234567890)'),
  body('password')
    .isString()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('role')
    .optional()
    .isIn(['SUPERADMIN', 'SUBADMIN', 'AGENT'])
    .withMessage('Role must be one of: SUPERADMIN, SUBADMIN, AGENT'),
  body('primaryTeamId')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined) return true;
      const mongoose = require('mongoose');
      return mongoose.Types.ObjectId.isValid(value);
    })
    .withMessage('Please select a valid team'),
  body('primaryZoneId')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined) return true;
      const mongoose = require('mongoose');
      return mongoose.Types.ObjectId.isValid(value);
    })
    .withMessage('Please select a valid zone'),
  body('teamIds')
    .optional()
    .isArray()
    .withMessage('Team IDs must be provided as a list'),
  body('teamIds.*')
    .optional()
    .custom((value, { req }) => {
      // Only validate if teamIds array is not empty
      if (req.body.teamIds && req.body.teamIds.length > 0) {
        const mongoose = require('mongoose');
        return mongoose.Types.ObjectId.isValid(value);
      }
      return true;
    })
    .withMessage('Each team ID must be valid'),
  body('zoneIds')
    .optional()
    .isArray()
    .withMessage('Zone IDs must be provided as a list'),
  body('zoneIds.*')
    .optional()
    .custom((value, { req }) => {
      // Only validate if zoneIds array is not empty
      if (req.body.zoneIds && req.body.zoneIds.length > 0) {
        const mongoose = require('mongoose');
        return mongoose.Types.ObjectId.isValid(value);
      }
      return true;
    })
    .withMessage('Each zone ID must be valid'),
];

export const updateUserValidation = [
  param('id')
    .isMongoId()
    .withMessage('User ID must be a valid MongoDB ObjectId'),
  body('name')
    .optional()
    .isString()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address'),
  body('username')
    .optional()
    .isString()
    .isLength({ min: 3 })
    .withMessage('Username must be at least 3 characters long'),
  body('contactNumber')
    .optional()
    .isString()
    .isLength({ min: 10 })
    .withMessage('Contact number must be at least 10 characters long'),
  body('password')
    .optional()
    .isString()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('role')
    .optional()
    .isIn(['SUPERADMIN', 'SUBADMIN', 'AGENT'])
    .withMessage('Role must be one of: SUPERADMIN, SUBADMIN, AGENT'),
  body('status')
    .optional()
    .isIn(['ACTIVE', 'INACTIVE'])
    .withMessage('Status must be either ACTIVE or INACTIVE'),
  body('teamId')
    .optional()
    .isMongoId()
    .withMessage('Team ID must be a valid MongoDB ObjectId'),
  body('zoneId')
    .optional()
    .isMongoId()
    .withMessage('Zone ID must be a valid MongoDB ObjectId'),
];

export const assignAgentToTeamValidation = [
  body('agentId')
    .isMongoId()
    .withMessage('Agent ID must be a valid MongoDB ObjectId'),
  body('teamId')
    .isMongoId()
    .withMessage('Team ID must be a valid MongoDB ObjectId'),
];

export const updateProfileValidation = [
  body('name')
    .optional()
    .isString()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address'),
];

export const listUsersValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('role')
    .optional()
    .isIn(['SUPERADMIN', 'SUBADMIN', 'AGENT'])
    .withMessage('Role must be one of: SUPERADMIN, SUBADMIN, AGENT'),
  query('status')
    .optional()
    .isIn(['ACTIVE', 'INACTIVE'])
    .withMessage('Status must be either ACTIVE or INACTIVE'),
  query('teamId')
    .optional()
    .isMongoId()
    .withMessage('Team ID must be a valid MongoDB ObjectId'),
  query('search')
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
];

export const getUserByIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('User ID must be a valid MongoDB ObjectId'),
];

export const deleteUserValidation = [
  param('id')
    .isMongoId()
    .withMessage('User ID must be a valid MongoDB ObjectId'),
];

export const getMyTeamMembersValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('role')
    .optional()
    .isIn(['SUBADMIN', 'AGENT'])
    .withMessage('Role must be one of: SUBADMIN, AGENT'),
  query('status')
    .optional()
    .isIn(['ACTIVE', 'INACTIVE'])
    .withMessage('Status must be either ACTIVE or INACTIVE'),
];

export const getTeamPerformanceValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  query('teamId')
    .optional()
    .isMongoId()
    .withMessage('Team ID must be a valid MongoDB ObjectId'),
];
