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
const route_routes_1 = __importDefault(require("./routes/route.routes"));
const zone_routes_1 = __importDefault(require("./routes/zone.routes"));
const activity_routes_1 = __importDefault(require("./routes/activity.routes"));
const team_routes_1 = __importDefault(require("./routes/team.routes"));
const app = (0, express_1.default)();
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
    max: Number(process.env.RATE_LIMIT_MAX) || 100, // limit each IP to 100 requests per windowMs
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    }
});
const corsOptions = {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)(corsOptions));
app.use((0, compression_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)(process.env.COOKIE_SECRET));
app.use((0, morgan_1.default)('combined'));
app.use('/api', limiter);
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'KnockWise API is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
// API Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/users', user_routes_1.default);
app.use('/api/leads', lead_routes_1.default);
app.use('/api/appointments', appointment_routes_1.default);
app.use('/api/assignments', assignment_routes_1.default);
app.use('/api/properties', property_routes_1.default);
app.use('/api/routes', route_routes_1.default);
app.use('/api/zones', zone_routes_1.default);
app.use('/api/activities', activity_routes_1.default);
app.use('/api/teams', team_routes_1.default);
// Swagger Documentation
app.use('/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec));
app.get('/openapi.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
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