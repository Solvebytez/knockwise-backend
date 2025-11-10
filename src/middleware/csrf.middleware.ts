import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

/**
 * CSRF Protection Middleware
 *
 * This middleware implements the double-submit cookie pattern to prevent
 * Cross-Site Request Forgery (CSRF) attacks.
 *
 * How it works:
 * 1. Server sets a CSRF token in a cookie (not httpOnly so frontend can read)
 * 2. Frontend includes the same token in request headers
 * 3. Server verifies both tokens match
 *
 * This prevents malicious sites from making requests on behalf of users
 * because they can't read the CSRF token from the cookie.
 */

export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.log("🛡️ CSRF middleware invoked");
  console.log("🛡️ process.env.NODE_ENV:", process.env.NODE_ENV);
  console.log("🛡️ env.cookieDomain:", env.cookieDomain);
  // Skip CSRF protection for:
  // - GET requests (read-only operations)
  // - Auth endpoints (login, register, refresh)
  // - Health checks and public endpoints
  const skipPaths = [
    "/auth/login",
    "/api/auth/login",
    "/auth/register",
    "/api/auth/register",
    "/auth/refresh",
    "/api/auth/refresh",
    "/auth/logout",
    "/api/auth/logout",
    "/health",
    "/api/health",
  ];

  const isGetRequest = req.method === "GET";
  const isSkipPath = skipPaths.some((path) => req.path.startsWith(path));

  if (isGetRequest || isSkipPath) {
    console.log(`🛡️ CSRF: Skipping protection for ${req.method} ${req.path}`);
    return next();
  }

  // Extract CSRF token from header and cookie
  const tokenFromHeader = req.headers["x-csrf-token"] as string;
  const tokenFromCookie = req.cookies["csrf-token"];

  console.log(`🛡️ CSRF: Checking token for ${req.method} ${req.path}`);
  console.log(
    `🛡️ CSRF: Header token: ${tokenFromHeader ? "Present" : "Missing"}`
  );
  console.log(
    `🛡️ CSRF: Cookie token: ${tokenFromCookie ? "Present" : "Missing"}`
  );

  // Validate CSRF token
  if (!tokenFromHeader || !tokenFromCookie) {
    console.log(
      `❌ CSRF: Missing token - Header: ${!!tokenFromHeader}, Cookie: ${!!tokenFromCookie}`
    );
    res.status(403).json({
      error: "CSRF token missing",
      message: "This request requires a valid CSRF token",
    });
    return;
  }

  if (tokenFromHeader !== tokenFromCookie) {
    console.log(
      `❌ CSRF: Token mismatch - Header: ${tokenFromHeader.substring(
        0,
        8
      )}..., Cookie: ${tokenFromCookie.substring(0, 8)}...`
    );
    res.status(403).json({
      error: "CSRF token mismatch",
      message: "The CSRF token in the header does not match the cookie",
    });
    return;
  }

  console.log(
    `✅ CSRF: Token validated successfully for ${req.method} ${req.path}`
  );
  next();
}

/**
 * Generate a secure CSRF token
 */
export function generateCSRFToken(): string {
  const crypto = require("crypto");
  return crypto.randomBytes(32).toString("hex");
}
