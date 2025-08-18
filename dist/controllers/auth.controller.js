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
const crypto_1 = __importDefault(require("crypto"));
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
    try {
        const { email, password } = req.body;
        // 1. Find user
        const user = await User_1.default.findOne({ email }).select("+password");
        if (!user) {
            res.status(401).json({ message: "Invalid credentials" });
            return;
        }
        // 2. Check user status
        if (user.status !== "ACTIVE") {
            res.status(403).json({ message: "Account is inactive" });
            return;
        }
        // 3. Compare password
        const ok = await bcryptjs_1.default.compare(password, user.password);
        if (!ok) {
            res.status(401).json({ message: "Invalid credentials" });
            return;
        }
        // 4. Generate tokens
        const payload = { sub: String(user._id), role: user.role };
        const accessToken = (0, jwt_1.signAccessToken)(payload);
        const refreshTokenValue = (0, jwt_1.signRefreshToken)(payload);
        const expiresAt = new Date(Date.now() + parseTime(env_1.env.refreshExpiresIn));
        const hashedToken = crypto_1.default.createHash("sha256").update(refreshTokenValue).digest("hex");
        // 5. Save refresh token in DB
        await RefreshToken_1.default.create({
            userId: user._id,
            token: hashedToken,
            expiresAt,
        });
        // 6. Cookie options
        const isProduction = process.env.NODE_ENV === "production";
        const cookieOptions = {
            httpOnly: true,
            secure: isProduction, // HTTPS in prod, HTTP locally
            sameSite: (isProduction ? "strict" : "lax"),
            path: "/", // important so Next.js can see them
        };
        // 7. Set cookies
        res.cookie("accessToken", accessToken, {
            ...cookieOptions,
            maxAge: parseTime(env_1.env.jwtExpiresIn),
        });
        res.cookie("refreshToken", refreshTokenValue, {
            ...cookieOptions,
            maxAge: env_1.env.cookieMaxAge,
        });
        // 8. Send response
        res.json({
            success: true,
            message: "Login successful",
            data: {
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    status: user.status,
                    primaryTeamId: user.primaryTeamId,
                    primaryZoneId: user.primaryZoneId,
                    teamIds: user.teamIds,
                    zoneIds: user.zoneIds,
                    createdAt: user.createdAt,
                },
                accessToken,
                refreshToken: refreshTokenValue,
            },
        });
    }
    catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}
// export async function login(req: Request, res: Response): Promise<void> {
//   const { email, password } = req.body;
//   const user = await User.findOne({ email }).select('+password');
//   if (!user) {
//     res.status(401).json({ message: 'Invalid credentials' });
//     return;
//   }
//   if (user.status !== 'ACTIVE') {
//     res.status(403).json({ message: 'Account is inactive' });
//     return;
//   }
//   const ok = await bcrypt.compare(password, user.password);
//   if (!ok) {
//     res.status(401).json({ message: 'Invalid credentials' });
//     return;
//   }
//   const payload = { sub: String(user._id), role: user.role };
//   const accessToken = signAccessToken(payload);
//   const refreshTokenValue = signRefreshToken(payload);
//   const expiresAt = new Date(Date.now() + parseTime(env.refreshExpiresIn));
//   // Save refresh token
//   await RefreshToken.create({ userId: user._id, token: refreshTokenValue, expiresAt });
//   // Set cookies
//   res.cookie('accessToken', accessToken, {
//     httpOnly: env.cookieHttpOnly,
//     secure: env.cookieSecure,
//     sameSite: env.cookieSameSite,
//     maxAge: parseTime(env.jwtExpiresIn),
//     path: '/'
//   });
//   res.cookie('refreshToken', refreshTokenValue, {
//     httpOnly: env.cookieHttpOnly,
//     secure: env.cookieSecure,
//     sameSite: env.cookieSameSite,
//     maxAge: env.cookieMaxAge,
//     path: '/'
//   });
//   // Return both tokens in response body for flexibility
//   res.json({ 
//     success: true,
//     message: 'Login successful',
//     data: {
//       user: {
//         _id: user._id,
//         name: user.name,
//         email: user.email,
//         role: user.role,
//         status: user.status,
//         teamId: user.teamId,
//         zoneId: user.zoneId,
//         createdAt: user.createdAt
//       },
//       accessToken,
//       refreshToken: refreshTokenValue
//     }
//   });
// }
async function refresh(req, res) {
    const cookieRefreshToken = req.cookies?.refreshToken;
    if (!cookieRefreshToken) {
        res.status(400).json({ message: "Missing refresh token" });
        return;
    }
    try {
        // 1. Verify refresh token
        const payload = (0, jwt_1.verifyRefreshToken)(cookieRefreshToken);
        if (!payload) {
            res.status(401).json({ message: "Invalid refresh token" });
            return;
        }
        // 2. Validate against DB
        const hashedCookie = crypto_1.default
            .createHash("sha256")
            .update(cookieRefreshToken)
            .digest("hex");
        const record = await RefreshToken_1.default.findOne({
            token: hashedCookie,
            revokedAt: null,
        });
        if (!record) {
            res.status(401).json({ message: "Invalid refresh token" });
            return;
        }
        // 3. Issue new access token
        const accessToken = (0, jwt_1.signAccessToken)({
            sub: payload.sub,
            role: payload.role,
        });
        const isProduction = process.env.NODE_ENV === "production";
        // 4. Cookie options (important!)
        const cookieOptions = {
            httpOnly: true,
            secure: isProduction, // only HTTPS in production
            sameSite: isProduction ? "none" : "lax", // "none" for cross-domain cookies
            path: "/", // allow frontend to access everywhere
            maxAge: parseTime(env_1.env.jwtExpiresIn),
        };
        // 5. Send new accessToken as cookie
        res.cookie("accessToken", accessToken, cookieOptions);
        res.json({
            success: true,
            message: "Token refreshed successfully",
        });
    }
    catch (err) {
        console.error("Refresh error:", err);
        res.status(401).json({ message: "Invalid refresh token" });
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