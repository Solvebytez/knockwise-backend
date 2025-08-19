const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('./dist/models/User').default;
const Team = require('./dist/models/Team').default;
const Zone = require('./dist/models/Zone').default;
const AgentZoneAssignment = require('./dist/models/AgentZoneAssignment').default;
const ScheduledAssignment = require('./dist/models/ScheduledAssignment').default;

async function checkTeamAssignmentStatus() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    console.log('\n=== CHECKING TEAM ASSIGNMENT STATUS ===\n');

    // 1. Check all teams and their assignment status
    console.log('1. TEAMS AND THEIR ASSIGNMENT STATUS:');
    const teams = await Team.find({}).populate('agentIds', 'name email assignmentStatus');
    
    for (const team of teams) {
      console.log(`\nTeam: ${team.name} (${team._id})`);
      console.log(`  Status: ${team.status}`);
      console.log(`  Assignment Status: ${team.assignmentStatus}`);
      console.log(`  Agent Count: ${team.agentIds?.length || 0}`);
      
      if (team.agentIds && team.agentIds.length > 0) {
        console.log('  Team Members:');
        team.agentIds.forEach(agent => {
          console.log(`    - ${agent.name} (${agent.email}) - Assignment Status: ${agent.assignmentStatus}`);
        });
      }
    }

    // 2. Check all zones and their assignments
    console.log('\n\n2. ZONES AND THEIR ASSIGNMENTS:');
    const zones = await Zone.find({});
    
    for (const zone of zones) {
      console.log(`\nZone: ${zone.name} (${zone._id})`);
      console.log(`  Status: ${zone.status}`);
      console.log(`  Team ID: ${zone.teamId || 'None'}`);
      console.log(`  Assigned Agent ID: ${zone.assignedAgentId || 'None'}`);
    }

    // 3. Check all AgentZoneAssignment records
    console.log('\n\n3. AGENT ZONE ASSIGNMENTS:');
    const agentZoneAssignments = await AgentZoneAssignment.find({}).populate('agentId', 'name email');
    
    if (agentZoneAssignments.length === 0) {
      console.log('  No AgentZoneAssignment records found');
    } else {
      for (const assignment of agentZoneAssignments) {
        console.log(`\n  Agent: ${assignment.agentId?.name || assignment.agentId} (${assignment.agentId?._id || assignment.agentId})`);
        console.log(`    Zone ID: ${assignment.zoneId}`);
        console.log(`    Team ID: ${assignment.teamId || 'None'}`);
        console.log(`    Status: ${assignment.status}`);
        console.log(`    Effective From: ${assignment.effectiveFrom}`);
      }
    }

    // 4. Check all ScheduledAssignment records
    console.log('\n\n4. SCHEDULED ASSIGNMENTS:');
    const scheduledAssignments = await ScheduledAssignment.find({});
    
    if (scheduledAssignments.length === 0) {
      console.log('  No ScheduledAssignment records found');
    } else {
      for (const assignment of scheduledAssignments) {
        console.log(`\n  Zone ID: ${assignment.zoneId}`);
        console.log(`    Team ID: ${assignment.teamId || 'None'}`);
        console.log(`    Agent ID: ${assignment.agentId || 'None'}`);
        console.log(`    Status: ${assignment.status}`);
        console.log(`    Scheduled Date: ${assignment.scheduledDate}`);
        console.log(`    Effective From: ${assignment.effectiveFrom}`);
      }
    }

    // 5. Check for orphaned assignments (assignments to non-existent zones)
    console.log('\n\n5. CHECKING FOR ORPHANED ASSIGNMENTS:');
    const zoneIds = zones.map(z => z._id.toString());
    
    const orphanedAgentAssignments = agentZoneAssignments.filter(
      assignment => !zoneIds.includes(assignment.zoneId.toString())
    );
    
    const orphanedScheduledAssignments = scheduledAssignments.filter(
      assignment => !zoneIds.includes(assignment.zoneId.toString())
    );
    
    if (orphanedAgentAssignments.length > 0) {
      console.log(`  Found ${orphanedAgentAssignments.length} orphaned AgentZoneAssignment records:`);
      orphanedAgentAssignments.forEach(assignment => {
        console.log(`    - Agent: ${assignment.agentId} -> Zone: ${assignment.zoneId} (zone doesn't exist)`);
      });
    } else {
      console.log('  No orphaned AgentZoneAssignment records found');
    }
    
    if (orphanedScheduledAssignments.length > 0) {
      console.log(`  Found ${orphanedScheduledAssignments.length} orphaned ScheduledAssignment records:`);
      orphanedScheduledAssignments.forEach(assignment => {
        console.log(`    - Zone: ${assignment.zoneId} (zone doesn't exist)`);
      });
    } else {
      console.log('  No orphaned ScheduledAssignment records found');
    }

    // 6. Check team assignment status logic
    console.log('\n\n6. TEAM ASSIGNMENT STATUS ANALYSIS:');
    for (const team of teams) {
      console.log(`\nTeam: ${team.name}`);
      
      // Check if team has any active zone assignments
      const teamZoneAssignments = agentZoneAssignments.filter(
        assignment => assignment.teamId?.toString() === team._id.toString() && assignment.status === 'ACTIVE'
      );
      
      // Check if team has any pending scheduled assignments
      const teamScheduledAssignments = scheduledAssignments.filter(
        assignment => assignment.teamId?.toString() === team._id.toString() && assignment.status === 'PENDING'
      );
      
      console.log(`  Active Zone Assignments: ${teamZoneAssignments.length}`);
      console.log(`  Pending Scheduled Assignments: ${teamScheduledAssignments.length}`);
      
      const shouldBeAssigned = teamZoneAssignments.length > 0 || teamScheduledAssignments.length > 0;
      console.log(`  Should be ASSIGNED: ${shouldBeAssigned}`);
      console.log(`  Current assignmentStatus: ${team.assignmentStatus}`);
      console.log(`  Status matches logic: ${(shouldBeAssigned && team.assignmentStatus === 'ASSIGNED') || (!shouldBeAssigned && team.assignmentStatus === 'UNASSIGNED')}`);
    }

    console.log('\n=== END OF ANALYSIS ===\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

checkTeamAssignmentStatus();
