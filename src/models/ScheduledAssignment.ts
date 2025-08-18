import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IScheduledAssignment extends Document {
  agentId?: mongoose.Types.ObjectId;
  teamId?: mongoose.Types.ObjectId;
  zoneId: mongoose.Types.ObjectId;
  scheduledDate: Date;
  effectiveFrom: Date;
  status: 'PENDING' | 'ACTIVATED' | 'CANCELLED';
  assignedBy: mongoose.Types.ObjectId;
  notificationSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ScheduledAssignmentSchema = new Schema<IScheduledAssignment>(
  {
    agentId: { type: Schema.Types.ObjectId, ref: 'User', required: false, index: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: false, index: true },
    zoneId: { type: Schema.Types.ObjectId, ref: 'Zone', required: true, index: true },
    scheduledDate: { type: Date, required: true, index: true },
    effectiveFrom: { type: Date, required: true, index: true },
    status: { 
      type: String, 
      enum: ['PENDING', 'ACTIVATED', 'CANCELLED'], 
      default: 'PENDING', 
      index: true 
    },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notificationSent: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Add validation to ensure either agentId or teamId is provided
ScheduledAssignmentSchema.pre('validate', function(next) {
  if (!this.agentId && !this.teamId) {
    next(new Error('Either agentId or teamId must be provided'));
  } else {
    next();
  }
});

ScheduledAssignmentSchema.index({ scheduledDate: 1, status: 1 });
ScheduledAssignmentSchema.index({ notificationSent: 1, status: 1 });

export const ScheduledAssignment: Model<IScheduledAssignment> =
  mongoose.models.ScheduledAssignment ||
  mongoose.model<IScheduledAssignment>('ScheduledAssignment', ScheduledAssignmentSchema);

export default ScheduledAssignment;
