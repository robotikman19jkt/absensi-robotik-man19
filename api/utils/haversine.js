/**
 * Menghitung jarak antara dua titik koordinat geografis menggunakan Rumus Haversine
 * @param {number} lat1 - Latitude titik 1
 * @param {number} lon1 - Longitude titik 1
 * @param {number} lat2 - Latitude titik 2
 * @param {number} lon2 - Longitude titik 2
 * @returns {number} Jarak dalam satuan meter
 */
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius rata-rata bumi dalam meter

  const toRad = (angle) => (angle * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const radLat1 = toRad(lat1);
  const radLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;
  return Math.round(distance * 10) / 10; // Pembulatan 1 desimal
}

/**
 * Validasi apakah posisi pengguna berada dalam radius geofencing MAN 19 Jakarta
 * @param {number} userLat 
 * @param {number} userLon 
 * @param {number} targetLat 
 * @param {number} targetLon 
 * @param {number} maxRadiusMeters 
 * @returns {{ isWithin: boolean, distance: number, maxRadius: number }}
 */
function validateGeofence(userLat, userLon, targetLat, targetLon, maxRadiusMeters = 100) {
  const distance = calculateDistanceMeters(userLat, userLon, targetLat, targetLon);
  return {
    isWithin: distance <= maxRadiusMeters,
    distance,
    maxRadius: maxRadiusMeters
  };
}

module.exports = {
  calculateDistanceMeters,
  validateGeofence
};
