"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("../config/env");
const User_1 = __importDefault(require("../models/User"));
const Team_1 = __importDefault(require("../models/Team"));
async function main() {
    await mongoose_1.default.connect(env_1.env.mongoUri);
    console.log('Creating test data...');
    // Create test agents
    const testAgents = [
        {
            name: 'John Smith',
            email: 'john.smith@knockwise.io',
            password: 'Agent@12345',
            role: 'AGENT',
            status: 'ACTIVE',
        },
        {
            name: 'Sarah Johnson',
            email: 'sarah.johnson@knockwise.io',
            password: 'Agent@12345',
            role: 'AGENT',
            status: 'ACTIVE',
        },
        {
            name: 'Mike Davis',
            email: 'mike.davis@knockwise.io',
            password: 'Agent@12345',
            role: 'AGENT',
            status: 'ACTIVE',
        },
        {
            name: 'Lisa Wilson',
            email: 'lisa.wilson@knockwise.io',
            password: 'Agent@12345',
            role: 'AGENT',
            status: 'ACTIVE',
        },
    ];
    const createdAgents = [];
    for (const agentData of testAgents) {
        const existing = await User_1.default.findOne({ email: agentData.email });
        if (!existing) {
            const agent = await User_1.default.create(agentData);
            createdAgents.push(agent);
            console.log(`Created agent: ${agent.name} (${agent.email})`);
        }
        else {
            createdAgents.push(existing);
            console.log(`Agent already exists: ${existing.name} (${existing.email})`);
        }
    }
    // Create test teams
    const testTeams = [
        {
            name: 'Team Alpha',
            description: 'High-performing sales team for premium properties',
            agentIds: createdAgents.slice(0, 2).map(agent => agent._id),
        },
        {
            name: 'Team Beta',
            description: 'Specialized team for residential properties',
            agentIds: createdAgents.slice(2, 4).map(agent => agent._id),
        },
        {
            name: 'Team Gamma',
            description: 'New team for expanding territories',
            agentIds: createdAgents.length > 0 && createdAgents[0] ? [createdAgents[0]._id] : [], // Only one agent
        },
    ];
    for (const teamData of testTeams) {
        const existing = await Team_1.default.findOne({ name: teamData.name });
        if (!existing) {
            const team = await Team_1.default.create({
                ...teamData,
                createdBy: createdAgents.length > 0 && createdAgents[0] ? createdAgents[0]._id : undefined, // Use first agent as admin for testing
                leaderId: teamData.agentIds[0], // First agent is leader
            });
            console.log(`Created team: ${team.name} with ${teamData.agentIds.length} agents`);
        }
        else {
            console.log(`Team already exists: ${existing.name}`);
        }
    }
    console.log('Test data creation completed!');
    await mongoose_1.default.disconnect();
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=test-data.js.map