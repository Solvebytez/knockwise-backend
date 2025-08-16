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
exports.Lead = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const LeadHistorySchema = new mongoose_1.Schema({
    at: { type: Date, required: true },
    by: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    status: {
        type: String,
        enum: ['NEW', 'CONTACTED', 'FOLLOW_UP', 'APPOINTMENT_SET', 'VISITED', 'NOT_INTERESTED', 'CONVERTED', 'LOST'],
    },
    notes: { type: String },
}, { _id: false });
const LeadSchema = new mongoose_1.Schema({
    propertyId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
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
    assignedAgentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    teamId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
    zoneId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Zone', default: null, index: true },
    history: { type: [LeadHistorySchema], default: [] },
    lastActivityAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });
LeadSchema.index({ assignedAgentId: 1, status: 1 });
LeadSchema.index({ zoneId: 1, status: 1, createdAt: -1 });
exports.Lead = mongoose_1.default.models.Lead || mongoose_1.default.model('Lead', LeadSchema);
exports.default = exports.Lead;
//# sourceMappingURL=Lead.js.map