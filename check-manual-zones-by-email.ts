/**
 * Script to check how many manual zones were created by a specific user
 * Run with: ts-node -r dotenv/config check-manual-zones-by-email.ts
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import User from './src/models/User';
import Zone from './src/models/Zone';
import { connectDatabase } from './src/config/database';

async function checkManualZonesByEmail() {
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
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}\n`);

    // Find all manual zones created by this user
    console.log('🔍 Finding MANUAL zones created by this user...');
    const manualZones = await Zone.find({ 
      createdBy: user._id,
      zoneType: 'MANUAL'
    })
    .sort({ createdAt: -1 });

    console.log(`\n✅ Found ${manualZones.length} MANUAL zones created by ${userEmail}\n`);

    if (manualZones.length > 0) {
      console.log('📋 Manual Zones Details:');
      console.log('='.repeat(80));
      manualZones.forEach((zone, index) => {
        console.log(`\n${index + 1}. Zone: ${zone.name}`);
        console.log(`   ID: ${zone._id}`);
        console.log(`   Description: ${zone.description || 'N/A'}`);
        console.log(`   Status: ${zone.status || 'N/A'}`);
        console.log(`   Zone Type: ${zone.zoneType}`);
        console.log(`   Created At: ${(zone as any).createdAt || 'N/A'}`);
        console.log(`   Updated At: ${(zone as any).updatedAt || 'N/A'}`);
        if (zone.areaId) {
          console.log(`   Area ID: ${zone.areaId}`);
        }
        if (zone.municipalityId) {
          console.log(`   Municipality ID: ${zone.municipalityId}`);
        }
        if (zone.communityId) {
          console.log(`   Community ID: ${zone.communityId}`);
        }
      });
      console.log('\n' + '='.repeat(80));
    }

    // Also check total zones (all types) created by this user
    const totalZones = await Zone.countDocuments({ createdBy: user._id });
    console.log(`\n📊 Total zones (all types) created by this user: ${totalZones}`);
    
    // Count by zone type
    const zonesByType = await Zone.aggregate([
      { $match: { createdBy: user._id } },
      { $group: { _id: '$zoneType', count: { $sum: 1 } } }
    ]);
    
    console.log('\n📊 Zones by type:');
    zonesByType.forEach((item) => {
      console.log(`   ${item._id || 'N/A'}: ${item.count}`);
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
checkManualZonesByEmail();

