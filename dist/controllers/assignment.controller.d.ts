import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare function createAssignment(req: AuthRequest, res: Response): Promise<void>;
export declare function getAssignmentById(req: AuthRequest, res: Response): Promise<void>;
export declare function updateAssignment(req: AuthRequest, res: Response): Promise<void>;
export declare function deleteAssignment(req: AuthRequest, res: Response): Promise<void>;
export declare function listAssignments(_req: Request, res: Response): Promise<void>;
export declare function getMyAssignments(req: AuthRequest, res: Response): Promise<void>;
export declare function getTeamAssignments(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=assignment.controller.d.ts.map