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
exports.AgentZoneAssignment = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const AgentZoneAssignmentSchema = new mongoose_1.Schema({
    agentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: false, index: true },
    zoneId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Zone', required: true, index: true },
    teamId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
    effectiveFrom: { type: Date, required: true, index: true },
    effectiveTo: { type: Date, default: null, index: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'COMPLETED', 'CANCELLED'], default: 'ACTIVE', index: true },
    assignedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
// Add validation to ensure either agentId or teamId is provided
AgentZoneAssignmentSchema.pre('validate', function (next) {
    if (!this.agentId && !this.teamId) {
        next(new Error('Either agentId or teamId must be provided'));
    }
    else {
        next();
    }
});
AgentZoneAssignmentSchema.index({ agentId: 1, effectiveTo: 1 });
AgentZoneAssignmentSchema.index({ zoneId: 1, effectiveTo: 1 });
AgentZoneAssignmentSchema.index({ agentId: 1, status: 1 });
exports.AgentZoneAssignment = mongoose_1.default.models.AgentZoneAssignment ||
    mongoose_1.default.model('AgentZoneAssignment', AgentZoneAssignmentSchema);
exports.default = exports.AgentZoneAssignment;
//# sourceMappingURL=AgentZoneAssignment.js.map