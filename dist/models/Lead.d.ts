import mongoose, { Document, Model } from 'mongoose';
export type LeadStatus = 'NEW' | 'CONTACTED' | 'FOLLOW_UP' | 'APPOINTMENT_SET' | 'VISITED' | 'NOT_INTERESTED' | 'CONVERTED' | 'LOST';
export type LeadSource = 'DOOR_KNOCK' | 'DATAGRID' | 'IMPORT' | 'REFERRAL' | 'OTHER';
export interface ILeadHistoryEntry {
    at: Date;
    by: mongoose.Types.ObjectId;
    action: string;
    status?: LeadStatus;
    notes?: string;
}
export interface ILead extends Document {
    propertyId: mongoose.Types.ObjectId;
    ownerName?: string;
    phone?: string;
    email?: string;
    notes?: string;
    status: LeadStatus;
    source: LeadSource;
    priority?: number;
    tags?: string[];
    assignedAgentId?: mongoose.Types.ObjectId | null;
    teamId?: mongoose.Types.ObjectId | null;
    zoneId?: mongoose.Types.ObjectId | null;
    history: ILeadHistoryEntry[];
    lastActivityAt?: Date;
}
export declare const Lead: Model<ILead>;
export default Lead;
//# sourceMappingURL=Lead.d.ts.map