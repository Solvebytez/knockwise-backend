import mongoose from 'mongoose';
import { env } from '../config/env';
import Team from '../models/Team';

async function main(): Promise<void> {
  await mongoose.connect(env.mongoUri);
  
  console.log('Starting team migration...');
  
  try {
    // Use raw MongoDB query to find teams with superadminId field
    if (!mongoose.connection.db) {
      throw new Error('Database connection not available');
    }
    
    const teams = await mongoose.connection.db.collection('teams').find({ superadminId: { $exists: true } }).toArray();
    
    console.log(`Found ${teams.length} teams to migrate`);
    
    for (const team of teams) {
      console.log(`Migrating team: ${team.name}`);
      
      // Update the team to use createdBy instead of superadminId
      await mongoose.connection.db.collection('teams').updateOne(
        { _id: team._id },
        {
          $set: { createdBy: team.superadminId },
          $unset: { superadminId: 1 }
        }
      );
      
      console.log(`✓ Migrated team: ${team.name}`);
    }
    
    console.log('Team migration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
  }
  
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
