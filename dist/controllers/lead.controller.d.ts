import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare function createLead(req: AuthRequest, res: Response): Promise<void>;
export declare function listLeads(_req: Request, res: Response): Promise<void>;
export declare function listMyLeads(req: AuthRequest, res: Response): Promise<void>;
export declare function updateLeadStatus(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=lead.controller.d.ts.map