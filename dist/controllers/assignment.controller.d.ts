import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
export declare const syncAgentZoneIds: (agentId: string) => Promise<void>;
export declare const updateTeamStatus: (teamId: string) => Promise<void>;
export declare const updateTeamAssignmentStatus: (teamId: string) => Promise<void>;
export declare const updateUserAssignmentStatus: (userId: string) => Promise<void>;
export declare function createAssignment(req: AuthRequest, res: Response): Promise<void>;
export declare function getAssignmentById(req: AuthRequest, res: Response): Promise<void>;
export declare function updateAssignment(req: AuthRequest, res: Response): Promise<void>;
export declare function deleteAssignment(req: AuthRequest, res: Response): Promise<void>;
export declare function listAssignments(_req: Request, res: Response): Promise<void>;
export declare function getMyAssignments(req: AuthRequest, res: Response): Promise<void>;
export declare function getTeamAssignments(req: AuthRequest, res: Response): Promise<void>;
export declare function getAssignmentStatus(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=assignment.controller.d.ts.map