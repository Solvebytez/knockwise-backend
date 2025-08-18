const mongoose = require('mongoose');
const axios = require('axios');

// Connect to the database using the same connection string as the server
mongoose.connect('mongodb+srv://username:password@cluster.mongodb.net/knockwise?retryWrites=true&w=majority')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    try {
      // First, let's login to get an access token
      console.log('Logging in to get access token...');
      const loginResponse = await axios.post('http://localhost:4000/api/auth/login', {
        email: 'subadmin@knockwise.io',
        password: 'Admin@12345'
      });
      
      const accessToken = loginResponse.data.data.accessToken;
      console.log('Login successful, got access token');
      
      // Sahin Hossain's agent ID
      const agentId = '68a300d2b6cde58ebfc6b566';
      
      // Zone IDs from the database
      const zone1Id = '68a30f982dec5aa7ce11cf92'; // "individual zone"
      const zone2Id = '68a3144baabef17a073a2aec'; // "2nd zone to indizidual"
      
      console.log('Creating assignments for both zones...');
      
      // Create assignment for first zone
      console.log('Creating assignment for zone 1...');
      const assignment1Response = await axios.post('http://localhost:4000/api/assignments/create', {
        agentId: agentId,
        zoneId: zone1Id,
        effectiveFrom: new Date().toISOString(),
        status: 'ACTIVE'
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Zone 1 assignment response:', assignment1Response.data);
      
      // Create assignment for second zone
      console.log('Creating assignment for zone 2...');
      const assignment2Response = await axios.post('http://localhost:4000/api/assignments/create', {
        agentId: agentId,
        zoneId: zone2Id,
        effectiveFrom: new Date().toISOString(),
        status: 'ACTIVE'
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Zone 2 assignment response:', assignment2Response.data);
      
      // Update the User model to reflect both zones
      console.log('Updating User model with both zones...');
      const updateUserResponse = await axios.put(`http://localhost:4000/api/users/update-agent-zone/${agentId}`, {
        primaryZoneId: zone2Id, // Set the second zone as primary (latest)
        zoneIds: [zone1Id, zone2Id] // Include both zones
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('User update response:', updateUserResponse.data);
      
      // Verify the assignments were created
      console.log('Verifying assignments...');
      const AgentZoneAssignment = require('./src/models/AgentZoneAssignment').default;
      const assignments = await AgentZoneAssignment.find({
        agentId: agentId
      }).populate('zoneId', 'name');
      
      console.log('Current assignments for Sahin Hossain:');
      console.log(JSON.stringify(assignments, null, 2));
      
      // Verify the User model was updated
      const User = require('./src/models/User').default;
      const user = await User.findById(agentId).select('name primaryZoneId zoneIds');
      
      console.log('Updated user data:');
      console.log(JSON.stringify(user, null, 2));
      
      console.log('✅ Zone assignments completed successfully!');
      
    } catch (error) {
      console.error('Error:', error.response?.data || error.message);
    }
    
    mongoose.connection.close();
  })
  .catch(console.error);
