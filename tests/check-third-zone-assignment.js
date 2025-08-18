const axios = require('axios');

async function checkThirdZoneAssignment() {
  try {
    // First, let's login to get an access token
    console.log('Logging in to get access token...');
    const loginResponse = await axios.post('http://localhost:4000/api/auth/login', {
      email: 'subadmin@knockwise.io',
      password: 'Admin@12345'
    });
    
    const accessToken = loginResponse.data.data.accessToken;
    console.log('Login successful, got access token');
    
    // Check all assignments for the agent
    console.log('Checking all assignments for ashvaksheik...');
    const agentId = '68a300ffb6cde58ebfc6b58b'; // ashvaksheik
    
    // Get all assignments for this agent
    const assignmentsResponse = await axios.get(`http://localhost:4000/api/assignments?agentId=${agentId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    console.log('All assignments for ashvaksheik:');
    console.log(JSON.stringify(assignmentsResponse.data, null, 2));
    
    // Check current agent data
    console.log('Checking current agent data...');
    const agentsResponse = await axios.get('http://localhost:4000/api/users/my-created-agents', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    const ashvaksheik = agentsResponse.data.data.find(agent => agent._id === agentId);
    if (ashvaksheik) {
      console.log('Current ashvaksheik data:');
      console.log('Name:', ashvaksheik.name);
      console.log('Primary Zone ID:', ashvaksheik.primaryZoneId?._id);
      console.log('Zone IDs:', ashvaksheik.zoneIds);
      console.log('All Assigned Zones:', ashvaksheik.allAssignedZones);
      console.log('Status:', ashvaksheik.status);
    }
    
    // Check all zones to see what the third zone ID is
    console.log('Checking all zones...');
    const zonesResponse = await axios.get('http://localhost:4000/api/zones/list', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    console.log('All zones:');
    console.log(JSON.stringify(zonesResponse.data.data, null, 2));
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

checkThirdZoneAssignment();
