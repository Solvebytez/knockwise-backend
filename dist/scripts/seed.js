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
    const existing = await User_1.default.findOne({ email: 'superadmin@knockwise.io' });
    if (!existing) {
        await User_1.default.create({
            name: 'Super Admin',
            email: 'superadmin@knockwise.io',
            password: 'Admin@12345',
            role: 'SUPERADMIN',
        });
        // eslint-disable-next-line no-console
        console.log('Seeded SUPERADMIN: superadmin@knockwise.io / Admin@12345');
    }
    else {
        // eslint-disable-next-line no-console
        console.log('SUPERADMIN already exists');
    }
    await mongoose_1.default.disconnect();
}
main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=seed.js.map