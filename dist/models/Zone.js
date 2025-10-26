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
exports.Zone = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ZoneSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    boundary: {
        type: { type: String, enum: ['Polygon'], required: true },
        coordinates: { type: [[[Number]]], required: true },
    },
    buildingData: {
        totalBuildings: { type: Number, default: 0 },
        residentialHomes: { type: Number, default: 0 },
        addresses: [{ type: String }],
        coordinates: [{ type: [Number] }], // [lng, lat]
        houseNumbers: {
            odd: [{ type: Number }],
            even: [{ type: Number }],
        },
        houseStatuses: { type: Map, of: {
                status: {
                    type: String,
                    enum: ['not-visited', 'interested', 'visited', 'callback', 'appointment', 'follow-up', 'not-interested'],
                    default: 'not-visited'
                },
                notes: { type: String },
                phone: { type: String },
                email: { type: String },
                lastVisited: { type: Date },
                updatedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
                updatedAt: { type: Date, default: Date.now }
            } },
    },
    assignedAgentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    teamId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
    status: { type: String, enum: ['DRAFT', 'ACTIVE', 'INACTIVE', 'SCHEDULED', 'COMPLETED'], default: 'DRAFT', index: true },
    zoneType: { type: String, enum: ['MANUAL', 'MAP'], required: true, default: 'MAP', index: true },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
// Re-enable 2dsphere index now that polygon closure is fixed
ZoneSchema.index({ boundary: '2dsphere' });
ZoneSchema.index({ 'buildingData.houseNumbers.odd': 1 });
ZoneSchema.index({ 'buildingData.houseNumbers.even': 1 });
exports.Zone = mongoose_1.default.models.Zone || mongoose_1.default.model('Zone', ZoneSchema);
exports.default = exports.Zone;
//# sourceMappingURL=Zone.js.map