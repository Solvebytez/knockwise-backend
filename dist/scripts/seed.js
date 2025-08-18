"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("../config/env");
const User_1 = __importDefault(require("../models/User"));
async function main() {
    await mongoose_1.default.connect(env_1.env.mongoUri);
    // Create test users if they don't exist
    const testUsers = [
        {
            name: 'Super Admin',
            email: 'superadmin@knockwise.io',
            password: 'Admin@12345',
            role: 'SUPERADMIN',
        },
        {
            name: 'Sub Admin',
            email: 'subadmin@knockwise.io',
            password: 'Admin@12345',
            role: 'SUBADMIN',
        },
        {
            name: 'Sales Agent',
            email: 'agent@knockwise.io',
            password: 'Admin@12345',
            role: 'AGENT',
        },
    ];
    for (const userData of testUsers) {
        const existing = await User_1.default.findOne({ email: userData.email });
        if (!existing) {
            await User_1.default.create(userData);
            console.log(`Seeded ${userData.role}: ${userData.email} / ${userData.password}`);
        }
        else {
            console.log(`${userData.role} already exists: ${userData.email}`);
        }
    }
    await mongoose_1.default.disconnect();
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=seed.js.map