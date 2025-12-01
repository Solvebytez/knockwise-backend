import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from './src/config/database';
import Lead from './src/models/Lead';
import User from './src/models/User';

async function checkLeads() {
  try {
    console.log('🔌 Connecting to database...');
    await connectDatabase();
    console.log('✅ Connected to database\n');

    const agentEmail = 'agent@knockwise.io';
    const agent = await User.findOne({ email: agentEmail });
    
    if (!agent) {
      console.log('❌ Agent not found');
      await mongoose.disconnect();
      return;
    }

    console.log(`👤 Agent: ${agent.name} (${agent._id})`);
    console.log(`   Email: ${agent.email}`);
    console.log(`   Role: ${agent.role}\n`);

    // Check all leads
    const allLeads = await Lead.find().limit(10);
    console.log(`📊 Total leads in database: ${allLeads.length}\n`);

    if (allLeads.length > 0) {
      console.log('📋 All Leads:');
      for (const lead of allLeads) {
        console.log(`  - Lead ID: ${lead._id}`);
        console.log(`    Owner: ${lead.ownerName || 'N/A'}`);
        console.log(`    Status: ${lead.status}`);
        console.log(`    Assigned Agent ID: ${lead.assignedAgentId || 'NOT ASSIGNED'}`);
        console.log(`    Agent ID Type: ${typeof lead.assignedAgentId}`);
        console.log(`    Agent Match: ${lead.assignedAgentId?.toString() === (agent._id as any).toString()}`);
        console.log('');
      }
    }

    // Check leads assigned to this agent
    const myLeads = await Lead.find({ assignedAgentId: agent._id });
    console.log(`\n📊 Leads assigned to ${agentEmail}: ${myLeads.length}`);
    
    if (myLeads.length > 0) {
      console.log('\n📋 My Leads:');
      myLeads.forEach((lead, i) => {
        console.log(`  ${i + 1}. ${lead.ownerName || 'Unknown'} - ${lead.status} (ID: ${lead._id})`);
      });
    }

    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

void checkLeads();

