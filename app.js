// ============================================
// GANTI DENGAN URL WEB APP APPS SCRIPT ANDA
// ============================================
const API_URL = 'https://script.google.com/macros/s/AKfycbyW4jWoWlt_i0U_FpeIjdTZymz2NhlyMh884z0uSxrrsCUd8hJpY5bb6JJIpDZln-FlFw/exec';

let currentUser = null;

// ============ API HELPERS ============
// Apps Script tidak support CORS untuk JSON POST dari browser.
// Solusi: kirim sebagai text/plain (simple request, no preflight).
async function apiPost(payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow'
  });
  return res.json();
}

async function apiGet(action, params = {}) {
  const url = new URL(API_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { redirect: 'follow' });
  return res.json();
}

// ============ LOGIN ============
async function handleLogin(e) {
  e.preventDefault();
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  const btn = document.getElementById('btnLogin');
  
  btn.disabled = true;
  btn.textContent = 'Memproses...';
  
  try {
    const res = await apiPost({ action: 'login', username: user, password: pass });
    if (res.success) {
      currentUser = res.user;
      sessionStorage.setItem('sirampog_user', JSON.stringify(res.user));
      showDashboard();
      showToast('Selamat datang, ' + res.user.nama);
    } else {
      showToast(res.message, true);
    }
  } catch(err) {
    showToast('Error koneksi: ' + err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Masuk 🔐';
  }
}

function logout() {
  currentUser = null;
  sessionStorage.removeItem('sirampog_user');
  document.getElementById('mainApp').classList.add('hidden');
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
}

// ============ DASHBOARD ============
function showDashboard() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  
  document.getElementById('userNameDisplay').textContent = currentUser.nama;
  const badge = document.getElementById('userRoleBadge');
  badge.textContent = currentUser.role.toUpperCase();
  badge.className = 'badge ' + (currentUser.role === 'admin' ? 'badge-admin' : 'badge-user');
  
  if (currentUser.role === 'admin') {
    document.getElementById('actionHeader').classList.remove('hidden');
  } else {
    document.getElementById('actionHeader').classList.add('hidden');
  }
  
  loadAduan();
}

// ============ LOAD ADUAN ============
async function loadAduan() {
  const tbody = document.getElementById('aduanTableBody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted)">Memuat data...</td></tr>';
  
  try {
    const data = await apiGet('getAllAduan');
    if (data.error) throw new Error(data.error);
    renderTable(data);
    updateStats(data);
  } catch(err) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--danger)">Gagal memuat: ' + err.message + '</td></tr>';
  }
}

function renderTable(data) {
  const tbody = document.getElementById('aduanTableBody');
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted)">Belum ada aduan.</td></tr>';
    return;
  }
  
  const sorted = [...data].reverse();
  
  tbody.innerHTML = sorted.map(row => {
    const statusClass = row.Status === 'Baru' ? 'status-baru' : 
                        row.Status === 'Diproses' ? 'status-proses' : 'status-selesai';
    
    let aksi = '';
    if (currentUser && currentUser.role === 'admin') {
      aksi = `<td>
        <select onchange="updateStatus('${row.TicketID}', this.value)" style="padding:.4rem;border-radius:6px;background:var(--bg);color:var(--text);border:1px solid rgba(148,163,184,.2);font-size:.8rem">
          <option value="Baru" ${row.Status==='Baru'?'selected':''}>Baru</option>
          <option value="Diproses" ${row.Status==='Diproses'?'selected':''}>Diproses</option>
          <option value="Selesai" ${row.Status==='Selesai'?'selected':''}>Selesai</option>
        </select>
      </td>`;
    }
    
    const tgl = row.Tanggal ? new Date(row.Tanggal).toLocaleDateString('id-ID') : '-';
    
    return `<tr>
      <td><strong>${row.TicketID}</strong></td>
      <td>${tgl}</td>
      <td>${row.Username || '-'}</td>
      <td>${row.Kategori}</td>
      <td>${row.Lokasi}</td>
      <td><span class="status-badge ${statusClass}">${row.Status}</span></td>
      ${aksi}
    </tr>`;
  }).join('');
}

function updateStats(data) {
  document.getElementById('statTotal').textContent = data.length;
  document.getElementById('statBaru').textContent = data.filter(d => d.Status === 'Baru').length;
  document.getElementById('statProses').textContent = data.filter(d => d.Status === 'Diproses').length;
  document.getElementById('statSelesai').textContent = data.filter(d => d.Status === 'Selesai').length;
}

// ============ BUAT ADUAN ============
async function handleBuatAduan(e) {
  e.preventDefault();
  const btn = document.getElementById('btnKirimAduan');
  btn.disabled = true;
  btn.textContent = 'Mengirim...';
  
  const data = {
    username: currentUser ? currentUser.username : 'Anonim',
    kategori: document.getElementById('aduanKategori').value,
    lokasi: document.getElementById('aduanLokasi').value,
    isi: document.getElementById('aduanIsi').value
  };
  
  try {
    const res = await apiPost({ action: 'submitAduan', data });
    if (res.success) {
      showToast('Aduan terkirim! Tiket: ' + res.ticketId);
      document.getElementById('formAduan').reset();
      loadAduan();
    } else {
      showToast('Gagal: ' + (res.message || res.error), true);
    }
  } catch(err) {
    showToast('Error: ' + err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Kirim Aduan 📤';
  }
}

// ============ UPDATE STATUS ============
async function updateStatus(ticketId, newStatus) {
  try {
    const res = await apiPost({
      action: 'updateStatus',
      ticketId, newStatus,
      adminUsername: currentUser.username
    });
    if (res.success) {
      showToast('Status ' + ticketId + ' → ' + newStatus);
      loadAduan();
    } else {
      showToast('Gagal: ' + (res.message || res.error), true);
    }
  } catch(err) {
    showToast('Error: ' + err.message, true);
  }
}

// ============ TOAST ============
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ============ AUTO LOGIN (session) ============
window.addEventListener('DOMContentLoaded', () => {
  const saved = sessionStorage.getItem('sirampog_user');
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      showDashboard();
    } catch(e) { sessionStorage.removeItem('sirampog_user'); }
  }
});
