"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signAccessToken = signAccessToken;
exports.verifyAccessToken = verifyAccessToken;
exports.signRefreshToken = signRefreshToken;
exports.verifyRefreshToken = verifyRefreshToken;
const jsonwebtoken_1 = require("jsonwebtoken");
const env_1 = require("../config/env");
function signAccessToken(payload) {
    const options = { expiresIn: env_1.env.jwtExpiresIn };
    return (0, jsonwebtoken_1.sign)(payload, env_1.env.jwtAccessSecret, options);
}
function verifyAccessToken(token) {
    return (0, jsonwebtoken_1.verify)(token, env_1.env.jwtAccessSecret);
}
function signRefreshToken(payload) {
    const options = { expiresIn: env_1.env.refreshExpiresIn };
    return (0, jsonwebtoken_1.sign)(payload, env_1.env.jwtRefreshSecret, options);
}
function verifyRefreshToken(token) {
    return (0, jsonwebtoken_1.verify)(token, env_1.env.jwtRefreshSecret);
}
//# sourceMappingURL=jwt.js.map