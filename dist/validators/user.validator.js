"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTeamPerformanceValidation = exports.getMyTeamMembersValidation = exports.deleteUserValidation = exports.getUserByIdValidation = exports.listUsersValidation = exports.updateProfileValidation = exports.assignAgentToTeamValidation = exports.updateUserValidation = exports.createAgentValidation = exports.createUserValidation = void 0;
const express_validator_1 = require("express-validator");
exports.createUserValidation = [
    (0, express_validator_1.body)('name')
        .isString()
        .isLength({ min: 2 })
        .withMessage('Name must be at least 2 characters long'),
    (0, express_validator_1.body)('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Must be a valid email address'),
    (0, express_validator_1.body)('password')
        .isString()
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    (0, express_validator_1.body)('role')
        .isIn(['SUPERADMIN', 'SUBADMIN', 'AGENT'])
        .withMessage('Role must be one of: SUPERADMIN, SUBADMIN, AGENT'),
    (0, express_validator_1.body)('teamId')
        .optional()
        .isMongoId()
        .withMessage('Team ID must be a valid MongoDB ObjectId'),
    (0, express_validator_1.body)('zoneId')
        .optional()
        .isMongoId()
        .withMessage('Zone ID must be a valid MongoDB ObjectId'),
];
exports.createAgentValidation = [
    (0, express_validator_1.body)('name')
        .isString()
        .isLength({ min: 2 })
        .withMessage('Name must be at least 2 characters long'),
    (0, express_validator_1.body)('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please enter a valid email address'),
    (0, express_validator_1.body)('username')
        .optional()
        .isString()
        .isLength({ min: 3 })
        .withMessage('Username must be at least 3 characters long'),
    (0, express_validator_1.body)('contactNumber')
        .optional()
        .isString()
        .matches(/^[\+]?[1-9][\d]{0,15}$/)
        .withMessage('Please enter a valid phone number (e.g., +1234567890)'),
    (0, express_validator_1.body)('password')
        .isString()
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    (0, express_validator_1.body)('role')
        .optional()
        .isIn(['SUPERADMIN', 'SUBADMIN', 'AGENT'])
        .withMessage('Role must be one of: SUPERADMIN, SUBADMIN, AGENT'),
    (0, express_validator_1.body)('primaryTeamId')
        .optional()
        .custom((value) => {
        if (value === null || value === undefined)
            return true;
        const mongoose = require('mongoose');
        return mongoose.Types.ObjectId.isValid(value);
    })
        .withMessage('Please select a valid team'),
    (0, express_validator_1.body)('primaryZoneId')
        .optional()
        .custom((value) => {
        if (value === null || value === undefined)
            return true;
        const mongoose = require('mongoose');
        return mongoose.Types.ObjectId.isValid(value);
    })
        .withMessage('Please select a valid zone'),
    (0, express_validator_1.body)('teamIds')
        .optional()
        .isArray()
        .withMessage('Team IDs must be provided as a list'),
    (0, express_validator_1.body)('teamIds.*')
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
    (0, express_validator_1.body)('zoneIds')
        .optional()
        .isArray()
        .withMessage('Zone IDs must be provided as a list'),
    (0, express_validator_1.body)('zoneIds.*')
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
exports.updateUserValidation = [
    (0, express_validator_1.param)('id')
        .isMongoId()
        .withMessage('User ID must be a valid MongoDB ObjectId'),
    (0, express_validator_1.body)('name')
        .optional()
        .isString()
        .isLength({ min: 2 })
        .withMessage('Name must be at least 2 characters long'),
    (0, express_validator_1.body)('email')
        .optional()
        .isEmail()
        .normalizeEmail()
        .withMessage('Must be a valid email address'),
    (0, express_validator_1.body)('username')
        .optional()
        .isString()
        .isLength({ min: 3 })
        .withMessage('Username must be at least 3 characters long'),
    (0, express_validator_1.body)('contactNumber')
        .optional()
        .isString()
        .isLength({ min: 10 })
        .withMessage('Contact number must be at least 10 characters long'),
    (0, express_validator_1.body)('password')
        .optional()
        .isString()
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    (0, express_validator_1.body)('role')
        .optional()
        .isIn(['SUPERADMIN', 'SUBADMIN', 'AGENT'])
        .withMessage('Role must be one of: SUPERADMIN, SUBADMIN, AGENT'),
    (0, express_validator_1.body)('status')
        .optional()
        .isIn(['ACTIVE', 'INACTIVE'])
        .withMessage('Status must be either ACTIVE or INACTIVE'),
    (0, express_validator_1.body)('teamId')
        .optional()
        .isMongoId()
        .withMessage('Team ID must be a valid MongoDB ObjectId'),
    (0, express_validator_1.body)('zoneId')
        .optional()
        .isMongoId()
        .withMessage('Zone ID must be a valid MongoDB ObjectId'),
];
exports.assignAgentToTeamValidation = [
    (0, express_validator_1.body)('agentId')
        .isMongoId()
        .withMessage('Agent ID must be a valid MongoDB ObjectId'),
    (0, express_validator_1.body)('teamId')
        .isMongoId()
        .withMessage('Team ID must be a valid MongoDB ObjectId'),
];
exports.updateProfileValidation = [
    (0, express_validator_1.body)('name')
        .optional()
        .isString()
        .isLength({ min: 2 })
        .withMessage('Name must be at least 2 characters long'),
    (0, express_validator_1.body)('email')
        .optional()
        .isEmail()
        .normalizeEmail()
        .withMessage('Must be a valid email address'),
];
exports.listUsersValidation = [
    (0, express_validator_1.query)('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    (0, express_validator_1.query)('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    (0, express_validator_1.query)('role')
        .optional()
        .isIn(['SUPERADMIN', 'SUBADMIN', 'AGENT'])
        .withMessage('Role must be one of: SUPERADMIN, SUBADMIN, AGENT'),
    (0, express_validator_1.query)('status')
        .optional()
        .isIn(['ACTIVE', 'INACTIVE'])
        .withMessage('Status must be either ACTIVE or INACTIVE'),
    (0, express_validator_1.query)('teamId')
        .optional()
        .isMongoId()
        .withMessage('Team ID must be a valid MongoDB ObjectId'),
];
exports.getUserByIdValidation = [
    (0, express_validator_1.param)('id')
        .isMongoId()
        .withMessage('User ID must be a valid MongoDB ObjectId'),
];
exports.deleteUserValidation = [
    (0, express_validator_1.param)('id')
        .isMongoId()
        .withMessage('User ID must be a valid MongoDB ObjectId'),
];
exports.getMyTeamMembersValidation = [
    (0, express_validator_1.query)('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    (0, express_validator_1.query)('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    (0, express_validator_1.query)('role')
        .optional()
        .isIn(['SUBADMIN', 'AGENT'])
        .withMessage('Role must be one of: SUBADMIN, AGENT'),
    (0, express_validator_1.query)('status')
        .optional()
        .isIn(['ACTIVE', 'INACTIVE'])
        .withMessage('Status must be either ACTIVE or INACTIVE'),
];
exports.getTeamPerformanceValidation = [
    (0, express_validator_1.query)('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be a valid ISO 8601 date'),
    (0, express_validator_1.query)('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be a valid ISO 8601 date'),
    (0, express_validator_1.query)('teamId')
        .optional()
        .isMongoId()
        .withMessage('Team ID must be a valid MongoDB ObjectId'),
];
//# sourceMappingURL=user.validator.js.map