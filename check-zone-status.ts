/**
 * Diagnostic script to check zone statuses and why they're showing as ACTIVE
 * Run with: ts-node -r dotenv/config check-zone-status.ts
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import User from './src/models/User';
import Zone from './src/models/Zone';
import { Resident } from './src/models/Resident';
import { connectDatabase } from './src/config/database';

async function checkZoneStatus() {
  try {
    console.log('🔌 Connecting to database...');
    await connectDatabase();
    console.log('✅ Connected to database\n');

    // 1. Find agent by email
    const agentEmail = 'agent@knockwise.io';
    console.log(`🔍 Looking for agent with email: ${agentEmail}`);
    const agent = await User.findOne({ email: agentEmail });
    
    if (!agent) {
      console.log('❌ Agent not found with email:', agentEmail);
      await mongoose.disconnect();
      return;
    }

    console.log('✅ Agent found:', agent.name, '\n');

    // 2. Find all zones for this agent
    const zones = await Zone.find({ 
      $or: [
        { createdBy: agent._id },
        { assignedAgentId: agent._id }
      ]
    });

    console.log(`📊 Found ${zones.length} zones\n`);
    console.log('='.repeat(80));
    console.log('ZONE STATUS ANALYSIS');
    console.log('='.repeat(80));
    console.log();

    for (const zone of zones) {
      console.log(`Zone: ${zone.name}`);
      console.log(`  Zone ID: ${zone._id}`);
      console.log(`  Stored Status in DB: ${zone.status}`);
      
      // Check buildingData.houseStatuses
      if (zone.buildingData?.houseStatuses) {
        const houseStatuses = Array.from((zone.buildingData.houseStatuses as any).values());
        const totalHouses = houseStatuses.length;
        const visitedHouses = houseStatuses.filter((house: any) => house.status !== "not-visited").length;
        
        console.log(`  Total Houses (from houseStatuses): ${totalHouses}`);
        console.log(`  Visited Houses: ${visitedHouses}`);
        console.log(`  Not Visited: ${totalHouses - visitedHouses}`);
        
        // Calculate status based on houseStatuses
        let calculatedStatus = "DRAFT";
        if (totalHouses > 0 && visitedHouses === totalHouses) {
          calculatedStatus = "COMPLETED";
        } else if (zone.status === "ACTIVE" || zone.assignedAgentId) {
          calculatedStatus = "ACTIVE";
        }
        
        console.log(`  Calculated Status (should be): ${calculatedStatus}`);
      } else {
        console.log(`  ⚠️  No houseStatuses in buildingData`);
      }

      // Check Resident collection
      const totalResidents = await Resident.countDocuments({ zoneId: zone._id });
      const visitedResidents = await Resident.countDocuments({ 
        zoneId: zone._id,
        status: "visited"
      });
      const notVisitedResidents = await Resident.countDocuments({ 
        zoneId: zone._id,
        status: "not-visited"
      });
      
      console.log(`  Total Residents (from Resident collection): ${totalResidents}`);
      console.log(`  Visited Residents: ${visitedResidents}`);
      console.log(`  Not Visited Residents: ${notVisitedResidents}`);
      
      if (totalResidents > 0) {
        const completionPercentage = Math.round((visitedResidents / totalResidents) * 100);
        console.log(`  Completion %: ${completionPercentage}%`);
      }

      console.log();
    }

    await mongoose.disconnect();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkZoneStatus();






