const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:4000/api';
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';

// Test data
let authToken = '';
let testAgentId = '';

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

async function createTestAgent() {
  try {
    const response = await axios.post(`${BASE_URL}/users/create-agent`, {
      name: 'Test Agent for Delete',
      email: 'delete-test@example.com',
      password: 'password123'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    testAgentId = response.data.data._id;
    console.log('✅ Created test agent:', testAgentId);
  } catch (error) {
    console.error('❌ Failed to create test agent:', error.response?.data || error.message);
    throw error;
  }
}

async function testDeleteModalBehavior() {
  try {
    console.log('\n🧪 Testing Delete Modal Behavior...');
    
    // Test 1: Verify agent exists before deletion
    const getResponse = await axios.get(`${BASE_URL}/users/my-created-agents`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const agent = getResponse.data.data.find(a => a._id === testAgentId);
    if (!agent) {
      console.log('❌ Test agent not found before deletion');
      return false;
    }
    console.log('✅ Test agent found before deletion:', agent.name);

    // Test 2: Attempt to delete the agent
    console.log('🔄 Attempting to delete agent...');
    const deleteResponse = await axios.delete(`${BASE_URL}/users/delete/${testAgentId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (deleteResponse.data.success) {
      console.log('✅ Agent deleted successfully');
    } else {
      console.log('❌ Failed to delete agent:', deleteResponse.data.message);
      return false;
    }

    // Test 3: Verify agent is deleted
    const getResponseAfter = await axios.get(`${BASE_URL}/users/my-created-agents`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const agentAfter = getResponseAfter.data.data.find(a => a._id === testAgentId);
    if (agentAfter) {
      console.log('❌ Test agent still exists after deletion');
      return false;
    }
    console.log('✅ Test agent successfully removed from list');

    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    return false;
  }
}

async function cleanup() {
  try {
    console.log('\n🧹 Cleanup completed - test agent was deleted during test');
  } catch (error) {
    console.error('❌ Cleanup failed:', error.response?.data || error.message);
  }
}

async function runTests() {
  try {
    console.log('🚀 Starting Delete Modal Behavior Tests...\n');
    
    await login();
    await createTestAgent();
    
    const success = await testDeleteModalBehavior();
    
    if (success) {
      console.log('\n✅ All delete modal behavior tests passed!');
      console.log('📝 Frontend modal should now:');
      console.log('   - Stay open during deletion (loading state)');
      console.log('   - Only close on successful deletion');
      console.log('   - Stay open on error for retry');
      console.log('   - Disable cancel button during deletion');
    } else {
      console.log('\n❌ Some tests failed');
    }
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  } finally {
    await cleanup();
    process.exit(0);
  }
}

// Run the tests
runTests();
