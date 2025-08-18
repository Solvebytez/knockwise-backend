const axios = require('axios');

async function assignZonesToTeam() {
  try {
    // First, let's login to get an access token
    console.log('Logging in to get access token...');
    const loginResponse = await axios.post('http://localhost:4000/api/auth/login', {
      email: 'subadmin@knockwise.io',
      password: 'Admin@12345'
    });
    
    const accessToken = loginResponse.data.data.accessToken;
    console.log('Login successful, got access token');
    
    // Team ID
    const teamId = '68a30121b6cde58ebfc6b5c2'; // "first team"
    
    // Zone IDs from the database
    const zone1Id = '68a30f982dec5aa7ce11cf92'; // "individual zone"
    const zone2Id = '68a3144baabef17a073a2aec'; // "2nd zone to indizidual"
    
    console.log('Creating team assignments for both zones...');
    
    // Create team assignment for first zone
    console.log('Creating team assignment for zone 1...');
    const assignment1Response = await axios.post('http://localhost:4000/api/assignments/create', {
      teamId: teamId,
      zoneId: zone1Id,
      effectiveFrom: new Date().toISOString(),
      status: 'ACTIVE'
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Zone 1 team assignment response:', assignment1Response.data);
    
    // Create team assignment for second zone
    console.log('Creating team assignment for zone 2...');
    const assignment2Response = await axios.post('http://localhost:4000/api/assignments/create', {
      teamId: teamId,
      zoneId: zone2Id,
      effectiveFrom: new Date().toISOString(),
      status: 'ACTIVE'
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Zone 2 team assignment response:', assignment2Response.data);
    
    // Verify the team assignments by checking team members
    console.log('Verifying team assignments...');
    const agentsResponse = await axios.get('http://localhost:4000/api/users/my-created-agents', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    // Check team members (author and ashvaksheik)
    const teamMembers = agentsResponse.data.data.filter(agent => 
      agent.primaryTeamId?._id === teamId
    );
    
    console.log('Team members after zone assignment:');
    teamMembers.forEach(member => {
      console.log(`\n${member.name}:`);
      console.log('  Primary Zone ID:', member.primaryZoneId?._id);
      console.log('  Zone IDs:', member.zoneIds);
      console.log('  All Assigned Zones:', member.allAssignedZones);
      console.log('  Team Zone Info:', member.teamZoneInfo);
      console.log('  Status:', member.status);
    });
    
    // Check team status
    console.log('\nChecking team status...');
    const teamsResponse = await axios.get('http://localhost:4000/api/teams', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    const team = teamsResponse.data.data.find(t => t._id === teamId);
    if (team) {
      console.log('Team status:', team.status);
    }
    
    console.log('✅ Team zone assignments completed successfully!');
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

assignZonesToTeam();
