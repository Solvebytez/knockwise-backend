import mongoose, { Schema, Document, Model } from 'mongoose';

export type VisitResponse =
  | 'NO_ANSWER'
  | 'NOT_INTERESTED'
  | 'CALL_BACK'
  | 'APPOINTMENT_SET'
  | 'FOLLOW_UP'
  | 'LEAD_CREATED';

export type ActivityType = 'VISIT' | 'ZONE_OPERATION' | 'PROPERTY_OPERATION' | 'ROUTE_OPERATION';
export type ZoneOperationType = 'CREATE' | 'UPDATE' | 'DELETE';
export type PropertyOperationType = 'CREATE' | 'UPDATE' | 'DELETE';
export type RouteOperationType = 'CREATE' | 'UPDATE' | 'DELETE';

export interface IActivity extends Document {
  agentId: mongoose.Types.ObjectId;
  activityType: ActivityType;
  propertyId?: mongoose.Types.ObjectId | null; // Optional for zone operations
  zoneId?: mongoose.Types.ObjectId | null;
  startedAt?: Date; // Optional for zone operations
  endedAt?: Date; // Optional for zone operations
  durationSeconds?: number; // Optional for zone operations
  response?: VisitResponse; // Optional for zone/property operations
  operationType?: ZoneOperationType | PropertyOperationType | RouteOperationType; // For zone/property/route operations
  residentId?: mongoose.Types.ObjectId | null; // For property/resident operations
  notes?: string;
}

const ActivitySchema = new Schema<IActivity>(
  {
    agentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    activityType: {
      type: String,
      enum: ['VISIT', 'ZONE_OPERATION', 'PROPERTY_OPERATION', 'ROUTE_OPERATION'],
      required: true,
      default: 'VISIT',
      index: true,
    },
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', default: null, index: true },
    zoneId: { type: Schema.Types.ObjectId, ref: 'Zone', default: null, index: true },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: null },
    response: {
      type: String,
      enum: ['NO_ANSWER', 'NOT_INTERESTED', 'CALL_BACK', 'APPOINTMENT_SET', 'FOLLOW_UP', 'LEAD_CREATED'],
      default: null,
      index: true,
    },
    operationType: {
      type: String,
      enum: ['CREATE', 'UPDATE', 'DELETE'],
      default: null,
      index: true,
    },
    residentId: { type: Schema.Types.ObjectId, ref: 'Resident', default: null, index: true },
    notes: { type: String },
  },
  { timestamps: true }
);

// Validation: For VISIT activities, require propertyId, startedAt, endedAt, durationSeconds, response
ActivitySchema.pre('validate', function(next) {
  if (this.activityType === 'VISIT') {
    if (!this.propertyId) {
      return next(new Error('propertyId is required for VISIT activities'));
    }
    if (!this.startedAt || !this.endedAt) {
      return next(new Error('startedAt and endedAt are required for VISIT activities'));
    }
    if (this.durationSeconds === null || this.durationSeconds === undefined) {
      return next(new Error('durationSeconds is required for VISIT activities'));
    }
    if (!this.response) {
      return next(new Error('response is required for VISIT activities'));
    }
  }
  
  if (this.activityType === 'ZONE_OPERATION') {
    if (!this.zoneId) {
      return next(new Error('zoneId is required for ZONE_OPERATION activities'));
    }
    if (!this.operationType) {
      return next(new Error('operationType is required for ZONE_OPERATION activities'));
    }
  }
  
  if (this.activityType === 'PROPERTY_OPERATION') {
    if (!this.propertyId && !this.residentId) {
      return next(new Error('propertyId or residentId is required for PROPERTY_OPERATION activities'));
    }
    if (!this.operationType) {
      return next(new Error('operationType is required for PROPERTY_OPERATION activities'));
    }
  }
  
  if (this.activityType === 'ROUTE_OPERATION') {
    if (!this.operationType) {
      return next(new Error('operationType is required for ROUTE_OPERATION activities'));
    }
  }
  
  next();
});

ActivitySchema.index({ agentId: 1, startedAt: -1 });

export const Activity: Model<IActivity> =
  mongoose.models.Activity || mongoose.model<IActivity>('Activity', ActivitySchema);

export default Activity;


