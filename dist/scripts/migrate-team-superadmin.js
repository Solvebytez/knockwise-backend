"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("../config/env");
async function main() {
    await mongoose_1.default.connect(env_1.env.mongoUri);
    console.log('Starting team migration...');
    try {
        // Use raw MongoDB query to find teams with superadminId field
        if (!mongoose_1.default.connection.db) {
            throw new Error('Database connection not available');
        }
        const teams = await mongoose_1.default.connection.db.collection('teams').find({ superadminId: { $exists: true } }).toArray();
        console.log(`Found ${teams.length} teams to migrate`);
        for (const team of teams) {
            console.log(`Migrating team: ${team.name}`);
            // Update the team to use createdBy instead of superadminId
            await mongoose_1.default.connection.db.collection('teams').updateOne({ _id: team._id }, {
                $set: { createdBy: team.superadminId },
                $unset: { superadminId: 1 }
            });
            console.log(`✓ Migrated team: ${team.name}`);
        }
        console.log('Team migration completed successfully!');
    }
    catch (error) {
        console.error('Error during migration:', error);
    }
    await mongoose_1.default.disconnect();
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=migrate-team-superadmin.js.map