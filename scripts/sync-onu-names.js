#!/usr/bin/env node
/**
 * Jalankan manual sinkronisasi nama ONU untuk semua / OLT tertentu.
 *
 * Contoh:
 *   node scripts/sync-onu-names.js --dry-run
 *   node scripts/sync-onu-names.js --olt 1
 *   node scripts/sync-onu-names.js
 */
const oltService = require('../services/oltService');
const onuSync = require('../services/onuSyncService');

function printSummary(s) {
  const line = `${s.oltName} (id=${s.oltId}): total=${s.total}, rename=${s.renamed}, sama=${s.same}, belum-match=${s.unmatch}, gagal=${s.failed}`;
  console.log(line);
  for (const e of s.errors || []) {
    console.log(`  GAGAL ${e.onu || ''}${e.sn ? ' (' + e.sn + ')' : ''} => ${e.target || ''}: ${e.error || ''}`);
  }
}

(async () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const skipFill = args.includes('--skip-fill');
  const oltIdx = args.indexOf('--olt');
  const oltId = oltIdx >= 0 && args[oltIdx + 1] ? args[oltIdx + 1] : null;

  if (dryRun) console.log('MODE: DRY-RUN (tidak ada perubahan nyata)');

  if (!skipFill) {
    console.log('-- Auto-isi mac_address pelanggan dari PPPoE aktif --');
    const macSummary = await onuSync.syncCustomerMacFromPppoe({ dryRun });
    console.log(
      `PPPoE: total=${macSummary.total}, diisi=${macSummary.filled}, sudah-ada=${macSummary.skipped}, ` +
      `tanpa-pelanggan=${macSummary.noCustomer}, caller-id-invalid=${macSummary.invalid}, gagal=${macSummary.errors.length}`
    );
    for (const e of macSummary.errors) console.log(`  GAGAL ${e.customer}: ${e.error}`);
  }

  console.log('-- Sinkronisasi nama ONU --');
  if (oltId) {
    const summary = await onuSync.syncOnuCustomerNames(oltId, { dryRun });
    printSummary(summary);
  } else {
    const results = await onuSync.syncAllOnuNames({ dryRun });
    for (const s of results) printSummary(s);
  }
  process.exit(0);
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});