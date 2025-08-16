import mongoose from 'mongoose';
import { env } from '../config/env';
import User from '../models/User';

async function main(): Promise<void> {
  await mongoose.connect(env.mongoUri);
  
  // Create test users if they don't exist
  const testUsers = [
    {
      name: 'Super Admin',
      email: 'superadmin@knockwise.io',
      password: 'Admin@12345',
      role: 'SUPERADMIN',
    },
    {
      name: 'Sub Admin',
      email: 'subadmin@knockwise.io',
      password: 'Admin@12345',
      role: 'SUBADMIN',
    },
    {
      name: 'Sales Agent',
      email: 'agent@knockwise.io',
      password: 'Admin@12345',
      role: 'AGENT',
    },
  ];

  for (const userData of testUsers) {
    const existing = await User.findOne({ email: userData.email });
    if (!existing) {
      await User.create(userData);
      console.log(`Seeded ${userData.role}: ${userData.email} / ${userData.password}`);
    } else {
      console.log(`${userData.role} already exists: ${userData.email}`);
    }
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


