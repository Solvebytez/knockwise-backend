const mongoose = require('mongoose');

// Connect to the database using the same connection string as the server
mongoose.connect('mongodb+srv://username:password@cluster.mongodb.net/knockwise?retryWrites=true&w=majority')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Import the AgentZoneAssignment model
    const AgentZoneAssignment = require('./src/models/AgentZoneAssignment').default;
    
    // Check assignments for Sahin Hossain (agent ID: 68a300d2b6cde58ebfc6b566)
    const assignments = await AgentZoneAssignment.find({
      agentId: '68a300d2b6cde58ebfc6b566'
    }).populate('zoneId', 'name');
    
    console.log('Assignments for Sahin Hossain:');
    console.log(JSON.stringify(assignments, null, 2));
    
    // Also check all assignments to see what's in the database
    const allAssignments = await AgentZoneAssignment.find({}).populate('zoneId', 'name').populate('agentId', 'name');
    console.log('\nAll assignments in database:');
    console.log(JSON.stringify(allAssignments, null, 2));
    
    mongoose.connection.close();
  })
  .catch(console.error);
