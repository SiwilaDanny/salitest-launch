// ═══════════════════════════════════════════════════════════
// SaLiTeSt Launch — Phone Model & Serial Number Resolver
// ═══════════════════════════════════════════════════════════

const MODEL_MAPPING = {
  // Samsung Galaxy A Series
  "sm-a032f": "Samsung Galaxy A03 Core",
  "sm-a035f": "Samsung Galaxy A03",
  "sm-a135f": "Samsung Galaxy A13",
  "sm-a235f": "Samsung Galaxy A23",
  "sm-a336b": "Samsung Galaxy A33 5G",
  "sm-a536b": "Samsung Galaxy A53 5G",
  "sm-a736b": "Samsung Galaxy A73 5G",
  "sm-a042f": "Samsung Galaxy A04e",
  "sm-a045f": "Samsung Galaxy A04",
  "sm-a145f": "Samsung Galaxy A14",
  "sm-a245f": "Samsung Galaxy A24",
  "sm-a346b": "Samsung Galaxy A34 5G",
  "sm-a546b": "Samsung Galaxy A54 5G",

  // Samsung Galaxy S Series
  "sm-g991b": "Samsung Galaxy S21 5G",
  "sm-g996b": "Samsung Galaxy S21+ 5G",
  "sm-g998b": "Samsung Galaxy S21 Ultra 5G",
  "sm-s901b": "Samsung Galaxy S22 5G",
  "sm-s906b": "Samsung Galaxy S22+ 5G",
  "sm-s908b": "Samsung Galaxy S22 Ultra 5G",
  "sm-s911b": "Samsung Galaxy S23 5G",
  "sm-s916b": "Samsung Galaxy S23+ 5G",
  "sm-s918b": "Samsung Galaxy S23 Ultra 5G",
  "sm-s921b": "Samsung Galaxy S24 5G",
  "sm-s926b": "Samsung Galaxy S24+ 5G",
  "sm-s928b": "Samsung Galaxy S24 Ultra 5G",

  // Samsung Galaxy Note / Fold
  "sm-f711b": "Samsung Galaxy Z Flip3 5G",
  "sm-f721b": "Samsung Galaxy Z Flip4 5G",
  "sm-f731b": "Samsung Galaxy Z Flip5 5G",
  "sm-f926b": "Samsung Galaxy Z Fold3 5G",
  "sm-f936b": "Samsung Galaxy Z Fold4 5G",
  "sm-f946b": "Samsung Galaxy Z Fold5 5G",
  "sm-n980f": "Samsung Galaxy Note 20",
  "sm-n986b": "Samsung Galaxy Note 20 Ultra 5G",

  // Google Pixel
  "pixel 4": "Google Pixel 4",
  "pixel 4a": "Google Pixel 4a",
  "pixel 5": "Google Pixel 5",
  "pixel 5a": "Google Pixel 5a",
  "pixel 6": "Google Pixel 6",
  "pixel 6a": "Google Pixel 6a",
  "pixel 6 pro": "Google Pixel 6 Pro",
  "pixel 7": "Google Pixel 7",
  "pixel 7a": "Google Pixel 7a",
  "pixel 7 pro": "Google Pixel 7 Pro",
  "pixel 8": "Google Pixel 8",
  "pixel 8 pro": "Google Pixel 8 Pro",
  "pixel 8a": "Google Pixel 8a",

  // iPhones (sometimes reported by internal identifier model codes)
  "iphone10,1": "iPhone 8",
  "iphone10,4": "iPhone 8",
  "iphone10,2": "iPhone 8 Plus",
  "iphone10,5": "iPhone 8 Plus",
  "iphone10,3": "iPhone X",
  "iphone10,6": "iPhone X",
  "iphone11,2": "iPhone XS",
  "iphone11,4": "iPhone XS Max",
  "iphone11,6": "iPhone XS Max",
  "iphone11,8": "iPhone XR",
  "iphone12,1": "iPhone 11",
  "iphone12,3": "iPhone 11 Pro",
  "iphone12,5": "iPhone 11 Pro Max",
  "iphone12,8": "iPhone SE (2nd Gen)",
  "iphone13,1": "iPhone 12 mini",
  "iphone13,2": "iPhone 12",
  "iphone13,3": "iPhone 12 Pro",
  "iphone13,4": "iPhone 12 Pro Max",
  "iphone14,2": "iPhone 13 Pro",
  "iphone14,3": "iPhone 13 Pro Max",
  "iphone14,4": "iPhone 13 mini",
  "iphone14,5": "iPhone 13",
  "iphone14,6": "iPhone SE (3rd Gen)",
  "iphone14,7": "iPhone 14",
  "iphone14,8": "iPhone 14 Plus",
  "iphone15,2": "iPhone 14 Pro",
  "iphone15,3": "iPhone 14 Pro Max",
  "iphone15,4": "iPhone 15",
  "iphone15,5": "iPhone 15 Plus",
  "iphone16,1": "iPhone 15 Pro",
  "iphone16,2": "iPhone 15 Pro Max",

  // ── Xiaomi / Redmi / POCO ──
  "2201117tg": "Xiaomi 12",
  "2203129g": "Xiaomi 12 Pro",
  "2207122mc": "Xiaomi 12T Pro",
  "2304frp6dg": "Xiaomi 13T",
  "23078rkhdc": "Xiaomi 13T Pro",
  "2211133g": "Xiaomi 13",
  "2210132g": "Xiaomi 13 Pro",
  "23013rk75c": "Xiaomi 13 Ultra",
  "2109119dg": "Xiaomi 11T",
  "2109119sg": "Xiaomi 11T Pro",
  "220333qny": "Redmi Note 11",
  "2201116tg": "Redmi Note 11 Pro",
  "22041219ny": "Redmi Note 11S",
  "22111317g": "Redmi Note 12",
  "23021raaeg": "Redmi Note 12 Pro",
  "22101316g": "Redmi Note 12 Pro+",
  "23076ra4bc": "Redmi Note 13",
  "23090ra98g": "Redmi Note 13 Pro",
  "23108rn74g": "Redmi Note 13 Pro+",
  "220733sfy": "Redmi A1",
  "23028ra8bc": "Redmi A2",
  "22120rn86g": "Redmi 12C",
  "23053rn02a": "Redmi 12",
  "23106rn0da": "Redmi 13C",
  "22071219cg": "POCO X4 GT",
  "23049pcd8g": "POCO X5 Pro 5G",
  "22101320g": "POCO F4",
  "23013pc75g": "POCO F5",
  "23049pcd8i": "POCO M5",
  "22071212ag": "POCO M4 Pro",

  // ── OPPO ──
  "cph2239": "OPPO A16",
  "cph2269": "OPPO A16s",
  "cph2325": "OPPO A17",
  "cph2477": "OPPO A18",
  "cph2375": "OPPO A57",
  "cph2387": "OPPO A57s",
  "cph2381": "OPPO A77",
  "cph2385": "OPPO A77s",
  "cph2505": "OPPO A78",
  "cph2339": "OPPO A96",
  "cph2401": "OPPO A98",
  "cph2271": "OPPO Reno7",
  "cph2363": "OPPO Reno8",
  "cph2389": "OPPO Reno8 Pro",
  "cph2495": "OPPO Reno10",
  "cph2521": "OPPO Reno10 Pro",
  "cph2531": "OPPO Reno11",
  "cph2525": "OPPO Reno11 Pro",
  "cph2305": "OPPO Find X5 Pro",
  "cph2519": "OPPO Find X6 Pro",

  // ── Tecno ──
  "bf7": "Tecno Spark 10C",
  "bf7j": "Tecno Spark 10",
  "ki5q": "Tecno Spark 10 Pro",
  "ki7": "Tecno Spark 20",
  "ki7c": "Tecno Spark 20C",
  "kj5": "Tecno Spark 20 Pro",
  "kj6": "Tecno Spark 20 Pro+",
  "bf6": "Tecno Spark 9 Pro",
  "kg5p": "Tecno Camon 20",
  "kg7n": "Tecno Camon 20 Pro",
  "ck6n": "Tecno Camon 20 Premier",
  "cl6": "Tecno Camon 30",
  "cl8": "Tecno Camon 30 Pro",
  "ad8": "Tecno Pova 4",
  "ad8s": "Tecno Pova 4 Pro",
  "lg8n": "Tecno Pova 5",
  "lg7n": "Tecno Pova 5 Pro",
  "lh8n": "Tecno Pova 6 Pro",
  "ch9n": "Tecno Phantom V Fold",
  "ad9": "Tecno Phantom X2",
  "ad9b": "Tecno Phantom X2 Pro",
  "bf5": "Tecno Pop 7",
  "bf5j": "Tecno Pop 7 Pro",

  // ── Infinix ──
  "x6515": "Infinix Hot 12",
  "x6817": "Infinix Hot 20",
  "x6826": "Infinix Hot 20S",
  "x6837": "Infinix Hot 30",
  "x6831": "Infinix Hot 30i",
  "x6835": "Infinix Hot 30 Play",
  "x6711": "Infinix Note 12",
  "x6716": "Infinix Note 12 Pro",
  "x670": "Infinix Note 30",
  "x6833b": "Infinix Note 30 Pro",
  "x6731": "Infinix Note 30 VIP",
  "x6525": "Infinix Smart 6",
  "x6511": "Infinix Smart 7",
  "x6516": "Infinix Smart 7 HD",
  "x6528": "Infinix Smart 8",
  "x657c": "Infinix Zero 20",
  "x6821": "Infinix Zero 30",
  "x6830": "Infinix Zero 30 5G",
  "x682c": "Infinix GT 10 Pro",

  // ── itel ──
  "a662l": "itel A58",
  "a665l": "itel A60",
  "a662lc": "itel A60s",
  "p662l": "itel P40",
  "p662lc": "itel P40+",
  "s665l": "itel S23",
  "s665lp": "itel S23+",
  "a663l": "itel A70",
  "w6502": "itel P55",
  "w6503": "itel P55+",
  "w7001": "itel RS4",

  // ── Lenovo / Motorola ──
  "xt2243-1": "Motorola Moto G73 5G",
  "xt2237-2": "Motorola Moto G53",
  "xt2347-2": "Motorola Moto G84 5G",
  "xt2301-4": "Motorola Moto G54 5G",
  "xt2339-2": "Motorola Edge 40",
  "xt2303-4": "Motorola Edge 40 Pro",
  "xt2343-2": "Motorola Edge 40 Neo",
  "xt2251-1": "Motorola Moto G32",
  "xt2235-2": "Motorola Moto G22",
  "xt2363-3": "Motorola Edge 50 Pro",
  "xt2361-3": "Motorola Edge 50 Fusion",
  "xt2365-1": "Motorola Edge 50 Ultra",
  "xt2421-1": "Motorola Moto G35",
  "xt2419-1": "Motorola Moto G45",
  "tb328fu": "Lenovo Tab M10 Plus (3rd Gen)",
  "tb370fu": "Lenovo Tab P12",
  "tb350fu": "Lenovo Tab M9",

  // ── Sony Xperia ──
  "xq-cq54": "Sony Xperia 1 V",
  "xq-cq72": "Sony Xperia 5 V",
  "xq-cc54": "Sony Xperia 10 V",
  "xq-dc54": "Sony Xperia 1 VI",
  "xq-dc72": "Sony Xperia 5 VI",
  "xq-dc44": "Sony Xperia 10 VI",
  "xq-bt52": "Sony Xperia 1 IV",
  "xq-ct54": "Sony Xperia 5 IV",
  "xq-cc72": "Sony Xperia 10 IV",

  // ── Huawei ──
  "els-nx9": "Huawei P40 Pro",
  "noh-nx9": "Huawei Mate 40 Pro",
  "aby-lx9": "Huawei Nova Y90",
  "ctr-lx1": "Huawei Nova 10",
  "nal-al00": "Huawei Nova 11 Pro",
  "bne-lx1": "Huawei Nova Y61",
  "dra-lx9": "Huawei Y5p",
  "med-lx9": "Huawei Y6p",
  "moa-lx9n": "Huawei Y6s",
  "jny-lx1": "Huawei Y9s",

  // ── Nokia ──
  "ta-1540": "Nokia G42 5G",
  "ta-1573": "Nokia G42 5G",
  "ta-1543": "Nokia C32",
  "ta-1570": "Nokia C32",
  "ta-1545": "Nokia C22",
  "ta-1535": "Nokia G22",
  "ta-1528": "Nokia X30 5G",
  "ta-1515": "Nokia G60 5G",
  "ta-1581": "Nokia C02",
};

