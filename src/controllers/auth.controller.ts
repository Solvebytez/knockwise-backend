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
      secure: false, // Set to false for Next.js proxy
      sameSite: "lax" as "lax", // Use lax for same-origin via proxy
      path: "/", // important so Next.js can see them
      domain: undefined, // Don't set domain for Next.js proxy
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

    console.log("🍪 Cookies set successfully");

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
  const cookieRefreshToken = req.cookies?.refreshToken;

  if (!cookieRefreshToken) {
    res.status(400).json({ message: "Missing refresh token" });
    return;
  }

  try {
    // 1. Verify refresh token
    const payload = verifyRefreshToken(cookieRefreshToken);
    if (!payload) {
      res.status(401).json({ message: "Invalid refresh token" });
      return;
    }

    // 2. Validate against DB
    const hashedCookie = crypto
      .createHash("sha256")
      .update(cookieRefreshToken)
      .digest("hex");

    const record = await RefreshToken.findOne({
      token: hashedCookie,
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

    const isProduction = process.env.NODE_ENV === "production";

    // 5. Cookie options (important!)
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction, // only HTTPS in production
      sameSite: isProduction ? "none" : "lax", // "none" for cross-domain cookies
      path: "/", // allow frontend to access everywhere
      maxAge: parseTime(env.jwtExpiresIn),
    } as const;

    // 6. Send new accessToken as cookie
    res.cookie("accessToken", accessToken, cookieOptions);

    // 7. Return user role and basic info
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
      },
    });
  } catch (err) {
    console.error("Refresh error:", err);
    res.status(401).json({ message: "Invalid refresh token" });
  }
}
export async function logout(req: Request, res: Response): Promise<void> {
  try {
    // Get refresh token from cookies or body
    const { refreshToken: bodyRefreshToken } = req.body as {
      refreshToken?: string;
    };
    const cookieRefreshToken = req.cookies?.refreshToken;
    const refreshToken = bodyRefreshToken || cookieRefreshToken;

    if (refreshToken) {
      // Hash the refresh token to match what's stored in DB
      const hashedToken = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");

      // Revoke the refresh token
      await RefreshToken.findOneAndUpdate(
        { token: hashedToken },
        { revokedAt: new Date() }
      );
    }

    // Clear cookies with proper options to ensure they're removed
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
