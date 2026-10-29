/**
 * Creates the first administrator.   Usage: npm run seed:admin
 * Reads SEED_ADMIN_* values from apps/web/.env.local (or the process environment).
 */
import { config } from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserModel } from '../src/models/User';
import { connectWithDnsFallback } from '../src/lib/db/dns-fallback';

config({ path: '.env.local' });
config();

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  const email = (process.env.SEED_ADMIN_EMAIL ?? '').toLowerCase().trim();
  const password = process.env.SEED_ADMIN_PASSWORD ?? '';
  const name = process.env.SEED_ADMIN_NAME ?? 'Administrator';

  if (!uri || !email || password.length < 8) {
    throw new Error('Set MONGODB_URI, SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (min 8 chars).');
  }

  await connectWithDnsFallback(uri, () => mongoose.connect(uri));
  await UserModel.syncIndexes();

  const existing = await UserModel.exists({ email, isDeleted: false });
  if (existing) {
    console.log(`✔ Admin ${email} already exists – nothing to do.`);
  } else {
    await UserModel.create({
      name,
      email,
      role: 'admin',
      passwordHash: await bcrypt.hash(password, 12),
    });
    console.log(`✔ Admin ${email} created. Change the password after the first login.`);
  }
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('✖', error instanceof Error ? error.message : error);
  process.exit(1);
});
