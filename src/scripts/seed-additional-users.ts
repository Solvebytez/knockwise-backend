import mongoose from "mongoose";
import { env } from "../config/env";
import User from "../models/User";

async function main(): Promise<void> {
  await mongoose.connect(env.mongoUri);

  console.log("Creating additional SubAdmin and SalesRep users...");

  // Additional SubAdmin users
  const subAdminUsers = [
    {
      name: "Jennifer Martinez",
      email: "jennifer.martinez@knockwise.io",
      username: "jennifer_m",
      contactNumber: "+1-555-0101",
      password: "Admin@12345",
      role: "SUBADMIN",
      status: "ACTIVE",
      assignmentStatus: "UNASSIGNED",
      timezone: "America/New_York",
    },
    {
      name: "David Thompson",
      email: "david.thompson@knockwise.io",
      username: "david_t",
      contactNumber: "+1-555-0102",
      password: "Admin@12345",
      role: "SUBADMIN",
      status: "ACTIVE",
      assignmentStatus: "UNASSIGNED",
      timezone: "America/Chicago",
    },
    {
      name: "Emily Rodriguez",
      email: "emily.rodriguez@knockwise.io",
      username: "emily_r",
      contactNumber: "+1-555-0103",
      password: "Admin@12345",
      role: "SUBADMIN",
      status: "ACTIVE",
      assignmentStatus: "UNASSIGNED",
      timezone: "America/Los_Angeles",
    },
  ];

  // Additional SalesRep (AGENT) users
  const salesRepUsers = [
    {
      name: "Michael Chen",
      email: "michael.chen@knockwise.io",
      username: "michael_c",
      contactNumber: "+1-555-0201",
      password: "Agent@12345",
      role: "AGENT",
      status: "ACTIVE",
      assignmentStatus: "UNASSIGNED",
      timezone: "America/New_York",
    },
    {
      name: "Amanda Foster",
      email: "amanda.foster@knockwise.io",
      username: "amanda_f",
      contactNumber: "+1-555-0202",
      password: "Agent@12345",
      role: "AGENT",
      status: "ACTIVE",
      assignmentStatus: "UNASSIGNED",
      timezone: "America/Chicago",
    },
    {
      name: "Robert Kim",
      email: "robert.kim@knockwise.io",
      username: "robert_k",
      contactNumber: "+1-555-0203",
      password: "Agent@12345",
      role: "AGENT",
      status: "ACTIVE",
      assignmentStatus: "UNASSIGNED",
      timezone: "America/Los_Angeles",
    },
    {
      name: "Jessica Brown",
      email: "jessica.brown@knockwise.io",
      username: "jessica_b",
      contactNumber: "+1-555-0204",
      password: "Agent@12345",
      role: "AGENT",
      status: "ACTIVE",
      assignmentStatus: "UNASSIGNED",
      timezone: "America/New_York",
    },
    {
      name: "Christopher Lee",
      email: "christopher.lee@knockwise.io",
      username: "christopher_l",
      contactNumber: "+1-555-0205",
      password: "Agent@12345",
      role: "AGENT",
      status: "ACTIVE",
      assignmentStatus: "UNASSIGNED",
      timezone: "America/Denver",
    },
    {
      name: "Samantha Taylor",
      email: "samantha.taylor@knockwise.io",
      username: "samantha_t",
      contactNumber: "+1-555-0206",
      password: "Agent@12345",
      role: "AGENT",
      status: "ACTIVE",
      assignmentStatus: "UNASSIGNED",
      timezone: "America/Phoenix",
    },
    {
      name: "Daniel Garcia",
      email: "daniel.garcia@knockwise.io",
      username: "daniel_g",
      contactNumber: "+1-555-0207",
      password: "Agent@12345",
      role: "AGENT",
      status: "ACTIVE",
      assignmentStatus: "UNASSIGNED",
      timezone: "America/Los_Angeles",
    },
    {
      name: "Ashley White",
      email: "ashley.white@knockwise.io",
      username: "ashley_w",
      contactNumber: "+1-555-0208",
      password: "Agent@12345",
      role: "AGENT",
      status: "ACTIVE",
      assignmentStatus: "UNASSIGNED",
      timezone: "America/New_York",
    },
  ];

  // Create SubAdmin users
  console.log("\n=== Creating SubAdmin Users ===");
  for (const userData of subAdminUsers) {
    const existing = await User.findOne({ email: userData.email });
    if (!existing) {
      await User.create(userData);
      console.log(`✓ Created SubAdmin: ${userData.name} (${userData.email})`);
    } else {
      console.log(
        `⚠ SubAdmin already exists: ${existing.name} (${existing.email})`
      );
    }
  }

  // Create SalesRep users
  console.log("\n=== Creating SalesRep Users ===");
  for (const userData of salesRepUsers) {
    const existing = await User.findOne({ email: userData.email });
    if (!existing) {
      await User.create(userData);
      console.log(`✓ Created SalesRep: ${userData.name} (${userData.email})`);
    } else {
      console.log(
        `⚠ SalesRep already exists: ${existing.name} (${existing.email})`
      );
    }
  }

  console.log("\n=== Summary ===");
  console.log(`SubAdmin users: ${subAdminUsers.length} total`);
  console.log(`SalesRep users: ${salesRepUsers.length} total`);
  console.log("\nAll users created successfully!");

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("Error creating additional users:", e);
  process.exit(1);
});
