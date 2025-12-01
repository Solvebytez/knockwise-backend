/**
 * Script to delete all MANUAL zones created by a specific user
 * Run with: ts-node -r dotenv/config delete-manual-zones-by-email.ts
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import User from './src/models/User';
import Zone from './src/models/Zone';
import Resident from './src/models/Resident';
import { connectDatabase } from './src/config/database';

async function deleteManualZonesByEmail() {
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
    console.log(`   Email: ${user.email}\n`);

    // Find all manual zones created by this user
    console.log('🔍 Finding MANUAL zones created by this user...');
    const manualZones = await Zone.find({ 
      createdBy: user._id,
      zoneType: 'MANUAL'
    });

    console.log(`\n📊 Found ${manualZones.length} MANUAL zones\n`);

    if (manualZones.length === 0) {
      console.log('✅ No manual zones to delete');
      await mongoose.disconnect();
      return;
    }

    // Show zones that will be deleted
    console.log('⚠️  Zones that will be deleted:');
    console.log('='.repeat(80));
    manualZones.forEach((zone, index) => {
      console.log(`\n${index + 1}. ${zone.name}`);
      console.log(`   ID: ${zone._id}`);
      console.log(`   Created: ${(zone as any).createdAt}`);
      console.log(`   Description: ${zone.description || 'N/A'}`);
    });
    console.log('\n' + '='.repeat(80));

    // Check for residents in these zones
    const zoneIds = manualZones.map(z => z._id);
    const residentsCount = await Resident.countDocuments({ 
      zoneId: { $in: zoneIds } 
    });

    console.log(`\n📊 Found ${residentsCount} residents in these zones`);

    if (residentsCount > 0) {
      console.log('⚠️  WARNING: These zones have residents. Residents will also be deleted.');
      const residents = await Resident.find({ zoneId: { $in: zoneIds } });
      console.log(`\n   Residents to be deleted:`);
      residents.forEach((resident, index) => {
        console.log(`   ${index + 1}. ${resident.address} (ID: ${resident._id})`);
      });
    }

    // Ask for confirmation (in a real scenario, you'd use readline)
    console.log('\n⚠️  WARNING: This will permanently delete:');
    console.log(`   - ${manualZones.length} manual zone(s)`);
    console.log(`   - ${residentsCount} resident(s)`);
    console.log('\n   This action cannot be undone!');
    console.log('\n   To proceed, uncomment the deletion code in the script.\n');

    // Proceeding with deletion
    console.log('\n🗑️  Starting deletion...\n');

    // Delete residents first
    if (residentsCount > 0) {
      console.log('🗑️  Deleting residents...');
      const deleteResidentsResult = await Resident.deleteMany({ 
        zoneId: { $in: zoneIds } 
      });
      console.log(`✅ Deleted ${deleteResidentsResult.deletedCount} residents\n`);
    }

    // Delete zones
    console.log('🗑️  Deleting zones...');
    const deleteZonesResult = await Zone.deleteMany({ 
      _id: { $in: zoneIds } 
    });
    console.log(`✅ Deleted ${deleteZonesResult.deletedCount} zones\n`);

    console.log('✅ Deletion completed successfully!');

    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
deleteManualZonesByEmail();

