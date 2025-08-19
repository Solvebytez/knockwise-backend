const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('./dist/models/User').default;
const Team = require('./dist/models/Team').default;
const Zone = require('./dist/models/Zone').default;
const AgentZoneAssignment = require('./dist/models/AgentZoneAssignment').default;
const ScheduledAssignment = require('./dist/models/ScheduledAssignment').default;

async function checkNewZoneData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    console.log('\n=== CHECKING DATA AFTER NEW ZONE CREATION ===\n');

    // 1. Check all zones
    console.log('1. ZONES:');
    const zones = await Zone.find({}).sort({ createdAt: -1 });
    
    for (const zone of zones) {
      console.log(`\nZone: ${zone.name} (${zone._id})`);
      console.log(`  Status: ${zone.status}`);
      console.log(`  Team ID: ${zone.teamId || 'None'}`);
      console.log(`  Assigned Agent ID: ${zone.assignedAgentId || 'None'}`);
      console.log(`  Created At: ${zone.createdAt}`);
      console.log(`  Created By: ${zone.createdBy}`);
    }

    // 2. Check all teams and their assignment status
    console.log('\n\n2. TEAMS AND THEIR ASSIGNMENT STATUS:');
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

    // 3. Check all users and their assignment status
    console.log('\n\n3. USERS AND THEIR ASSIGNMENT STATUS:');
    const users = await User.find({ role: 'AGENT' }).sort({ createdAt: -1 });
    
    for (const user of users) {
      console.log(`\nUser: ${user.name} (${user.email}) - ${user._id}`);
      console.log(`  Status: ${user.status}`);
      console.log(`  Assignment Status: ${user.assignmentStatus}`);
      console.log(`  Primary Zone ID: ${user.primaryZoneId || 'None'}`);
      console.log(`  Zone IDs: [${user.zoneIds?.join(', ') || 'None'}]`);
      console.log(`  Team IDs: [${user.teamIds?.join(', ') || 'None'}]`);
    }

    // 4. Check all AgentZoneAssignment records
    console.log('\n\n4. AGENT ZONE ASSIGNMENTS:');
    const agentZoneAssignments = await AgentZoneAssignment.find({}).populate('agentId', 'name email').populate('teamId', 'name').populate('zoneId', 'name');
    
    if (agentZoneAssignments.length === 0) {
      console.log('  No AgentZoneAssignment records found');
    } else {
      for (const assignment of agentZoneAssignments) {
        console.log(`\n  Assignment ID: ${assignment._id}`);
        console.log(`    Agent: ${assignment.agentId?.name || assignment.agentId} (${assignment.agentId?._id || assignment.agentId})`);
        console.log(`    Team: ${assignment.teamId?.name || assignment.teamId || 'None'}`);
        console.log(`    Zone: ${assignment.zoneId?.name || assignment.zoneId} (${assignment.zoneId?._id || assignment.zoneId})`);
        console.log(`    Status: ${assignment.status}`);
        console.log(`    Effective From: ${assignment.effectiveFrom}`);
        console.log(`    Assigned By: ${assignment.assignedBy}`);
      }
    }

    // 5. Check all ScheduledAssignment records
    console.log('\n\n5. SCHEDULED ASSIGNMENTS:');
    const scheduledAssignments = await ScheduledAssignment.find({});
    
    if (scheduledAssignments.length === 0) {
      console.log('  No ScheduledAssignment records found');
    } else {
      for (const assignment of scheduledAssignments) {
        console.log(`\n  Assignment ID: ${assignment._id}`);
        console.log(`    Zone ID: ${assignment.zoneId}`);
        console.log(`    Team ID: ${assignment.teamId || 'None'}`);
        console.log(`    Agent ID: ${assignment.agentId || 'None'}`);
        console.log(`    Status: ${assignment.status}`);
        console.log(`    Scheduled Date: ${assignment.scheduledDate}`);
        console.log(`    Effective From: ${assignment.effectiveFrom}`);
        console.log(`    Assigned By: ${assignment.assignedBy}`);
      }
    }

    // 6. Check assignment status logic consistency
    console.log('\n\n6. ASSIGNMENT STATUS LOGIC CHECK:');
    
    for (const team of teams) {
      console.log(`\nTeam: ${team.name}`);
      
      // Check if team has any active zone assignments
      const teamZoneAssignments = agentZoneAssignments.filter(
        assignment => assignment.teamId?._id?.toString() === team._id.toString() && assignment.status === 'ACTIVE'
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

checkNewZoneData();
