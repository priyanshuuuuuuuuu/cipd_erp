const fs = require('fs');
const path = require('path');

const dir = 'C:\\Users\\parsh\\OneDrive\\Desktop\\BTP\\cipd_erp\\supabase\\schemas';
let out = '-- 1. CREATE TABLES\n\n';

const tables = JSON.parse(fs.readFileSync(path.join(dir, 'tables.json'), 'utf8'));
tables.forEach(t => out += t.create_table + '\n\n');

out += '-- 2. PRIMARY KEYS\n\n';
const pks = JSON.parse(fs.readFileSync(path.join(dir, 'primaryKey.json'), 'utf8'));
pks.forEach(p => out += p['?column?'] + '\n\n');

out += '-- 3. FOREIGN KEYS\n\n';
const fks = JSON.parse(fs.readFileSync(path.join(dir, 'foreignKey.json'), 'utf8'));
fks.forEach(f => out += f['?column?'] + '\n\n');

out += '-- 4. INDEXES\n\n';
const idxs = JSON.parse(fs.readFileSync(path.join(dir, 'indexes.json'), 'utf8'));
idxs.forEach(i => out += i.indexdef + ';\n\n');

fs.writeFileSync(path.join(dir, 'schema_update.sql'), out);
console.log('Schema update script created at:', path.join(dir, 'schema_update.sql'));
