const mongoose = require('mongoose');
const AgentZoneAssignment = require('./src/models/AgentZoneAssignment').AgentZoneAssignment;
const User = require('./src/models/User').User;
const Team = require('./src/models/Team').Team;

// Connect to MongoDB
mongoose.connect('mongodb+srv://username:password@cluster.mongodb.net/knockwise?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function testStatusLogic() {
  try {
    console.log('Testing status logic...');
    
    // Test 1: Check current statuses
    console.log('\n=== Current Statuses ===');
    const agent = await User.findById('68a2f320b4b725ffccf1f1fd');
    const team = await Team.findById('68a2f54fb04d2fb710ddf0a9');
    const assignments = await AgentZoneAssignment.find({
      $or: [
        { agentId: '68a2f320b4b725ffccf1f1fd' },
        { teamId: '68a2f54fb04d2fb710ddf0a9' }
      ]
    });
    
    console.log('Agent Status:', agent.status);
    console.log('Team Status:', team.status);
    console.log('Assignments:', assignments.map(a => ({ id: a._id, status: a.status, type: a.agentId ? 'individual' : 'team' })));
    
    // Test 2: Update assignment to COMPLETED
    console.log('\n=== Updating Assignment to COMPLETED ===');
    await AgentZoneAssignment.findByIdAndUpdate('68a2f586b04d2fb710ddf0e0', { status: 'COMPLETED' });
    console.log('Updated individual assignment to COMPLETED');
    
    // Test 3: Check statuses after update
    console.log('\n=== Statuses After COMPLETED Update ===');
    const updatedAgent = await User.findById('68a2f320b4b725ffccf1f1fd');
    const updatedTeam = await Team.findById('68a2f54fb04d2fb710ddf0a9');
    const updatedAssignments = await AgentZoneAssignment.find({
      $or: [
        { agentId: '68a2f320b4b725ffccf1f1fd' },
        { teamId: '68a2f54fb04d2fb710ddf0a9' }
      ]
    });
    
    console.log('Agent Status:', updatedAgent.status);
    console.log('Team Status:', updatedTeam.status);
    console.log('Assignments:', updatedAssignments.map(a => ({ id: a._id, status: a.status, type: a.agentId ? 'individual' : 'team' })));
    
    // Test 4: Update assignment back to ACTIVE
    console.log('\n=== Updating Assignment back to ACTIVE ===');
    await AgentZoneAssignment.findByIdAndUpdate('68a2f586b04d2fb710ddf0e0', { status: 'ACTIVE' });
    console.log('Updated individual assignment back to ACTIVE');
    
    // Test 5: Final status check
    console.log('\n=== Final Statuses ===');
    const finalAgent = await User.findById('68a2f320b4b725ffccf1f1fd');
    const finalTeam = await Team.findById('68a2f54fb04d2fb710ddf0a9');
    const finalAssignments = await AgentZoneAssignment.find({
      $or: [
        { agentId: '68a2f320b4b725ffccf1f1fd' },
        { teamId: '68a2f54fb04d2fb710ddf0a9' }
      ]
    });
    
    console.log('Agent Status:', finalAgent.status);
    console.log('Team Status:', finalTeam.status);
    console.log('Assignments:', finalAssignments.map(a => ({ id: a._id, status: a.status, type: a.agentId ? 'individual' : 'team' })));
    
    console.log('\n=== Test Complete ===');
    
  } catch (error) {
    console.error('Error testing status logic:', error);
  } finally {
    mongoose.connection.close();
  }
}

testStatusLogic();
