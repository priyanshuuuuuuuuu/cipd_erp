'use strict';
const XLSX = require('xlsx');
const XLSX_PATH = 'C:\\Users\\parsh\\OneDrive\\Desktop\\BTP\\Attendance _ iPD-CP(Jan-Jun 2026).xlsx';

const wb = XLSX.readFile(XLSX_PATH, { cellDates: false, sheetStubs: true });
const ws = wb.Sheets['April 2026'];

if (!ws) {
  console.log('April 2026 sheet not found!');
  process.exit(1);
}

const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
console.log('--- RAW data (first 7 rows, first 30 cols) ---');
for (let r = 0; r < Math.min(7, data.length); r++) {
  const rowSlice = (data[r] || []).slice(0, 30);
  console.log(`Row[${r}]: ${JSON.stringify(rowSlice)}`);
}

const dataF = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
console.log('\n--- FORMATTED data (raw:false, first 7 rows, first 30 cols) ---');
for (let r = 0; r < Math.min(7, dataF.length); r++) {
  const rowSlice = (dataF[r] || []).slice(0, 30);
  console.log(`Row[${r}]: ${JSON.stringify(rowSlice)}`);
}
