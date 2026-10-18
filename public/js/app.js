/**
 * Logic Presensi Siswa Ekstrakurikuler Robotik MAN 19 Jakarta
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('attendanceForm');
  const btnSubmit = document.getElementById('btnSubmit');
  const btnText = document.getElementById('btnText');
  const btnIcon = document.getElementById('btnIcon');
  const btnTestGps = document.getElementById('btnTestGps');

  const gpsStatusCard = document.getElementById('gpsStatusCard');
  const gpsIndicatorDot = document.getElementById('gpsIndicatorDot');
  const gpsStatusText = document.getElementById('gpsStatusText');

  // Modal elements
  const resultModal = document.getElementById('resultModal');
  const modalCard = document.getElementById('modalCard');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalConfirmBtn = document.getElementById('modalConfirmBtn');
  const modalIconContainer = document.getElementById('modalIconContainer');
  const modalTitle = document.getElementById('modalTitle');
  const modalMessage = document.getElementById('modalMessage');
  const modalDetails = document.getElementById('modalDetails');

  const resNama = document.getElementById('resNama');
  const resKelas = document.getElementById('resKelas');
  const resJarak = document.getElementById('resJarak');
  const resWaktu = document.getElementById('resWaktu');

  let cachedPosition = null;

  // Options akurasi tinggi GPS
  const geoOptions = {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 0
  };

  /**
   * Mendapatkan atau membuat ID perangkat unik persisten (Device Fingerprint)
   */
  function getOrCreateDeviceId() {
    let deviceId = localStorage.getItem('man19_robotik_device_id');
    if (!deviceId) {
      const traits = `${screen.width}x${screen.height}_${navigator.hardwareConcurrency || 2}`;
      const randomStr = Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      deviceId = `DEV_${traits}_${randomStr}`;
      localStorage.setItem('man19_robotik_device_id', deviceId);
    }
    return deviceId;
  }

  // Real-time listener cek kunci perangkat saat siswa mengetikkan token
  const tokenInput = document.getElementById('token');
  const deviceLockWarning = document.getElementById('deviceLockWarning');

  function checkDeviceLockForToken(tokenCode) {
    if (!tokenCode || !deviceLockWarning) return;
    const cleanToken = tokenCode.trim().toUpperCase();
    const attendedJson = localStorage.getItem('man19_attended_' + cleanToken);
    if (attendedJson) {
      try {
        const parsed = JSON.parse(attendedJson);
        deviceLockWarning.innerHTML = `
          <i data-lucide="lock" class="w-3.5 h-3.5 text-amber-400 shrink-0"></i>
          <span>Perangkat ini sudah digunakan absen oleh <strong>${parsed.nama}</strong> (${parsed.kelas}) pada sesi token ini.</span>
        `;
        deviceLockWarning.classList.remove('hidden');
        lucide.createIcons();
      } catch (e) {}
    } else {
      deviceLockWarning.classList.add('hidden');
    }
  }

  if (tokenInput) {
    tokenInput.addEventListener('input', (e) => {
      checkDeviceLockForToken(e.target.value);
    });
  }

  /**
   * Helper untuk mendapatkan koordinat GPS melalui Promise
   */
  function getCurrentGPSPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error('Browser Anda tidak mendukung Geolocation API.'));
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, geoOptions);
    });
  }

  /**
   * Update UI status GPS
   */
  function updateGpsUI(status, message, dotColor = 'bg-amber-400') {
    gpsStatusText.textContent = message;
    gpsIndicatorDot.className = `w-2.5 h-2.5 rounded-full ${dotColor}`;
  }

  /**
   * Tombol Tes Cepat GPS
   */
  btnTestGps.addEventListener('click', async () => {
    updateGpsUI('loading', 'Mencari sinyal GPS akurasi tinggi...', 'bg-amber-400 animate-pulse');
    try {
      const pos = await getCurrentGPSPosition();
      cachedPosition = pos;
      const acc = Math.round(pos.coords.accuracy);
      updateGpsUI('ready', `GPS Terkunci (Akurasi: ±${acc}m)`, 'bg-emerald-400');
    } catch (err) {
      handleGeoError(err);
    }
  });

  /**
   * Handle Error Geolocation
   */
  function handleGeoError(err) {
    let msg = 'Gagal mengakses GPS perangkat.';
    if (err.code === 1) { // PERMISSION_DENIED
      msg = 'Izin lokasi (GPS) ditolak. Wajib izinkan akses lokasi di browser untuk absen.';
    } else if (err.code === 2) { // POSITION_UNAVAILABLE
      msg = 'Sinyal lokasi tidak tersedia. Pastikan fitur Lokasi di HP/Laptop menyala.';
    } else if (err.code === 3) { // TIMEOUT
      msg = 'Waktu pencarian GPS habis. Silakan coba kembali di tempat terbuka.';
    }
    updateGpsUI('error', msg, 'bg-rose-500');
    return msg;
  }

  /**
   * Set Tombol Form State
   */
  function setFormLoading(isLoading, customText = 'Memproses Absensi...') {
    if (isLoading) {
      btnSubmit.disabled = true;
      btnSubmit.classList.add('opacity-75', 'cursor-not-allowed');
      btnText.textContent = customText;
      btnIcon.setAttribute('data-lucide', 'loader-2');
      btnIcon.classList.add('animate-spin');
    } else {
      btnSubmit.disabled = false;
      btnSubmit.classList.remove('opacity-75', 'cursor-not-allowed');
      btnText.textContent = 'Kirim Presensi Sekarang';
      btnIcon.setAttribute('data-lucide', 'send');
      btnIcon.classList.remove('animate-spin');
    }
    lucide.createIcons();
  }

  /**
   * Tampilkan Modal Feedback
   */
  function showModal({ type, title, message, data = null }) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;

    if (type === 'success') {
      modalCard.className = 'w-full max-w-md glass-panel rounded-2xl p-6 sm:p-7 border border-emerald-500/40 relative shadow-2xl transform scale-100 transition-transform duration-300';
      modalIconContainer.className = 'w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
      modalIconContainer.innerHTML = '<i data-lucide="check-circle-2" class="w-8 h-8"></i>';

      if (data) {
        modalDetails.classList.remove('hidden');
        resNama.textContent = data.nama;
        resKelas.textContent = data.kelas;
        resJarak.textContent = `${data.distance_meters} meter dari MAN 19`;
        resWaktu.textContent = data.waktu_wib;
      }
    } else {
      modalCard.className = 'w-full max-w-md glass-panel rounded-2xl p-6 sm:p-7 border border-rose-500/40 relative shadow-2xl transform scale-100 transition-transform duration-300';
      modalIconContainer.className = 'w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-rose-500/10 text-rose-400 border border-rose-500/30';
      modalIconContainer.innerHTML = '<i data-lucide="alert-triangle" class="w-8 h-8"></i>';
      modalDetails.classList.add('hidden');
    }

    resultModal.classList.remove('hidden');
    setTimeout(() => {
      resultModal.classList.remove('opacity-0');
    }, 10);

    lucide.createIcons();
  }

  function closeModal() {
    resultModal.classList.add('opacity-0');
    setTimeout(() => {
      resultModal.classList.add('hidden');
    }, 300);
  }

  modalCloseBtn.addEventListener('click', closeModal);
  modalConfirmBtn.addEventListener('click', closeModal);
  resultModal.addEventListener('click', (e) => {
    if (e.target === resultModal) closeModal();
  });

  /**
   * Submit Event Listener
   */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nama = document.getElementById('nama').value.trim();
    const kelas = document.getElementById('kelas').value;
    const token = document.getElementById('token').value.trim().toUpperCase();

    if (!nama || !kelas || !token) {
      showModal({
        type: 'error',
        title: 'Formulir Belum Lengkap',
        message: 'Mohon isi Nama Lengkap, pilih Kelas, dan masukkan Token Sesi.'
      });
      return;
    }

    // 1. Validasi Kunci Perangkat di Browser (Anti Titip Absen)
    const attendedJson = localStorage.getItem('man19_attended_' + token);
    if (attendedJson) {
      try {
        const parsed = JSON.parse(attendedJson);
        showModal({
          type: 'error',
          title: 'Perangkat Terkunci (Anti Titip Absen)',
          message: `HP ini sudah Anda gunakan untuk absensi atas nama "${parsed.nama}" (${parsed.kelas}) pada sesi token ini! Sistem melarang 1 HP digunakan untuk mengabsenkan siswa lain.`
        });
        return;
      } catch (e) {}
    }

    setFormLoading(true, 'Mengunci Posisi GPS...');
    updateGpsUI('loading', 'Mendeteksi koordinat terkini...', 'bg-cyan-400 animate-pulse');

    let position;
    try {
      position = await getCurrentGPSPosition();
      cachedPosition = position;
      const acc = Math.round(position.coords.accuracy);
      updateGpsUI('ready', `GPS Terkunci (Akurasi: ±${acc}m)`, 'bg-emerald-400');
    } catch (geoErr) {
      setFormLoading(false);
      const errMsg = handleGeoError(geoErr);
      showModal({
        type: 'error',
        title: 'Akses GPS Gagal',
        message: errMsg
      });
      return;
    }

    const user_lat = position.coords.latitude;
    const user_lon = position.coords.longitude;
    const device_id = getOrCreateDeviceId();

    setFormLoading(true, 'Memverifikasi Presensi...');

    try {
      const payload = {
        nama,
        kelas,
        token,
        user_lat,
        user_lon,
        device_id
      };

      const response = await fetch('/api/absensi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      setFormLoading(false);

      if (response.ok && result.success) {
        // Kunci perangkat ini di memori HP untuk token sesi ini
        localStorage.setItem('man19_attended_' + token, JSON.stringify({
          nama: result.data.nama,
          kelas: result.data.kelas,
          waktu: result.data.waktu_wib
        }));
        checkDeviceLockForToken(token);

        // Tampilkan modal sukses
        showModal({
          type: 'success',
          title: 'Presensi Berhasil!',
          message: 'Kehadiran Anda pada sesi Ekstrakurikuler Robotik telah resmi tercatat di sistem.',
          data: result.data
        });

        // Reset nama & kelas (token tetap tersimpan untuk kenyamanan jika diperlukan)
        document.getElementById('nama').value = '';
        document.getElementById('kelas').value = '';
      } else {
        // Tampilkan pesan error spesifik dari backend (Device Lock, Out of Bounds, Duplicate, Expired)
        const modalTitle = result.code === 'DEVICE_LOCKED' 
          ? 'Perangkat Terkunci (Anti Titip Absen)'
          : (result.code === 'OUT_OF_BOUNDS' ? 'Di Luar Area MAN 19' : 'Presensi Ditolak');

        showModal({
          type: 'error',
          title: modalTitle,
          message: result.message || 'Terjadi kesalahan saat memproses absensi Anda.'
        });
      }
    } catch (networkError) {
      setFormLoading(false);
      console.error('Fetch error:', networkError);
      showModal({
        type: 'error',
        title: 'Gagal Terhubung ke Server',
        message: 'Koneksi internet bermasalah atau server backend sedang offline. Silakan coba kembali.'
      });
    }
  });

  // Tes GPS otomatis saat pertama kali dibuka (opsional ramah pengguna)
  setTimeout(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          cachedPosition = pos;
          const acc = Math.round(pos.coords.accuracy);
          updateGpsUI('ready', `GPS Siap (Akurasi: ±${acc}m)`, 'bg-emerald-400');
        },
        () => {
          updateGpsUI('idle', 'Klik "Kirim Presensi" atau "Tes GPS" untuk izin lokasi', 'bg-slate-400');
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    }
  }, 1000);
});
