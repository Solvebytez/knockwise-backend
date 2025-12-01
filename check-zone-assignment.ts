import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from './src/config/database';
import Zone from './src/models/Zone';
import { Resident } from './src/models/Resident';
import { AgentZoneAssignment } from './src/models/AgentZoneAssignment';
import User from './src/models/User';

async function checkZoneAssignment() {
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

    console.log(`👤 Agent: ${agent.name} (${agent._id})\n`);

    const zoneId = '692d5c610487632f89b0ce15';
    const zone = await Zone.findById(zoneId);
    
    if (!zone) {
      console.log('❌ Zone not found');
      await mongoose.disconnect();
      return;
    }

    console.log(`Zone: ${zone.name}`);
    console.log(`  Zone ID: ${zone._id}`);
    console.log(`  Zone Type: ${zone.zoneType}`);
    console.log(`  Created By: ${zone.createdBy}`);
    console.log(`  Agent ID: ${agent._id}`);
    console.log(`  Match: ${zone.createdBy?.toString() === (agent._id as any).toString()}\n`);

    // Check assignment
    const assignment = await AgentZoneAssignment.findOne({
      zoneId: zone._id,
      agentId: agent._id,
    });
    
    console.log('Assignment:');
    if (assignment) {
      console.log(`  ✅ Found assignment: ${assignment._id}`);
      console.log(`  Status: ${assignment.status}`);
      console.log(`  Effective From: ${assignment.effectiveFrom}`);
      console.log(`  Effective To: ${assignment.effectiveTo}`);
    } else {
      console.log('  ❌ No assignment found');
    }
    console.log('');

    // Check residents
    const residentCount = await Resident.countDocuments({ zoneId: zone._id });
    console.log(`Residents: ${residentCount}`);
    
    // Test the query with different formats
    console.log('\nTesting queries:');
    const count1 = await Resident.countDocuments({ zoneId: zone._id });
    const count2 = await Resident.countDocuments({ zoneId: new mongoose.Types.ObjectId(zoneId) });
    const count3 = await Resident.countDocuments({ zoneId: zoneId });
    
    console.log(`  countDocuments({ zoneId: zone._id }): ${count1}`);
    console.log(`  countDocuments({ zoneId: new ObjectId(zoneId) }): ${count2}`);
    console.log(`  countDocuments({ zoneId: zoneId string }): ${count3}`);

    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

void checkZoneAssignment();

