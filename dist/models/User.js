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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const UserSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    username: { type: String, trim: true, sparse: true },
    contactNumber: { type: String, trim: true },
    password: { type: String, required: true, select: false },
    originalPassword: { type: String, select: false }, // Add originalPassword field
    role: { type: String, enum: ['SUPERADMIN', 'SUBADMIN', 'AGENT'], required: true, index: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    assignmentStatus: { type: String, enum: ['ASSIGNED', 'UNASSIGNED'], default: 'UNASSIGNED' },
    timezone: { type: String, default: 'America/New_York' }, // Default timezone
    // Primary assignments (for backward compatibility)
    primaryTeamId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Team', default: null },
    primaryZoneId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Zone', default: null },
    // Multiple assignments
    teamIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Team' }],
    zoneIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Zone' }],
    // Track who created this user
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ teamIds: 1 });
UserSchema.index({ zoneIds: 1 });
UserSchema.index({ createdBy: 1 });
UserSchema.pre('save', async function hashPassword(next) {
    const user = this;
    if (!user.isModified('password'))
        return next();
    const salt = await bcryptjs_1.default.genSalt(10);
    user.password = await bcryptjs_1.default.hash(user.password, salt);
    next();
});
UserSchema.methods.comparePassword = async function (candidate) {
    const user = this;
    return bcryptjs_1.default.compare(candidate, user.password);
};
exports.User = mongoose_1.default.models.User || mongoose_1.default.model('User', UserSchema);
exports.default = exports.User;
//# sourceMappingURL=User.js.map