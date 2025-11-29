/**
 * Cleanup script to remove all manual zones and related data for a specific agent
 * 
 * Run with: npx ts-node -r dotenv/config cleanup-manual-zones.ts
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from './src/config/database';

// Agent email to clean up
const AGENT_EMAIL = 'agent@knockwise.io';

// Specific zone IDs to delete (from the app logs)
const MANUAL_ZONE_IDS = [
  '69299f761ce761bdaafc9570',  // "Mannual zone"
  '69258e034b264c76f48bfc3f',  // "mannual zone"
  '69258dfa4b264c76f48bfc1f',  // "mannual z0ne"
  '69258dd14b264c76f48bfbfc',  // "mannual zne"
];

async function cleanupManualZones() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await connectDatabase();
    console.log('✅ Connected to MongoDB');

    // Get database reference
    const db = mongoose.connection.db;
    if (!db) {
      console.log('❌ Database connection not established');
      return;
    }

    // 1. Find the agent by email
    console.log(`\n🔍 Finding agent with email: ${AGENT_EMAIL}`);
    const agent = await db.collection('users').findOne({ email: AGENT_EMAIL });
    
    if (!agent) {
      console.log('❌ Agent not found with email:', AGENT_EMAIL);
      return;
    }
    
    console.log(`✅ Found agent: ${agent.name} (ID: ${agent._id})`);

    // 2. Convert string IDs to ObjectIds and find the zones
    console.log('\n🔍 Finding manual zones by IDs...');
    const zoneObjectIds = MANUAL_ZONE_IDS.map(id => new mongoose.Types.ObjectId(id));
    
    const manualZones = await db.collection('zones').find({
      _id: { $in: zoneObjectIds },
      zoneType: 'MANUAL'
    }).toArray();

    console.log(`✅ Found ${manualZones.length} manual zone(s) out of ${MANUAL_ZONE_IDS.length} requested`);

    if (manualZones.length === 0) {
      console.log('ℹ️  No manual zones found to clean up');
      console.log('ℹ️  Requested IDs:', MANUAL_ZONE_IDS);
      
      // Let's also check all zones for this agent
      console.log('\n🔍 Checking all zones for this agent...');
      const allZones = await db.collection('zones').find({
        $or: [
          { createdBy: agent._id },
          { assignedAgentId: agent._id }
        ]
      }).toArray();
      console.log(`Found ${allZones.length} total zones for agent`);
      allZones.forEach((z, i) => {
        console.log(`   ${i+1}. ${z.name} (ID: ${z._id}, Type: ${z.zoneType})`);
      });
      return;
    }

    // Get zone IDs (use the ObjectIds we already have)
    const zoneIds = zoneObjectIds;
    const zoneNames = manualZones.map(z => z.name);
    
    console.log('\n📋 Zones to be deleted:');
    manualZones.forEach((zone, i) => {
      console.log(`   ${i + 1}. ${zone.name} (ID: ${zone._id})`);
    });

    // 3. Delete residents/properties in these zones
    console.log('\n🗑️  Deleting residents in manual zones...');
    const residentsResult = await db.collection('residents').deleteMany({
      zoneId: { $in: zoneIds }
    });
    console.log(`   Deleted ${residentsResult.deletedCount} resident(s)`);

    // 4. Delete agent zone assignments
    console.log('\n🗑️  Deleting agent zone assignments...');
    const assignmentsResult = await db.collection('agentzoneassignments').deleteMany({
      zoneId: { $in: zoneIds }
    });
    console.log(`   Deleted ${assignmentsResult.deletedCount} assignment(s)`);

    // 5. Delete scheduled assignments if any
    console.log('\n🗑️  Deleting scheduled assignments...');
    const scheduledResult = await db.collection('scheduledassignments').deleteMany({
      zoneId: { $in: zoneIds }
    });
    console.log(`   Deleted ${scheduledResult.deletedCount} scheduled assignment(s)`);

    // 6. Delete activities related to these zones
    console.log('\n🗑️  Deleting activities for manual zones...');
    const activitiesResult = await db.collection('activities').deleteMany({
      zoneId: { $in: zoneIds }
    });
    console.log(`   Deleted ${activitiesResult.deletedCount} activity record(s)`);

    // 7. Update communities - remove zone references
    console.log('\n🔄 Updating communities to remove zone references...');
    const communitiesResult = await db.collection('communities').updateMany(
      { zoneIds: { $in: zoneIds } },
      { $pull: { zoneIds: { $in: zoneIds } } } as any
    );
    console.log(`   Updated ${communitiesResult.modifiedCount} community(ies)`);

    // 8. Update agent's zoneIds array
    console.log('\n🔄 Updating agent\'s zoneIds array...');
    const userResult = await db.collection('users').updateOne(
      { _id: agent._id },
      { $pull: { zoneIds: { $in: zoneIds } } } as any
    );
    console.log(`   Updated agent's zoneIds (modified: ${userResult.modifiedCount})`);

    // 9. Finally, delete the zones
    console.log('\n🗑️  Deleting manual zones...');
    const zonesResult = await db.collection('zones').deleteMany({
      _id: { $in: zoneIds }
    });
    console.log(`   Deleted ${zonesResult.deletedCount} zone(s)`);

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('✅ CLEANUP COMPLETED SUCCESSFULLY');
    console.log('='.repeat(50));
    console.log(`   Agent: ${agent.name} (${AGENT_EMAIL})`);
    console.log(`   Zones deleted: ${zonesResult.deletedCount}`);
    console.log(`   Zone names: ${zoneNames.join(', ')}`);
    console.log(`   Residents deleted: ${residentsResult.deletedCount}`);
    console.log(`   Assignments deleted: ${assignmentsResult.deletedCount}`);
    console.log(`   Activities deleted: ${activitiesResult.deletedCount}`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    console.log('\n🔗 Closing MongoDB connection...');
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run the cleanup
cleanupManualZones();

