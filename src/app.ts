import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
import { connectDatabase } from "./config/database";
import { env } from "./config/env";
import { notFound, errorHandler } from "./middleware/errors";
import { AuthRequest } from "./middleware/auth";
import { csrfProtection } from "./middleware/csrf.middleware";

// Import routes
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import leadRoutes from "./routes/lead.routes";
import appointmentRoutes from "./routes/appointment.routes";
import assignmentRoutes from "./routes/assignment.routes";
import propertyRoutes from "./routes/property.routes";
import residentRoutes from "./routes/resident.routes";
import routeRoutes from "./routes/route.routes";
import zoneRoutes from "./routes/zone.routes";
import activityRoutes from "./routes/activity.routes";
import teamRoutes from "./routes/team.routes";
import addressValidationRoutes from "./routes/address-validation.routes";
// Location hierarchy routes
import areaRoutes from "./routes/area.routes";
import municipalityRoutes from "./routes/municipality.routes";
import communityRoutes from "./routes/community.routes";
// Agent zone routes
import agentZoneRoutes from "./routes/agentZone.routes";

const app = express();

// Trust proxy for correct IP handling (Render, Vercel, etc.)
app.set("trust proxy", 1);

// Flexible Rate Limiting Configuration
const createRateLimiter = (
  windowMs: number,
  max: number,
  skipSuccessfulRequests = false
) => {
  return rateLimit({
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

const allowedOrigins = env.corsOrigins
  .split(",")
  .map((origin) => origin.trim());

const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      console.log("🔗 CORS: Allowing request with no origin (mobile app)");
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      console.log(`🔗 CORS: Allowing origin: ${origin}`);
      return callback(null, true);
    }

    // Reject unknown origins
    console.log(`❌ CORS: Rejecting origin: ${origin}`);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

console.log("🔗 CORS Allowed Origins:", allowedOrigins);

// Middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(morgan("combined"));

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

// CSRF Protection for all API routes (except auth)
app.use("/api", csrfProtection);

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/residents", residentRoutes);
app.use("/api/routes", routeRoutes);
app.use("/api/zones", zoneRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/address-validation", addressValidationRoutes);
// Location hierarchy routes
app.use("/api/areas", areaRoutes);
app.use("/api/municipalities", municipalityRoutes);
app.use("/api/communities", communityRoutes);
// Agent zone routes
app.use("/api/agent-zones", agentZoneRoutes);

// Swagger Documentation
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/openapi.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

export const createApp = () => {
  return app;
};

export default app;
