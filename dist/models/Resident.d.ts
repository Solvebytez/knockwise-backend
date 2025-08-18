import mongoose, { Document, Model } from 'mongoose';
export type ResidentStatus = 'not-visited' | 'interested' | 'visited' | 'callback' | 'appointment' | 'follow-up' | 'not-interested';
export interface IResident extends Document {
    zoneId: mongoose.Types.ObjectId;
    address: string;
    coordinates: [number, number];
    houseNumber?: number;
    status: ResidentStatus;
    notes?: string;
    phone?: string;
    email?: string;
    lastVisited?: Date;
    assignedAgentId?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Resident: Model<IResident>;
export default Resident;
//# sourceMappingURL=Resident.d.ts.map