const mongoose = require('mongoose');
const { AgentZoneAssignment } = require('./src/models/AgentZoneAssignment');
const { User } = require('./src/models/User');
const { Team } = require('./src/models/Team');

// Connect to MongoDB
mongoose.connect('mongodb+srv://username:password@cluster.mongodb.net/knockwise?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function testCompletedStatus() {
  try {
    console.log('Testing COMPLETED status logic...');
    
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
    console.log('Assignments:', assignments.map(a => ({ 
      id: a._id, 
      status: a.status, 
      type: a.agentId ? 'individual' : 'team',
      effectiveTo: a.effectiveTo 
    })));
    
    // Test 2: Update individual assignment to COMPLETED
    console.log('\n=== Updating Individual Assignment to COMPLETED ===');
    await AgentZoneAssignment.findByIdAndUpdate('68a2f586b04d2fb710ddf0e0', { 
      status: 'COMPLETED',
      effectiveTo: new Date()
    });
    console.log('Updated individual assignment to COMPLETED');
    
    // Test 3: Check statuses after COMPLETED update
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
    console.log('Assignments:', updatedAssignments.map(a => ({ 
      id: a._id, 
      status: a.status, 
      type: a.agentId ? 'individual' : 'team',
      effectiveTo: a.effectiveTo 
    })));
    
    // Test 4: Update assignment to CANCELLED
    console.log('\n=== Updating Assignment to CANCELLED ===');
    await AgentZoneAssignment.findByIdAndUpdate('68a2f586b04d2fb710ddf0e0', { 
      status: 'CANCELLED',
      effectiveTo: new Date()
    });
    console.log('Updated assignment to CANCELLED');
    
    // Test 5: Check statuses after CANCELLED update
    console.log('\n=== Statuses After CANCELLED Update ===');
    const cancelledAgent = await User.findById('68a2f320b4b725ffccf1f1fd');
    const cancelledTeam = await Team.findById('68a2f54fb04d2fb710ddf0a9');
    const cancelledAssignments = await AgentZoneAssignment.find({
      $or: [
        { agentId: '68a2f320b4b725ffccf1f1fd' },
        { teamId: '68a2f54fb04d2fb710ddf0a9' }
      ]
    });
    
    console.log('Agent Status:', cancelledAgent.status);
    console.log('Team Status:', cancelledTeam.status);
    console.log('Assignments:', cancelledAssignments.map(a => ({ 
      id: a._id, 
      status: a.status, 
      type: a.agentId ? 'individual' : 'team',
      effectiveTo: a.effectiveTo 
    })));
    
    // Test 6: Update assignment back to ACTIVE
    console.log('\n=== Updating Assignment back to ACTIVE ===');
    await AgentZoneAssignment.findByIdAndUpdate('68a2f586b04d2fb710ddf0e0', { 
      status: 'ACTIVE',
      effectiveTo: null
    });
    console.log('Updated assignment back to ACTIVE');
    
    // Test 7: Final status check
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
    console.log('Assignments:', finalAssignments.map(a => ({ 
      id: a._id, 
      status: a.status, 
      type: a.agentId ? 'individual' : 'team',
      effectiveTo: a.effectiveTo 
    })));
    
    console.log('\n=== Test Complete ===');
    console.log('\nExpected Behavior:');
    console.log('- When assignment is ACTIVE: Agent should be ACTIVE');
    console.log('- When assignment is COMPLETED: Agent should be INACTIVE');
    console.log('- When assignment is CANCELLED: Agent should be INACTIVE');
    
  } catch (error) {
    console.error('Error testing completed status logic:', error);
  } finally {
    mongoose.connection.close();
  }
}

testCompletedStatus();
