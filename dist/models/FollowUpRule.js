"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FollowUpRule = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const TriggerConditionSchema = new mongoose_1.Schema({
    field: { type: String, required: true },
    operator: {
        type: String,
        enum: ['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'in'],
        required: true,
    },
    value: { type: mongoose_1.Schema.Types.Mixed, required: true },
}, { _id: false });
const FollowUpActionSchema = new mongoose_1.Schema({
    type: {
        type: String,
        enum: ['SEND_EMAIL', 'SEND_SMS', 'CREATE_TASK', 'SCHEDULE_APPOINTMENT', 'UPDATE_STATUS'],
        required: true,
    },
    delayMinutes: { type: Number, default: 0 },
    template: { type: String },
    recipients: [{ type: String }],
    data: { type: mongoose_1.Schema.Types.Mixed },
}, { _id: false });
const FollowUpRuleSchema = new mongoose_1.Schema({
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
    teamId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
    createdById: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    lastExecuted: { type: Date },
    executionCount: { type: Number, default: 0 },
}, { timestamps: true });
FollowUpRuleSchema.index({ isActive: 1, priority: -1 });
FollowUpRuleSchema.index({ teamId: 1, isActive: 1 });
exports.FollowUpRule = mongoose_1.default.models.FollowUpRule || mongoose_1.default.model('FollowUpRule', FollowUpRuleSchema);
exports.default = exports.FollowUpRule;
//# sourceMappingURL=FollowUpRule.js.map