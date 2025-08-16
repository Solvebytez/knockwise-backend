import mongoose, { Schema, Document, Model } from 'mongoose';

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'FOLLOW_UP'
  | 'APPOINTMENT_SET'
  | 'VISITED'
  | 'NOT_INTERESTED'
  | 'CONVERTED'
  | 'LOST';

export type LeadSource = 'DOOR_KNOCK' | 'DATAGRID' | 'IMPORT' | 'REFERRAL' | 'OTHER';

export interface ILeadHistoryEntry {
  at: Date;
  by: mongoose.Types.ObjectId; // user who made the change
  action: string; // e.g., status change, note added, assigned
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
  priority?: number; // 1-5
  tags?: string[];
  assignedAgentId?: mongoose.Types.ObjectId | null;
  teamId?: mongoose.Types.ObjectId | null;
  zoneId?: mongoose.Types.ObjectId | null;
  history: ILeadHistoryEntry[];
  lastActivityAt?: Date;
}

const LeadHistorySchema = new Schema<ILeadHistoryEntry>(
  {
    at: { type: Date, required: true },
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    status: {
      type: String,
      enum: ['NEW', 'CONTACTED', 'FOLLOW_UP', 'APPOINTMENT_SET', 'VISITED', 'NOT_INTERESTED', 'CONVERTED', 'LOST'],
    },
    notes: { type: String },
  },
  { _id: false }
);

const LeadSchema = new Schema<ILead>(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    ownerName: { type: String },
    phone: { type: String },
    email: { type: String, lowercase: true },
    notes: { type: String },
    status: {
      type: String,
      enum: ['NEW', 'CONTACTED', 'FOLLOW_UP', 'APPOINTMENT_SET', 'VISITED', 'NOT_INTERESTED', 'CONVERTED', 'LOST'],
      default: 'NEW',
      index: true,
    },
    source: { type: String, enum: ['DOOR_KNOCK', 'DATAGRID', 'IMPORT', 'REFERRAL', 'OTHER'], default: 'DOOR_KNOCK' },
    priority: { type: Number, min: 1, max: 5, default: 3 },
    tags: [{ type: String, index: true }],
    assignedAgentId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
    zoneId: { type: Schema.Types.ObjectId, ref: 'Zone', default: null, index: true },
    history: { type: [LeadHistorySchema], default: [] },
    lastActivityAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

LeadSchema.index({ assignedAgentId: 1, status: 1 });
LeadSchema.index({ zoneId: 1, status: 1, createdAt: -1 });

export const Lead: Model<ILead> = mongoose.models.Lead || mongoose.model<ILead>('Lead', LeadSchema);

export default Lead;