/**
 * Resolves raw model codes/serial numbers to human-friendly device names
 *
 * @param {string} rawModel
 * @returns {string} Friendly phone model name
 */
export function resolveDeviceName(rawModel) {
  if (!rawModel) return "Unknown Device";
  const clean = rawModel.trim().toLowerCase();

  // 1. Direct match check
  if (MODEL_MAPPING[clean]) {
    return MODEL_MAPPING[clean];
  }

  // 2. Base substring match (for regional variants e.g. SM-A032F/DS)
  for (const [key, value] of Object.entries(MODEL_MAPPING)) {
    if (clean.startsWith(key) || key.startsWith(clean)) {
      return value;
    }
  }

  // 3. Brand prefix fallbacks for unmapped model codes
  if (clean.startsWith("sm-")) return `Samsung Device (${rawModel.toUpperCase()})`;
  if (clean.startsWith("iphone")) return `Apple iPhone (${rawModel})`;
  if (clean.startsWith("cph")) return `OPPO Device (${rawModel.toUpperCase()})`;
  if (clean.startsWith("rmx")) return `Realme Device (${rawModel.toUpperCase()})`;
  if (clean.startsWith("v") && /^v\d{4}/.test(clean)) return `Vivo Device (${rawModel.toUpperCase()})`;
  if (clean.startsWith("xt")) return `Motorola Device (${rawModel.toUpperCase()})`;
  if (clean.startsWith("xq-")) return `Sony Xperia (${rawModel.toUpperCase()})`;
  if (clean.startsWith("ta-")) return `Nokia Device (${rawModel.toUpperCase()})`;

  return rawModel;
}
