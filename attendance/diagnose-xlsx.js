'use strict';
// Quick diagnostic: prints first 7 rows + first 12 columns of every sheet
// Run: node diagnose-xlsx.js

const XLSX = require('xlsx');
const XLSX_PATH = 'C:\\Users\\parsh\\OneDrive\\Desktop\\BTP\\Attendance _ iPD-CP(Jan-Jun 2026).xlsx';

const wb = XLSX.readFile(XLSX_PATH, { cellDates: false, sheetStubs: true });
console.log('Sheets:', wb.SheetNames.join(', '), '\n');

for (const sheetName of wb.SheetNames.slice(0, 2)) { // just first 2 sheets
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SHEET: "${sheetName}"`);
  console.log('='.repeat(60));

  const ws   = wb.Sheets[sheetName];

  // 1. Print raw !merges count
  const merges = ws['!merges'] || [];
  console.log(`Merge count: ${merges.length}`);
  console.log('First 5 merges:', JSON.stringify(merges.slice(0, 5)));

  // 2. Print raw sheet range
  console.log('Sheet range:', ws['!ref']);

  // 3. Print raw cell values for first 7 rows, cols A-M (0-12)
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
  console.log('\n--- RAW data (first 7 rows, first 12 cols) ---');
  for (let r = 0; r < Math.min(7, data.length); r++) {
    const rowSlice = (data[r] || []).slice(0, 12);
    console.log(`Row[${r}]: ${JSON.stringify(rowSlice)}`);
  }

  // 4. Print formatted (raw:false) cell values
  const dataF = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
  console.log('\n--- FORMATTED data (raw:false, first 7 rows, first 12 cols) ---');
  for (let r = 0; r < Math.min(7, dataF.length); r++) {
    const rowSlice = (dataF[r] || []).slice(0, 12);
    console.log(`Row[${r}]: ${JSON.stringify(rowSlice)}`);
  }

  // 5. Check specific cell types for row 1 (date row), cols 2-5
  console.log('\n--- Cell type/value for row 1 (date row), cols C-F ---');
  const cols = ['C','D','E','F'];
  for (const col of cols) {
    const addr  = `${col}2`; // Excel row 2 = 0-indexed row 1
    const cell  = ws[addr];
    if (cell) {
      console.log(`  ${addr}: type=${cell.t}, value=${JSON.stringify(cell.v)}, formatted=${JSON.stringify(cell.w)}`);
    } else {
      console.log(`  ${addr}: (empty/missing)`);
    }
  }
}
