import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User } from '../models/User';

export interface AuthRequest extends Request {
  user?: {
    sub: string;
    email: string;
    role: 'SUPERADMIN' | 'SUBADMIN' | 'AGENT';
    primaryTeamId?: string;
    primaryZoneId?: string;
    teamIds?: string[] | undefined;
    zoneIds?: string[] | undefined;
    id?: string;
  };
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;
    
    // Check for bearer token first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    
    // If no bearer token, check for cookie
    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    console.log('token', token,env.jwtAccessSecret)
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required (Bearer token or cookie)'
      });
    }
    
    const decoded = jwt.verify(token, env.jwtAccessSecret) as any;


    
    // Get user from database to ensure they still exist and are active
    const user = await User.findById(decoded.sub).select('-password');
    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    req.user = {
      sub: (user as any)._id.toString(),
      email: user.email,
      role: user.role,
      primaryTeamId: user.primaryTeamId ? (user.primaryTeamId as any).toString() : undefined,
      primaryZoneId: user.primaryZoneId ? (user.primaryZoneId as any).toString() : undefined,
      teamIds: user.teamIds && user.teamIds.length > 0 ? user.teamIds.map((id: any) => id.toString()) : undefined,
      zoneIds: user.zoneIds && user.zoneIds.length > 0 ? user.zoneIds.map((id: any) => id.toString()) : undefined,
      id: (user as any)._id.toString()
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

export const requireRoles = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};


