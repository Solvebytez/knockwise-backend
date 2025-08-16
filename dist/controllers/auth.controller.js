"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.refresh = refresh;
exports.logout = logout;
exports.logoutAll = logoutAll;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = __importDefault(require("../models/User"));
const RefreshToken_1 = __importDefault(require("../models/RefreshToken"));
const jwt_1 = require("../utils/jwt");
const env_1 = require("../config/env");
function parseTime(text) {
    const match = /^(\d+)([mhd])$/.exec(text);
    if (!match)
        return 0;
    const num = Number(match[1]);
    const unit = match[2];
    if (unit === 'm')
        return num * 60 * 1000;
    if (unit === 'h')
        return num * 60 * 60 * 1000;
    if (unit === 'd')
        return num * 24 * 60 * 60 * 1000;
    return 0;
}
async function register(req, res) {
    const { name, email, password, role } = req.body;
    const exists = await User_1.default.findOne({ email });
    if (exists) {
        res.status(409).json({ message: 'Email already exists' });
        return;
    }
    const user = await User_1.default.create({ name, email, password, role });
    // Generate tokens
    const payload = { sub: String(user._id), role: user.role };
    const accessToken = (0, jwt_1.signAccessToken)(payload);
    const refreshTokenValue = (0, jwt_1.signRefreshToken)(payload);
    const expiresAt = new Date(Date.now() + parseTime(env_1.env.refreshExpiresIn));
    // Save refresh token
    await RefreshToken_1.default.create({ userId: user._id, token: refreshTokenValue, expiresAt });
    // Set cookies
    res.cookie('accessToken', accessToken, {
        httpOnly: env_1.env.cookieHttpOnly,
        secure: env_1.env.cookieSecure,
        sameSite: env_1.env.cookieSameSite,
        maxAge: parseTime(env_1.env.jwtExpiresIn),
        path: '/'
    });
    res.cookie('refreshToken', refreshTokenValue, {
        httpOnly: env_1.env.cookieHttpOnly,
        secure: env_1.env.cookieSecure,
        sameSite: env_1.env.cookieSameSite,
        maxAge: env_1.env.cookieMaxAge,
        path: '/'
    });
    // Return both tokens in response body for flexibility
    res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
                createdAt: user.createdAt
            },
            accessToken,
            refreshToken: refreshTokenValue
        }
    });
}
async function login(req, res) {
    const { email, password } = req.body;
    const user = await User_1.default.findOne({ email }).select('+password');
    if (!user) {
        res.status(401).json({ message: 'Invalid credentials' });
        return;
    }
    if (user.status !== 'ACTIVE') {
        res.status(403).json({ message: 'Account is inactive' });
        return;
    }
    const ok = await bcryptjs_1.default.compare(password, user.password);
    if (!ok) {
        res.status(401).json({ message: 'Invalid credentials' });
        return;
    }
    const payload = { sub: String(user._id), role: user.role };
    const accessToken = (0, jwt_1.signAccessToken)(payload);
    const refreshTokenValue = (0, jwt_1.signRefreshToken)(payload);
    const expiresAt = new Date(Date.now() + parseTime(env_1.env.refreshExpiresIn));
    // Save refresh token
    await RefreshToken_1.default.create({ userId: user._id, token: refreshTokenValue, expiresAt });
    // Set cookies
    res.cookie('accessToken', accessToken, {
        httpOnly: env_1.env.cookieHttpOnly,
        secure: env_1.env.cookieSecure,
        sameSite: env_1.env.cookieSameSite,
        maxAge: parseTime(env_1.env.jwtExpiresIn),
        path: '/'
    });
    res.cookie('refreshToken', refreshTokenValue, {
        httpOnly: env_1.env.cookieHttpOnly,
        secure: env_1.env.cookieSecure,
        sameSite: env_1.env.cookieSameSite,
        maxAge: env_1.env.cookieMaxAge,
        path: '/'
    });
    // Return both tokens in response body for flexibility
    res.json({
        success: true,
        message: 'Login successful',
        data: {
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
                teamId: user.teamId,
                zoneId: user.zoneId,
                createdAt: user.createdAt
            },
            accessToken,
            refreshToken: refreshTokenValue
        }
    });
}
async function refresh(req, res) {
    // Check for refresh token in body first, then cookies
    const { refreshToken: bodyRefreshToken } = req.body;
    const cookieRefreshToken = req.cookies?.refreshToken;
    const refreshToken = bodyRefreshToken || cookieRefreshToken;
    if (!refreshToken) {
        res.status(400).json({ message: 'Missing refresh token' });
        return;
    }
    try {
        const payload = (0, jwt_1.verifyRefreshToken)(refreshToken);
        const record = await RefreshToken_1.default.findOne({ token: refreshToken, revokedAt: null });
        if (!record) {
            res.status(401).json({ message: 'Invalid refresh token' });
            return;
        }
        const accessToken = (0, jwt_1.signAccessToken)({ sub: payload.sub, role: payload.role });
        // Set new access token cookie
        res.cookie('accessToken', accessToken, {
            httpOnly: env_1.env.cookieHttpOnly,
            secure: env_1.env.cookieSecure,
            sameSite: env_1.env.cookieSameSite,
            maxAge: parseTime(env_1.env.jwtExpiresIn),
            path: '/'
        });
        res.json({
            success: true,
            message: 'Token refreshed successfully',
            data: { accessToken }
        });
    }
    catch {
        res.status(401).json({ message: 'Invalid refresh token' });
    }
}
async function logout(req, res) {
    try {
        // Get refresh token from cookies or body
        const { refreshToken: bodyRefreshToken } = req.body;
        const cookieRefreshToken = req.cookies?.refreshToken;
        const refreshToken = bodyRefreshToken || cookieRefreshToken;
        if (refreshToken) {
            // Revoke the refresh token
            await RefreshToken_1.default.findOneAndUpdate({ token: refreshToken }, { revokedAt: new Date() });
        }
        // Clear cookies
        res.clearCookie('accessToken', { path: '/' });
        res.clearCookie('refreshToken', { path: '/' });
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    }
    catch (error) {
        console.error('Logout error:', error);
        // Even if there's an error, clear cookies
        res.clearCookie('accessToken', { path: '/' });
        res.clearCookie('refreshToken', { path: '/' });
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    }
}
async function logoutAll(req, res) {
    try {
        // Get user ID from request (requires authentication)
        const userId = req.user?.sub;
        if (userId) {
            // Revoke all refresh tokens for this user
            await RefreshToken_1.default.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
        }
        // Clear cookies
        res.clearCookie('accessToken', { path: '/' });
        res.clearCookie('refreshToken', { path: '/' });
        res.json({
            success: true,
            message: 'Logged out from all devices successfully'
        });
    }
    catch (error) {
        console.error('Logout all error:', error);
        // Even if there's an error, clear cookies
        res.clearCookie('accessToken', { path: '/' });
        res.clearCookie('refreshToken', { path: '/' });
        res.json({
            success: true,
            message: 'Logged out from all devices successfully'
        });
    }
}
//# sourceMappingURL=auth.controller.js.map