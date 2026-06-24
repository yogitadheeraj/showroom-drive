import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Location } from '../models/Location.js';

async function main() {
  console.log('Starting Location.brands migration...');
  if (!env.mongoUri) {
    console.error('MONGODB_URI is not set. Export it and re-run using `npx tsx src/scripts/migrate_location_brands.ts`.');
    process.exit(1);
  }

  await mongoose.connect(env.mongoUri);
  console.log('Connected to MongoDB');

  const cursor = Location.find().cursor();
  let total = 0;
  let updated = 0;

  for await (const doc of cursor) {
    total += 1;
    const loc: any = doc.toObject ? doc.toObject() : { ...doc };
    const original = JSON.stringify(loc.brands || []);

    // Normalize brands to array of { name: string, is_active: boolean }
    let normalized: any[] = [];
    if (Array.isArray(loc.brands)) {
      normalized = loc.brands
        .map((b: any) => {
          if (typeof b === 'string') return { name: b, is_active: true };
          if (b && typeof b === 'object') return { name: b.name ?? String(b), is_active: typeof b.is_active === 'boolean' ? b.is_active : true };
          return null;
        })
        .filter(Boolean);
    } else if (loc.brands && typeof loc.brands === 'string') {
      normalized = [{ name: loc.brands, is_active: true }];
    } else if (loc.brands && typeof loc.brands === 'object') {
      normalized = [{ name: loc.brands.name ?? String(loc.brands), is_active: loc.brands.is_active ?? true }];
    }

    const newJson = JSON.stringify(normalized);
    if (newJson !== original) {
      await Location.updateOne({ id: loc.id }, { $set: { brands: normalized, updated_at: new Date().toISOString() } });
      updated += 1;
      console.log(`Updated location ${loc.id} — brands normalized (${original} -> ${newJson})`);
    }
  }

  console.log(`Done. Scanned ${total} locations, updated ${updated}.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Migration failed', err);
  process.exit(2);
});
