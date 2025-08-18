const mongoose = require('mongoose');
const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:4000/api';
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';

// Test data
let authToken = '';
let testTeamId = '';
let testAgent1Id = '';
let testAgent2Id = '';
let testZoneId = '';

async function login() {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    
    authToken = response.data.data.accessToken;
    console.log('✅ Login successful');
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    throw error;
  }
}

async function createTestData() {
  try {
    // Create test agents
    const agent1Response = await axios.post(`${BASE_URL}/users/create-agent`, {
      name: 'Test Agent 1',
      email: 'agent1@test.com',
      password: 'password123'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    testAgent1Id = agent1Response.data.data._id;
    console.log('✅ Created test agent 1:', testAgent1Id);

    const agent2Response = await axios.post(`${BASE_URL}/users/create-agent`, {
      name: 'Test Agent 2',
      email: 'agent2@test.com',
      password: 'password123'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    testAgent2Id = agent2Response.data.data._id;
    console.log('✅ Created test agent 2:', testAgent2Id);

    // Create test team with agent 1
    const teamResponse = await axios.post(`${BASE_URL}/teams`, {
      name: 'Test Team for Zone Sync',
      description: 'Testing zone synchronization',
      memberIds: [testAgent1Id]
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    testTeamId = teamResponse.data.data._id;
    console.log('✅ Created test team:', testTeamId);

    // Create test zone
    const zoneResponse = await axios.post(`${BASE_URL}/zones`, {
      name: 'Test Zone for Team',
      description: 'Test zone for team assignment',
      boundary: {
        type: 'Polygon',
        coordinates: [[[-96.797, 32.7767], [-96.787, 32.7867], [-96.807, 32.7667], [-96.797, 32.7767]]]
      }
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    testZoneId = zoneResponse.data.data._id;
    console.log('✅ Created test zone:', testZoneId);

    // Assign zone to team
    const assignmentResponse = await axios.post(`${BASE_URL}/assignments`, {
      teamId: testTeamId,
      zoneId: testZoneId,
      assignedDate: new Date().toISOString()
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Assigned zone to team');

  } catch (error) {
    console.error('❌ Failed to create test data:', error.response?.data || error.message);
    throw error;
  }
}

async function checkAgentZoneIds(agentId, expectedZoneCount, description) {
  try {
    const response = await axios.get(`${BASE_URL}/users/my-created-agents`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const agent = response.data.data.find(a => a._id === agentId);
    if (!agent) {
      console.log(`❌ Agent ${agentId} not found`);
      return false;
    }

    const zoneCount = agent.zoneIds ? agent.zoneIds.length : 0;
    console.log(`📊 ${description}: Agent has ${zoneCount} zones (expected: ${expectedZoneCount})`);
    
    if (zoneCount === expectedZoneCount) {
      console.log(`✅ ${description}: Zone count matches expectation`);
      return true;
    } else {
      console.log(`❌ ${description}: Zone count mismatch`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Failed to check agent zones:`, error.response?.data || error.message);
    return false;
  }
}

async function testAddMemberToTeam() {
  try {
    console.log('\n🧪 Testing: Add member to team');
    
    // Check initial state
    await checkAgentZoneIds(testAgent1Id, 1, 'Agent 1 before adding Agent 2');
    await checkAgentZoneIds(testAgent2Id, 0, 'Agent 2 before being added to team');

    // Add agent 2 to team
    const response = await axios.put(`${BASE_URL}/teams/${testTeamId}`, {
      name: 'Test Team for Zone Sync',
      description: 'Testing zone synchronization',
      memberIds: [testAgent1Id, testAgent2Id]
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Added agent 2 to team');

    // Wait a moment for sync
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check final state
    await checkAgentZoneIds(testAgent1Id, 1, 'Agent 1 after adding Agent 2');
    await checkAgentZoneIds(testAgent2Id, 1, 'Agent 2 after being added to team');

  } catch (error) {
    console.error('❌ Failed to test add member:', error.response?.data || error.message);
  }
}

async function testRemoveMemberFromTeam() {
  try {
    console.log('\n🧪 Testing: Remove member from team');
    
    // Check initial state
    await checkAgentZoneIds(testAgent1Id, 1, 'Agent 1 before removing Agent 2');
    await checkAgentZoneIds(testAgent2Id, 1, 'Agent 2 before being removed from team');

    // Remove agent 2 from team
    const response = await axios.put(`${BASE_URL}/teams/${testTeamId}`, {
      name: 'Test Team for Zone Sync',
      description: 'Testing zone synchronization',
      memberIds: [testAgent1Id]
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Removed agent 2 from team');

    // Wait a moment for sync
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check final state
    await checkAgentZoneIds(testAgent1Id, 1, 'Agent 1 after removing Agent 2');
    await checkAgentZoneIds(testAgent2Id, 0, 'Agent 2 after being removed from team');

  } catch (error) {
    console.error('❌ Failed to test remove member:', error.response?.data || error.message);
  }
}

async function cleanup() {
  try {
    console.log('\n🧹 Cleaning up test data...');
    
    // Delete test data
    if (testZoneId) {
      await axios.delete(`${BASE_URL}/zones/delete/${testZoneId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      console.log('✅ Deleted test zone');
    }
    
    if (testTeamId) {
      await axios.delete(`${BASE_URL}/teams/${testTeamId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      console.log('✅ Deleted test team');
    }
    
    if (testAgent1Id) {
      await axios.delete(`${BASE_URL}/users/${testAgent1Id}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      console.log('✅ Deleted test agent 1');
    }
    
    if (testAgent2Id) {
      await axios.delete(`${BASE_URL}/users/${testAgent2Id}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      console.log('✅ Deleted test agent 2');
    }
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error.response?.data || error.message);
  }
}

async function runTests() {
  try {
    console.log('🚀 Starting Team Zone Sync Tests...\n');
    
    await login();
    await createTestData();
    
    await testAddMemberToTeam();
    await testRemoveMemberFromTeam();
    
    console.log('\n✅ All tests completed!');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  } finally {
    await cleanup();
    process.exit(0);
  }
}

// Run the tests
runTests();
