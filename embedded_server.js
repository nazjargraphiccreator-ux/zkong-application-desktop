/**
 * Zkong Desktop Application - Unofficial • Embedded Standalone Server (Zero-Dependency Node.js Engine)
 * Developed by Nazjar Dev. Runs 100% self-contained inside Electron Desktop.
 * Production Multi-Account Cloud Architecture for ZKong ESL Systems.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');
const XLSX = require('xlsx');

let syncLiveModule = null;
try {
    syncLiveModule = require('./sync_live_zkong');
} catch (e) {
    try {
        syncLiveModule = require(path.join(__dirname, 'sync_live_zkong.js'));
    } catch (e2) {}
}

// Determine directories (packaged or development)
const IS_PACKAGED = !process.defaultApp && (process.resourcesPath !== undefined && !__dirname.includes('node_modules'));
let ROOT_DIR = path.resolve(__dirname, '..');
if (IS_PACKAGED && fs.existsSync(path.join(process.resourcesPath, 'app', 'products.json'))) {
    ROOT_DIR = path.join(process.resourcesPath, 'app');
} else if (IS_PACKAGED && fs.existsSync(path.join(__dirname, 'products.json'))) {
    ROOT_DIR = __dirname;
}

const PUBLIC_DIR = fs.existsSync(path.join(__dirname, 'public')) ? path.join(__dirname, 'public') : path.join(ROOT_DIR, 'public');
const DATA_FILE = fs.existsSync(path.join(__dirname, 'products.json')) ? path.join(__dirname, 'products.json') : path.join(ROOT_DIR, 'products.json');
const CONFIG_FILE = fs.existsSync(path.join(__dirname, 'config.json')) ? path.join(__dirname, 'config.json') : path.join(ROOT_DIR, 'config.json');
const BACKUPS_DIR = path.join(path.dirname(DATA_FILE), 'backups');
const EXCEL_FILE = fs.existsSync(path.join(path.dirname(DATA_FILE), 'Single_ana.xlsx')) 
    ? path.join(path.dirname(DATA_FILE), 'Single_ana.xlsx') 
    : path.join(path.dirname(DATA_FILE), 'zkong_catalog.xlsx');
const TAGS_FILE = path.join(path.dirname(DATA_FILE), 'tags.json');

if (!fs.existsSync(BACKUPS_DIR)) {
    try { fs.mkdirSync(BACKUPS_DIR, { recursive: true }); } catch (e) {}
}

// Default Configuration - Generic & Production Ready
const DEFAULT_CONFIG = {
    port: 5050,
    cloud_url: "http://esl-eu.zkong.com:9999",
    cloud_user: "",
    cloud_pass: "",
    cloud_merchant_id: "",
    mw_store_id: "",
    auto_detect_liquids: true,
    vat_percent: 19,
    default_template_cat: "default",
    default_template_type: "2.9"
};

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
        }
    } catch (e) {
        console.error('[Config] Error loading config:', e);
    }
    return DEFAULT_CONFIG;
}

function saveConfig(cfg) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('[Config] Error saving config:', e);
        return false;
    }
}

function getTags() {
    try {
        const candidates = [
            TAGS_FILE,
            path.join(ROOT_DIR, 'tags.json'),
            path.join(__dirname, 'tags.json'),
            path.join(__dirname, '..', 'tags.json'),
            path.join(process.cwd(), 'tags.json'),
            path.join(process.cwd(), 'zkong-platform', 'tags.json')
        ];
        for (const f of candidates) {
            if (f && fs.existsSync(f)) {
                const data = JSON.parse(fs.readFileSync(f, 'utf8'));
                if (Array.isArray(data) && data.length > 0) return data;
            }
        }
    } catch (e) {
        console.error('[Tags] Error loading tags:', e);
    }
    return [];
}

// =========================================================================
// Real-Time Background ZKong Monitor Daemon (Auto-Update Watcher)
// =========================================================================
let watcherTimer = null;
const watcherStatus = {
    active: true,
    intervalSeconds: 30,
    lastCheck: null,
    lastModifiedCount: 0,
    totalChecks: 0,
    isChecking: false
};

async function runLiveWatcherCheck() {
    if (watcherStatus.isChecking) return;
    const cfg = loadConfig();
    if (!cfg.cloud_user || !cfg.cloud_pass) {
        return; // Awaiting user login
    }
    watcherStatus.isChecking = true;
    try {
        if (syncLiveModule && typeof syncLiveModule.syncFromZkongCloud === 'function') {
            const res = await syncLiveModule.syncFromZkongCloud();
            watcherStatus.lastCheck = new Date().toLocaleTimeString('ro-RO');
            watcherStatus.lastModifiedCount = res.updatedPricesCount || 0;
            watcherStatus.totalChecks++;
            if (res.updatedPricesCount > 0) {
                console.log(`[Live Watcher] ✓ S-au detectat ${res.updatedPricesCount} prețuri modificate în ZKong Cloud! Actualizat automat.`);
            }
        }
    } catch (e) {
        console.warn('[Live Watcher] Eroare la verificarea automată ZKong:', e.message);
    } finally {
        watcherStatus.isChecking = false;
    }
}

function startLiveWatcher(seconds = 30) {
    if (watcherTimer) clearInterval(watcherTimer);
    watcherStatus.active = true;
    watcherStatus.intervalSeconds = seconds;
    watcherTimer = setInterval(runLiveWatcherCheck, seconds * 1000);
    console.log(`[Live Watcher] Monitorizare live ZKong activă la fiecare ${seconds} secunde.`);
}

function stopLiveWatcher() {
    if (watcherTimer) clearInterval(watcherTimer);
    watcherTimer = null;
    watcherStatus.active = false;
    console.log('[Live Watcher] Monitorizare live ZKong oprită.');
}

// Non-solution terms (hardware, accessories)
const NON_SOLUTION_TERMS = [
    'dispenser', 'galeata', 'găleată', 'galeti', 'găleți',
    'manusi', 'mănuși', 'manusa', 'mănușă',
    'saci menajeri', 'sac menajer', 'saci gunoi', 'pungi',
    'prosop', 'hartie', 'hârtie', 'rola prosop', 'role prosop', 'rola laveta',
    'mop', 'rezerva mop', 'suport mop', 'coada mop', 'maner mop', 'storcator',
    'seringa', 'seringă', 'perie', 'racleta', 'racletă',
    'faras', 'făraș', 'matura', 'mătură', 'coada matura',
    'carucior', 'cărucior', 'pad tifon', 'burete', 'bureți',
    'laveta', 'lavetă', 'lavete', 'holder black 500', 'suport dispenser',
    'fluturas / microperfuzor', 'halat unica', 'bax role'
];

// Consumable solutions that must NEVER be treated as hardware
const CONSUMABLE_TERMS = [
    'sapun', 'săpun', 'detergent', 'gel', 'dezinfectant', 'degresant',
    'balsam', 'sampon', 'șampon', 'solutie', 'soluție', 'crema', 'cremă',
    'spuma', 'spumă', 'spray', 'pasta', 'pastă', 'lichid', 'lotiune',
    'loțiune', 'odorizant', 'parfum', 'detartrant', 'clor', 'inalbitor',
    'înălbitor', 'dekal', 'brillgel', 'aral', 'piatti', 'floorquat',
    'glitter', 'vigorgel', 'nefel', 'active', 'cleaner', 'decalcifiant'
];

function isHardware(name) {
    const n = String(name || '').toLowerCase();
    if (CONSUMABLE_TERMS.some(t => n.includes(t))) return false;
    return NON_SOLUTION_TERMS.some(t => n.includes(t));
}

// Autonomous unit price calculator conforming to HG 947/2000
function extractVolumeOrWeight(name, spec = '') {
    const s = String(spec || '').trim().toLowerCase();
    const n = String(name || '').trim().toLowerCase();

    if (isHardware(name)) {
        return { val: 0, unit: '', isLiquid: false, isSolid: false, formatted: null };
    }

    // 1. Multipack pattern in name: e.g. "2 x 5 L", "4x750ml", "3 x 5kg"
    const multiMatch = n.match(/\b(\d+)\s*[x\*]\s*(\d+(?:[.,]\d+)?)\s*(l|lt|litri|litru|ml|kg|g|gr)\b/i);
    if (multiMatch) {
        const count = parseInt(multiMatch[1], 10);
        let singleVal = parseFloat(multiMatch[2].replace(',', '.'));
        const u = multiMatch[3].toLowerCase();
        if (['l', 'lt', 'litri', 'litru'].includes(u)) {
            const total = count * singleVal;
            return { val: total, unit: 'litru', isLiquid: true, isSolid: false, formatted: `${count}x${singleVal}L` };
        } else if (u === 'ml') {
            const totalLiters = (count * singleVal) / 1000.0;
            return { val: totalLiters, unit: 'litru', isLiquid: true, isSolid: false, formatted: `${count}x${singleVal}ml` };
        } else if (u === 'kg') {
            const total = count * singleVal;
            return { val: total, unit: 'kg', isLiquid: false, isSolid: true, formatted: `${count}x${singleVal}kg` };
        } else if (['g', 'gr'].includes(u)) {
            const totalKg = (count * singleVal) / 1000.0;
            return { val: totalKg, unit: 'kg', isLiquid: false, isSolid: true, formatted: `${count}x${singleVal}g` };
        }
    }

    // 2. Direct Liter in name or spec
    const literMatch = n.match(/\b(\d+(?:[.,]\d+)?)\s*(?:l|lt|litri|litru)\b/i) || s.match(/\b(\d+(?:[.,]\d+)?)\s*(?:l|lt|litri|litru)\b/i);
    if (literMatch) {
        const v = parseFloat(literMatch[1].replace(',', '.'));
        if (v > 0 && v <= 100) {
            return { val: v, unit: 'litru', isLiquid: true, isSolid: false, formatted: `${v} L` };
        }
    }

    // 3. Direct ML in name or spec
    const mlMatch = n.match(/\b(\d+(?:[.,]\d+)?)\s*ml\b/i) || s.match(/\b(\d+(?:[.,]\d+)?)\s*ml\b/i);
    if (mlMatch) {
        let v = parseFloat(mlMatch[1].replace(',', '.'));
        if (v < 1.0 && v > 0) {
            return { val: v, unit: 'litru', isLiquid: true, isSolid: false, formatted: `${Math.round(v * 1000)} ml` };
        } else if (v >= 1.0 && v <= 5000) {
            return { val: v / 1000.0, unit: 'litru', isLiquid: true, isSolid: false, formatted: `${v} ml` };
        }
    }

    // 4. Direct KG in name or spec
    const kgMatch = n.match(/\b(\d+(?:[.,]\d+)?)\s*(?:kg|kilograme)\b/i) || s.match(/\b(\d+(?:[.,]\d+)?)\s*(?:kg|kilograme)\b/i);
    if (kgMatch) {
        const v = parseFloat(kgMatch[1].replace(',', '.'));
        if (v > 0 && v <= 100) {
            return { val: v, unit: 'kg', isLiquid: false, isSolid: true, formatted: `${v} kg` };
        }
    }

    // 5. Direct Grams in name or spec
    const gMatch = n.match(/\b(\d+(?:[.,]\d+)?)\s*(?:g|gr|grame)\b/i) || s.match(/\b(\d+(?:[.,]\d+)?)\s*(?:g|gr|grame)\b/i);
    if (gMatch) {
        const v = parseFloat(gMatch[1].replace(',', '.'));
        if (v >= 5 && v < 2000) {
            return { val: v / 1000.0, unit: 'kg', isLiquid: false, isSolid: true, formatted: `${v} g` };
        }
    }

    return { val: 0, unit: '', isLiquid: false, isSolid: false, formatted: null };
}

function calculateProductPpl(p) {
    const price = parseFloat(p.price || 0) || 0;
    const { val, unit, isLiquid, isSolid, formatted } = extractVolumeOrWeight(p.name, p.spec);

    let pricePerLiter = 0;
    let formattedPpl = '';
    let custFeature1 = '';

    if (val > 0 && price > 0) {
        pricePerLiter = Math.round((price / val) * 100) / 100;
        if (isLiquid) {
            formattedPpl = `${pricePerLiter.toFixed(2)} Lei / Litru`;
            custFeature1 = formattedPpl;
        } else if (isSolid) {
            formattedPpl = `${pricePerLiter.toFixed(2)} Lei / Kg`;
            custFeature1 = formattedPpl;
        }
    }

    p.isLiquid = isLiquid;
    p.isSolid = isSolid;
    p.unitType = isLiquid ? 'litru' : (isSolid ? 'kg' : '');
    p.quantity = val;
    p.liters = isLiquid ? val : 0;
    p.kg = isSolid ? val : 0;
    p.formattedVolume = formatted || (p.spec || '');
    if (!p.spec || p.spec.trim() === '' || p.spec.toLowerCase().includes('0.750 ml')) {
        p.spec = formatted || (isLiquid ? `${val} L` : (isSolid ? `${val} kg` : ''));
    }
    p.pricePerLiter = pricePerLiter;
    p.formattedPpl = formattedPpl;
    p.custFeature1 = custFeature1;
    p.templateCategory = 'default';
    p.templateType = '2.9';

    return p;
}

// Products Store
function getProducts() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('[Products] Error reading products:', e);
    }
    return [];
}

function saveProducts(products) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2), 'utf8');
        const altDataFile = path.resolve(ROOT_DIR, 'products.json');
        if (altDataFile !== DATA_FILE && fs.existsSync(altDataFile)) {
            try { fs.writeFileSync(altDataFile, JSON.stringify(products, null, 2), 'utf8'); } catch (e) {}
        }
        syncExcelFile(products);
        return true;
    } catch (e) {
        console.error('[Products] Error saving products:', e);
        return false;
    }
}

const HEADERS = [
    'Product Code', 'Product ID*', 'SKU（PLU）', 'Product name',
    'Original Price(supports up to five decimal places)',
    'Selling Price(supports up to five decimal places)',
    'Member Price', 'Template Category*', 'Template Type*', 'Sales unit',
    'Product grade', 'Country of origin', 'Specification',
    'Inventory 1', 'Inventory 2', 'Inventory 3', 'QR code URL', 'NFC URL',
    'Short product name', 'Promotion Start Time', 'Promotion End Time', 'Copy', 'Label',
    'Measurement type (1: by weight, 2: by count)', 'Listing status (1: listed, 2: delisted)',
    'Label number', 'Primary category', 'Secondary category',
    'Extended field 1', 'Extended field 2', 'Extended field 3', 'Extended field 4',
    'Extended field 5', 'Extended field 6', 'Extended field 7', 'Extended field 8',
    'Extended field 9', 'Extended field 10', 'Extended field 11', 'Extended field 12',
    'Extended field 13', 'Extended field 14', 'Extended field 15', 'Extended field 16',
    'Extended field 17', 'Extended field 18', 'Extended field 19', 'Extended field 20',
    'Extended field 21', 'Extended field 22', 'Extended field 23', 'Extended field 24',
    'Extended field 25', 'Extended field 26', 'Extended field 27', 'Extended field 28',
    'Extended field 29', 'Extended field 30', 'Extended field 31', 'Extended field 32',
    'Extended field 33', 'Extended field 34', 'Extended field 35', 'Extended field 36',
    'Extended field 37', 'Extended field 38', 'Extended field 39', 'Extended field 40',
    'Extended field 41', 'Extended field 42', 'Extended field 43', 'Extended field 44',
    'Extended field 45', 'Extended field 46', 'Extended field 47', 'Extended field 48',
    'Extended field 49', 'Extended field 50'
];

function syncExcelFile(products, customPath = null) {
    try {
        const excelRows = [HEADERS];
        for (const p of products) {
            const row = new Array(78).fill('');
            row[0] = p.barcode || '';
            row[1] = p.barcode || '';
            row[2] = p.sku || p.barcode || '';
            row[3] = p.name || '';
            row[4] = p.originalPrice ? parseFloat(p.originalPrice).toFixed(2) : (p.price ? parseFloat(p.price).toFixed(2) : '');
            row[5] = p.price ? parseFloat(p.price).toFixed(2) : '0.00';
            row[6] = '';
            row[7] = p.templateCategory || 'default';
            row[8] = p.templateType || '2.9';
            row[9] = p.unit || 'buc';
            row[10] = '';
            row[11] = '';
            row[12] = p.spec || p.formattedVolume || '';
            row[13] = p.stock !== undefined ? p.stock : 99;
            // Extended field 1 (Pret/Litru sau Kg HG 947/2000):
            row[28] = p.custFeature1 || '';
            excelRows.push(row);
        }

        const ws = XLSX.utils.aoa_to_sheet(excelRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Single_specification_Item');

        const roRows = products.map(p => ({
            'Cod Bare': p.barcode,
            'Denumire Produs': p.name,
            'Pret Vanzare (RON)': p.price ? parseFloat(p.price).toFixed(2) : '0.00',
            'Pret Vechi (RON)': p.originalPrice ? parseFloat(p.originalPrice).toFixed(2) : '',
            'Gramaj / Volum': p.spec || '',
            'Pret / Litru sau Kg': p.custFeature1 || '-',
            'Eticheta ESL Conectata': p.tagCode ? (p.tagCode + ' (Bat: ' + (p.tagBattery || 100) + '%)') : 'Nealocata',
            'Stoc': p.stock || 99
        }));
        const wsRo = XLSX.utils.json_to_sheet(roRows);
        XLSX.utils.book_append_sheet(wb, wsRo, 'Catalog_ZKong_ESL');

        if (customPath) {
            XLSX.writeFile(wb, customPath);
            return true;
        }

        const targets = [
            'C:/Users/Nazjar/Desktop/Single_ana.xlsx',
            EXCEL_FILE,
            path.resolve(ROOT_DIR, 'Single_ana.xlsx')
        ];
        for (const t of targets) {
            try {
                if (t.includes('Desktop') || fs.existsSync(path.dirname(t))) {
                    XLSX.writeFile(wb, t);
                }
            } catch (e) {}
        }
        return true;
    } catch (e) {
        console.error('[Excel] Error syncing Excel file:', e);
        return false;
    }
}

// ZKong Cloud Client with Native RSA Token Generation
let zkongSession = { token: null, ts: 0, agencyId: null, merchantId: null, storeId: null };

async function zkongLogin(force = false) {
    const config = loadConfig();
    const now = Date.now() / 1000;
    if (!force && zkongSession.token && (now - zkongSession.ts) < 300) {
        return zkongSession;
    }

    const base = config.cloud_url || "http://esl-eu.zkong.com:9999";
    const pkRes = await fetch(`${base}/user/getErpPublicKey`);
    const pkJson = await pkRes.json();
    if (!pkJson.data) {
        throw new Error(pkJson.message || 'Cheie publica indisponibila ZKong');
    }

    const derBuf = Buffer.from(pkJson.data, 'base64');
    const pubKey = crypto.createPublicKey({ key: derBuf, format: 'der', type: 'spki' });
    const encPass = crypto.publicEncrypt({
        key: pubKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
    }, Buffer.from(config.cloud_pass, 'utf8')).toString('base64');

    const loginRes = await fetch(`${base}/user/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            account: config.cloud_user,
            loginType: 3,
            password: encPass
        })
    });
    const loginJson = await loginRes.json();
    if (!loginJson.data || !loginJson.data.token) {
        throw new Error(loginJson.message || 'Autentificare respinsa de ZKong Cloud');
    }

    const cu = loginJson.data.currentUser || {};
    zkongSession = {
        token: loginJson.data.token,
        ts: now,
        base: base,
        agencyId: cu.agencyId || config.cloud_merchant_id,
        merchantId: cu.merchantId || config.cloud_merchant_id,
        storeId: config.mw_store_id || "1749214564196"
    };
    return zkongSession;
}

async function zkongBindTag(barcode, tagCode) {
    const s = await zkongLogin();
    const url = `${s.base}/bind/bindItemPriceTag/1`;
    const payload = {
        agencyId: s.agencyId,
        merchantId: s.merchantId,
        storeId: s.storeId,
        barCode: String(barcode).trim(),
        priceTagCode: String(tagCode).trim()
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': s.token },
        body: JSON.stringify(payload)
    });
    const data = await res.json();

    const ZKONG_ERRORS = {
        15069: 'Eticheta ESL nu este înregistrată în baza de date ZKong (verificați codul de pe spate).',
        15068: 'Eticheta este deja alocată la un alt produs în magazin.',
        15070: 'Codul de bare al produsului nu a fost găsit în ZKong Cloud (sincronizați catalogul mai întâi).',
        14014: 'Operațiune efectuată cu succes.'
    };

    const explanation = ZKONG_ERRORS[data.code] || data.message || 'Cod ZKong ' + data.code;
    return {
        success: data.code === 0 || data.code === 14014 || data.code === '0',
        code: data.code,
        message: data.message,
        explanation: explanation,
        raw: data
    };
}

async function zkongUnbindTag(barcode, tagCode) {
    const s = await zkongLogin();
    const url = `${s.base}/bind/deleteBindItem/`;
    const payload = {
        agencyId: s.agencyId,
        merchantId: s.merchantId,
        storeId: s.storeId,
        barCode: String(barcode).trim(),
        priceTagCode: String(tagCode).trim()
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': s.token },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    return {
        success: data.code === 0 || data.code === 14014 || data.code === '0',
        code: data.code,
        message: data.message,
        raw: data
    };
}

async function zkongPushProducts(products, batchSize = 200) {
    let s = await zkongLogin(true);
    const items = products.filter(p => p.barcode).map(p => ({
        barCode: String(p.barcode).trim(),
        itemTitle: p.name || '',
        price: p.price !== undefined ? Math.round(parseFloat(p.price) * 100) / 100 : undefined,
        originalPrice: p.originalPrice ? Math.round(parseFloat(p.originalPrice) * 100) / 100 : undefined,
        attrCategory: 'default',
        attrName: '2.9',
        spec: p.spec || p.formattedVolume || '',
        custFeature1: p.custFeature1 || ''
    }));

    const url = `${s.base}/item/batchImportItem?emptyNeedDelete=2`;
    let sent = 0;
    let errors = 0;
    const logs = [];

    for (let i = 0; i < items.length; i += batchSize) {
        const chunk = items.slice(i, i + batchSize);
        const payload = {
            agencyId: s.agencyId,
            merchantId: s.merchantId,
            storeId: s.storeId,
            unitName: 1,
            itemList: chunk
        };

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': s.token },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            const isOk = (data.code === 0 || data.code === '0' || data.code === 14014 || String(data.message).toLowerCase().includes('success'));
            if (isOk) {
                sent += chunk.length;
                logs.push(`Lotul ${Math.floor(i / batchSize) + 1} (${chunk.length} produse): Sincronizat cu succes.`);
            } else {
                errors += chunk.length;
                logs.push(`Lotul ${Math.floor(i / batchSize) + 1}: Eroare ZKong: ${data.message}`);
            }
        } catch (err) {
            errors += chunk.length;
            logs.push(`Lotul ${Math.floor(i / batchSize) + 1}: Eroare conexiune: ${err.message}`);
        }
    }

    return { total: items.length, sent, errors, logs };
}

async function zkongPullProducts() {
    const s = await zkongLogin(true);
    const storeId = s.storeId || "1749214564196";

    // 1. Fetch all items from ZKong Cloud
    const itemsRes = await fetch(`${s.base}/erp/item/list?page=1&size=1000&useExternalStoreId=1&externalStoreId=1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': s.token },
        body: JSON.stringify({ externalStoreId: '1' })
    });
    const itemsJson = await itemsRes.json();
    const cloudItems = (itemsJson.data && itemsJson.data.list) ? itemsJson.data.list : [];

    // 2. Fetch all bound tags with battery and status
    let allTags = [];
    for (let page = 1; page <= 10; page++) {
        try {
            const tagsRes = await fetch(`${s.base}/erp/esl/list?useExternalStoreId=0&storeId=${storeId}&page=${page}&size=100`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': s.token },
                body: JSON.stringify({ storeId, page, size: 100 })
            });
            const tagsJson = await tagsRes.json();
            const list = (tagsJson.data && tagsJson.data.list) ? tagsJson.data.list : [];
            allTags.push(...list);
            if (list.length === 0 || allTags.length >= (tagsJson.data ? tagsJson.data.totalElements : 0)) {
                break;
            }
        } catch (e) {
            break;
        }
    }

    // Build map of barcode -> tag info
    const tagMap = {};
    for (const t of allTags) {
        if (t.itemBarCode) {
            tagMap[String(t.itemBarCode).trim()] = {
                priceTagCode: t.priceTagCode,
                battery: t.battery,
                batteryLevel: t.batteryLevel,
                mac: t.mac,
                apMac: t.apMac,
                apSignal: t.apSignal,
                oemModel: t.oemModel,
                lastCommuTime: t.lastCommuTime
            };
        }
    }

    // 3. Merge with local products
    let localProducts = getProducts();
    const localMap = {};
    localProducts.forEach(p => {
        if (p.barcode) localMap[String(p.barcode).trim()] = p;
    });

    let updatedCount = 0;
    let addedCount = 0;

    for (const ci of cloudItems) {
        const barcode = String(ci.barCode || ci.barcode || '').trim();
        if (!barcode) continue;

        const tagInfo = tagMap[barcode] || null;
        const cPrice = ci.price !== null && ci.price !== undefined ? parseFloat(ci.price) : 0;
        const cOrig = ci.originalPrice !== null && ci.originalPrice !== undefined ? parseFloat(ci.originalPrice) : 0;
        const effectivePrice = cPrice > 0 ? cPrice : (cOrig > 0 ? cOrig : 0);
        const name = ci.itemTitle || ci.name || '';
        const spec = ci.spec || '';

        if (localMap[barcode]) {
            // Update existing product
            const p = localMap[barcode];
            if (effectivePrice > 0) p.price = effectivePrice;
            if (cOrig > 0) p.originalPrice = cOrig;
            else if (cPrice > 0) p.originalPrice = cPrice;
            if (name && (!p.name || p.name.length < name.length)) p.name = name;
            if (spec && !p.spec) p.spec = spec;
            if (tagInfo) {
                p.tagCode = tagInfo.priceTagCode;
                p.tagBattery = tagInfo.battery;
                p.tagMac = tagInfo.mac;
                p.tagModel = tagInfo.oemModel;
                p.tagLastSeen = tagInfo.lastCommuTime;
            }
            calculateProductPpl(p);
            updatedCount++;
        } else {
            // Add new product from cloud
            let newP = {
                id: localProducts.length + 1,
                barcode,
                sku: barcode,
                name: name || `Produs ${barcode}`,
                price: effectivePrice || 0,
                originalPrice: cOrig > 0 ? cOrig : (cPrice > 0 ? cPrice : null),
                spec,
                unit: 'buc',
                stock: 99
            };
            if (tagInfo) {
                newP.tagCode = tagInfo.priceTagCode;
                newP.tagBattery = tagInfo.battery;
                newP.tagMac = tagInfo.mac;
                newP.tagModel = tagInfo.oemModel;
                newP.tagLastSeen = tagInfo.lastCommuTime;
            }
            newP = calculateProductPpl(newP);
            localProducts.push(newP);
            localMap[barcode] = newP;
            addedCount++;
        }
    }

    // Also attach tag info to any other local products matching tagMap
    localProducts.forEach(p => {
        const b = String(p.barcode || '').trim();
        if (tagMap[b] && !p.tagCode) {
            const t = tagMap[b];
            p.tagCode = t.priceTagCode;
            p.tagBattery = t.battery;
            p.tagMac = t.mac;
            p.tagModel = t.oemModel;
            p.tagLastSeen = t.lastCommuTime;
        }
    });

    saveProducts(localProducts);

    // Save timestamped backup
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUPS_DIR, `zkong_pull_${ts}.xlsx`);
    syncExcelFile(localProducts, backupFile);

    return {
        success: true,
        totalCloudItems: cloudItems.length,
        totalBoundTags: allTags.length,
        updatedCount,
        addedCount,
        totalLocalProducts: localProducts.length,
        backupFile: path.basename(backupFile)
    };
}

// HTTP Server Request Router
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                resolve({ rawBody: body });
            }
        });
        req.on('error', reject);
    });
}

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(JSON.stringify(data));
}

function serveStaticFile(req, res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const MIME_TYPES = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.ico': 'image/x-icon',
        '.svg': 'image/svg+xml',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Fișierul nu a fost găsit');
            return;
        }
        res.writeHead(200, {
            'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
            'Cache-Control': 'no-cache'
        });
        res.end(content);
    });
}

const server = http.createServer(async (req, res) => {
    // CORS Preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    try {
        // ================= API ROUTES =================
        if (pathname === '/api/status') {
            const products = getProducts();
            const config = loadConfig();
            const liquids = products.filter(p => p.isLiquid || p.unitType === 'litru').length;
            const solids = products.filter(p => p.isSolid || p.unitType === 'kg').length;
            const boundTags = products.filter(p => !!p.tagCode).length;

            let mwOnline = false;
            try {
                mwOnline = await new Promise((resolve) => {
                    const r = http.get('http://127.0.0.1:8003/system/version', { timeout: 800 }, (res) => resolve(res.statusCode === 200));
                    r.on('error', () => resolve(false));
                    r.on('timeout', () => { r.destroy(); resolve(false); });
                });
            } catch (e) {}

            return sendJson(res, 200, {
                status: 'ok',
                platform: {
                    name: 'Zkong Desktop Application - Unofficial',
                    author: 'Nazjar Dev',
                    version: '2026.3.0 Standalone Desktop Edition',
                    uptime: 'Online'
                },
                middleware: {
                    online: mwOnline,
                    url: 'http://127.0.0.1:8003',
                    store_id: config.mw_store_id || ''
                },
                cloud: {
                    url: config.cloud_url || 'http://esl-eu.zkong.com:9999',
                    user: config.cloud_user || '',
                    merchant_id: config.cloud_merchant_id || '',
                    template_default: config.default_template_type || '2.9'
                },
                stats: {
                    totalProducts: products.length,
                    liquidProducts: liquids,
                    solidProducts: solids,
                    boundTags: boundTags,
                    lastFile: path.basename(EXCEL_FILE),
                    fileExists: fs.existsSync(EXCEL_FILE)
                }
            });
        }

        // Production Multi-User Session Status
        if (pathname === '/api/session' && req.method === 'GET') {
            const config = loadConfig();
            const isAuth = !!(config.cloud_user && config.cloud_pass);
            return sendJson(res, 200, {
                status: 'ok',
                authenticated: isAuth,
                user: config.cloud_user || '',
                serverUrl: config.cloud_url || 'http://esl-eu.zkong.com:9999',
                merchantId: config.cloud_merchant_id || '',
                storeId: config.mw_store_id || ''
            });
        }

        // Production Multi-User ZKong Cloud Login
        if (pathname === '/api/login' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const serverUrl = String(body.serverUrl || 'http://esl-eu.zkong.com:9999').trim().replace(/\/+$/, '');
                const account = String(body.account || '').trim();
                const password = String(body.password || '').trim();
                const storeId = String(body.storeId || '').trim();

                if (!account || !password) {
                    return sendJson(res, 400, { status: 'error', message: 'Account and password are required' });
                }

                // 1. Fetch RSA Public Key from ZKong Cloud
                const pkRes = await fetch(serverUrl + '/user/getErpPublicKey');
                const pkJson = await pkRes.json();
                if (!pkJson.data) {
                    return sendJson(res, 401, {
                        status: 'error',
                        message: pkJson.message || 'Cannot retrieve RSA public encryption key from ZKong server. Check server URL.'
                    });
                }

                const derBuf = Buffer.from(pkJson.data, 'base64');
                const pubKey = crypto.createPublicKey({ key: derBuf, format: 'der', type: 'spki' });
                const encPass = crypto.publicEncrypt({
                    key: pubKey,
                    padding: crypto.constants.RSA_PKCS1_PADDING
                }, Buffer.from(password, 'utf8')).toString('base64');

                // 2. Authenticate against ZKong Cloud
                const loginRes = await fetch(serverUrl + '/user/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ account: account, loginType: 3, password: encPass })
                });
                const loginJson = await loginRes.json();
                if (!loginJson.data || !loginJson.data.token) {
                    return sendJson(res, 401, {
                        status: 'error',
                        message: loginJson.message || 'Invalid ZKong credentials or account locked.'
                    });
                }

                const token = loginJson.data.token;
                const merchantId = String(loginJson.data.merchantId || '');

                // 3. Persist new credentials into local config
                const config = loadConfig();
                config.cloud_url = serverUrl;
                config.cloud_user = account;
                config.cloud_pass = password;
                config.cloud_merchant_id = merchantId;
                if (storeId) {
                    config.mw_store_id = storeId;
                }
                saveConfig(config);

                // 4. Trigger background live sync of catalog & tags for this new user
                let syncResult = null;
                if (syncLiveModule && typeof syncLiveModule.syncFromZkongCloud === 'function') {
                    try {
                        syncResult = await syncLiveModule.syncFromZkongCloud();
                    } catch (e) {
                        console.warn('[Login Sync Warning]', e.message);
                    }
                }

                try { startLiveWatcher(30); } catch (e) {}

                return sendJson(res, 200, {
                    status: 'ok',
                    message: 'Successfully connected to ZKong Cloud!',
                    user: account,
                    merchantId: merchantId,
                    storeId: config.mw_store_id,
                    serverUrl: serverUrl,
                    token: token,
                    syncedProducts: syncResult ? (syncResult.totalProducts || 0) : 0
                });
            } catch (err) {
                console.error('[Login Error]', err);
                return sendJson(res, 500, { status: 'error', message: err.message });
            }
        }

        // Production Logout / Switch Account
        if (pathname === '/api/logout' && req.method === 'POST') {
            try {
                const config = loadConfig();
                config.cloud_user = '';
                config.cloud_pass = '';
                saveConfig(config);
                stopLiveWatcher();
                return sendJson(res, 200, {
                    status: 'ok',
                    message: 'Logged out successfully. You can now log into another ZKong account.'
                });
            } catch (err) {
                return sendJson(res, 500, { status: 'error', message: err.message });
            }
        }

        if (pathname === '/api/analytics') {
            const products = getProducts();
            const liquids = products.filter(p => p.isLiquid || p.unitType === 'litru');
            const solids = products.filter(p => p.isSolid || p.unitType === 'kg');
            const avgPpl = liquids.length ? (liquids.reduce((a, b) => a + (b.pricePerLiter || 0), 0) / liquids.length).toFixed(2) : '0.00';
            const avgPpk = solids.length ? (solids.reduce((a, b) => a + (b.pricePerLiter || 0), 0) / solids.length).toFixed(2) : '0.00';

            return sendJson(res, 200, {
                status: 'ok',
                analytics: {
                    total: products.length,
                    liquids: liquids.length,
                    solids: solids.length,
                    hardware: products.length - liquids.length - solids.length,
                    avgPricePerLiter: avgPpl,
                    avgPricePerKg: avgPpk
                }
            });
        }

        if (pathname === '/api/products') {
            let products = getProducts();
            const q = String(parsedUrl.query.q || parsedUrl.query.search || '').trim().toLowerCase();
            const filter = String(parsedUrl.query.filter || 'all').toLowerCase();
            const page = parseInt(parsedUrl.query.page, 10) || 1;
            const limit = parseInt(parsedUrl.query.per_page || parsedUrl.query.limit, 10) || 50;

            if (q) {
                products = products.filter(p =>
                    String(p.name || '').toLowerCase().includes(q) ||
                    String(p.barcode || '').toLowerCase().includes(q) ||
                    String(p.sku || '').toLowerCase().includes(q) ||
                    String(p.custFeature1 || '').toLowerCase().includes(q) ||
                    String(p.spec || '').toLowerCase().includes(q)
                );
            }

            if (filter === 'liquid' || filter === 'liquids') {
                products = products.filter(p => p.isLiquid || p.unitType === 'litru');
            } else if (filter === 'solid' || filter === 'solids') {
                products = products.filter(p => p.isSolid || p.unitType === 'kg');
            } else if (filter === 'bound') {
                products = products.filter(p => !!p.tagCode);
            } else if (filter === 'unbound') {
                products = products.filter(p => !p.tagCode);
            } else if (filter === 'battery-low') {
                products = products.filter(p => p.tagCode && (p.tagBattery || 100) < 30);
            } else if (filter === 'hardware') {
                products = products.filter(p => !p.isLiquid && !p.isSolid && p.unitType !== 'litru' && p.unitType !== 'kg');
            } else if (filter === 'promo') {
                products = products.filter(p => p.originalPrice && p.price < p.originalPrice);
            }

            const total = products.length;
            const totalPages = Math.ceil(total / limit) || 1;
            const start = (page - 1) * limit;
            const items = products.slice(start, start + limit);

            return sendJson(res, 200, {
                status: 'ok',
                total,
                page,
                perPage: limit,
                totalPages,
                products: items
            });
        }

        if (pathname === '/api/create_product' && req.method === 'POST') {
            const body = await parseBody(req);
            const barcode = String(body.barcode || '').trim();
            const name = String(body.name || '').trim();
            const price = parseFloat(body.price) || 0;
            const origPrice = parseFloat(body.originalPrice) || null;
            const spec = String(body.spec || '').trim();
            const unit = String(body.unit || 'buc').trim();
            const syncZkong = body.sync_zkong !== false;

            if (!barcode || !name || price <= 0) {
                return sendJson(res, 400, { status: 'error', message: 'Codul de bare, denumirea și prețul (> 0) sunt obligatorii.' });
            }

            let products = getProducts();
            if (products.some(p => String(p.barcode).trim() === barcode)) {
                return sendJson(res, 400, { status: 'error', message: `Produsul cu codul de bare ${barcode} există deja în catalog.` });
            }

            let newProd = {
                id: products.length + 1,
                barcode,
                sku: barcode,
                name,
                price,
                originalPrice: origPrice,
                spec,
                unit,
                stock: 99
            };
            newProd = calculateProductPpl(newProd);

            products.unshift(newProd);
            saveProducts(products);

            let syncRes = null;
            if (syncZkong) {
                try {
                    syncRes = await zkongPushProducts([newProd]);
                } catch (e) {
                    syncRes = { error: e.message };
                }
            }

            return sendJson(res, 200, {
                status: 'ok',
                message: `Produsul "${name}" a fost creat cu succes.`,
                product: newProd,
                zkong_sync: syncRes
            });
        }

        if (pathname === '/api/update_product' && req.method === 'POST') {
            const body = await parseBody(req);
            const barcode = String(body.barcode || '').trim();
            const pid = body.id;

            let products = getProducts();
            let idx = products.findIndex(p => (pid && p.id === pid) || (barcode && String(p.barcode).trim() === barcode));
            if (idx === -1) {
                return sendJson(res, 404, { status: 'error', message: 'Produsul nu a fost găsit în catalog.' });
            }

            let p = products[idx];
            if (body.name) p.name = String(body.name).trim();
            if (body.price !== undefined) p.price = parseFloat(body.price) || 0;
            if (body.originalPrice !== undefined) p.originalPrice = parseFloat(body.originalPrice) || null;
            if (body.spec !== undefined) p.spec = String(body.spec).trim();
            if (body.unit !== undefined) p.unit = String(body.unit).trim();

            p = calculateProductPpl(p);
            products[idx] = p;
            saveProducts(products);

            let syncRes = null;
            if (body.sync_zkong) {
                try {
                    syncRes = await zkongPushProducts([p]);
                } catch (e) {
                    syncRes = { error: e.message };
                }
            }

            return sendJson(res, 200, {
                status: 'ok',
                message: `Produsul "${p.name}" a fost actualizat.`,
                product: p,
                zkong_sync: syncRes
            });
        }

        if (pathname === '/api/bind_tag' && req.method === 'POST') {
            const body = await parseBody(req);
            const barcode = String(body.barcode || '').trim();
            const tagCode = String(body.tag_code || '').trim();

            if (!barcode || !tagCode) {
                return sendJson(res, 400, { status: 'error', message: 'Codul de bare și codul etichetei sunt obligatorii.' });
            }

            try {
                const result = await zkongBindTag(barcode, tagCode);
                return sendJson(res, 200, { status: 'ok', ...result });
            } catch (err) {
                return sendJson(res, 500, { status: 'error', message: err.message });
            }
        }

        if (pathname === '/api/unbind_tag' && req.method === 'POST') {
            const body = await parseBody(req);
            const barcode = String(body.barcode || '').trim();
            const tagCode = String(body.tag_code || '').trim();

            try {
                const result = await zkongUnbindTag(barcode, tagCode);
                return sendJson(res, 200, { status: 'ok', ...result });
            } catch (err) {
                return sendJson(res, 500, { status: 'error', message: err.message });
            }
        }

        if (pathname === '/api/sync_zkong' && req.method === 'POST') {
            const body = await parseBody(req);
            let products = getProducts();
            if (body.barcode) {
                products = products.filter(p => String(p.barcode).trim() === String(body.barcode).trim());
            }

            try {
                const result = await zkongPushProducts(products);
                return sendJson(res, 200, { status: 'ok', ...result });
            } catch (err) {
                return sendJson(res, 500, { status: 'error', message: err.message });
            }
        }

        if (pathname === '/api/pull_zkong' && req.method === 'POST') {
            try {
                if (syncLiveModule && typeof syncLiveModule.syncFromZkongCloud === 'function') {
                    const result = await syncLiveModule.syncFromZkongCloud();
                    return sendJson(res, 200, {
                        status: 'ok',
                        message: `✓ Sincronizare live ZKong finalizată cu succes! S-au actualizat ${result.updatedPricesCount || 0} prețuri și ${result.totalBoundTags || 0} etichete active din ZKong Cloud.`,
                        ...result
                    });
                } else {
                    const result = await zkongPullProducts();
                    return sendJson(res, 200, {
                        status: 'ok',
                        message: `Sincronizare finalizată!`,
                        ...result
                    });
                }
            } catch (err) {
                return sendJson(res, 500, { status: 'error', message: err.message });
            }
        }

        if (pathname === '/api/clean_names' && req.method === 'POST') {
            try {
                let products = getProducts();
                let updatedCount = 0;
                const cleaner = (syncLiveModule && syncLiveModule.cleanProductName) ? syncLiveModule.cleanProductName : (n => n);
                products.forEach(p => {
                    const cleaned = cleaner(p.name);
                    if (cleaned && cleaned !== p.name) {
                        p.name = cleaned;
                        updatedCount++;
                    }
                });
                if (updatedCount > 0) {
                    saveProducts(products);
                }
                return sendJson(res, 200, {
                    status: 'ok',
                    updatedNamesCount: updatedCount,
                    message: `✓ S-au corectat automat ${updatedCount} denumiri cu diacritice și gramatică!`
                });
            } catch (err) {
                return sendJson(res, 500, { status: 'error', message: err.message });
            }
        }

        if (pathname === '/api/calculator') {
            const body = req.method === 'POST' ? await parseBody(req) : parsedUrl.query;
            const price = parseFloat(body.price) || 0;
            const spec = String(body.spec || '').trim();
            const name = String(body.name || '').trim();

            const dummy = calculateProductPpl({ price, spec, name });
            return sendJson(res, 200, {
                status: 'ok',
                unitPrice: dummy.pricePerLiter,
                formattedUnitPrice: dummy.formattedPpl,
                custFeature1: dummy.custFeature1,
                unitType: dummy.unitType,
                volumeFormatted: dummy.formattedVolume
            });
        }

        if ((pathname === '/api/export' || pathname === '/api/export_excel') && req.method === 'GET') {
            let targetFile = EXCEL_FILE;
            const desktopExcel = 'C:\\Users\\Nazjar\\Desktop\\Single_ana.xlsx';
            if (fs.existsSync(desktopExcel)) targetFile = desktopExcel;

            if (fs.existsSync(targetFile)) {
                res.writeHead(200, {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': 'attachment; filename="Single_ana.xlsx"'
                });
                return fs.createReadStream(targetFile).pipe(res);
            }
            return sendJson(res, 404, { status: 'error', message: 'Fișierul Single_ana.xlsx nu a fost găsit.' });
        }

        if (pathname === '/api/backups') {
            const list = fs.existsSync(BACKUPS_DIR)
                ? fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.xlsx')).map(f => {
                    const st = fs.statSync(path.join(BACKUPS_DIR, f));
                    return { filename: f, size: st.size, mtime: st.mtime };
                })
                : [];
            return sendJson(res, 200, { status: 'ok', backups: list });
        }

        if (pathname === '/api/middleware/status') {
            let mwOnline = false;
            let mwVer = 'v1.6.0';
            try {
                const health = await new Promise((resolve) => {
                    const r = http.get('http://127.0.0.1:8003/system/version', { timeout: 1000 }, (res) => {
                        let b = '';
                        res.on('data', c => b += c);
                        res.on('end', () => {
                            try {
                                const parsed = JSON.parse(b);
                                resolve({ online: res.statusCode === 200, version: parsed.data || 'v1.6.0' });
                            } catch (e) {
                                resolve({ online: res.statusCode === 200, version: 'v1.6.0' });
                            }
                        });
                    });
                    r.on('error', () => resolve({ online: false, version: 'offline' }));
                    r.on('timeout', () => { r.destroy(); resolve({ online: false, version: 'timeout' }); });
                });
                mwOnline = health.online;
                mwVer = health.version;
            } catch (e) {}

            return sendJson(res, 200, {
                status: 'ok',
                middleware: {
                    online: mwOnline,
                    version: mwVer,
                    port: 8003,
                    integrated: true
                }
            });
        }

        if (pathname === '/api/middleware/restart' || pathname === '/api/middleware/start') {
            try {
                const { supervisor } = require('./middleware_supervisor');
                const result = await supervisor.ensureRunning();
                return sendJson(res, 200, { status: 'ok', result });
            } catch (err) {
                return sendJson(res, 500, { status: 'error', message: err.message });
            }
        }

        if (pathname === '/api/sync/middleware' || pathname === '/api/sync_middleware') {
            const products = getProducts();
            writeProductsToExcel(products, EXCEL_FILE);
            const desktopExcel = 'C:\\Users\\Nazjar\\Desktop\\Single_ana.xlsx';
            try { writeProductsToExcel(products, desktopExcel); } catch (e) {}

            return sendJson(res, 200, {
                status: 'ok',
                message: `Fișierul Single_ana.xlsx a fost actualizat pe disc cu ${products.length} produse pentru middleware!`,
                total: products.length
            });
        }

        if (pathname === '/api/tags') {
            let tags = getTags();
            const q = String(parsedUrl.query.q || parsedUrl.query.search || '').trim().toLowerCase();
            const filter = String(parsedUrl.query.filter || 'all').toLowerCase();

            if (q) {
                tags = tags.filter(t =>
                    String(t.tagCode || '').toLowerCase().includes(q) ||
                    String(t.mac || '').toLowerCase().includes(q) ||
                    String(t.itemBarCode || '').toLowerCase().includes(q) ||
                    String(t.productName || '').toLowerCase().includes(q) ||
                    String(t.spec || '').toLowerCase().includes(q)
                );
            }

            if (filter === 'liquid' || filter === 'liquids') {
                tags = tags.filter(t => t.isLiquid || t.unitType === 'litru');
            } else if (filter === 'solid' || filter === 'solids') {
                tags = tags.filter(t => t.isSolid || t.unitType === 'kg');
            } else if (filter === 'battery-low') {
                tags = tags.filter(t => (t.batteryPercent || 100) < 30);
            } else if (filter === 'bound') {
                tags = tags.filter(t => !!t.itemBarCode && t.productName !== 'Nealocat');
            } else if (filter === 'unbound') {
                tags = tags.filter(t => !t.itemBarCode || t.productName === 'Nealocat');
            }

            return sendJson(res, 200, {
                status: 'ok',
                total: tags.length,
                totalAll: getTags().length,
                tags: tags
            });
        }

        if (pathname === '/api/watcher/status') {
            return sendJson(res, 200, {
                status: 'ok',
                watcher: watcherStatus
            });
        }

        if (pathname === '/api/watcher/toggle' && req.method === 'POST') {
            const body = await parseBody(req);
            if (body.active === false) {
                stopLiveWatcher();
            } else {
                const interval = parseInt(body.interval, 10) || watcherStatus.intervalSeconds || 30;
                startLiveWatcher(interval);
            }
            return sendJson(res, 200, { status: 'ok', watcher: watcherStatus });
        }

        if (pathname === '/api/watcher/check_now' && req.method === 'POST') {
            let result = null;
            if (syncLiveModule && typeof syncLiveModule.syncFromZkongCloud === 'function') {
                result = await syncLiveModule.syncFromZkongCloud();
                watcherStatus.lastCheck = new Date().toLocaleTimeString('ro-RO');
                watcherStatus.lastModifiedCount = result.updatedPricesCount || 0;
            }
            return sendJson(res, 200, {
                status: 'ok',
                message: result ? `Verificare live ZKong finalizată! ${result.updatedPricesCount} prețuri actualizate.` : 'Sincronizare finalizată',
                result: result,
                watcher: watcherStatus
            });
        }

        if (pathname === '/api/recalc_all_prices' && req.method === 'POST') {
            let products = getProducts();
            let updated = 0;
            products = products.map(p => {
                const before = p.custFeature1;
                const after = calculateProductPpl(p);
                if (before !== after.custFeature1) updated++;
                return after;
            });
            saveProducts(products);
            return sendJson(res, 200, {
                status: 'ok',
                message: `S-au recalculat automat cantitățile și prețurile unitare pentru toate produsele! (${updated} actualizate)`,
                updatedCount: updated
            });
        }

        if (pathname === '/api/save_settings' && req.method === 'POST') {
            const body = await parseBody(req);
            const cfg = { ...loadConfig(), ...body };
            saveConfig(cfg);
            return sendJson(res, 200, { status: 'ok', config: cfg });
        }

        // ================= STATIC FILE SERVING =================
        let staticPath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
        if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
            return serveStaticFile(req, res, staticPath);
        }

        // Fallback to index.html for single-page app
        const indexPath = path.join(PUBLIC_DIR, 'index.html');
        if (fs.existsSync(indexPath)) {
            return serveStaticFile(req, res, indexPath);
        }

        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Ruta nu a fost găsită');

    } catch (err) {
        console.error('[Server Error]', err);
        return sendJson(res, 500, { status: 'error', message: err.message });
    }
});

// Standalone runner function
function startEmbeddedServer(port = 5050) {
    return new Promise((resolve, reject) => {
        server.listen(port, '0.0.0.0', () => {
            console.log(`[Embedded Server] Serverul ZKong Desktop ascultă pe http://127.0.0.1:${port}`);
            console.log(`[Embedded Server] Accesibil și din rețeaua locală LAN pe portul ${port}`);
            resolve(server);
            try { startLiveWatcher(30); } catch (e) {}
        });
        server.on('error', (e) => {
            if (e.code === 'EADDRINUSE') {
                console.log(`[Embedded Server] Portul ${port} este deja ocupat de un alt proces (probabil deja activ).`);
                resolve(null);
            } else {
                reject(e);
            }
        });
    });
}

// If executed directly: `node embedded_server.js`
if (require.main === module) {
    startEmbeddedServer(5050);
}

module.exports = {
    startEmbeddedServer,
    server,
    calculateProductPpl,
    extractVolumeOrWeight,
    getProducts,
    saveProducts,
    getTags,
    startLiveWatcher,
    stopLiveWatcher,
    watcherStatus,
    zkongLogin,
    zkongBindTag,
    zkongPushProducts,
    zkongPullProducts
};
