import dotenv from "dotenv";

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "4000", 10),
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/knockwise",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "change_me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "change_me_refresh",
  refreshExpiresIn: process.env.REFRESH_EXPIRES_IN || "30d",
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10),
  corsOrigin: process.env.CORS_ORIGIN || "*",
  corsOrigins: process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:3001",
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW || "900000", 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || "200", 10),
  // Cookie configuration
  cookieSecret: process.env.COOKIE_SECRET || "knockwise_cookie_secret",
  cookieSecure: process.env.NODE_ENV === "production",
  cookieHttpOnly: true,
  cookieSameSite:
    process.env.NODE_ENV === "production"
      ? "strict"
      : ("lax" as "strict" | "lax" | "none"),
  cookieMaxAge: parseInt(process.env.COOKIE_MAX_AGE || "2592000000", 10), // 30 days in milliseconds
  // Email configuration
  sendgridApiKey: process.env.SENDGRID_API_KEY,
  sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL || "noreply@knockwise.com",
  // Frontend URL for email links
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  // Google Maps API
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
};

export default env;
