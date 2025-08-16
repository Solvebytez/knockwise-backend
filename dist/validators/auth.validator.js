"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logoutValidation = exports.refreshValidation = exports.loginValidation = exports.registerValidation = void 0;
const express_validator_1 = require("express-validator");
exports.registerValidation = [
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
exports.loginValidation = [
    (0, express_validator_1.body)('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Must be a valid email address'),
    (0, express_validator_1.body)('password')
        .isString()
        .withMessage('Password is required'),
];
exports.refreshValidation = [
    (0, express_validator_1.body)('refreshToken')
        .isString()
        .withMessage('Refresh token is required'),
];
exports.logoutValidation = [
    (0, express_validator_1.body)('refreshToken')
        .optional()
        .isString()
        .withMessage('Refresh token must be a string if provided'),
];
//# sourceMappingURL=auth.validator.js.map