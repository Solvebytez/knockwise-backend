import { Request, Response, NextFunction } from 'express';
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
export declare const requireAuth: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const requireRoles: (...roles: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=auth.d.ts.map