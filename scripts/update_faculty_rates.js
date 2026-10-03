// One-off script to update all faculty honorarium rates to 2000
// Run: node update_faculty_rates.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../client-next/.env') });

const postgres = require(path.resolve(__dirname, '../client-next/node_modules/postgres'));
const { drizzle } = require(path.resolve(__dirname, '../client-next/node_modules/drizzle-orm/postgres-js'));
const { faculty } = require(path.resolve(__dirname, '../client-next/drizzle/schema'));
const { ne } = require(path.resolve(__dirname, '../client-next/node_modules/drizzle-orm'));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is missing in client-next/.env');
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

async function run() {
  try {
    await db
      .update(faculty)
      .set({ honorariumRatePerHour: '2000' })
      .where(ne(faculty.id, '00000000-0000-0000-0000-000000000000'));

    console.log('✓ All faculty honorarium rates updated to ₹2,000/hr');
  } catch (error) {
    console.error('Error updating rates:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
