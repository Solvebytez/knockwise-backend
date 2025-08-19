const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('./dist/models/User').default;
const Team = require('./dist/models/Team').default;
const Zone = require('./dist/models/Zone').default;
const AgentZoneAssignment = require('./dist/models/AgentZoneAssignment').default;
const ScheduledAssignment = require('./dist/models/ScheduledAssignment').default;

// Helper function to update team status (copied from controller)
const updateTeamStatus = async (teamId) => {
  try {
    const team = await Team.findById(teamId);
    if (!team) return;

    // Check if team has any zone assignments (exclude COMPLETED and CANCELLED)
    const teamZoneAssignments = await AgentZoneAssignment.find({
      teamId: teamId,
      status: { $nin: ['COMPLETED', 'CANCELLED'] },
      effectiveTo: null
    });

    // Check if team has any PENDING scheduled assignments
    const scheduledAssignments = await ScheduledAssignment.find({
      teamId: teamId,
      status: 'PENDING'
    });

    // Team is ACTIVE if it has any zone assignments (active or scheduled)
    const hasZoneAssignment = teamZoneAssignments.length > 0 || scheduledAssignments.length > 0;
    const newStatus = hasZoneAssignment ? 'ACTIVE' : 'INACTIVE';
    
    if (newStatus !== team.status) {
      await Team.findByIdAndUpdate(teamId, { status: newStatus });
      console.log(`Team ${team.name} (${teamId}) status updated to ${newStatus}`);
    } else {
      console.log(`Team ${team.name} (${teamId}) status is already correct: ${team.status}`);
    }
  } catch (error) {
    console.error('Error updating team status:', error);
  }
};

// Helper function to update team assignment status (copied from controller)
const updateTeamAssignmentStatus = async (teamId) => {
  try {
    const team = await Team.findById(teamId);
    if (!team) return;

    // Check if team has any active zone assignments (exclude COMPLETED and CANCELLED)
    const activeZoneAssignments = await AgentZoneAssignment.find({
      teamId: teamId,
      status: { $nin: ['COMPLETED', 'CANCELLED'] },
      effectiveTo: null
    });

    // Check if team has any PENDING scheduled assignments
    const scheduledAssignments = await ScheduledAssignment.find({
      teamId: teamId,
      status: 'PENDING'
    });

    // Team is ASSIGNED if it has any zone assignments (active or scheduled)
    const hasZoneAssignment = activeZoneAssignments.length > 0 || scheduledAssignments.length > 0;
    const newAssignmentStatus = hasZoneAssignment ? 'ASSIGNED' : 'UNASSIGNED';

    if (newAssignmentStatus !== team.assignmentStatus) {
      await Team.findByIdAndUpdate(teamId, { assignmentStatus: newAssignmentStatus });
      console.log(`Team ${team.name} (${teamId}) assignment status updated to ${newAssignmentStatus}`);
    } else {
      console.log(`Team ${team.name} (${teamId}) assignment status is already correct: ${team.assignmentStatus}`);
    }
  } catch (error) {
    console.error('Error updating team assignment status:', error);
  }
};

async function executeControllerFix() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    console.log('\n=== EXECUTING CONTROLLER FIX ===\n');

    // 1. Check current state
    console.log('1. CURRENT STATE:');
    const teams = await Team.find({});
    for (const team of teams) {
      console.log(`\nTeam: ${team.name} (${team._id})`);
      console.log(`  Status: ${team.status}`);
      console.log(`  Assignment Status: ${team.assignmentStatus}`);
    }

    // 2. Check assignments
    console.log('\n2. ASSIGNMENTS:');
    const agentZoneAssignments = await AgentZoneAssignment.find({});
    const scheduledAssignments = await ScheduledAssignment.find({});
    
    console.log(`AgentZoneAssignment records: ${agentZoneAssignments.length}`);
    console.log(`ScheduledAssignment records: ${scheduledAssignments.length}`);

    // 3. Execute the controller logic (same as createZone controller)
    console.log('\n3. EXECUTING CONTROLLER LOGIC:');
    
    for (const team of teams) {
      console.log(`\nProcessing team: ${team.name} (${team._id})`);
      
      // Execute the same logic as in createZone controller
      await updateTeamAssignmentStatus(team._id.toString());
      await updateTeamStatus(team._id.toString());
    }

    // 4. Check final state
    console.log('\n4. FINAL STATE:');
    const finalTeams = await Team.find({});
    for (const team of finalTeams) {
      console.log(`\nTeam: ${team.name} (${team._id})`);
      console.log(`  Status: ${team.status}`);
      console.log(`  Assignment Status: ${team.assignmentStatus}`);
    }

    console.log('\n=== END OF CONTROLLER FIX ===\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

executeControllerFix();
