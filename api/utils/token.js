const crypto = require('crypto');

/**
 * Menghasilkan kode token acak yang unik dan mudah dibaca
 * Contoh format: RBK-8924 atau ROBO-7K2X
 * @param {string} prefix 
 * @param {number} length 
 * @returns {string}
 */
function generateTokenCode(prefix = 'RBK', length = 4) {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Tanpa 0, 1, I, O untuk menghindari salah ketik
  let result = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return `${prefix}-${result}`;
}

/**
 * Format tanggal ISO / UTC ke format waktu Indonesia Barat (WIB)
 * @param {Date|string} dateInput 
 * @returns {string}
 */
function formatWIB(dateInput) {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  return d.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }) + ' WIB';
}

module.exports = {
  generateTokenCode,
  formatWIB
};
