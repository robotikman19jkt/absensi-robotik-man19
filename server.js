const app = require('./api/index');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🤖 SERVER ABSENSI ROBOTIK MAN 19 JAKARTA AKTIF`);
  console.log(`📍 URL Absensi Siswa : http://localhost:${PORT}`);
  console.log(`🛡️  URL Panel Admin   : http://localhost:${PORT}/admin`);
  console.log(`📡 API Health Check   : http://localhost:${PORT}/api/health`);
  console.log('====================================================');
});
