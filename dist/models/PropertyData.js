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
exports.PropertyData = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const PropertyDataSchema = new mongoose_1.Schema({
    addressLine1: { type: String, required: true, index: true },
    addressLine2: { type: String },
    city: { type: String, required: true, index: true },
    state: { type: String, required: true, index: true },
    postalCode: { type: String, required: true, index: true },
    location: {
        type: { type: String, enum: ['Point'], required: true },
        coordinates: { type: [Number], required: true },
    },
    mlsId: { type: String, index: true },
    mlsStatus: { type: String, enum: ['ACTIVE', 'SOLD', 'PENDING', 'WITHDRAWN'] },
    listPrice: { type: Number },
    soldPrice: { type: Number },
    soldDate: { type: Date },
    daysOnMarket: { type: Number },
    ownerName: { type: String, index: true },
    ownerPhone: { type: String },
    ownerEmail: { type: String, lowercase: true },
    ownerMailingAddress: { type: String },
    propertyType: { type: String, enum: ['SINGLE_FAMILY', 'MULTI_FAMILY', 'CONDO', 'TOWNHOUSE', 'COMMERCIAL'] },
    bedrooms: { type: Number },
    bathrooms: { type: Number },
    squareFootage: { type: Number },
    lotSize: { type: Number },
    yearBuilt: { type: Number },
    estimatedValue: { type: Number, index: true },
    lastAssessedValue: { type: Number },
    taxAmount: { type: Number },
    zoneId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Zone', default: null, index: true },
    dataSource: { type: String, enum: ['MLS', 'PUBLIC_RECORDS', 'THIRD_PARTY', 'MANUAL'], required: true },
    lastUpdated: { type: Date, default: Date.now, index: true },
    leadScore: { type: Number, min: 1, max: 100, index: true },
    motivationScore: { type: Number, min: 1, max: 100 },
    equityScore: { type: Number, min: 1, max: 100 },
}, { timestamps: true });
PropertyDataSchema.index({ location: '2dsphere' });
PropertyDataSchema.index({ addressLine1: 1, city: 1, state: 1, postalCode: 1 }, { unique: true });
exports.PropertyData = mongoose_1.default.models.PropertyData || mongoose_1.default.model('PropertyData', PropertyDataSchema);
exports.default = exports.PropertyData;
//# sourceMappingURL=PropertyData.js.map