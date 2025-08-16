import mongoose, { Schema, Document, Model } from 'mongoose';

export type TriggerType = 'LEAD_STATUS_CHANGE' | 'TIME_ELAPSED' | 'ACTIVITY_COMPLETED' | 'CUSTOM_CONDITION';
export type ActionType = 'SEND_EMAIL' | 'SEND_SMS' | 'CREATE_TASK' | 'SCHEDULE_APPOINTMENT' | 'UPDATE_STATUS';

export interface ITriggerCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in';
  value: any;
}

export interface IFollowUpAction {
  type: ActionType;
  delayMinutes?: number;
  template?: string;
  recipients?: string[];
  data?: Record<string, any>;
}

export interface IFollowUpRule extends Document {
  name: string;
  description?: string;
  triggerType: TriggerType;
  triggerConditions: ITriggerCondition[];
  actions: IFollowUpAction[];
  isActive: boolean;
  priority: number; // 1-10, higher = more important
  teamId?: mongoose.Types.ObjectId | null;
  createdById: mongoose.Types.ObjectId;
  lastExecuted?: Date;
  executionCount: number;
}

const TriggerConditionSchema = new Schema<ITriggerCondition>(
  {
    field: { type: String, required: true },
    operator: {
      type: String,
      enum: ['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'in'],
      required: true,
    },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

const FollowUpActionSchema = new Schema<IFollowUpAction>(
  {
    type: {
      type: String,
      enum: ['SEND_EMAIL', 'SEND_SMS', 'CREATE_TASK', 'SCHEDULE_APPOINTMENT', 'UPDATE_STATUS'],
      required: true,
    },
    delayMinutes: { type: Number, default: 0 },
    template: { type: String },
    recipients: [{ type: String }],
    data: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const FollowUpRuleSchema = new Schema<IFollowUpRule>(
  {
    name: { type: String, required: true },
    description: { type: String },
    triggerType: {
      type: String,
      enum: ['LEAD_STATUS_CHANGE', 'TIME_ELAPSED', 'ACTIVITY_COMPLETED', 'CUSTOM_CONDITION'],
      required: true,
      index: true,
    },
    triggerConditions: { type: [TriggerConditionSchema], required: true },
    actions: { type: [FollowUpActionSchema], required: true },
    isActive: { type: Boolean, default: true, index: true },
    priority: { type: Number, min: 1, max: 10, default: 5, index: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastExecuted: { type: Date },
    executionCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

FollowUpRuleSchema.index({ isActive: 1, priority: -1 });
FollowUpRuleSchema.index({ teamId: 1, isActive: 1 });

export const FollowUpRule: Model<IFollowUpRule> =
  mongoose.models.FollowUpRule || mongoose.model<IFollowUpRule>('FollowUpRule', FollowUpRuleSchema);

export default FollowUpRule;
