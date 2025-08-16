"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.env = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '4000', 10),
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/knockwise',
    jwtSecret: process.env.JWT_SECRET || 'change_me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'change_me_refresh',
    refreshExpiresIn: process.env.REFRESH_EXPIRES_IN || '30d',
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
    corsOrigin: process.env.CORS_ORIGIN || '*',
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '200', 10),
    // Cookie configuration
    cookieSecret: process.env.COOKIE_SECRET || 'knockwise_cookie_secret',
    cookieSecure: process.env.NODE_ENV === 'production',
    cookieHttpOnly: true,
    cookieSameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    cookieMaxAge: parseInt(process.env.COOKIE_MAX_AGE || '2592000000', 10), // 30 days in milliseconds
};
exports.default = exports.env;
//# sourceMappingURL=env.js.map