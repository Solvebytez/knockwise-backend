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

// Clean up orphaned data using direct MongoDB operations
async function cleanupOrphanedData() {
  try {
    console.log('🧹 Starting cleanup of orphaned residential data...');
    console.log('================================================');

    const db = mongoose.connection.db;

    // Get all existing zone IDs
    const zonesCollection = db.collection('zones');
    const existingZones = await zonesCollection.find({}, { projection: { _id: 1 } }).toArray();
    const existingZoneIds = existingZones.map(zone => zone._id.toString());
    
    console.log(`📊 Found ${existingZoneIds.length} existing zones`);

    if (existingZoneIds.length === 0) {
      console.log('⚠️  No zones found. This will delete ALL residential data!');
      console.log('   Are you sure you want to continue? (y/N)');
      
      // For safety, we'll require explicit confirmation
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise((resolve) => {
        rl.question('', (input) => {
          rl.close();
          resolve(input.toLowerCase());
        });
      });

      if (answer !== 'y' && answer !== 'yes') {
        console.log('❌ Cleanup cancelled by user');
        return;
      }
    }

    // 1. Clean up orphaned Properties
    console.log('\n1. Cleaning up orphaned Properties...');
    const propertiesCollection = db.collection('properties');
    const orphanedProperties = await propertiesCollection.find({
      zoneId: { $exists: true, $nin: existingZoneIds }
    }).toArray();
    console.log(`   Found ${orphanedProperties.length} orphaned properties`);
    
    if (orphanedProperties.length > 0) {
      const deleteResult = await propertiesCollection.deleteMany({
        zoneId: { $exists: true, $nin: existingZoneIds }
      });
      console.log(`   ✅ Deleted ${deleteResult.deletedCount} orphaned properties`);
    }

    // 2. Clean up orphaned Leads
    console.log('\n2. Cleaning up orphaned Leads...');
    const leadsCollection = db.collection('leads');
    const orphanedLeads = await leadsCollection.find({
      zoneId: { $exists: true, $nin: existingZoneIds }
    }).toArray();
    console.log(`   Found ${orphanedLeads.length} orphaned leads`);
    
    if (orphanedLeads.length > 0) {
      const deleteResult = await leadsCollection.deleteMany({
        zoneId: { $exists: true, $nin: existingZoneIds }
      });
      console.log(`   ✅ Deleted ${deleteResult.deletedCount} orphaned leads`);
    }

    // 3. Clean up orphaned Activities
    console.log('\n3. Cleaning up orphaned Activities...');
    const activitiesCollection = db.collection('activities');
    const orphanedActivities = await activitiesCollection.find({
      zoneId: { $exists: true, $nin: existingZoneIds }
    }).toArray();
    console.log(`   Found ${orphanedActivities.length} orphaned activities`);
    
    if (orphanedActivities.length > 0) {
      const deleteResult = await activitiesCollection.deleteMany({
        zoneId: { $exists: true, $nin: existingZoneIds }
      });
      console.log(`   ✅ Deleted ${deleteResult.deletedCount} orphaned activities`);
    }

    // 4. Clean up orphaned Routes
    console.log('\n4. Cleaning up orphaned Routes...');
    const routesCollection = db.collection('routes');
    const orphanedRoutes = await routesCollection.find({
      zoneId: { $exists: true, $nin: existingZoneIds }
    }).toArray();
    console.log(`   Found ${orphanedRoutes.length} orphaned routes`);
    
    if (orphanedRoutes.length > 0) {
      const deleteResult = await routesCollection.deleteMany({
        zoneId: { $exists: true, $nin: existingZoneIds }
      });
      console.log(`   ✅ Deleted ${deleteResult.deletedCount} orphaned routes`);
    }

    // 5. Clean up orphaned Residents
    console.log('\n5. Cleaning up orphaned Residents...');
    const residentsCollection = db.collection('residents');
    const orphanedResidents = await residentsCollection.find({
      zoneId: { $exists: true, $nin: existingZoneIds }
    }).toArray();
    console.log(`   Found ${orphanedResidents.length} orphaned residents`);
    
    if (orphanedResidents.length > 0) {
      const deleteResult = await residentsCollection.deleteMany({
        zoneId: { $exists: true, $nin: existingZoneIds }
      });
      console.log(`   ✅ Deleted ${deleteResult.deletedCount} orphaned residents`);
    }

    // 6. Clean up orphaned Agent Zone Assignments
    console.log('\n6. Cleaning up orphaned Agent Zone Assignments...');
    const assignmentsCollection = db.collection('agentzoneassignments');
    const orphanedAssignments = await assignmentsCollection.find({
      zoneId: { $exists: true, $nin: existingZoneIds }
    }).toArray();
    console.log(`   Found ${orphanedAssignments.length} orphaned assignments`);
    
    if (orphanedAssignments.length > 0) {
      const deleteResult = await assignmentsCollection.deleteMany({
        zoneId: { $exists: true, $nin: existingZoneIds }
      });
      console.log(`   ✅ Deleted ${deleteResult.deletedCount} orphaned assignments`);
    }

    // 7. Clean up orphaned Scheduled Assignments
    console.log('\n7. Cleaning up orphaned Scheduled Assignments...');
    const scheduledCollection = db.collection('scheduledassignments');
    const orphanedScheduled = await scheduledCollection.find({
      zoneId: { $exists: true, $nin: existingZoneIds }
    }).toArray();
    console.log(`   Found ${orphanedScheduled.length} orphaned scheduled assignments`);
    
    if (orphanedScheduled.length > 0) {
      const deleteResult = await scheduledCollection.deleteMany({
        zoneId: { $exists: true, $nin: existingZoneIds }
      });
      console.log(`   ✅ Deleted ${deleteResult.deletedCount} orphaned scheduled assignments`);
    }

    // 8. Clean up Properties with null/invalid zoneId
    console.log('\n8. Cleaning up Properties with null/invalid zoneId...');
    const nullZoneProperties = await propertiesCollection.find({
      $or: [
        { zoneId: null },
        { zoneId: { $exists: false } }
      ]
    }).toArray();
    console.log(`   Found ${nullZoneProperties.length} properties with null/invalid zoneId`);
    
    if (nullZoneProperties.length > 0) {
      const deleteResult = await propertiesCollection.deleteMany({
        $or: [
          { zoneId: null },
          { zoneId: { $exists: false } }
        ]
      });
      console.log(`   ✅ Deleted ${deleteResult.deletedCount} properties with null/invalid zoneId`);
    }

    // 9. Clean up Leads with null/invalid zoneId
    console.log('\n9. Cleaning up Leads with null/invalid zoneId...');
    const nullZoneLeads = await leadsCollection.find({
      $or: [
        { zoneId: null },
        { zoneId: { $exists: false } }
      ]
    }).toArray();
    console.log(`   Found ${nullZoneLeads.length} leads with null/invalid zoneId`);
    
    if (nullZoneLeads.length > 0) {
      const deleteResult = await leadsCollection.deleteMany({
        $or: [
          { zoneId: null },
          { zoneId: { $exists: false } }
        ]
      });
      console.log(`   ✅ Deleted ${deleteResult.deletedCount} leads with null/invalid zoneId`);
    }

    // 10. Clean up Activities with null/invalid zoneId
    console.log('\n10. Cleaning up Activities with null/invalid zoneId...');
    const nullZoneActivities = await activitiesCollection.find({
      $or: [
        { zoneId: null },
        { zoneId: { $exists: false } }
      ]
    }).toArray();
    console.log(`   Found ${nullZoneActivities.length} activities with null/invalid zoneId`);
    
    if (nullZoneActivities.length > 0) {
      const deleteResult = await activitiesCollection.deleteMany({
        $or: [
          { zoneId: null },
          { zoneId: { $exists: false } }
        ]
      });
      console.log(`   ✅ Deleted ${deleteResult.deletedCount} activities with null/invalid zoneId`);
    }

    // 11. Clean up Routes with null/invalid zoneId
    console.log('\n11. Cleaning up Routes with null/invalid zoneId...');
    const nullZoneRoutes = await routesCollection.find({
      $or: [
        { zoneId: null },
        { zoneId: { $exists: false } }
      ]
    }).toArray();
    console.log(`   Found ${nullZoneRoutes.length} routes with null/invalid zoneId`);
    
    if (nullZoneRoutes.length > 0) {
      const deleteResult = await routesCollection.deleteMany({
        $or: [
          { zoneId: null },
          { zoneId: { $exists: false } }
        ]
      });
      console.log(`   ✅ Deleted ${deleteResult.deletedCount} routes with null/invalid zoneId`);
    }

    // 12. Clean up Residents with null/invalid zoneId
    console.log('\n12. Cleaning up Residents with null/invalid zoneId...');
    const nullZoneResidents = await residentsCollection.find({
      $or: [
        { zoneId: null },
        { zoneId: { $exists: false } }
      ]
    }).toArray();
    console.log(`   Found ${nullZoneResidents.length} residents with null/invalid zoneId`);
    
    if (nullZoneResidents.length > 0) {
      const deleteResult = await residentsCollection.deleteMany({
        $or: [
          { zoneId: null },
          { zoneId: { $exists: false } }
        ]
      });
      console.log(`   ✅ Deleted ${deleteResult.deletedCount} residents with null/invalid zoneId`);
    }

    // Summary
    console.log('\n📋 Cleanup Summary:');
    console.log('==================');
    console.log(`   Properties deleted: ${orphanedProperties.length + (nullZoneProperties.length || 0)}`);
    console.log(`   Leads deleted: ${orphanedLeads.length + (nullZoneLeads.length || 0)}`);
    console.log(`   Activities deleted: ${orphanedActivities.length + (nullZoneActivities.length || 0)}`);
    console.log(`   Routes deleted: ${orphanedRoutes.length + (nullZoneRoutes.length || 0)}`);
    console.log(`   Residents deleted: ${orphanedResidents.length + (nullZoneResidents.length || 0)}`);
    console.log(`   Assignments deleted: ${orphanedAssignments.length}`);
    console.log(`   Scheduled assignments deleted: ${orphanedScheduled.length}`);

    console.log('\n✅ Cleanup completed successfully!');
    console.log('   All orphaned residential data has been removed from the database.');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// Main execution
async function main() {
  await connectDB();
  await cleanupOrphanedData();
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

module.exports = { cleanupOrphanedData };
