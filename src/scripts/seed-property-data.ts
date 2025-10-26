import mongoose from 'mongoose';
import { PropertyData } from '../models/PropertyData';
import { Resident } from '../models/Resident';
import { Zone } from '../models/Zone';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/knockwise';

async function seedPropertyData() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all zones
    const zones = await Zone.find();
    console.log(`📊 Found ${zones.length} zones`);

    if (zones.length === 0) {
      console.log('❌ No zones found. Please create zones first.');
      return;
    }

    // Get all residents
    const residents = await Resident.find();
    console.log(`🏠 Found ${residents.length} residents`);

    if (residents.length === 0) {
      console.log('❌ No residents found. Please create residents first.');
      return;
    }

    // Sample property data templates
    const propertyDataTemplates = [
      {
        propertyType: 'SINGLE_FAMILY',
        bedrooms: 3,
        bathrooms: 2,
        yearBuilt: 1995,
        estimatedValue: 750000,
        leadScore: 75,
        ownerName: 'John Smith',
        ownerPhone: '+1-416-555-0123',
        dataSource: 'MLS'
      },
      {
        propertyType: 'TOWNHOUSE',
        bedrooms: 4,
        bathrooms: 3,
        yearBuilt: 2005,
        estimatedValue: 850000,
        leadScore: 82,
        ownerName: 'Sarah Johnson',
        ownerPhone: '+1-416-555-0456',
        dataSource: 'MLS'
      },
      {
        propertyType: 'CONDO',
        bedrooms: 2,
        bathrooms: 2,
        yearBuilt: 2010,
        estimatedValue: 650000,
        leadScore: 68,
        ownerName: 'Mike Davis',
        ownerPhone: '+1-416-555-0789',
        dataSource: 'MLS'
      },
      {
        propertyType: 'SINGLE_FAMILY',
        bedrooms: 5,
        bathrooms: 4,
        yearBuilt: 1988,
        estimatedValue: 1200000,
        leadScore: 90,
        ownerName: 'Lisa Wilson',
        ownerPhone: '+1-416-555-0321',
        dataSource: 'MLS'
      },
      {
        propertyType: 'TOWNHOUSE',
        bedrooms: 3,
        bathrooms: 2,
        yearBuilt: 2000,
        estimatedValue: 680000,
        leadScore: 72,
        ownerName: 'David Brown',
        ownerPhone: '+1-416-555-0654',
        dataSource: 'MLS'
      }
    ];

    let createdCount = 0;
    let updatedCount = 0;

    // Create PropertyData for each resident
    for (let i = 0; i < residents.length; i++) {
      const resident = residents[i];
      
      if (!resident) {
        console.log(`⚠️  Skipping undefined resident at index ${i}`);
        continue;
      }
      
      // Check if resident already has PropertyData
      if (resident.propertyDataId) {
        console.log(`⏭️  Resident ${resident.address} already has PropertyData, skipping...`);
        continue;
      }

      // Get a random template
      const template = propertyDataTemplates[i % propertyDataTemplates.length];
      
      // Parse resident address
      const addressParts = resident.address.split(',');
      const addressLine1 = addressParts[0]?.trim() || 'Unknown Street';
      const city = addressParts[1]?.trim() || 'Toronto';
      const state = addressParts[2]?.trim() || 'ON';
      const postalCode = addressParts[3]?.trim() || 'M4L 3Y1';

      // Create PropertyData
      const propertyData = new PropertyData({
        addressLine1,
        city,
        state,
        postalCode,
        location: {
          type: 'Point',
          coordinates: resident.coordinates
        },
        zoneId: resident.zoneId,
        ...template
      });

      try {
        await propertyData.save();
        console.log(`✅ Created PropertyData for ${resident.address}`);

        // Update resident to link to this PropertyData
        await Resident.findByIdAndUpdate(resident._id, { 
          propertyDataId: propertyData._id 
        });
        console.log(`🔗 Linked PropertyData to resident ${resident.address}`);

        createdCount++;
      } catch (error) {
        console.error(`❌ Error creating PropertyData for ${resident.address}:`, error);
      }
    }

    console.log('\n📊 Seeding Summary:');
    console.log(`✅ Created ${createdCount} PropertyData records`);
    console.log(`🔗 Updated ${updatedCount} residents with PropertyData links`);

    // Verify the data
    const totalPropertyData = await PropertyData.countDocuments();
    const residentsWithPropertyData = await Resident.countDocuments({ 
      propertyDataId: { $exists: true, $ne: null } 
    });

    console.log(`\n🔍 Verification:`);
    console.log(`📊 Total PropertyData in database: ${totalPropertyData}`);
    console.log(`🏠 Residents with PropertyData: ${residentsWithPropertyData}/${residents.length}`);

  } catch (error) {
    console.error('❌ Error seeding PropertyData:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the seeding function
seedPropertyData().then(() => {
  console.log('🎉 PropertyData seeding completed!');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Seeding failed:', error);
  process.exit(1);
});
