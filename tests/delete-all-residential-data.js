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

// Delete ALL residential data using direct MongoDB operations
async function deleteAllResidentialData() {
  try {
    console.log('🗑️  WARNING: This will delete ALL residential data from the database!');
    console.log('===============================================================');
    console.log('');
    console.log('This script will delete:');
    console.log('  - All Properties');
    console.log('  - All Leads');
    console.log('  - All Activities');
    console.log('  - All Routes');
    console.log('  - All Residents');
    console.log('  - All Agent Zone Assignments');
    console.log('  - All Scheduled Assignments');
    console.log('');
    console.log('⚠️  This action cannot be undone!');
    console.log('');

    const db = mongoose.connection.db;

    // Get counts before deletion
    const propertiesCollection = db.collection('properties');
    const leadsCollection = db.collection('leads');
    const activitiesCollection = db.collection('activities');
    const routesCollection = db.collection('routes');
    const residentsCollection = db.collection('residents');
    const assignmentsCollection = db.collection('agentzoneassignments');
    const scheduledCollection = db.collection('scheduledassignments');

    const propertyCount = await propertiesCollection.countDocuments();
    const leadCount = await leadsCollection.countDocuments();
    const activityCount = await activitiesCollection.countDocuments();
    const routeCount = await routesCollection.countDocuments();
    const residentCount = await residentsCollection.countDocuments();
    const assignmentCount = await assignmentsCollection.countDocuments();
    const scheduledCount = await scheduledCollection.countDocuments();

    console.log('📊 Current data counts:');
    console.log(`   Properties: ${propertyCount}`);
    console.log(`   Leads: ${leadCount}`);
    console.log(`   Activities: ${activityCount}`);
    console.log(`   Routes: ${routeCount}`);
    console.log(`   Residents: ${residentCount}`);
    console.log(`   Assignments: ${assignmentCount}`);
    console.log(`   Scheduled Assignments: ${scheduledCount}`);
    console.log('');

    // Require explicit confirmation
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise((resolve) => {
      rl.question('Are you absolutely sure you want to delete ALL residential data? (type "DELETE ALL" to confirm): ', (input) => {
        rl.close();
        resolve(input);
      });
    });

    if (answer !== 'DELETE ALL') {
      console.log('❌ Deletion cancelled by user');
      return;
    }

    console.log('\n🧹 Starting deletion of ALL residential data...');
    console.log('==============================================');

    // Delete all data
    console.log('\n1. Deleting all Properties...');
    const propertyResult = await propertiesCollection.deleteMany({});
    console.log(`   ✅ Deleted ${propertyResult.deletedCount} properties`);

    console.log('\n2. Deleting all Leads...');
    const leadResult = await leadsCollection.deleteMany({});
    console.log(`   ✅ Deleted ${leadResult.deletedCount} leads`);

    console.log('\n3. Deleting all Activities...');
    const activityResult = await activitiesCollection.deleteMany({});
    console.log(`   ✅ Deleted ${activityResult.deletedCount} activities`);

    console.log('\n4. Deleting all Routes...');
    const routeResult = await routesCollection.deleteMany({});
    console.log(`   ✅ Deleted ${routeResult.deletedCount} routes`);

    console.log('\n5. Deleting all Residents...');
    const residentResult = await residentsCollection.deleteMany({});
    console.log(`   ✅ Deleted ${residentResult.deletedCount} residents`);

    console.log('\n6. Deleting all Agent Zone Assignments...');
    const assignmentResult = await assignmentsCollection.deleteMany({});
    console.log(`   ✅ Deleted ${assignmentResult.deletedCount} assignments`);

    console.log('\n7. Deleting all Scheduled Assignments...');
    const scheduledResult = await scheduledCollection.deleteMany({});
    console.log(`   ✅ Deleted ${scheduledResult.deletedCount} scheduled assignments`);

    // Summary
    console.log('\n📋 Deletion Summary:');
    console.log('==================');
    console.log(`   Properties deleted: ${propertyResult.deletedCount}`);
    console.log(`   Leads deleted: ${leadResult.deletedCount}`);
    console.log(`   Activities deleted: ${activityResult.deletedCount}`);
    console.log(`   Routes deleted: ${routeResult.deletedCount}`);
    console.log(`   Residents deleted: ${residentResult.deletedCount}`);
    console.log(`   Assignments deleted: ${assignmentResult.deletedCount}`);
    console.log(`   Scheduled assignments deleted: ${scheduledResult.deletedCount}`);

    const totalDeleted = propertyResult.deletedCount + leadResult.deletedCount + 
                        activityResult.deletedCount + routeResult.deletedCount + 
                        residentResult.deletedCount + assignmentResult.deletedCount + 
                        scheduledResult.deletedCount;

    console.log(`\n🎯 Total records deleted: ${totalDeleted}`);
    console.log('\n✅ All residential data has been successfully deleted!');
    console.log('   Your database is now clean and ready for fresh data.');

  } catch (error) {
    console.error('❌ Error during deletion:', error);
  }
}

// Main execution
async function main() {
  await connectDB();
  await deleteAllResidentialData();
  await mongoose.disconnect();
  console.log('\n🔌 Disconnected from MongoDB');
  process.exit(0);
}

// Handle script execution
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { deleteAllResidentialData };
