import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare function createActivity(req: AuthRequest, res: Response): Promise<void>;
export declare function listMyActivities(req: AuthRequest, res: Response): Promise<void>;
export declare function listAllActivities(req: AuthRequest, res: Response): Promise<void>;
export declare function getActivityById(req: AuthRequest, res: Response): Promise<void>;
export declare function updateActivity(req: AuthRequest, res: Response): Promise<void>;
export declare function deleteActivity(req: AuthRequest, res: Response): Promise<void>;
export declare function getActivityStatistics(req: AuthRequest, res: Response): Promise<void>;
export declare function getAgentPerformance(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=activity.controller.d.ts.map