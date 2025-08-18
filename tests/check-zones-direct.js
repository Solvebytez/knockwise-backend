const mongoose = require('mongoose');
require('dotenv').config();

async function checkZonesDirect() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Import Zone model
    const { Zone } = require('./src/models/Zone');

    // Get all zones
    const zones = await Zone.find({});
    console.log('Total zones in database:', zones.length);

    if (zones.length > 0) {
      console.log('Available zones:');
      zones.forEach(zone => {
        console.log(`  ID: ${zone._id}`);
        console.log(`  Name: ${zone.name}`);
        console.log(`  Status: ${zone.status}`);
        console.log('  ---');
      });
    } else {
      console.log('No zones found in database');
    }

    // Also check teams
    const { Team } = require('./src/models/Team');
    const teams = await Team.find({});
    console.log('\nTotal teams in database:', teams.length);

    if (teams.length > 0) {
      console.log('Available teams:');
      teams.forEach(team => {
        console.log(`  ID: ${team._id}`);
        console.log(`  Name: ${team.name}`);
        console.log(`  Status: ${team.status}`);
        console.log('  ---');
      });
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');

  } catch (error) {
    console.error('Error:', error);
  }
}

checkZonesDirect();
