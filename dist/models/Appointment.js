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
exports.Appointment = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const AppointmentSchema = new mongoose_1.Schema({
    title: { type: String },
    agentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdById: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    propertyId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Property', default: null, index: true },
    leadId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Lead', default: null, index: true },
    start: { type: Date, required: true, index: true },
    end: { type: Date, required: true },
    status: { type: String, enum: ['SCHEDULED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'], default: 'SCHEDULED', index: true },
    notes: { type: String },
    teamId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
}, { timestamps: true });
AppointmentSchema.index({ agentId: 1, start: 1 });
exports.Appointment = mongoose_1.default.models.Appointment || mongoose_1.default.model('Appointment', AppointmentSchema);
exports.default = exports.Appointment;
//# sourceMappingURL=Appointment.js.map