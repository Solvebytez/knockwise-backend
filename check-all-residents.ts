import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from './src/config/database';
import Zone from './src/models/Zone';
import { Resident } from './src/models/Resident';
import User from './src/models/User';

async function checkAllResidents() {
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

    // Find all manual zones created by this agent
    const manualZones = await Zone.find({ 
      createdBy: agent._id, 
      zoneType: 'MANUAL' 
    });
    
    console.log(`📊 Found ${manualZones.length} manual zones\n`);

    // Check all residents with dataSource MANUAL
    const allManualResidents = await Resident.find({ dataSource: 'MANUAL' });
    console.log(`📊 Total MANUAL residents in database: ${allManualResidents.length}\n`);

    if (allManualResidents.length > 0) {
      console.log('📋 All MANUAL residents:');
      for (const resident of allManualResidents) {
        const zone = await Zone.findById(resident.zoneId);
        console.log(`  - ${resident.address}`);
        console.log(`    Resident ID: ${resident._id}`);
        console.log(`    Zone ID: ${resident.zoneId}`);
        console.log(`    Zone Name: ${zone ? zone.name : 'NOT FOUND'}`);
        console.log(`    Zone Type: ${zone ? zone.zoneType : 'N/A'}`);
        console.log('');
      }
    }

    // Check residents for each manual zone
    for (const zone of manualZones) {
      const residents = await Resident.find({ zoneId: zone._id });
      console.log(`Zone: ${zone.name} (${zone._id})`);
      console.log(`  Residents with this zoneId: ${residents.length}`);
      
      if (residents.length > 0) {
        residents.forEach((r, i) => {
          console.log(`    ${i + 1}. ${r.address} (ID: ${r._id})`);
        });
      }
      console.log('');
    }

    await mongoose.disconnect();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

void checkAllResidents();

