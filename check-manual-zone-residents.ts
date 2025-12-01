import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from './src/config/database';
import Zone from './src/models/Zone';
import { Resident } from './src/models/Resident';

async function checkManualZoneResidents() {
  try {
    console.log('🔌 Connecting to database...');
    await connectDatabase();
    console.log('✅ Connected to database\n');

    const manualZones = await Zone.find({ zoneType: 'MANUAL' }).limit(10);
    console.log(`📊 Found ${manualZones.length} manual zones\n`);

    for (const zone of manualZones) {
      const residentCount = await Resident.countDocuments({ zoneId: zone._id });
      const residents = await Resident.find({ zoneId: zone._id }).limit(3);
      
      console.log(`Zone: ${zone.name}`);
      console.log(`  Zone ID: ${zone._id}`);
      console.log(`  Total Residents: ${residentCount}`);
      
      if (residents.length > 0) {
        console.log(`  Sample Residents:`);
        residents.forEach((r, i) => {
          console.log(`    ${i + 1}. ${r.address} (ID: ${r._id}, zoneId: ${r.zoneId})`);
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

void checkManualZoneResidents();


