/**
 * Script to check for duplicate manual zones (same name, same user)
 * Run with: ts-node -r dotenv/config check-duplicate-manual-zones.ts
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import User from './src/models/User';
import Zone from './src/models/Zone';
import { connectDatabase } from './src/config/database';

async function checkDuplicateManualZones() {
  try {
    console.log('🔌 Connecting to database...');
    await connectDatabase();
    console.log('✅ Connected to database\n');

    // Find user by email
    const userEmail = 'agent@knockwise.io';
    console.log(`🔍 Looking for user with email: ${userEmail}`);
    const user = await User.findOne({ email: userEmail });
    
    if (!user) {
      console.log('❌ User not found with email:', userEmail);
      await mongoose.disconnect();
      return;
    }

    console.log('✅ User found:');
    console.log(`   ID: ${user._id}`);
    console.log(`   Name: ${user.name}\n`);

    // Find all manual zones created by this user
    const manualZones = await Zone.find({ 
      createdBy: user._id,
      zoneType: 'MANUAL'
    })
    .sort({ createdAt: -1 });

    console.log(`📊 Found ${manualZones.length} MANUAL zones\n`);

    // Group by name to find duplicates
    const zonesByName = new Map<string, typeof manualZones>();
    manualZones.forEach(zone => {
      const name = zone.name.toLowerCase().trim();
      if (!zonesByName.has(name)) {
        zonesByName.set(name, []);
      }
      zonesByName.get(name)!.push(zone);
    });

    // Check for duplicates
    console.log('🔍 Checking for duplicate zone names:');
    console.log('='.repeat(80));
    let hasDuplicates = false;
    
    zonesByName.forEach((zones, name) => {
      if (zones.length > 1) {
        hasDuplicates = true;
        console.log(`\n⚠️  DUPLICATE FOUND: "${name}" (${zones.length} zones)`);
        zones.forEach((zone, index) => {
          console.log(`   ${index + 1}. ID: ${zone._id}`);
          console.log(`      Name: ${zone.name}`);
          console.log(`      Created: ${(zone as any).createdAt}`);
          console.log(`      Updated: ${(zone as any).updatedAt}`);
          console.log(`      Description: ${zone.description || 'N/A'}`);
        });
      }
    });

    if (!hasDuplicates) {
      console.log('\n✅ No duplicate zone names found');
    }

    // Show all zones with their details
    console.log('\n' + '='.repeat(80));
    console.log('\n📋 All Manual Zones:');
    console.log('='.repeat(80));
    manualZones.forEach((zone, index) => {
      console.log(`\n${index + 1}. ${zone.name}`);
      console.log(`   ID: ${zone._id}`);
      console.log(`   Created: ${(zone as any).createdAt}`);
      console.log(`   Updated: ${(zone as any).updatedAt}`);
      console.log(`   Description: ${zone.description || 'N/A'}`);
    });

    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
checkDuplicateManualZones();













