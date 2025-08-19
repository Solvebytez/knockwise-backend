const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Team = require('./dist/models/Team').default;
const AgentZoneAssignment = require('./dist/models/AgentZoneAssignment').default;
const ScheduledAssignment = require('./dist/models/ScheduledAssignment').default;

// Helper function to update team status (copied from controller)
const updateTeamStatus = async (teamId) => {
  try {
    const team = await Team.findById(teamId);
    if (!team) return;

    console.log(`\nChecking team: ${team.name} (${teamId})`);
    console.log(`Current status: ${team.status}`);

    // Check if team has any zone assignments (exclude COMPLETED and CANCELLED)
    const teamZoneAssignments = await AgentZoneAssignment.find({
      teamId: teamId,
      status: { $nin: ['COMPLETED', 'CANCELLED'] },
      effectiveTo: null
    });

    console.log(`Active zone assignments: ${teamZoneAssignments.length}`);

    // Check if team has any PENDING scheduled assignments
    const scheduledAssignments = await ScheduledAssignment.find({
      teamId: teamId,
      status: 'PENDING'
    });

    console.log(`Pending scheduled assignments: ${scheduledAssignments.length}`);

    // Team is ACTIVE if it has any zone assignments (active or scheduled)
    const hasZoneAssignment = teamZoneAssignments.length > 0 || scheduledAssignments.length > 0;
    const newStatus = hasZoneAssignment ? 'ACTIVE' : 'INACTIVE';
    
    console.log(`Has zone assignment: ${hasZoneAssignment}`);
    console.log(`New status should be: ${newStatus}`);
    
    if (newStatus !== team.status) {
      await Team.findByIdAndUpdate(teamId, { status: newStatus });
      console.log(`✅ Team ${team.name} (${teamId}) status updated to ${newStatus}`);
    } else {
      console.log(`✅ Team ${team.name} (${teamId}) status is already correct: ${team.status}`);
    }
  } catch (error) {
    console.error('❌ Error updating team status:', error);
  }
};

async function testUpdateTeamStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    console.log('\n=== TESTING UPDATE TEAM STATUS ===\n');

    // Get the team
    const team = await Team.findOne({ name: 'Parent for Member 1' });
    if (!team) {
      console.log('Team not found');
      return;
    }

    console.log(`Testing team: ${team.name} (${team._id})`);
    console.log(`Current status: ${team.status}`);
    console.log(`Current assignment status: ${team.assignmentStatus}`);

    // Test the updateTeamStatus function
    await updateTeamStatus(team._id.toString());

    // Check final state
    const finalTeam = await Team.findById(team._id);
    console.log(`\nFinal team status: ${finalTeam.status}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

testUpdateTeamStatus();
