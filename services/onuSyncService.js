/**
 * Service: Sinkronisasi Nama ONU (OLT) dengan Data Pelanggan.
 *
 * Mengganti nama ONU di perangkat OLT menjadi pppoe_username / nama pelanggan
 * secara otomatis. Pencocokan dilakukan dari beberapa sumber, urutannya:
 *  1. onu.customer_id hasil enrichment stats (macMap / tag / tagTail),
 *  2. mac_address pelanggan (cocok dengan serial/MAC ONU),
 *  3. caller-id sesi PPPoE aktif dari router (untuk ONU yang baru aktif).
 */
const { logger } = require('../config/logger');
const db = require('../config/database');
const oltService = require('./oltService');
const mikrotikService = require('./mikrotikService');

function normalizeKey(s) {
  return String(s || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

/**
 * Tentukan target nama untuk satu ONU.
 * @returns {{customer: object|null, target: string|null, via: string|null}}
 */
function resolveOnuTarget(onu, byId, byMac, byUser, macToUser) {
  const snNorm = normalizeKey(onu.sn);
  let customer = onu.customer_id ? byId.get(onu.customer_id) : null;
  let via = 'mac_map';
  if (!customer) {
    if (snNorm && byMac.has(snNorm)) {
      customer = byMac.get(snNorm);
      via = 'mac_map';
    } else if (snNorm && macToUser.has(snNorm)) {
      const uname = macToUser.get(snNorm);
      customer = byUser.get(uname) || null;
      via = customer ? 'pppoe_live' : null;
    }
  }
  if (!customer) return { customer: null, target: null, via: null };
  const target = (customer.pppoe_username && String(customer.pppoe_username).trim())
    ? String(customer.pppoe_username).trim()
    : String(customer.name || '').trim();
  return { customer, target, via };
}

/**
 * Sinkronkan nama ONU pada satu OLT.
 * @param {number|string} oltId
 * @param {{dryRun?: boolean}} opts
 */
async function syncOnuCustomerNames(oltId, opts = {}) {
  const dryRun = !!opts.dryRun;
  const olt = oltService.getOltById(oltId);
  if (!olt) throw new Error('OLT tidak ditemukan');

  const stats = await oltService.getOltStats(oltId, true);
  const onus = stats.onus || [];

  const custs = db.prepare('SELECT id, name, pppoe_username, mac_address FROM customers').all() || [];
  const byId = new Map(custs.map((c) => [c.id, c]));
  const byMac = new Map();
  const byUser = new Map();
  for (const c of custs) {
    if (c.mac_address) byMac.set(normalizeKey(c.mac_address), c);
    if (c.pppoe_username) byUser.set(String(c.pppoe_username).trim().toLowerCase(), c);
  }

  const sessions = await mikrotikService.getActivePppoeSessionsMap();
  const macToUser = new Map();
  for (const [username, s] of sessions.entries()) {
    const m = normalizeKey(s.callerId);
    if (m && !macToUser.has(m)) macToUser.set(m, username);
  }

  const summary = {
    oltId: olt.id,
    oltName: olt.name,
    total: onus.length,
    renamed: 0,
    failed: 0,
    same: 0,
    unmatch: 0,
    errors: []
  };

  for (const onu of onus) {
    const { customer, target, via } = resolveOnuTarget(onu, byId, byMac, byUser, macToUser);
    if (!customer || !target) {
      summary.unmatch++;
      continue;
    }
    const writable = target.slice(0, 30);
    if (String(onu.name || '').trim() === writable) {
      summary.same++;
      continue;
    }
    try {
      if (!dryRun) {
        await oltService.renameOnu(oltId, onu.index, target);
      }
      summary.renamed++;
      logger.info(`[SyncONU] ${dryRun ? '[DRY-RUN] akan rename' : 'rename'} ${onu.id} (${onu.sn}) => ${target} (${via})`);
    } catch (err) {
      summary.failed++;
      summary.errors.push({ onu: onu.id, sn: onu.sn, target, error: err.message });
      logger.error(`[SyncONU] Gagal rename ${onu.id} => ${target}: ${err.message}`);
    }
  }

  return summary;
}

/**
 * Sinkronkan semua OLT aktif.
 * @param {{dryRun?: boolean}} opts
 */
async function syncAllOnuNames(opts = {}) {
  const olts = (oltService.getAllOlts() || []).filter(
    (o) => o.is_active === 1 || o.is_active === true
  );
  const results = [];
  for (const olt of olts) {
    try {
      results.push(await syncOnuCustomerNames(olt.id, opts));
    } catch (err) {
      results.push({ oltId: olt.id, oltName: olt.name, total: 0, renamed: 0, failed: 1, same: 0, unmatch: 0, errors: [{ error: err.message }] });
    }
  }
  return results;
}

module.exports = { syncOnuCustomerNames, syncAllOnuNames };