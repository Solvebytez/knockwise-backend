/**
 * Script to delete all zones created by agent@knockwise.io and all associated data
 * Run with: ts-node -r dotenv/config delete-agent-zones.ts
 * 
 * WARNING: This is a destructive operation that will permanently delete:
 * - All zones created by the agent
 * - All residents in those zones
 * - All activities related to those zones
 * - All routes in those zones
 * - All assignments (AgentZoneAssignment, ScheduledAssignment)
 * - All leads in those zones
 * - All properties in those zones
 * - All property data in those zones
 * - References in User model (primaryZoneId, zoneIds)
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import User from './src/models/User';
import Zone from './src/models/Zone';
import { Resident } from './src/models/Resident';
import { Activity } from './src/models/Activity';
import { Route } from './src/models/Route';
import { AgentZoneAssignment } from './src/models/AgentZoneAssignment';
import { ScheduledAssignment } from './src/models/ScheduledAssignment';
import { Lead } from './src/models/Lead';
import { Property } from './src/models/Property';
import { PropertyData } from './src/models/PropertyData';
import { connectDatabase } from './src/config/database';

async function deleteAgentZones() {
  try {
    console.log('🔌 Connecting to database...');
    await connectDatabase();
    console.log('✅ Connected to database\n');

    // 1. Find agent by email
    const agentEmail = 'agent@knockwise.io';
    console.log(`🔍 Looking for agent with email: ${agentEmail}`);
    const agent = await User.findOne({ email: agentEmail });
    
    if (!agent) {
      console.log('❌ Agent not found with email:', agentEmail);
      await mongoose.disconnect();
      return;
    }

    console.log('✅ Agent found:');
    console.log(`   ID: ${agent._id}`);
    console.log(`   Name: ${agent.name}`);
    console.log(`   Email: ${agent.email}\n`);

    // 2. Find all zones created by this agent
    console.log('🔍 Finding zones created by this agent...');
    const zonesCreatedByAgent = await Zone.find({ createdBy: agent._id });
    console.log(`✅ Found ${zonesCreatedByAgent.length} zones created by agent\n`);

    if (zonesCreatedByAgent.length === 0) {
      console.log('ℹ️  No zones found to delete.');
      await mongoose.disconnect();
      return;
    }

    // Display zones that will be deleted
    console.log('📋 Zones to be deleted:');
    zonesCreatedByAgent.forEach((zone, index) => {
      console.log(`   ${index + 1}. ${zone.name} (${zone._id})`);
    });
    console.log();

    // Get all zone IDs
    const zoneIds: mongoose.Types.ObjectId[] = zonesCreatedByAgent.map(z => z._id as mongoose.Types.ObjectId);

    // 3. Count and delete associated data
    console.log('🗑️  Starting deletion process...\n');

    // Delete Residents
    const residentsCount = await Resident.countDocuments({ zoneId: { $in: zoneIds } });
    console.log(`   📊 Found ${residentsCount} residents to delete`);
    const residentsResult = await Resident.deleteMany({ zoneId: { $in: zoneIds } });
    console.log(`   ✅ Deleted ${residentsResult.deletedCount} residents\n`);

    // Delete Activities
    const activitiesCount = await Activity.countDocuments({ zoneId: { $in: zoneIds } });
    console.log(`   📊 Found ${activitiesCount} activities to delete`);
    const activitiesResult = await Activity.deleteMany({ zoneId: { $in: zoneIds } });
    console.log(`   ✅ Deleted ${activitiesResult.deletedCount} activities\n`);

    // Delete Routes
    const routesCount = await Route.countDocuments({ zoneId: { $in: zoneIds } });
    console.log(`   📊 Found ${routesCount} routes to delete`);
    const routesResult = await Route.deleteMany({ zoneId: { $in: zoneIds } });
    console.log(`   ✅ Deleted ${routesResult.deletedCount} routes\n`);

    // Delete AgentZoneAssignments
    const assignmentsCount = await AgentZoneAssignment.countDocuments({ zoneId: { $in: zoneIds } });
    console.log(`   📊 Found ${assignmentsCount} agent zone assignments to delete`);
    const assignmentsResult = await AgentZoneAssignment.deleteMany({ zoneId: { $in: zoneIds } });
    console.log(`   ✅ Deleted ${assignmentsResult.deletedCount} agent zone assignments\n`);

    // Delete ScheduledAssignments
    const scheduledCount = await ScheduledAssignment.countDocuments({ zoneId: { $in: zoneIds } });
    console.log(`   📊 Found ${scheduledCount} scheduled assignments to delete`);
    const scheduledResult = await ScheduledAssignment.deleteMany({ zoneId: { $in: zoneIds } });
    console.log(`   ✅ Deleted ${scheduledResult.deletedCount} scheduled assignments\n`);

    // Delete Leads
    const leadsCount = await Lead.countDocuments({ zoneId: { $in: zoneIds } });
    console.log(`   📊 Found ${leadsCount} leads to delete`);
    const leadsResult = await Lead.deleteMany({ zoneId: { $in: zoneIds } });
    console.log(`   ✅ Deleted ${leadsResult.deletedCount} leads\n`);

    // Delete Properties
    const propertiesCount = await Property.countDocuments({ zoneId: { $in: zoneIds } });
    console.log(`   📊 Found ${propertiesCount} properties to delete`);
    const propertiesResult = await Property.deleteMany({ zoneId: { $in: zoneIds } });
    console.log(`   ✅ Deleted ${propertiesResult.deletedCount} properties\n`);

    // Delete PropertyData
    const propertyDataCount = await PropertyData.countDocuments({ zoneId: { $in: zoneIds } });
    console.log(`   📊 Found ${propertyDataCount} property data records to delete`);
    const propertyDataResult = await PropertyData.deleteMany({ zoneId: { $in: zoneIds } });
    console.log(`   ✅ Deleted ${propertyDataResult.deletedCount} property data records\n`);

    // 4. Remove zone references from User model
    console.log('🔧 Cleaning up User model references...');
    const usersWithZoneRefs = await User.find({
      $or: [
        { primaryZoneId: { $in: zoneIds } },
        { zoneIds: { $in: zoneIds } }
      ]
    });
    
    for (const user of usersWithZoneRefs) {
      let updated = false;
      
      // Remove primaryZoneId if it matches
      const primaryZoneIdStr = user.primaryZoneId?.toString();
      if (primaryZoneIdStr && zoneIds.some(id => id.toString() === primaryZoneIdStr)) {
        user.primaryZoneId = null;
        updated = true;
      }
      
      // Remove zoneIds from array
      if (user.zoneIds && user.zoneIds.length > 0) {
        const originalLength = user.zoneIds.length;
        const zoneIdStrings = zoneIds.map(id => id.toString());
        user.zoneIds = user.zoneIds.filter(
          (zoneId: mongoose.Types.ObjectId) => 
            !zoneIdStrings.includes(zoneId.toString())
        );
        if (user.zoneIds.length !== originalLength) {
          updated = true;
        }
      }
      
      if (updated) {
        await user.save();
        console.log(`   ✅ Updated user: ${user.email || user.name}`);
      }
    }
    console.log(`   ✅ Cleaned up ${usersWithZoneRefs.length} user records\n`);

    // 5. Finally, delete the zones themselves
    console.log('🗑️  Deleting zones...');
    const zonesResult = await Zone.deleteMany({ _id: { $in: zoneIds } });
    console.log(`   ✅ Deleted ${zonesResult.deletedCount} zones\n`);

    // 6. Summary
    console.log('='.repeat(80));
    console.log('📊 DELETION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Agent: ${agent.name} (${agent.email})`);
    console.log(`Zones Deleted: ${zonesResult.deletedCount}`);
    console.log(`Residents Deleted: ${residentsResult.deletedCount}`);
    console.log(`Activities Deleted: ${activitiesResult.deletedCount}`);
    console.log(`Routes Deleted: ${routesResult.deletedCount}`);
    console.log(`Agent Zone Assignments Deleted: ${assignmentsResult.deletedCount}`);
    console.log(`Scheduled Assignments Deleted: ${scheduledResult.deletedCount}`);
    console.log(`Leads Deleted: ${leadsResult.deletedCount}`);
    console.log(`Properties Deleted: ${propertiesResult.deletedCount}`);
    console.log(`Property Data Records Deleted: ${propertyDataResult.deletedCount}`);
    console.log(`User Records Updated: ${usersWithZoneRefs.length}`);
    console.log('='.repeat(80));
    console.log('✅ Deletion completed successfully!');

    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

deleteAgentZones();

