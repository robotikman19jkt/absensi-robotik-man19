/**
 * Logic Panel Admin Ekstrakurikuler Robotik MAN 19 Jakarta
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elemen Login
  const loginScreen = document.getElementById('loginScreen');
  const dashboardContent = document.getElementById('dashboardContent');
  const adminLoginForm = document.getElementById('adminLoginForm');
  const adminPinInput = document.getElementById('adminPinInput');
  const loginErrorMsg = document.getElementById('loginErrorMsg');
  const btnLogout = document.getElementById('btnLogout');

  // Elemen Token Sesi
  const btnGenerateToken = document.getElementById('btnGenerateToken');
  const iconGenerate = document.getElementById('iconGenerate');
  const activeTokenDisplay = document.getElementById('activeTokenDisplay');
  const btnCopyToken = document.getElementById('btnCopyToken');
  const copyFeedback = document.getElementById('copyFeedback');
  const countdownTimer = document.getElementById('countdownTimer');
  const tokenStatusBadge = document.getElementById('tokenStatusBadge');
  const tokenCreatedAt = document.getElementById('tokenCreatedAt');

  // Elemen Metrik
  const statToday = document.getElementById('statToday');
  const statTotal = document.getElementById('statTotal');

  // Elemen Tabel & Filter
  const tableBody = document.getElementById('tableBody');
  const tableRecordCount = document.getElementById('tableRecordCount');
  const searchNama = document.getElementById('searchNama');
  const filterKelas = document.getElementById('filterKelas');
  const btnRefreshTable = document.getElementById('btnRefreshTable');
  const iconRefresh = document.getElementById('iconRefresh');
  const btnExportData = document.getElementById('btnExportData');

  let adminPin = sessionStorage.getItem('robotik_admin_pin') || '';
  let countdownInterval = null;
  let remainingSeconds = 0;
  let autoRefreshTimer = null;

  // Inisialisasi: Cek apakah sudah login
  if (adminPin) {
    verifyAndUnlock(adminPin);
  }

  /**
   * Verifikasi PIN ke Backend
   */
  async function verifyAndUnlock(pin) {
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        adminPin = pin;
        sessionStorage.setItem('robotik_admin_pin', pin);
        loginScreen.classList.add('hidden');
        dashboardContent.classList.remove('hidden');
        btnLogout.classList.remove('hidden');

        // Mulai load data dashboard
        loadDashboard();
      } else {
        sessionStorage.removeItem('robotik_admin_pin');
        showLoginError('PIN Admin salah. Silakan coba kembali.');
      }
    } catch (err) {
      console.error(err);
      showLoginError('Gagal terhubung ke server untuk verifikasi.');
    }
  }

  function showLoginError(msg) {
    loginErrorMsg.textContent = msg;
    loginErrorMsg.classList.remove('hidden');
  }

  // Submit Form Login
  adminLoginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const pin = adminPinInput.value.trim();
    if (!pin) return;
    verifyAndUnlock(pin);
  });

  // Tombol Logout
  btnLogout.addEventListener('click', () => {
    sessionStorage.removeItem('robotik_admin_pin');
    window.location.reload();
  });

  /**
   * Load Seluruh Data Dashboard
   */
  function loadDashboard() {
    fetchActiveToken();
    fetchRekapData();

    // Auto-refresh rekap tabel setiap 10 detik
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(() => {
      fetchRekapData(true); // silent = true
    }, 10000);
  }

  /**
   * Ambil Token Aktif & Mulai Countdown
   */
  async function fetchActiveToken() {
    try {
      const res = await fetch('/api/admin/token/active', {
        headers: { 'x-admin-pin': adminPin }
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (data.has_active_token && data.token) {
          renderActiveToken(data.token);
        } else {
          renderNoActiveToken();
        }
      }
    } catch (err) {
      console.error('Error fetch active token:', err);
    }
  }

  function renderActiveToken(token) {
    activeTokenDisplay.textContent = token.code;
    tokenCreatedAt.textContent = `Dibuat: ${token.created_at_wib}`;
    tokenStatusBadge.textContent = 'AKTIF (30 MENIT)';
    tokenStatusBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';

    remainingSeconds = token.seconds_left;
    startCountdown();
  }

  function renderNoActiveToken() {
    activeTokenDisplay.textContent = 'TIDAK AKTIF';
    tokenCreatedAt.textContent = 'Klik tombol di atas untuk membuat token sesi';
    countdownTimer.textContent = '00 : 00';
    tokenStatusBadge.textContent = 'KEDALUWARSA / KOSONG';
    tokenStatusBadge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30';
    if (countdownInterval) clearInterval(countdownInterval);
  }

  /**
   * Countdown Timer 30 Menit
   */
  function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);

    const updateTimerDisplay = () => {
      if (remainingSeconds <= 0) {
        clearInterval(countdownInterval);
        renderNoActiveToken();
        return;
      }

      const minutes = Math.floor(remainingSeconds / 60);
      const seconds = remainingSeconds % 60;
      countdownTimer.textContent = `${String(minutes).padStart(2, '0')} : ${String(seconds).padStart(2, '0')}`;
      remainingSeconds--;
    };

    updateTimerDisplay();
    countdownInterval = setInterval(updateTimerDisplay, 1000);
  }

  /**
   * Generate Token Baru
   */
  btnGenerateToken.addEventListener('click', async () => {
    btnGenerateToken.disabled = true;
    iconGenerate.classList.add('animate-spin');

    try {
      const res = await fetch('/api/admin/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': adminPin
        }
      });
      const data = await res.json();

      if (res.ok && data.success) {
        renderActiveToken(data.token);
      } else {
        alert(data.message || 'Gagal membuat token baru!');
      }
    } catch (err) {
      console.error(err);
      alert('Gagal membuat token baru. Cek koneksi server.');
    } finally {
      btnGenerateToken.disabled = false;
      iconGenerate.classList.remove('animate-spin');
    }
  });

  /**
   * Salin Token ke Clipboard
   */
  btnCopyToken.addEventListener('click', () => {
    const code = activeTokenDisplay.textContent.trim();
    if (!code || code === 'TIDAK AKTIF' || code === 'MEMUAT...') return;

    navigator.clipboard.writeText(code).then(() => {
      copyFeedback.classList.remove('opacity-0');
      setTimeout(() => {
        copyFeedback.classList.add('opacity-0');
      }, 2500);
    });
  });

  /**
   * Ambil Rekap Absensi
   */
  async function fetchRekapData(silent = false) {
    if (!silent) {
      iconRefresh.classList.add('animate-spin');
    }

    try {
      const querySearch = encodeURIComponent(searchNama.value.trim());
      const queryKelas = encodeURIComponent(filterKelas.value);

      const url = `/api/admin/rekap?search=${querySearch}&kelas=${queryKelas}`;
      const res = await fetch(url, {
        headers: { 'x-admin-pin': adminPin }
      });
      const data = await res.json();

      if (res.ok && data.success) {
        // Update Metrik
        statToday.textContent = data.stats.total_today;
        statTotal.textContent = data.stats.total_all;

        // Render Baris Tabel
        renderTableRows(data.data);
      }
    } catch (err) {
      console.error('Error fetch rekap:', err);
    } finally {
      if (!silent) {
        iconRefresh.classList.remove('animate-spin');
      }
    }
  }

  /**
   * Render Tabel Absensi
   */
  function renderTableRows(records) {
    tableRecordCount.textContent = `Menampilkan ${records.length} data absensi`;

    if (!records || records.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-12 text-slate-500">
            <div class="w-12 h-12 mx-auto mb-2 text-slate-600 flex items-center justify-center">
              <i data-lucide="inbox" class="w-8 h-8"></i>
            </div>
            Belum ada data presensi yang sesuai kriteria pencarian.
          </td>
        </tr>
      `;
      lucide.createIcons();
      return;
    }

    const rowsHtml = records.map((item, index) => {
      const dist = parseFloat(item.distance_meters);
      const distClass = dist <= 50 
        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' 
        : 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';

      const isClassX = item.kelas.startsWith('X-');
      const badgeClass = isClassX 
        ? 'bg-cyan-950/70 text-cyan-300 border-cyan-500/30' 
        : 'bg-indigo-950/70 text-indigo-300 border-indigo-500/30';

      return `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="py-3 px-4 text-center font-mono text-slate-500">${index + 1}</td>
          <td class="py-3 px-4 font-semibold text-white">${escapeHtml(item.nama)}</td>
          <td class="py-3 px-4">
            <span class="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${badgeClass}">
              ${item.kelas}
            </span>
          </td>
          <td class="py-3 px-4 text-slate-300 font-mono text-[11px]">${item.created_at_wib}</td>
          <td class="py-3 px-4">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border ${distClass}">
              <i data-lucide="map-pin" class="w-3 h-3"></i> ${dist} m
            </span>
          </td>
          <td class="py-3 px-4">
            <span class="font-mono text-xs text-slate-300 bg-slate-900 px-2 py-1 rounded border border-slate-800">
              ${escapeHtml(item.token_used)}
            </span>
          </td>
        </tr>
      `;
    }).join('');

    tableBody.innerHTML = rowsHtml;
    lucide.createIcons();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Filter & Search Events
  let searchTimeout = null;
  searchNama.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      fetchRekapData(false);
    }, 300);
  });

  filterKelas.addEventListener('change', () => {
    fetchRekapData(false);
  });

  btnRefreshTable.addEventListener('click', () => {
    fetchRekapData(false);
  });

  // Export Data ke CSV / Excel
  btnExportData.addEventListener('click', () => {
    const selectedKelas = encodeURIComponent(filterKelas.value);
    const exportUrl = `/api/admin/export?pin=${encodeURIComponent(adminPin)}&kelas=${selectedKelas}`;
    
    // Buka link download langsung
    window.location.href = exportUrl;
  });

});
