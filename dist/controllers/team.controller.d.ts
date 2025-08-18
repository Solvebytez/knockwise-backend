import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const createTeam: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getMyTeams: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getTeamById: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateTeam: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteTeam: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getTeamStats: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getTeamPerformance: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=team.controller.d.ts.map