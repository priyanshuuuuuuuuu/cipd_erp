/**
 * parse_schedules.mjs
 * Reads all PDF schedule files from Data/Schedule/
 * Extracts date + slot timings and outputs Data/schedule_times.xlsx
 */

import { createRequire } from 'module';
const require    = createRequire(import.meta.url);
const pdfParse   = require('pdf-parse');
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEDULE_DIR = path.resolve(__dirname, '../../Data/Schedule');
const OUTPUT_FILE  = path.resolve(__dirname, '../../Data/schedule_times.xlsx');

// ── Time parsing helpers ──────────────────────────────────────────────────────
function parseTimeTo24h(t) {
  if (!t) return null;
  t = t.trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\./g, ':')
    .replace(/–|-/g, '-');

  // e.g. "9:30 am", "11 am", "1:30 pm", "13:00"
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2] || '0', 10);
  const meridiem = m[3];
  if (meridiem === 'pm' && h !== 12) h += 12;
  if (meridiem === 'am' && h === 12) h = 0;
  return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
}

// Parse "9:30 am - 11 am" → { start: "09:30", end: "11:00" }
function parseTimeRange(rangeStr) {
  if (!rangeStr) return null;
  const parts = rangeStr.split(/\s*[–\-]\s*/);
  if (parts.length < 2) return null;
  const start = parseTimeTo24h(parts[0].trim());
  const end   = parseTimeTo24h(parts[parts.length - 1].trim());
  if (!start || !end) return null;
  return { start, end };
}

// Parse date strings like "02-02-2026", "2-02-2026", "02/02/2026"
function parseDateStr(s) {
  const m = s.match(/(\d{1,2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (!m) return null;
  return m[3] + '-' + m[2].padStart(2,'0') + '-' + m[1].padStart(2,'0');
}

// ── Main extraction logic ─────────────────────────────────────────────────────
async function extractFromPDF(filePath) {
  const buf  = fs.readFileSync(filePath);
  const data = await pdfParse(buf);
  const text = data.text;

  console.log(`\n--- ${path.basename(filePath)} ---`);
  // Uncomment to debug raw text:
  // console.log(text);

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const results = [];

  // Strategy: find lines that look like dates, then find time ranges near them
  // The PDF text is extracted roughly left-to-right, top-to-bottom per row
  // Typical pattern in these PDFs:
  //   "02-02-2026"  (or "02-02-2026 (Monday)")
  //   "9:30 am - 11 am"   ← slot1 header
  //   ... session content ...
  //   "11:15 am – 1 pm"   ← slot2 header
  //   etc.

  // Find all time ranges in the text
  const timeRangeRegex = /\d{1,2}(?::\d{2})?\s*(?:am|pm)\s*[–\-]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)/gi;
  const dateRegex      = /(\d{1,2})[\/\-](\d{2})[\/\-](202\d)/g;

  // Pass 1: find all dates with their line index
  const dateEntries = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/(\d{1,2})[\/\-](\d{2})[\/\-](202\d)/);
    if (m) {
      const iso = m[3] + '-' + m[2].padStart(2,'0') + '-' + m[1].padStart(2,'0');
      dateEntries.push({ date: iso, lineIdx: i });
    }
  }

  // Pass 2: for each date, collect all time ranges between this date and the next date
  for (let di = 0; di < dateEntries.length; di++) {
    const { date, lineIdx } = dateEntries[di];
    const nextLineIdx = di + 1 < dateEntries.length ? dateEntries[di + 1].lineIdx : lines.length;

    // Collect the text block for this date
    const block = lines.slice(lineIdx, nextLineIdx).join(' ');

    // Find all time ranges in this block
    const found = [];
    let m2;
    const re = /(\d{1,2}(?::\d{2})?)\s*(am|pm)\s*[–\-]\s*(\d{1,2}(?::\d{2})?)\s*(am|pm)/gi;
    re.lastIndex = 0;
    while ((m2 = re.exec(block)) !== null) {
      const startStr = m2[1] + ' ' + m2[2];
      const endStr   = m2[3] + ' ' + m2[4];
      const start    = parseTimeTo24h(startStr);
      const end      = parseTimeTo24h(endStr);
      if (start && end) found.push({ start, end });
    }

    // Deduplicate while preserving order
    const seen = new Set();
    const unique = found.filter(t => {
      const k = t.start + '-' + t.end;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });

    // Sort by start time
    unique.sort((a, b) => a.start.localeCompare(b.start));

    if (unique.length >= 2) {
      const row = {
        date,
        slot1_start: unique[0]?.start || '',
        slot1_end:   unique[0]?.end   || '',
        slot2_start: unique[1]?.start || '',
        slot2_end:   unique[1]?.end   || '',
        slot3_start: unique[2]?.start || '',
        slot3_end:   unique[2]?.end   || '',
        slot4_start: unique[3]?.start || '',
        slot4_end:   unique[3]?.end   || '',
      };
      results.push(row);
      console.log(`  ${date}: ${unique.map(t => t.start+'-'+t.end).join(' | ')}`);
    } else {
      console.log(`  ${date}: WARN — only ${unique.length} time ranges found`);
    }
  }

  return results;
}

// ── Entry point ───────────────────────────────────────────────────────────────
async function main() {
  const files = fs.readdirSync(SCHEDULE_DIR)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .sort()
    .map(f => path.join(SCHEDULE_DIR, f));

  console.log(`Found ${files.length} PDF(s) in ${SCHEDULE_DIR}`);

  const allRows = [];
  for (const f of files) {
    try {
      const rows = await extractFromPDF(f);
      allRows.push(...rows);
    } catch (e) {
      console.error(`ERROR reading ${path.basename(f)}: ${e.message}`);
    }
  }

  // Deduplicate by date (keep last occurrence)
  const byDate = {};
  for (const r of allRows) byDate[r.date] = r;
  const finalRows = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));

  console.log(`\nTotal unique dates extracted: ${finalRows.length}`);

  // Write to Excel
  const ws = xlsx.utils.json_to_sheet(finalRows, {
    header: ['date','slot1_start','slot1_end','slot2_start','slot2_end','slot3_start','slot3_end','slot4_start','slot4_end']
  });
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Schedule');
  xlsx.writeFile(wb, OUTPUT_FILE);
  console.log(`\nSaved: ${OUTPUT_FILE}`);
  console.log('\nPlease review this Excel file before running fix_session_times.mjs');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
