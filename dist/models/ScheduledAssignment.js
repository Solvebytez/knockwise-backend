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
exports.ScheduledAssignment = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ScheduledAssignmentSchema = new mongoose_1.Schema({
    agentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: false, index: true },
    teamId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Team', required: false, index: true },
    zoneId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Zone', required: true, index: true },
    scheduledDate: { type: Date, required: true, index: true },
    effectiveFrom: { type: Date, required: true, index: true },
    status: {
        type: String,
        enum: ['PENDING', 'ACTIVATED', 'CANCELLED', 'COMPLETED', 'SCHEDULED'],
        default: 'PENDING',
        index: true
    },
    assignedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    notificationSent: { type: Boolean, default: false, index: true },
}, { timestamps: true });
// Add validation to ensure either agentId or teamId is provided
ScheduledAssignmentSchema.pre('validate', function (next) {
    if (!this.agentId && !this.teamId) {
        next(new Error('Either agentId or teamId must be provided'));
    }
    else {
        next();
    }
});
ScheduledAssignmentSchema.index({ scheduledDate: 1, status: 1 });
ScheduledAssignmentSchema.index({ notificationSent: 1, status: 1 });
exports.ScheduledAssignment = mongoose_1.default.models.ScheduledAssignment ||
    mongoose_1.default.model('ScheduledAssignment', ScheduledAssignmentSchema);
exports.default = exports.ScheduledAssignment;
//# sourceMappingURL=ScheduledAssignment.js.map