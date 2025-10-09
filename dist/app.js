"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_1 = require("./config/swagger");
const errors_1 = require("./middleware/errors");
// Import routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const lead_routes_1 = __importDefault(require("./routes/lead.routes"));
const appointment_routes_1 = __importDefault(require("./routes/appointment.routes"));
const assignment_routes_1 = __importDefault(require("./routes/assignment.routes"));
const property_routes_1 = __importDefault(require("./routes/property.routes"));
const resident_routes_1 = __importDefault(require("./routes/resident.routes"));
const route_routes_1 = __importDefault(require("./routes/route.routes"));
const zone_routes_1 = __importDefault(require("./routes/zone.routes"));
const activity_routes_1 = __importDefault(require("./routes/activity.routes"));
const team_routes_1 = __importDefault(require("./routes/team.routes"));
const address_validation_routes_1 = __importDefault(require("./routes/address-validation.routes"));
const app = (0, express_1.default)();
// Flexible Rate Limiting Configuration
const createRateLimiter = (windowMs, max, skipSuccessfulRequests = false) => {
    return (0, express_rate_limit_1.default)({
        windowMs,
        max,
        skipSuccessfulRequests,
        message: {
            success: false,
            message: "Too many requests, please try again later.",
        },
        standardHeaders: true,
        legacyHeaders: false,
        // Skip rate limiting for development environment
        skip: (req) => process.env.NODE_ENV === "development",
        // Remove custom keyGenerator to use built-in IP handling which properly supports IPv6
    });
};
// Different rate limiters for different scenarios
const strictLimiter = createRateLimiter(15 * 60 * 1000, 50); // 50 requests per 15 minutes
const moderateLimiter = createRateLimiter(15 * 60 * 1000, 200); // 200 requests per 15 minutes
const lenientLimiter = createRateLimiter(15 * 60 * 1000, 500); // 500 requests per 15 minutes
const corsOptions = {
    origin: ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)(corsOptions));
app.use((0, compression_1.default)());
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)(process.env.COOKIE_SECRET));
app.use((0, morgan_1.default)("combined"));
// Apply rate limiting selectively
// Strict limits for auth routes
app.use("/api/auth", strictLimiter);
// Moderate limits for data-heavy routes
app.use("/api/users", moderateLimiter);
app.use("/api/teams", moderateLimiter);
app.use("/api/zones", moderateLimiter);
app.use("/api/assignments", moderateLimiter);
// Lenient limits for other routes
app.use("/api/leads", lenientLimiter);
app.use("/api/appointments", lenientLimiter);
app.use("/api/properties", lenientLimiter);
app.use("/api/residents", lenientLimiter);
app.use("/api/routes", lenientLimiter);
app.use("/api/activities", lenientLimiter);
app.use("/api/address-validation", lenientLimiter);
// Health check endpoint
app.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "KnockWise API is running",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
// API Routes
app.use("/api/auth", auth_routes_1.default);
app.use("/api/users", user_routes_1.default);
app.use("/api/leads", lead_routes_1.default);
app.use("/api/appointments", appointment_routes_1.default);
app.use("/api/assignments", assignment_routes_1.default);
app.use("/api/properties", property_routes_1.default);
app.use("/api/residents", resident_routes_1.default);
app.use("/api/routes", route_routes_1.default);
app.use("/api/zones", zone_routes_1.default);
app.use("/api/activities", activity_routes_1.default);
app.use("/api/teams", team_routes_1.default);
app.use("/api/address-validation", address_validation_routes_1.default);
// Swagger Documentation
app.use("/docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec));
app.get("/openapi.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swagger_1.swaggerSpec);
});
// Error handling middleware
app.use(errors_1.notFound);
app.use(errors_1.errorHandler);
const createApp = () => {
    return app;
};
exports.createApp = createApp;
exports.default = app;
//# sourceMappingURL=app.js.map