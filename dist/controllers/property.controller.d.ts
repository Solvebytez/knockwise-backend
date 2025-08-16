import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare function searchProperties(req: AuthRequest, res: Response): Promise<void>;
export declare function getPropertyById(req: AuthRequest, res: Response): Promise<void>;
export declare function bulkImportProperties(req: AuthRequest, res: Response): Promise<void>;
export declare function updatePropertyScores(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=property.controller.d.ts.map