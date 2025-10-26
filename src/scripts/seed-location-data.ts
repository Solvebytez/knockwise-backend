import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
import { connectDatabase } from "../config/database";
import { Area } from "../models/Area";
import { Municipality } from "../models/Municipality";
import { Community } from "../models/Community";

// Load environment variables
dotenv.config();

// Location data from the provided JSON
const locationData = {
  area: {
    type: "Area",
    name: "Peel",
    municipalities: [
      {
        type: "Municipality",
        name: "Brampton",
        communities: [
          { name: "Airport Road/ Highway 7 Business", type: "Community" },
          { name: "Centre", type: "Community" },
          { name: "Bram West", type: "Community" },
          { name: "Bramalea South Industrial", type: "Community" },
          { name: "Brampton East", type: "Community" },
          { name: "Brampton South", type: "Community" },
          { name: "Claireville Conservation", type: "Community" },
          { name: "Fletcher's Creek South", type: "Community" },
          { name: "Fletcher's West", type: "Community" },
          { name: "Goreway Drive Corridor", type: "Community" },
          { name: "Heart Lake West", type: "Community" },
          { name: "Madoc", type: "Community" },
          { name: "Northwest Sandalwood Parkway", type: "Community" },
          { name: "Queen Street Corridor", type: "Community" },
          { name: "Snelgrove", type: "Community" },
          { name: "Toronto Gore Rural Estate", type: "Community" },
          { name: "Westgate", type: "Community" },
          { name: "Avondale", type: "Community" },
          { name: "Bramalea North Industrial", type: "Community" },
          { name: "Bramalea West Industrial", type: "Community" },
          { name: "Brampton East Industrial", type: "Community" },
          { name: "Brampton West", type: "Community" },
          { name: "Credit Valley", type: "Community" },
          { name: "Fletcher's Creek Village", type: "Community" },
          { name: "Gore Industrial North", type: "Community" },
          { name: "Heart Lake", type: "Community" },
          { name: "Highway 427", type: "Community" },
          { name: "Northgate", type: "Community" },
          { name: "Northwood Park", type: "Community" },
          { name: "Sandringham-Wellington", type: "Community" },
          { name: "Southgate", type: "Community" },
          { name: "Vales of Castlemore", type: "Community" },
          { name: "Bram East", type: "Community" },
          { name: "Bramalea Road South Gateway", type: "Community" },
          { name: "Brampton 407 Corridor", type: "Community" },
          { name: "Brampton North", type: "Community" },
          { name: "Central Park", type: "Community" },
          { name: "Downtown Brampton", type: "Community" },
          { name: "Fletcher's Meadow", type: "Community" },
          { name: "Gore Industrial South", type: "Community" },
          { name: "Heart Lake East", type: "Community" },
          { name: "Huttonville", type: "Community" },
          { name: "Northwest Brampton", type: "Community" },
          { name: "Parkway Belt Industrial Area", type: "Community" },
          { name: "Sandringham-Wellington North", type: "Community" },
          { name: "Steeles Industrial", type: "Community" },
          { name: "Vales of Castlemore North", type: "Community" },
        ],
      },
      {
        type: "Municipality",
        name: "Mississauga",
        communities: [
          { name: "Airport Corporate", type: "Community" },
          { name: "Churchill Meadows", type: "Community" },
          { name: "Cooksville", type: "Community" },
          { name: "East Credit", type: "Community" },
          { name: "Fairview", type: "Community" },
          { name: "Lakeview", type: "Community" },
          { name: "Malton", type: "Community" },
          { name: "Meadowvale Business Park", type: "Community" },
          { name: "Mississauga Valleys", type: "Community" },
          { name: "Rathwood", type: "Community" },
          { name: "Southdown", type: "Community" },
          { name: "Applewood", type: "Community" },
          { name: "City Centre", type: "Community" },
          { name: "Creditview", type: "Community" },
          { name: "Erin Mills", type: "Community" },
          { name: "Gateway", type: "Community" },
          { name: "Lisgar", type: "Community" },
          { name: "Mavis-Erindale", type: "Community" },
          { name: "Meadowvale Village", type: "Community" },
          { name: "Northeast", type: "Community" },
          { name: "Sheridan", type: "Community" },
          { name: "Streetsville", type: "Community" },
          { name: "Central Erin Mills", type: "Community" },
          { name: "Clarkson", type: "Community" },
          { name: "Dixie", type: "Community" },
          { name: "Erindale", type: "Community" },
          { name: "Hurontario", type: "Community" },
          { name: "Lorne Park", type: "Community" },
          { name: "Meadowvale", type: "Community" },
          { name: "Mineola", type: "Community" },
          { name: "Port Credit", type: "Community" },
          { name: "Sheridan Park", type: "Community" },
          { name: "Western Business Park", type: "Community" },
        ],
      },
    ],
  },
};

