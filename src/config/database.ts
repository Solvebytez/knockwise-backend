import mongoose from 'mongoose';
import { env } from './env';

export async function connectDatabase(): Promise<void> {
  const uri = env.mongoUri;
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
}

export default connectDatabase;


