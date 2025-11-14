/**
 * Diagnostic script to check agent zones and assignments
 * Run with: ts-node -r dotenv/config check-agent-zones.ts
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import User from './src/models/User';
import Zone from './src/models/Zone';
import { AgentZoneAssignment } from './src/models/AgentZoneAssignment';
import { ScheduledAssignment } from './src/models/ScheduledAssignment';
import { connectDatabase } from './src/config/database';

async function checkAgentZones() {
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
    console.log(`   Email: ${agent.email}`);
    console.log(`   Role: ${agent.role}`);
    console.log(`   Zone IDs in user: ${agent.zoneIds?.length || 0}\n`);

    // 2. Find zones created by this agent
    console.log('🔍 Finding zones created by this agent...');
    const zonesCreatedByAgent = await Zone.find({ createdBy: agent._id });
    console.log(`✅ Found ${zonesCreatedByAgent.length} zones created by agent\n`);

    // 3. Find zones assigned to this agent
    console.log('🔍 Finding zones assigned to this agent...');
    const zonesAssignedToAgent = await Zone.find({ assignedAgentId: agent._id });
    console.log(`✅ Found ${zonesAssignedToAgent.length} zones assigned to agent\n`);

    // 4. Find all zones (created OR assigned)
    const allZoneIds = new Set<string>();
    zonesCreatedByAgent.forEach(z => allZoneIds.add((z._id as mongoose.Types.ObjectId).toString()));
    zonesAssignedToAgent.forEach(z => allZoneIds.add((z._id as mongoose.Types.ObjectId).toString()));
    
    console.log(`📊 Total unique zones: ${allZoneIds.size}\n`);

    // 5. Check AgentZoneAssignment records for each zone
    console.log('🔍 Checking AgentZoneAssignment records...\n');
    
    const zoneDetails: Array<{
      zoneId: string;
      zoneName: string;
      zoneStatus: string;
      createdBy: string;
      assignedAgentId: string;
      totalAssignments: number;
      activeAssignments: number;
      assignments: Array<{
        _id: string;
        status: string;
        effectiveFrom: Date | null;
        effectiveTo: Date | null;
        agentId: string;
        matchesAgent: string;
      }>;
    }> = [];
    
    for (const zoneId of allZoneIds) {
      const zone = await Zone.findById(zoneId);
      if (!zone) continue;

      const assignments = await AgentZoneAssignment.find({
        zoneId: zone._id,
        agentId: agent._id,
      });

      const activeAssignments = assignments.filter(a => 
        (a.status === 'ACTIVE' || a.status === 'INACTIVE') && 
        a.effectiveTo === null
      );

      zoneDetails.push({
        zoneId: (zone._id as mongoose.Types.ObjectId).toString(),
        zoneName: zone.name,
        zoneStatus: zone.status || 'UNKNOWN',
        createdBy: zone.createdBy?.toString() === (agent._id as mongoose.Types.ObjectId).toString() ? 'YES' : 'NO',
        assignedAgentId: zone.assignedAgentId?.toString() === (agent._id as mongoose.Types.ObjectId).toString() ? 'YES' : 'NO',
        totalAssignments: assignments.length,
        activeAssignments: activeAssignments.length,
        assignments: assignments.map(a => ({
          _id: (a._id as mongoose.Types.ObjectId).toString(),
          status: a.status,
          effectiveFrom: a.effectiveFrom,
          effectiveTo: a.effectiveTo ?? null,
          agentId: a.agentId ? (a.agentId as mongoose.Types.ObjectId).toString() : 'N/A',
          matchesAgent: a.agentId && (a.agentId as mongoose.Types.ObjectId).toString() === (agent._id as mongoose.Types.ObjectId).toString() ? 'YES' : 'NO',
        })),
      });
    }

    // 6. Display results
    console.log('='.repeat(80));
    console.log('📋 ZONE AND ASSIGNMENT ANALYSIS');
    console.log('='.repeat(80));
    console.log();

    zoneDetails.forEach((detail, index) => {
      console.log(`Zone ${index + 1}: ${detail.zoneName}`);
      console.log(`  Zone ID: ${detail.zoneId}`);
      console.log(`  Zone Status: ${detail.zoneStatus}`);
      console.log(`  Created by Agent: ${detail.createdBy}`);
      console.log(`  Assigned to Agent: ${detail.assignedAgentId}`);
      console.log(`  Total Assignments: ${detail.totalAssignments}`);
      console.log(`  Active Assignments (ACTIVE/INACTIVE, effectiveTo=null): ${detail.activeAssignments}`);
      
      if (detail.assignments.length > 0) {
        console.log(`  Assignment Details:`);
        detail.assignments.forEach((assignment, idx) => {
          console.log(`    Assignment ${idx + 1}:`);
          console.log(`      ID: ${assignment._id}`);
          console.log(`      Status: ${assignment.status}`);
          console.log(`      Agent ID Match: ${assignment.matchesAgent}`);
          console.log(`      Effective From: ${assignment.effectiveFrom}`);
          console.log(`      Effective To: ${assignment.effectiveTo || 'null'}`);
        });
      } else {
        console.log(`  ⚠️  NO ASSIGNMENT RECORDS FOUND!`);
      }
      console.log();
    });

    // 7. Check Today's Tasks query conditions
    console.log('='.repeat(80));
    console.log('🔍 CHECKING "TODAY\'S TASKS" QUERY CONDITIONS');
    console.log('='.repeat(80));
    console.log();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Query that matches getAgentDashboardStats
    const activeTerritories = await AgentZoneAssignment.find({
      $or: [
        { agentId: agent._id as mongoose.Types.ObjectId },
        { teamId: { $in: agent.teamIds || [] } },
      ],
      status: { $in: ["ACTIVE", "INACTIVE"] },
      effectiveTo: null,
    }).populate("zoneId", "_id");

    const scheduledTerritoriesToday = await ScheduledAssignment.find({
      $or: [
        { agentId: agent._id as mongoose.Types.ObjectId },
        { teamId: { $in: agent.teamIds || [] } },
      ],
      scheduledDate: {
        $gte: today,
        $lt: tomorrow,
      },
      status: "PENDING",
    }).populate("zoneId", "_id");

    console.log(`Active/Inactive Assignments (effectiveTo=null): ${activeTerritories.length}`);
    activeTerritories.forEach((assignment, idx) => {
      console.log(`  ${idx + 1}. Zone ID: ${assignment.zoneId?._id || 'N/A'}, Status: ${assignment.status}`);
    });
    console.log();

    console.log(`Scheduled Assignments for Today: ${scheduledTerritoriesToday.length}`);
    scheduledTerritoriesToday.forEach((assignment, idx) => {
      console.log(`  ${idx + 1}. Zone ID: ${assignment.zoneId?._id || 'N/A'}, Status: ${assignment.status}`);
    });
    console.log();

    // Deduplicate territories (same logic as backend)
    const territoryMap = new Map();
    [...activeTerritories, ...scheduledTerritoriesToday].forEach((item) => {
      const zoneId = item.zoneId?._id?.toString();
      if (zoneId && !territoryMap.has(zoneId)) {
        territoryMap.set(zoneId, item.zoneId);
      }
    });

    console.log(`📊 Today's Tasks Count: ${territoryMap.size}`);
    console.log(`   (Unique zones from active + scheduled assignments)`);
    console.log();

    // 8. Summary
    console.log('='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Agent: ${agent.name} (${agent.email})`);
    console.log(`Zones Created: ${zonesCreatedByAgent.length}`);
    console.log(`Zones Assigned: ${zonesAssignedToAgent.length}`);
    console.log(`Total Unique Zones: ${allZoneIds.size}`);
    console.log(`Zones with Active Assignments: ${zoneDetails.filter(d => d.activeAssignments > 0).length}`);
    console.log(`Zones WITHOUT Assignments: ${zoneDetails.filter(d => d.totalAssignments === 0).length}`);
    console.log(`Today's Tasks (from query): ${territoryMap.size}`);
    console.log();

    // 9. Issues found
    const zonesWithoutAssignments = zoneDetails.filter(d => d.totalAssignments === 0);
    if (zonesWithoutAssignments.length > 0) {
      console.log('⚠️  ISSUES FOUND:');
      console.log(`   ${zonesWithoutAssignments.length} zone(s) have NO AgentZoneAssignment records:`);
      zonesWithoutAssignments.forEach(z => {
        console.log(`     - ${z.zoneName} (${z.zoneId})`);
      });
      console.log();
      console.log('💡 SOLUTION: These zones need AgentZoneAssignment records created.');
    } else {
      console.log('✅ All zones have assignment records!');
    }

    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkAgentZones();

