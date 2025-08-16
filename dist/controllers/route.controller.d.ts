import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare function createRoute(req: AuthRequest, res: Response): Promise<void>;
export declare function optimizeRoute(req: AuthRequest, res: Response): Promise<void>;
export declare function getMyRoutes(req: AuthRequest, res: Response): Promise<void>;
export declare function getRouteById(req: AuthRequest, res: Response): Promise<void>;
export declare function updateRoute(req: AuthRequest, res: Response): Promise<void>;
export declare function deleteRoute(req: AuthRequest, res: Response): Promise<void>;
export declare function listRoutes(req: AuthRequest, res: Response): Promise<void>;
export declare function getTeamRoutes(req: AuthRequest, res: Response): Promise<void>;
export declare function updateRouteStatus(req: AuthRequest, res: Response): Promise<void>;
export declare function duplicateRoute(req: AuthRequest, res: Response): Promise<void>;
export declare function shareRoute(req: AuthRequest, res: Response): Promise<void>;
export declare function updateStopStatus(req: AuthRequest, res: Response): Promise<void>;
export declare function getRouteAnalytics(req: AuthRequest, res: Response): Promise<void>;
export declare function exportRoute(req: AuthRequest, res: Response): Promise<void>;
export declare function createTemplate(req: AuthRequest, res: Response): Promise<void>;
export declare function getTemplates(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=route.controller.d.ts.map