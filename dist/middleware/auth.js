"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRoles = exports.requireAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const User_1 = require("../models/User");
const requireAuth = async (req, res, next) => {
    try {
        let token;
        // Check for bearer token first
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
        // If no bearer token, check for cookie
        if (!token && req.cookies?.accessToken) {
            token = req.cookies.accessToken;
        }
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access token required (Bearer token or cookie)'
            });
        }
        const decoded = jsonwebtoken_1.default.verify(token, env_1.env.jwtSecret);
        // Get user from database to ensure they still exist and are active
        const user = await User_1.User.findById(decoded.sub).select('-password');
        if (!user || user.status !== 'ACTIVE') {
            return res.status(401).json({
                success: false,
                message: 'User not found or inactive'
            });
        }
        req.user = {
            sub: user._id.toString(),
            email: user.email,
            role: user.role,
            teamId: user.teamId ? user.teamId.toString() : undefined,
            zoneId: user.zoneId ? user.zoneId.toString() : undefined,
            id: user._id.toString()
        };
        next();
    }
    catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
};
exports.requireAuth = requireAuth;
const requireRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions'
            });
        }
        next();
    };
};
exports.requireRoles = requireRoles;
//# sourceMappingURL=auth.js.map