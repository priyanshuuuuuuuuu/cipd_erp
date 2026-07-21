/**
 * Populates wifi_snapshots with realistic test data
 * for the 2026-03-31 sessions so attendance can be tested.
 *
 * Usage: node scripts/populate_test_snapshots.js
 */

<<<<<<< HEAD
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pvqxzbabstyhskhydbvl.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_KEY env var is not set. Add it to .env before running.');
=======
const SUPABASE_URL = 'https://pvqxzbabstyhskhydbvl.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
>>>>>>> 7658f2ac563b0494eb5d492cf1cc267b94a33e63

// Student MACs to include in test data
const STUDENT_MACS = [
  'c4:84:fc:06:e4:03',  // iPDCP2026W1
  '10:3f:44:8f:03:ef',  // iPDCP2026W2
  'b2:6d:e4:2e:c4:72',  // iPDCP2026W3
  'e4:84:d3:aa:2d:34',  // iPDCP2026W4
  'a8:8f:d9:b8:a2:ef',  // iPDCP2026W5
  'a8:ab:b5:50:84:d6',  // iPDCP2026W7
  'd0:49:7c:db:52:41',  // iPDCP2026W8
  'A4:83:E7:2B:9F:01',  // EN21CS1042
  '50:da:d6:74:2d:9f',  // iPDCP2026W9
  '1c:d1:07:46:54:2d',  // iPDCP2026W11
  '90:cd:e8:2a:80:a6',  // iPDCP2026W12
  '20:e4:6f:9f:e1:b3',  // iPDCP2026W14
  '40:d1:60:03:23:89',  // iPDCP2026W15
  '94:bb:43:a4:08:30',  // iPDCP2026W16
  'e8:88:43:01:14:a1',  // iPDCP2026W17
  '4c:f2:02:1d:2e:5d',  // iPDCP2026W18
  '48:ef:1c:2d:f7:e6',  // iPDCP2026W10
];

// Some random non-student MACs (noise)
const RANDOM_MACS = [
  'AA:BB:CC:11:22:33',
  'DD:EE:FF:44:55:66',
  '11:22:33:AA:BB:CC',
];

const DEVICE_NAMES = ['', 'android-abc', 'iPhone', 'Galaxy-S24', 'Pixel-8', 'OnePlus-12', 'Redmi', 'Realme', ''];

// Sessions on 2026-03-31
const SESSIONS = [
  { id: '19911232-b9c1-4812-acc8-d1f0a8bc1df0', start: '09:00', end: '10:30' },
  { id: 'e79c83eb-d183-4d3f-898f-0f62a95e8402', start: '10:45', end: '12:15' },
  { id: '82fe9b21-2d93-44a4-a5ed-5f0c96f73208', start: '13:00', end: '14:30' },
  { id: 'bc4ed861-23cb-4f08-b450-e3cb247481d9', start: '09:00', end: '10:30' },
];

const DATE = '2026-03-31';

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomSignal() {
  // Most students have signal 3-5, some have weak (1-2)
  const r = Math.random();
  if (r < 0.1) return 1;      // 10% weak
  if (r < 0.2) return 2;      // 10% weak
  if (r < 0.4) return 3;      // 20% medium
  if (r < 0.7) return 4;      // 30% good
  return 5;                    // 30% strong
}

function generateSnapshot(dateStr, timeStr, studentSubset) {
  const clients = [];

  // Add student devices
  studentSubset.forEach(mac => {
    clients.push({
      mac,
      name: DEVICE_NAMES[randomInt(0, DEVICE_NAMES.length - 1)],
      signal: `${randomSignal()} dBm`,
      ip: `192.168.1.${randomInt(10, 250)}`,
      duration: `${randomInt(1, 90)} min`,
      download: `${randomInt(1, 500)} MB`,
      upload: `${randomInt(1, 100)} MB`,
    });
  });

  // Add some random non-student devices
  RANDOM_MACS.forEach(mac => {
    if (Math.random() > 0.5) {
      clients.push({
        mac,
        name: 'Unknown',
        signal: `${randomSignal()} dBm`,
        ip: `192.168.1.${randomInt(200, 254)}`,
        duration: '',
        download: '',
        upload: '',
      });
    }
  });

  const captured_at = `${dateStr}T${timeStr}:00+05:30`;

  return {
    captured_at,
    iw_dump: JSON.stringify(clients),
    error: null,
  };
}

async function insertSnapshots(snapshots) {
  const batchSize = 20;
  for (let i = 0; i < snapshots.length; i += batchSize) {
    const batch = snapshots.slice(i, i + batchSize);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/wifi_snapshots`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error(`Batch ${i / batchSize + 1} failed:`, res.status, txt);
    } else {
      console.log(`  Inserted batch ${i / batchSize + 1} (${batch.length} snapshots)`);
    }
  }
}

async function main() {
  console.log('=== Populating test wifi_snapshots ===\n');

  const allSnapshots = [];

  // For each session, generate snapshots every 6 minutes
  for (const session of SESSIONS) {
    const [startH, startM] = session.start.split(':').map(Number);
    const [endH, endM] = session.end.split(':').map(Number);
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;

    console.log(`Session ${session.id.slice(0, 8)}... (${session.start}-${session.end})`);

    // Pick a random subset of students for this session (70-90% attendance)
    const attendanceRate = 0.7 + Math.random() * 0.2;
    const shuffled = [...STUDENT_MACS].sort(() => Math.random() - 0.5);
    const presentStudents = shuffled.slice(0, Math.floor(shuffled.length * attendanceRate));

    console.log(`  ${presentStudents.length}/${STUDENT_MACS.length} students present`);

    // Generate a snapshot every 6 minutes
    let snapshotCount = 0;
    for (let min = startMin; min <= endMin + 2; min += 6) {
      const h = String(Math.floor(min / 60)).padStart(2, '0');
      const m = String(min % 60).padStart(2, '0');

      // Each snapshot has slightly different subset (some students may step out briefly)
      const thisSnapshot = presentStudents.filter(() => Math.random() > 0.05); // 5% chance of missing a ping

      const snap = generateSnapshot(DATE, `${h}:${m}`, thisSnapshot);
      allSnapshots.push(snap);
      snapshotCount++;
    }

    console.log(`  Generated ${snapshotCount} snapshots\n`);
  }

  console.log(`Total snapshots to insert: ${allSnapshots.length}`);
  await insertSnapshots(allSnapshots);

  console.log('\n✓ Done! Test data populated for', DATE);
}

main().catch(console.error);
