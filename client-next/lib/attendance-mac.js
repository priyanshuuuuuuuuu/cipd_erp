/** Shared MAC normalization for Wi-Fi attendance matching */

export function normalizeMac(mac) {
  if (!mac) return '';
  return mac
    .trim()
    .toUpperCase()
    .replace(/[-.\s]/g, ':')
    .replace(/:+/g, ':')
    .replace(/^:|:$/g, '');
}

export function isValidMac(mac) {
  return /^([A-F0-9]{2}:){5}[A-F0-9]{2}$/.test(mac);
}