async function seedLocationData() {
  try {
    console.log("🌱 Starting location data seeding...");

    // Connect to database
    await connectDatabase();
    console.log("✅ Connected to MongoDB");

    // Clear existing data (optional - remove if you want to keep existing data)
    console.log("🗑️ Clearing existing location data...");
    await Community.deleteMany({});
    await Municipality.deleteMany({});
    await Area.deleteMany({});
    console.log("✅ Cleared existing location data");

    // Create Area
    console.log("🏢 Creating Area...");
    const area = new Area({
      name: locationData.area.name,
      type: locationData.area.type,
      municipalities: [],
    });
    await area.save();
    console.log(`✅ Created Area: ${area.name} (ID: ${area._id})`);

    // Create Municipalities and Communities
    const municipalityIds: Types.ObjectId[] = [];

    for (const municipalityData of locationData.area.municipalities) {
      console.log(`🏘️ Creating Municipality: ${municipalityData.name}...`);

      const municipality = new Municipality({
        name: municipalityData.name,
        type: municipalityData.type,
        areaId: area._id,
        communities: [],
      });
      await municipality.save();
      municipalityIds.push(municipality._id as Types.ObjectId);

      console.log(
        `✅ Created Municipality: ${municipality.name} (ID: ${municipality._id})`
      );

      // Create Communities for this Municipality
      const communityIds: Types.ObjectId[] = [];

      for (const communityData of municipalityData.communities) {
        console.log(`🏠 Creating Community: ${communityData.name}...`);

        const community = new Community({
          name: communityData.name,
          type: communityData.type,
          municipalityId: municipality._id,
          areaId: area._id,
        });
        await community.save();
        communityIds.push(community._id as Types.ObjectId);

        console.log(
          `✅ Created Community: ${community.name} (ID: ${community._id})`
        );
      }

      // Update Municipality with Community IDs
      municipality.communities = communityIds;
      await municipality.save();
      console.log(
        `✅ Updated Municipality ${municipality.name} with ${communityIds.length} communities`
      );
    }

    // Update Area with Municipality IDs
    area.municipalities = municipalityIds;
    await area.save();
    console.log(
      `✅ Updated Area ${area.name} with ${municipalityIds.length} municipalities`
    );

    // Verify the data
    console.log("\n📊 Verification:");
    const totalAreas = await Area.countDocuments();
    const totalMunicipalities = await Municipality.countDocuments();
    const totalCommunities = await Community.countDocuments();

    console.log(`📈 Total Areas: ${totalAreas}`);
    console.log(`📈 Total Municipalities: ${totalMunicipalities}`);
    console.log(`📈 Total Communities: ${totalCommunities}`);

    // Show sample data
    console.log("\n🔍 Sample Data:");
    const sampleArea = await Area.findOne().populate({
      path: "municipalities",
      populate: {
        path: "communities",
        model: "Community",
      },
    });

    if (sampleArea) {
      console.log(`Area: ${sampleArea.name}`);
      console.log(`Municipalities: ${sampleArea.municipalities.length}`);
      if (sampleArea.municipalities.length > 0) {
        const firstMunicipality = sampleArea.municipalities[0] as any;
        console.log(`First Municipality: ${firstMunicipality.name}`);
        console.log(
          `Communities in ${firstMunicipality.name}: ${firstMunicipality.communities.length}`
        );
        if (firstMunicipality.communities.length > 0) {
          console.log(
            `First Community: ${firstMunicipality.communities[0].name}`
          );
        }
      }
    }

    console.log("\n🎉 Location data seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding location data:", error);
    throw error;
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
  }
}

// Run the seeding function
if (require.main === module) {
  seedLocationData()
    .then(() => {
      console.log("✅ Seeding process completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Seeding process failed:", error);
      process.exit(1);
    });
}

export default seedLocationData;
