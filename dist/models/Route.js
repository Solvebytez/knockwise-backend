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
exports.Route = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const RouteStopSchema = new mongoose_1.Schema({
    propertyId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'PropertyData', required: true },
    order: { type: Number, required: true },
    estimatedDuration: { type: Number, required: true, default: 15 }, // 15 minutes default
    notes: { type: String },
    status: {
        type: String,
        enum: ['PENDING', 'COMPLETED', 'SKIPPED', 'RESCHEDULED'],
        default: 'PENDING'
    },
    actualDuration: { type: Number },
    completedAt: { type: Date },
}, { _id: false });
const RouteOptimizationSettingsSchema = new mongoose_1.Schema({
    maxStops: { type: Number, default: 50 },
    maxDistance: { type: Number, default: 25 }, // miles
    preferredTimeWindow: {
        start: { type: String, default: '09:00' },
        end: { type: String, default: '17:00' },
    },
    optimizationType: {
        type: String,
        enum: ['FASTEST', 'SHORTEST', 'BALANCED'],
        default: 'FASTEST'
    },
    avoidFerries: { type: Boolean, default: false },
    avoidHighways: { type: Boolean, default: false },
    avoidTolls: { type: Boolean, default: false },
    avoidTraffic: { type: Boolean, default: true },
    startFromOffice: { type: Boolean, default: true },
    returnToOffice: { type: Boolean, default: true },
}, { _id: false });
const RouteAnalyticsSchema = new mongoose_1.Schema({
    totalStops: { type: Number, default: 0 },
    completedStops: { type: Number, default: 0 },
    skippedStops: { type: Number, default: 0 },
    totalDistance: { type: Number, default: 0 },
    actualDistance: { type: Number },
    estimatedDuration: { type: Number, default: 0 },
    actualDuration: { type: Number },
    startTime: { type: Date },
    endTime: { type: Date },
    efficiency: { type: Number, default: 0 }, // percentage
    completionRate: { type: Number, default: 0 }, // percentage
}, { _id: false });
const RouteSharingSchema = new mongoose_1.Schema({
    sharedWith: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }],
    sharedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    sharedAt: { type: Date, default: Date.now },
    permissions: {
        type: String,
        enum: ['VIEW', 'EDIT', 'ADMIN'],
        default: 'VIEW'
    },
}, { _id: false });
const RouteSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    description: { type: String },
    agentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    zoneId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Zone', default: null, index: true },
    teamId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
    date: { type: Date, required: true, index: true },
    stops: { type: [RouteStopSchema], required: true },
    totalDistance: { type: Number, default: 0 },
    totalDuration: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['DRAFT', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ARCHIVED'],
        default: 'DRAFT',
        index: true,
    },
    priority: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        default: 'MEDIUM',
        index: true,
    },
    startLocation: {
        type: { type: String, enum: ['Point'] },
        coordinates: { type: [Number] },
        address: { type: String },
    },
    endLocation: {
        type: { type: String, enum: ['Point'] },
        coordinates: { type: [Number] },
        address: { type: String },
    },
    optimizationSettings: { type: RouteOptimizationSettingsSchema, default: () => ({}) },
    analytics: { type: RouteAnalyticsSchema, default: () => ({}) },
    sharing: { type: RouteSharingSchema },
    tags: [{ type: String }],
    isTemplate: { type: Boolean, default: false },
    templateName: { type: String },
    parentRouteId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Route' },
}, { timestamps: true });
// Indexes for better query performance
RouteSchema.index({ agentId: 1, date: 1 });
RouteSchema.index({ status: 1, date: 1 });
RouteSchema.index({ priority: 1, date: 1 });
RouteSchema.index({ teamId: 1, status: 1 });
RouteSchema.index({ zoneId: 1, status: 1 });
RouteSchema.index({ isTemplate: 1 });
RouteSchema.index({ tags: 1 });
// Pre-save middleware to update analytics
RouteSchema.pre('save', function (next) {
    if (this.stops) {
        this.analytics.totalStops = this.stops.length;
        this.analytics.completedStops = this.stops.filter(stop => stop.status === 'COMPLETED').length;
        this.analytics.skippedStops = this.stops.filter(stop => stop.status === 'SKIPPED').length;
        this.analytics.completionRate = this.analytics.totalStops > 0
            ? (this.analytics.completedStops / this.analytics.totalStops) * 100
            : 0;
    }
    next();
});
exports.Route = mongoose_1.default.models.Route || mongoose_1.default.model('Route', RouteSchema);
exports.default = exports.Route;
//# sourceMappingURL=Route.js.map