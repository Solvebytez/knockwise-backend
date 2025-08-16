import mongoose, { Document, Model } from 'mongoose';
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
    priority: number;
    teamId?: mongoose.Types.ObjectId | null;
    createdById: mongoose.Types.ObjectId;
    lastExecuted?: Date;
    executionCount: number;
}
export declare const FollowUpRule: Model<IFollowUpRule>;
export default FollowUpRule;
//# sourceMappingURL=FollowUpRule.d.ts.map