import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare function createAppointment(req: AuthRequest, res: Response): Promise<void>;
export declare function getAppointmentById(req: AuthRequest, res: Response): Promise<void>;
export declare function updateAppointment(req: AuthRequest, res: Response): Promise<void>;
export declare function deleteAppointment(req: AuthRequest, res: Response): Promise<void>;
export declare function listAppointments(req: AuthRequest, res: Response): Promise<void>;
export declare function getMyAppointments(req: AuthRequest, res: Response): Promise<void>;
export declare function getTeamAppointments(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=appointment.controller.d.ts.map