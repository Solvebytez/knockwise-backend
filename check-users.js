const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/knockwise')
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    
    try {
      // Import User model
      const User = require('./src/models/User');
      
      // Find all users
      const users = await User.find({}).select('email role status name createdAt');
      
      console.log('\n📊 Users in database:');
      if (users.length === 0) {
        console.log('❌ No users found in database');
      } else {
        users.forEach((user, index) => {
          console.log(`${index + 1}. ${user.email} (${user.role}) - Status: ${user.status}`);
        });
      }
      
      // Check if test users exist
      const testEmails = [
        'superadmin@knockwise.io',
        'subadmin@knockwise.io', 
        'agent@knockwise.io'
      ];
      
      console.log('\n🔍 Checking for test users:');
      for (const email of testEmails) {
        const user = await User.findOne({ email });
        if (user) {
          console.log(`✅ ${email} - Found (${user.role}, ${user.status})`);
        } else {
          console.log(`❌ ${email} - Not found`);
        }
      }
      
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
    
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
  });
