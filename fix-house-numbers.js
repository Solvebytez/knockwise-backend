const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/knockwise', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Import Resident model
const Resident = require('./src/models/Resident').default;

// Helper function to extract house number from address
const extractHouseNumber = (address) => {
  const match = address.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
};

// Function to fix house numbers
const fixHouseNumbers = async () => {
  try {
    console.log('🔍 Starting house number fix...');
    
    // Get all residents
    const residents = await Resident.find({});
    console.log(`📊 Found ${residents.length} residents to process`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const resident of residents) {
      try {
        const extractedHouseNumber = extractHouseNumber(resident.address);
        
        if (extractedHouseNumber > 0 && extractedHouseNumber !== resident.houseNumber) {
          console.log(`🏠 Updating ${resident.address}: ${resident.houseNumber || 'null'} → ${extractedHouseNumber}`);
          
          await Resident.findByIdAndUpdate(resident._id, {
            houseNumber: extractedHouseNumber
          });
          
          updatedCount++;
        }
      } catch (error) {
        console.error(`❌ Error updating resident ${resident._id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`✅ House number fix completed!`);
    console.log(`📈 Updated: ${updatedCount} residents`);
    console.log(`❌ Errors: ${errorCount} residents`);
    
  } catch (error) {
    console.error('❌ Error in fixHouseNumbers:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

// Run the fix
fixHouseNumbers();
