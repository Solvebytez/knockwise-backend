const mongoose = require('mongoose');

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/knockwise');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

// Delete all residents
async function deleteAllResidents() {
  try {
    console.log('🗑️  Deleting all residents...');
    
    const db = mongoose.connection.db;
    const residentsCollection = db.collection('residents');
    
    const result = await residentsCollection.deleteMany({});
    
    console.log(`✅ Deleted ${result.deletedCount} residents`);
    console.log('🎯 All residents have been removed from the database.');
    
  } catch (error) {
    console.error('❌ Error deleting residents:', error);
  }
}

// Main execution
async function main() {
  await connectDB();
  await deleteAllResidents();
  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB');
  process.exit(0);
}

// Handle script execution
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}
