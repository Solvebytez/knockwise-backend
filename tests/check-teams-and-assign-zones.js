const axios = require('axios');

async function checkTeamsAndAssignZones() {
  try {
    // First, let's login to get an access token
    console.log('Logging in to get access token...');
    const loginResponse = await axios.post('http://localhost:4000/api/auth/login', {
      email: 'subadmin@knockwise.io',
      password: 'Admin@12345'
    });
    
    const accessToken = loginResponse.data.data.accessToken;
    console.log('Login successful, got access token');
    
    // Check existing teams
    console.log('Checking existing teams...');
    const teamsResponse = await axios.get('http://localhost:4000/api/teams', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    console.log('Existing teams:');
    console.log(JSON.stringify(teamsResponse.data.data, null, 2));
    
    // Check existing zones
    console.log('Checking existing zones...');
    const zonesResponse = await axios.get('http://localhost:4000/api/zones', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    console.log('Existing zones:');
    console.log(JSON.stringify(zonesResponse.data.data, null, 2));
    
    // Get team members
    console.log('Checking team members...');
    const agentsResponse = await axios.get('http://localhost:4000/api/users/my-created-agents', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    console.log('Team members:');
    console.log(JSON.stringify(agentsResponse.data.data, null, 2));
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

checkTeamsAndAssignZones();
