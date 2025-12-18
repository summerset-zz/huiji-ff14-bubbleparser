// Simple scanner for tabx chunk JSON files
// Usage: node tools/checkChunkConstraints.js output/unified_npc_balloon_chunk_9.json

const fs = require('fs');
const path = require('path');

function scanFile(filePath) {
  const abs = path.resolve(filePath);
  const raw = fs.readFileSync(abs, 'utf-8');
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse JSON:', e.message);
    process.exit(1);
  }

  if (!json || !Array.isArray(json.data)) {
    console.error('Invalid format: missing data array');
    process.exit(1);
  }

  const violations = [];

  for (let r = 0; r < json.data.length; r++) {
    const row = json.data[r];
    if (!Array.isArray(row)) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (typeof cell !== 'string') continue;
      const len = cell.length;
      const hasTab = /\t/.test(cell);
      const startsSpace = cell.startsWith(' ');
      const endsSpace = cell.endsWith(' ');
      if (len > 400 || hasTab || startsSpace || endsSpace) {
        violations.push({ r, c, len, hasTab, startsSpace, endsSpace, sample: cell.slice(0, 120) });
      }
    }
  }

  if (violations.length === 0) {
    console.log('No violations found.');
    return;
  }

  console.log(`Found ${violations.length} violation(s):`);
  for (const v of violations) {
    console.log(
      `- row=${v.r} col=${v.c} len=${v.len} tab=${v.hasTab} startSpace=${v.startsSpace} endSpace=${v.endsSpace}\n  sample: ${JSON.stringify(v.sample)}`
    );
  }
}

const target = process.argv[2] || 'output/unified_npc_balloon_chunk_9.json';
scanFile(target);
