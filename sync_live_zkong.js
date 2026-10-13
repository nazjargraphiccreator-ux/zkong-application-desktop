#!/usr/bin/env node
/**
 * Zkong Desktop Application - Unofficial • Live Cloud Sync Engine
 * Developed by Nazjar Dev. Real-time bidirectional ZKong ESL Cloud sync.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Resolve XLSX module
let XLSX;
const possibleXlsxPaths = [
    path.join(__dirname, 'desktop', 'node_modules', 'xlsx'),
    path.join(__dirname, '..', 'desktop', 'node_modules', 'xlsx'),
    path.join(__dirname, 'node_modules', 'xlsx'),
    'xlsx'
];
for (const p of possibleXlsxPaths) {
    try {
        XLSX = require(p);
        break;
    } catch (e) {}
}
if (!XLSX) {
    console.error('[Sync] Modulul XLSX nu a fost găsit. Rulați npm install xlsx.');
    process.exit(1);
}

const CONFIG_FILE = path.join(__dirname, 'config.json');
const DATA_FILE = path.join(__dirname, 'products.json');
const BACKUPS_DIR = path.join(__dirname, 'backups');
const ROOT_DIR = path.resolve(__dirname, '..');

const DEFAULT_CONFIG = {
    cloud_url: "http://esl-eu.zkong.com:9999",
    cloud_user: "",
    cloud_pass: "",
    mw_store_id: "",
    cloud_merchant_id: ""
};

function loadConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
        } catch (e) {}
    }
    return DEFAULT_CONFIG;
}

// Hardware & Accessories exclusion terms
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

function isHardware(name) {
    const n = String(name || '').toLowerCase();
    return NON_SOLUTION_TERMS.some(t => n.includes(t));
}

// =========================================================================
// Autonomous Romanian Diacritics & Grammar Correction Engine
// =========================================================================
const CORRECTIONS = [
    // Artifacts & Encoding fixes
    [/[\uFFFD]/g, ''],
    [/[\?]?ndep[\?]rtarea/gi, 'îndepărtarea'],
    [/eficient[\?]/gi, 'eficientă'],
    [/gr[\?]sime/gi, 'grăsime'],
    [/\s+[\?]i\s+/gi, ' și '],
    [/str[\?]lucitor/gi, 'strălucitor'],

    // Common cleaning typos
    [/\barama de capsuni\b/gi, 'aromă de căpșuni'],
    [/\barama\b/gi, 'aromă'],
    [/\bcuartenare\b/gi, 'cuaternare'],

    // Essential Cleaning Verbs & Actions
    [/\bcuratare\b/gi, 'curățare'],
    [/\bcuratat\b/gi, 'curățat'],
    [/\bspalare\b/gi, 'spălare'],
    [/\bspalat\b/gi, 'spălat'],
    [/\bclatire\b/gi, 'clătire'],
    [/\bintretinere\b/gi, 'întreținere'],
    [/\bindepartare\b/gi, 'îndepărtare'],
    [/\bindepartarea\b/gi, 'îndepărtarea'],
    [/\binalbitor\b/gi, 'înălbitor'],
    [/\binalbire\b/gi, 'înălbire'],
    [/\bingrijire\b/gi, 'îngrijire'],
    [/\bdezinfectie\b/gi, 'dezinfecție'],
    [/\bprotectie\b/gi, 'protecție'],

    // Surfaces & Areas
    [/\bsuprafata\b/gi, 'suprafață'],
    [/\bsuprafete\b/gi, 'suprafețe'],
    [/\bsuprafetelor\b/gi, 'suprafețelor'],
    [/\bsuprafetele\b/gi, 'suprafețele'],
    [/\bpardoseala\b/gi, 'pardoseală'],
    [/\bfaianta\b/gi, 'faianță'],
    [/\bsticla\b/gi, 'sticlă'],
    [/\bpiatra\b/gi, 'piatră'],
    [/\bmarmura\b/gi, 'marmură'],
    [/\bbucatarie\b/gi, 'bucătărie'],
    [/\btoaleta\b/gi, 'toaletă'],
    [/\bpentru bai\b/gi, 'pentru băi'],
    [/\btapiterie\b/gi, 'tapițerie'],
    [/\bmocheta\b/gi, 'mochetă'],

    // Materials, Dirt & Chemistry
    [/\bgrasime\b/gi, 'grăsime'],
    [/\bgrasimi\b/gi, 'grăsimi'],
    [/\bgrasimilor\b/gi, 'grăsimilor'],
    [/\brugina\b/gi, 'rugină'],
    [/\bsaruri\b/gi, 'săruri'],
    [/\bsapun\b/gi, 'săpun'],
    [/\bspuma\b/gi, 'spumă'],
    [/\bcrema\b/gi, 'cremă'],
    [/\bpasta\b/gi, 'pastă'],
    [/\bpudra\b/gi, 'pudră'],
    [/\bpunga\b/gi, 'pungă'],

    // Fragrances & Natural extracts
    [/\bcapsuni\b/gi, 'căpșuni'],
    [/\bcapsune\b/gi, 'căpșune'],
    [/\bcapsuna\b/gi, 'căpșună'],
    [/\blamaie\b/gi, 'lămâie'],
    [/\blamai\b/gi, 'lămâi'],
    [/\bportocala\b/gi, 'portocală'],
    [/\bportocale\b/gi, 'portocale'],
    [/\bpiersica\b/gi, 'piersică'],
    [/\bmar\b/gi, 'măr'],
    [/\botet\b/gi, 'oțet'],
    [/\bmusetel\b/gi, 'mușețel'],
    [/\blevantica\b/gi, 'levănțică'],
    [/\blavanda\b/gi, 'lavandă'],
    [/\bmasline\b/gi, 'măsline'],
    [/\bmenta\b/gi, 'mentă'],
    [/\bprimavara\b/gi, 'primăvară'],
    [/\bvara\b/gi, 'vară'],

    // Accessories & Hardware
    [/\bmanusi\b/gi, 'mănuși'],
    [/\bhartie\b/gi, 'hârtie'],
    [/\bgaleata\b/gi, 'găleată'],
    [/\bgaleti\b/gi, 'găleți'],
    [/\bcarucior\b/gi, 'cărucior'],
    [/\bcarucioare\b/gi, 'cărucioare'],
    [/\bmatura\b/gi, 'mătură'],
    [/\bmaturi\b/gi, 'mături'],
    [/\bfaras\b/gi, 'făraș'],
    [/\bfarase\b/gi, 'fărașe'],
    [/\bracleta\b/gi, 'racletă'],
    [/\braclete\b/gi, 'raclete'],
    [/\brezerva\b/gi, 'rezervă'],
    [/\brezerve\b/gi, 'rezerve'],
    [/\broti\b/gi, 'roți'],
    [/\bstorcator\b/gi, 'storcător'],
    [/\bpompa\b/gi, 'pompă'],
    [/\bfolosinta\b/gi, 'folosință'],
    [/\bmasina\b/gi, 'mașină'],
    [/\bmasini\b/gi, 'mașini'],

    // Adjectives & Descriptions
    [/\bstralucitor\b/gi, 'strălucitor'],
    [/\bstralucitoare\b/gi, 'strălucitoare'],
    [/\bstralucire\b/gi, 'strălucire'],
    [/\bmultifunctional\b/gi, 'multifuncțional'],
    [/\bmultifunctionala\b/gi, 'multifuncțională'],
    [/\bmultifunctionale\b/gi, 'multifuncționale'],
    [/\bdezinfectanti\b/gi, 'dezinfectanți'],
    [/\bantistatica\b/gi, 'antistatică'],
    [/\beficienta\b/gi, 'eficientă'],
    [/\becologica\b/gi, 'ecologică'],
    [/\becologice\b/gi, 'ecologice'],
    [/\brapida\b/gi, 'rapidă'],
    [/\bputernica\b/gi, 'puternică'],
    [/\bproaspat\b/gi, 'proaspăt'],
    [/\bproaspata\b/gi, 'proaspătă'],
    [/\bcurata\b/gi, 'curată'],
    [/\bparfumata\b/gi, 'parfumată'],
    [/\bdelicata\b/gi, 'delicată'],
    [/\bigienizanta\b/gi, 'igienizantă'],
    [/\bantibacteriana\b/gi, 'antibacteriană'],
    [/\bindustriala\b/gi, 'industrială'],
    [/\bprofesionala\b/gi, 'profesională'],
    [/\bcasnica\b/gi, 'casnică'],
    [/\bbiodegradabila\b/gi, 'biodegradabilă'],
    [/\bconcentrata\b/gi, 'concentrată'],
    [/\bactiva\b/gi, 'activă'],

    // Fixed prepositional phrases
    [/\bpe baza de\b/gi, 'pe bază de'],
    [/\bunica folosinta\b/gi, 'unică folosință'],

    // Grammar & Conjunctions
    [/\s+si\s+/gi, ' și '],
    [/\s+fara\s+/gi, ' fără ']
];

function cleanProductName(name) {
    if (!name) return '';
    let res = String(name).trim();

    // Fix spacing around punctuation
    res = res.replace(/\s+([,.:;])/g, '$1');
    res = res.replace(/([,;])([^\s0-9])/g, '$1 $2');
    res = res.replace(/\s{2,}/g, ' ');

    // Normalize bad volume '0.750 ml' -> '750 ml'
    res = res.replace(/\b0\.750\s*ml\b/gi, '750 ml');
    res = res.replace(/\b0\.500\s*ml\b/gi, '500 ml');

    // Apply dictionary rules while respecting word boundaries & case
    for (const [pattern, replacement] of CORRECTIONS) {
        res = res.replace(pattern, (match) => {
            if (match === match.toUpperCase() && match.length > 2) {
                return replacement.toUpperCase();
            } else if (match[0] === match[0].toUpperCase()) {
                return replacement.charAt(0).toUpperCase() + replacement.slice(1);
            } else {
                return replacement.toLowerCase();
            }
        });
    }

    // Capitalize first letter
    if (res.length > 0) {
        res = res.charAt(0).toUpperCase() + res.slice(1);
    }

    return res;
}

// Autonomous unit price calculator conforming to HG 947/2000
function extractVolumeOrWeight(name, spec = '') {
    const s = String(spec || '').trim().toLowerCase();
    const n = String(name || '').trim().toLowerCase();

    if (isHardware(name)) {
        return { val: 0, unit: '', isLiquid: false, isSolid: false, formatted: null };
    }

    if (s) {
        let m_kg = s.match(/^(\d+(?:[.,]\d+)?)\s*kg\b/);
        if (m_kg) {
            const v = parseFloat(m_kg[1].replace(',', '.'));
            if (v > 0 && v <= 50) {
                return { val: v, unit: 'kg', isLiquid: false, isSolid: true, formatted: (Number.isInteger(v) ? v : v) + 'kg' };
            }
        }
        let m_g = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:g|gr)\b/);
        if (m_g) {
            const v = parseFloat(m_g[1].replace(',', '.'));
            if (v > 0 && v < 1000) {
                return { val: v / 1000.0, unit: 'kg', isLiquid: false, isSolid: true, formatted: (Number.isInteger(v) ? v : v) + 'g' };
            }
        }
        let m_l = s.match(/^(\d+(?:[.,]\d+)?)\s*l\b/);
        if (m_l) {
            const v = parseFloat(m_l[1].replace(',', '.'));
            if (v > 0 && v <= 50) {
                return { val: v, unit: 'litru', isLiquid: true, isSolid: false, formatted: (Number.isInteger(v) ? v : v) + 'L' };
            }
        }
        let m_ml = s.match(/^(\d+(?:[.,]\d+)?)\s*ml\b/);
        if (m_ml) {
            const v = parseFloat(m_ml[1].replace(',', '.'));
            if (v < 1.0 && v > 0) {
                // E.g. "0.750 ml" -> actually 0.75 Liters!
                return { val: v, unit: 'litru', isLiquid: true, isSolid: false, formatted: Math.round(v * 1000) + 'ml' };
            } else if (v >= 1.0) {
                return { val: v / 1000.0, unit: 'litru', isLiquid: true, isSolid: false, formatted: (Number.isInteger(v) ? v : v) + 'ml' };
            }
        }
    }

    // fallback in name
    let m_kg_n = n.match(/\b(\d+(?:[.,]\d+)?)\s*(?:kg|kilograme)\b/);
    if (m_kg_n) {
        const v = parseFloat(m_kg_n[1].replace(',', '.'));
        if (v > 0 && v <= 50) {
            return { val: v, unit: 'kg', isLiquid: false, isSolid: true, formatted: (Number.isInteger(v) ? v : v) + 'kg' };
        }
    }
    let m_l_n = n.match(/\b(\d+(?:[.,]\d+)?)\s*(?:l|litri|litru)\b/);
    if (m_l_n) {
        const v = parseFloat(m_l_n[1].replace(',', '.'));
        if (v > 0 && v <= 50) {
            return { val: v, unit: 'litru', isLiquid: true, isSolid: false, formatted: (Number.isInteger(v) ? v : v) + 'L' };
        }
    }
    let m_ml_n = n.match(/\b(\d+(?:[.,]\d+)?)\s*ml\b/);
    if (m_ml_n) {
        const v = parseFloat(m_ml_n[1].replace(',', '.'));
        if (v < 1.0 && v > 0) {
            return { val: v, unit: 'litru', isLiquid: true, isSolid: false, formatted: Math.round(v * 1000) + 'ml' };
        } else if (v >= 1.0) {
            return { val: v / 1000.0, unit: 'litru', isLiquid: true, isSolid: false, formatted: (Number.isInteger(v) ? v : v) + 'ml' };
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
            formattedPpl = pricePerLiter.toFixed(2) + ' Lei / Litru';
            custFeature1 = formattedPpl;
        } else if (isSolid) {
            formattedPpl = pricePerLiter.toFixed(2) + ' Lei / Kg';
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
    p.pricePerLiter = pricePerLiter;
    p.formattedPpl = formattedPpl;
    p.custFeature1 = custFeature1;
    p.templateCategory = 'default';
    p.templateType = '2.9';

    return p;
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

async function syncFromZkongCloud() {
    const config = loadConfig();
    const base = config.cloud_url || 'http://esl-eu.zkong.com:9999';
    const storeId = config.mw_store_id || '1749214564196';

    // 1. Login with RSA
    const pkRes = await fetch(base + '/user/getErpPublicKey');
    const pkJson = await pkRes.json();
    if (!pkJson.data) throw new Error(pkJson.message || 'Cheie publică indisponibilă ZKong');

    const derBuf = Buffer.from(pkJson.data, 'base64');
    const pubKey = crypto.createPublicKey({ key: derBuf, format: 'der', type: 'spki' });
    const encPass = crypto.publicEncrypt({
        key: pubKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
    }, Buffer.from(config.cloud_pass, 'utf8')).toString('base64');

    const loginRes = await fetch(base + '/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: config.cloud_user, loginType: 3, password: encPass })
    });
    const loginJson = await loginRes.json();
    if (!loginJson.data || !loginJson.data.token) {
        throw new Error(loginJson.message || 'Autentificare eșuată ZKong Cloud');
    }
    const token = loginJson.data.token;

    // 2. Fetch all products from ZKong Cloud
    const itemsRes = await fetch(base + '/erp/item/list?page=1&size=1000&useExternalStoreId=1&externalStoreId=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token },
        body: JSON.stringify({ externalStoreId: '1' })
    });
    const itemsJson = await itemsRes.json();
    const cloudItems = (itemsJson.data && itemsJson.data.list) ? itemsJson.data.list : [];

    // 3. Fetch all active bound tags
    let allTags = [];
    for (let page = 1; page <= 10; page++) {
        try {
            const tagsRes = await fetch(base + '/erp/esl/list?useExternalStoreId=0&storeId=' + storeId + '&page=' + page + '&size=100', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': token },
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

    // 4. Merge with local data
    let localProducts = [];
    try {
        if (fs.existsSync(DATA_FILE)) {
            localProducts = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (e) {}

    const localMap = {};
    localProducts.forEach(p => {
        if (p.barcode) localMap[String(p.barcode).trim()] = p;
    });

    let updatedPricesCount = 0;
    let updatedNamesCount = 0;
    const finalProducts = [];

    for (const ci of cloudItems) {
        const barcode = String(ci.barCode || '').trim();
        if (!barcode) continue;

        const tagInfo = tagMap[barcode] || null;
        const cPrice = ci.price !== null && ci.price !== undefined ? parseFloat(ci.price) : 0;
        const cOrig = ci.originalPrice !== null && ci.originalPrice !== undefined ? parseFloat(ci.originalPrice) : 0;
        
        // Effective selling price from ZKong
        const effectivePrice = cPrice > 0 ? cPrice : (cOrig > 0 ? cOrig : 0);
        const rawName = ci.itemTitle || ci.name || (localMap[barcode] ? localMap[barcode].name : '');
        const cleanName = cleanProductName(rawName);
        const spec = ci.spec || (localMap[barcode] ? localMap[barcode].spec : '');

        if (rawName !== cleanName) {
            updatedNamesCount++;
        }

        let prod = localMap[barcode] || {
            id: finalProducts.length + 1,
            barcode: barcode,
            sku: barcode,
            name: cleanName,
            unit: 'buc',
            stock: 99
        };

        if (prod.price !== effectivePrice) {
            updatedPricesCount++;
        }

        prod.barcode = barcode;
        prod.sku = barcode;
        prod.name = cleanName;
        prod.price = effectivePrice;
        prod.originalPrice = cOrig > 0 ? cOrig : (cPrice > 0 ? cPrice : null);
        prod.spec = spec;
        prod.stock = ci.stock1 || prod.stock || 99;

        if (tagInfo) {
            prod.tagCode = tagInfo.priceTagCode;
            prod.tagBattery = tagInfo.battery;
            prod.tagMac = tagInfo.mac;
            prod.tagModel = tagInfo.oemModel;
            prod.tagLastSeen = tagInfo.lastCommuTime;
        }

        calculateProductPpl(prod);
        finalProducts.push(prod);
    }

    // 5. Save JSON databases
    const jsonStr = JSON.stringify(finalProducts, null, 2);
    fs.writeFileSync(DATA_FILE, jsonStr, 'utf8');

    const additionalJsonPaths = [
        path.join(ROOT_DIR, 'products.json'),
        path.join(ROOT_DIR, 'zkong-platform', 'desktop', 'dist', 'Zkong-Desktop-Application-win32-x64', 'resources', 'app', 'products.json'),
        path.join(ROOT_DIR, 'Zkong-ESL-Standalone', 'resources', 'app', 'products.json')
    ];
    for (const p of additionalJsonPaths) {
        if (fs.existsSync(path.dirname(p))) {
            try { fs.writeFileSync(p, jsonStr, 'utf8'); } catch (e) {}
        }
    }

    // 6. Generate Standard ZKong Excel
    const excelRows = [HEADERS];
    for (const p of finalProducts) {
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
        // Extended field 1 is index 28 (custFeature1: HG 947/2000 unit price):
        row[28] = p.custFeature1 || '';

        excelRows.push(row);
    }

    const ws = XLSX.utils.aoa_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Single_specification_Item');

    // Add readable Romanian view sheet
    const roRows = finalProducts.map(p => ({
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

    // Write to all target files
    const targets = [
        'C:/Users/Nazjar/Desktop/zkong_catalog.xlsx',
        path.join(ROOT_DIR, 'zkong_catalog.xlsx'),
        path.join(__dirname, 'zkong_catalog.xlsx')
    ];

    const writtenTargets = [];
    for (const target of targets) {
        try {
            if (target.includes('Desktop') || fs.existsSync(path.dirname(target))) {
                XLSX.writeFile(wb, target);
                writtenTargets.push(target);
            }
        } catch (e) {
            console.warn(`[Sync] Nu s-a putut scrie in ${target}: ${e.message}`);
        }
    }

    if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupTarget = path.join(BACKUPS_DIR, 'Single_ana_LIVE_ZKONG_' + ts + '.xlsx');
    try {
        XLSX.writeFile(wb, backupTarget);
    } catch (e) {}

    return {
        status: 'ok',
        success: true,
        message: `Sincronizare live ZKong finalizată cu succes! S-au actualizat ${updatedPricesCount} prețuri modificate din ZKong.`,
        totalCloudItems: cloudItems.length,
        totalBoundTags: allTags.length,
        updatedPricesCount,
        updatedNamesCount,
        totalProducts: finalProducts.length,
        writtenFiles: writtenTargets,
        backupFile: path.basename(backupTarget)
    };
}

// CLI Execution or module export
if (require.main === module) {
    const isDaemon = process.argv.includes('--watch') || process.argv.includes('--daemon');
    const intervalSec = 60;

    async function execute() {
        try {
            const res = await syncFromZkongCloud();
            console.log(JSON.stringify(res, null, 2));
        } catch (err) {
            console.error(JSON.stringify({ status: 'error', message: err.message }));
            if (!isDaemon) process.exit(1);
        }
    }

    execute().then(() => {
        if (isDaemon) {
            console.log(`[Sync Watcher] Sincronizarea live rulează în fundal la fiecare ${intervalSec} secunde...`);
            setInterval(execute, intervalSec * 1000);
        }
    });
}

module.exports = { syncFromZkongCloud, calculateProductPpl, extractVolumeOrWeight, cleanProductName };
