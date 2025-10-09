import mongoose from 'mongoose';
import { Zone } from '../models/Zone';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const migrateZoneType = async () => {
  try {
    console.log('🚀 Starting zone type migration...');
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    // Find all zones that don't have zoneType field
    const zonesWithoutZoneType = await Zone.find({ zoneType: { $exists: false } });
    console.log(`📊 Found ${zonesWithoutZoneType.length} zones without zoneType field`);
    
    if (zonesWithoutZoneType.length === 0) {
      console.log('✅ All zones already have zoneType field');
      return;
    }
    
    // Update all zones to have zoneType = 'MAP'
    const updateResult = await Zone.updateMany(
      { zoneType: { $exists: false } },
      { $set: { zoneType: 'MAP' } }
    );
    
    console.log(`✅ Successfully updated ${updateResult.modifiedCount} zones with zoneType = 'MAP'`);
    
    // Verify the update
    const remainingZonesWithoutZoneType = await Zone.find({ zoneType: { $exists: false } });
    console.log(`📊 Remaining zones without zoneType: ${remainingZonesWithoutZoneType.length}`);
    
    if (remainingZonesWithoutZoneType.length === 0) {
      console.log('✅ Migration completed successfully!');
    } else {
      console.log('⚠️ Some zones still don\'t have zoneType field');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Run migration if this file is executed directly
if (require.main === module) {
  migrateZoneType()
    .then(() => {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

export default migrateZoneType;
