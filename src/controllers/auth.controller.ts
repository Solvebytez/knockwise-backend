import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User";
import RefreshToken from "../models/RefreshToken";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import { env } from "../config/env";
import { generateCSRFToken } from "../middleware/csrf.middleware";
import crypto from "crypto";

function parseTime(text: string): number {
  const match = /^(\d+)([mhd])$/.exec(text);
  if (!match) return 0;
  const num = Number(match[1]);
  const unit = match[2];
  if (unit === "m") return num * 60 * 1000;
  if (unit === "h") return num * 60 * 60 * 1000;
  if (unit === "d") return num * 24 * 60 * 60 * 1000;
  return 0;
}

export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password, role } = req.body;
  const exists = await User.findOne({ email });
  if (exists) {
    res.status(409).json({ message: "Email already exists" });
    return;
  }
  const user = await User.create({ name, email, password, role });

  // Generate tokens
  const payload = { sub: String(user._id), role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshTokenValue = signRefreshToken(payload);
  const expiresAt = new Date(Date.now() + parseTime(env.refreshExpiresIn));

  // Save refresh token
  await RefreshToken.create({
    userId: user._id,
    token: refreshTokenValue,
    expiresAt,
  });

  // Set cookies
  res.cookie("accessToken", accessToken, {
    httpOnly: env.cookieHttpOnly,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    maxAge: parseTime(env.jwtExpiresIn),
    path: "/",
  });

  res.cookie("refreshToken", refreshTokenValue, {
    httpOnly: env.cookieHttpOnly,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    maxAge: env.cookieMaxAge,
    path: "/",
  });

  // Return both tokens in response body for flexibility
  res.status(201).json({
    success: true,
    message: "User registered successfully",
    data: {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken: refreshTokenValue,
    },
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    // 1. Find user
    const user = await User.findOne({ email }).select("+password");
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
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    // 4. Generate tokens
    const payload = { sub: String(user._id), role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshTokenValue = signRefreshToken(payload);
    const expiresAt = new Date(Date.now() + parseTime(env.refreshExpiresIn));

    const hashedToken = crypto
      .createHash("sha256")
      .update(refreshTokenValue)
      .digest("hex");

    // 5. Save refresh token in DB
    await RefreshToken.create({
      userId: user._id,
      token: hashedToken,
      expiresAt,
    });

    // 6. Cookie options
    const isProduction = process.env.NODE_ENV === "production";
    console.log("🌍 NODE_ENV:", process.env.NODE_ENV);
    console.log("🌍 isProduction:", isProduction);

    const cookieOptions = {
      httpOnly: true,
      secure: isProduction, // ✅ must be true for HTTPS
      sameSite: (isProduction ? "none" : "lax") as "lax" | "none", // ✅ allow cross-site cookies on Vercel
      path: "/",
    };

    // 7. Set cookies
    console.log("🍪 Setting cookies with options:", cookieOptions);
    console.log("🍪 Request origin:", req.headers.origin);
    console.log("🍪 Request host:", req.headers.host);
    console.log("🍪 Request cookies:", req.headers.cookie);

    res.cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: parseTime(env.jwtExpiresIn),
    });

    res.cookie("refreshToken", refreshTokenValue, {
      ...cookieOptions,
      maxAge: env.cookieMaxAge,
    });

    // Generate and set CSRF token
    const csrfToken = generateCSRFToken();
    res.cookie("csrf-token", csrfToken, {
      httpOnly: false, // Frontend needs to read this
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    console.log("🍪 Cookies set successfully");
    console.log("🛡️ CSRF token generated and set");

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
  } catch (error) {
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

export async function refresh(req: Request, res: Response): Promise<void> {
  // Support both cookie (web) and body (mobile) for refreshToken
  const bodyRefreshToken = req.body?.refreshToken;
  const cookieRefreshToken = req.cookies?.refreshToken;
  const refreshToken = bodyRefreshToken || cookieRefreshToken;

  if (!refreshToken) {
    res.status(400).json({ message: "Missing refresh token" });
    return;
  }

  try {
    // 1. Verify refresh token
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      res.status(401).json({ message: "Invalid refresh token" });
      return;
    }

    // 2. Validate against DB
    const hashedToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    const record = await RefreshToken.findOne({
      token: hashedToken,
      revokedAt: null,
    });

    if (!record) {
      res.status(401).json({ message: "Invalid refresh token" });
      return;
    }

    // 3. Get user info for role
    const user = await User.findById(payload.sub).select(
      "role name email status"
    );
    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }

    // 4. Issue new access token
    const accessToken = signAccessToken({
      sub: payload.sub,
      role: user.role,
    });

    // 5. Keep existing refresh token (no rotation for now)
    // If you want token rotation in the future, generate new refresh token here:
    // const newRefreshToken = signRefreshToken({ sub: payload.sub, role: user.role });
    // Then update DB and return newRefreshToken instead of refreshToken

    const isProduction = process.env.NODE_ENV === "production";

    // 6. Cookie options (important!)
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction, // only HTTPS in production
      sameSite: isProduction ? "none" : "lax", // "none" for cross-domain cookies
      path: "/", // allow frontend to access everywhere
      maxAge: parseTime(env.jwtExpiresIn),
    } as const;

    // 7. Send new accessToken as cookie (for web)
    res.cookie("accessToken", accessToken, cookieOptions);

    // 8. Set refreshToken cookie (for web) - keep existing or use new if rotating
    res.cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: env.cookieMaxAge,
    });

    // Generate and set new CSRF token
    const csrfToken = generateCSRFToken();
    res.cookie("csrf-token", csrfToken, {
      httpOnly: false, // Frontend needs to read this
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    console.log("🛡️ CSRF token refreshed");
    console.log("🔄 Token refresh - Source:", bodyRefreshToken ? "body (mobile)" : "cookie (web)");

    // 9. Return tokens in response body (for mobile apps) + cookies (for web)
    res.json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        },
        accessToken, // Return in body for mobile
        refreshToken: refreshToken, // Return existing refreshToken (or newRefreshToken if rotating)
      },
    });
  } catch (err) {
    console.error("Refresh error:", err);
    res.status(401).json({ message: "Invalid refresh token" });
  }
}
export async function logout(req: Request, res: Response): Promise<void> {
  console.log("🚪 Backend logout endpoint called");
  console.log("🍪 Request cookies:", req.cookies);
  console.log("📝 Request body:", req.body);

  try {
    // Get refresh token from cookies or body
    const bodyRefreshToken = req.body?.refreshToken;
    const cookieRefreshToken = req.cookies?.refreshToken;
    const refreshToken = bodyRefreshToken || cookieRefreshToken;

    console.log("🔍 Refresh token found:", !!refreshToken);

    if (refreshToken) {
      // Hash the refresh token to match what's stored in DB
      const hashedToken = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");

      console.log("🔄 Revoking refresh token in database...");
      // Revoke the refresh token
      await RefreshToken.findOneAndUpdate(
        { token: hashedToken },
        { revokedAt: new Date() }
      );
      console.log("✅ Refresh token revoked successfully");
    }

    // Clear cookies with proper options to ensure they're removed
    const isProduction = process.env.NODE_ENV === "production";
    console.log("🌍 NODE_ENV:", process.env.NODE_ENV);
    console.log("🌍 isProduction:", isProduction);

    console.log("🍪 Clearing accessToken cookie...");
    res.clearCookie("accessToken", {
      path: "/",
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
    });

    console.log("🍪 Clearing refreshToken cookie...");
    res.clearCookie("refreshToken", {
      path: "/",
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
    });

    console.log("🍪 Clearing csrf-token cookie...");
    res.clearCookie("csrf-token", {
      path: "/",
      httpOnly: false,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
    });

    console.log("✅ All cookies cleared, sending response");
    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    // Even if there's an error, clear cookies
    const isProduction = process.env.NODE_ENV === "production";

    res.clearCookie("accessToken", {
      path: "/",
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
    });

    res.clearCookie("refreshToken", {
      path: "/",
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
    });

    res.clearCookie("csrf-token", {
      path: "/",
      httpOnly: false,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
    });

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  }
}

export async function logoutAll(req: Request, res: Response): Promise<void> {
  try {
    // Get user ID from request (requires authentication)
    const userId = (req as any).user?.sub;

    if (userId) {
      // Revoke all refresh tokens for this user
      await RefreshToken.updateMany(
        { userId, revokedAt: null },
        { revokedAt: new Date() }
      );
    }

    // Clear cookies
    res.clearCookie("accessToken", { path: "/" });
    res.clearCookie("refreshToken", { path: "/" });

    res.json({
      success: true,
      message: "Logged out from all devices successfully",
    });
  } catch (error) {
    console.error("Logout all error:", error);
    // Even if there's an error, clear cookies
    res.clearCookie("accessToken", { path: "/" });
    res.clearCookie("refreshToken", { path: "/" });

    res.json({
      success: true,
      message: "Logged out from all devices successfully",
    });
  }
}
