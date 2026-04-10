'use client';
import { useEffect, useState } from 'react';

export default function Home() {
  const TARGET = 200000000;
  const [loading, setLoading] = useState(true);

  const [gDonations, setGDonations] = useState<any[]>([]);
  const [fDonations, setFDonations] = useState<any[]>([]);

  // Views
  const [view, setView] = useState<'home' | 'all-umum' | 'all-tetap'>('home');
  const [activeTab, setActiveTab] = useState('umum');
  const [copied, setCopied] = useState(false);
  const [copiedDana, setCopiedDana] = useState(false);
  const [filterMonth, setFilterMonth] = useState('semua');

  useEffect(() => {
    // Track visitor
    fetch('/api/visitor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: '/' }) }).catch(() => {});

    Promise.all([
      fetch('/api/general-donations').then(r => r.json()),
      fetch('/api/fixed-donations').then(r => r.json())
    ]).then(([genD, fixD]) => {
      setGDonations(Array.isArray(genD) ? genD : []);
      setFDonations(Array.isArray(fixD) ? fixD : []);
      setLoading(false);
    }).catch(e => {
      console.error(e);
      setLoading(false);
    });
  }, []);

  const totalG = gDonations.reduce((s, d) => s + d.amount, 0);
  const totalF = fDonations.reduce((s, d) => s + d.amount, 0);
  const totalGathered = totalG + totalF;
  const pct = Math.min(100, (totalGathered / TARGET) * 100);

  // --- Data Processors ---

  // 1. Umum
  const umumDonations = gDonations;

  // 2. Tetap (Grouped by name)
  const fixedDonorsMap = fDonations.reduce((acc: any, d) => {
    const dName = d.donor.name;
    if (!acc[dName]) {
      acc[dName] = { amount: 0, latestActivity: new Date(0) };
    }
    acc[dName].amount += d.amount;
    const dDate = new Date(d.date);
    if (dDate > acc[dName].latestActivity) {
      acc[dName].latestActivity = dDate;
    }
    return acc;
  }, {});

  const fixedDonorsList = Object.keys(fixedDonorsMap).map(name => ({
    name,
    amount: fixedDonorsMap[name].amount,
    latestActivity: fixedDonorsMap[name].latestActivity
  })).sort((a, b) => b.latestActivity.getTime() - a.latestActivity.getTime());

  // Top 5s
  const recentUmum5 = umumDonations.slice(0, 5); // Already sorted descending by DB
  const recentFixed5 = fixedDonorsList.slice(0, 5);

  // Filters logic for 'All' views
  const getMonthsOptions = (list: any[]) => {
    const s = new Set<string>();
    list.forEach(d => {
      const dt = new Date(d.date || d.latestActivity);
      if (!isNaN(dt.getTime())) s.add(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
    });
    return Array.from(s).sort().reverse();
  };

  const filterByMonth = (list: any[], dateField: string) => {
    if (filterMonth === 'semua') return list;
    return list.filter(d => {
      const dt = new Date(d[dateField]);
      const mStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      return mStr === filterMonth;
    });
  };

  // Formatters
  const formatRp = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n).replace(/\s/g, '').replace(/Rp/i, "Rp.");
  const formatTgl = (t: string) => {
    const d = new Date(t);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  const formatTglShort = (t: string) => {
    const d = new Date(t);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  };


  // -------------- RENDER 'ALL UMUM' -------------- 
  if (view === 'all-umum') {
    const filtered = filterByMonth(umumDonations, 'date');
    const opsiBulan = getMonthsOptions(umumDonations);

    return (
      <div className="card" style={{ marginTop: '40px', maxWidth: '800px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px' }}>
          <button onClick={() => setView('home')} style={{ background: 'transparent', color: 'var(--primary)', border: '2px solid var(--primary)', borderRadius: '30px', padding: '10px 24px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', maxWidth: '300px', width: '100%' }}>
            Kembali ke Halaman Utama
          </button>
        </div>

        <h2 style={{ textAlign: 'left', marginBottom: '5px' }}>Semua Data Donatur</h2>
        <p style={{ textAlign: 'left', color: '#777', fontSize: '14px', marginTop: 0, marginBottom: '25px' }}>Menampilkan seluruh riwayat donasi secara lengkap dan transparan.</p>

        <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '130px', background: '#f4fafc', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#777' }}>Total Donatur</p>
            <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: 'var(--primary)' }}>{new Set(filtered.map(d => d.name)).size} orang</p>
          </div>
          <div style={{ flex: 1, minWidth: '130px', background: '#f4fafc', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#777' }}>Total Terkumpul</p>
            <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: 'var(--primary)' }}>{formatRp(filtered.reduce((s, d) => s + d.amount, 0))}</p>
          </div>
          <div style={{ flex: 1, minWidth: '130px', background: '#f4fafc', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#777' }}>Donasi Terbesar</p>
            <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: 'var(--primary)' }}>{formatRp(filtered.length > 0 ? Math.max(...filtered.map(d => d.amount)) : 0)}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
          <label style={{ fontWeight: 'bold' }}>Filter Bulan:</label>
          <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={{ margin: 0, width: 'auto', padding: '5px 10px' }}>
            <option value="semua">Semua Waktu</option>
            {opsiBulan.map(b => {
              const [y, m] = b.split('-');
              const label = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
              return <option key={b} value={b}>{label}</option>;
            })}
          </select>
        </div>

        <div className="table-section" style={{ minHeight: '200px', marginTop: 0, borderTop: 'none' }}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Nama Donatur</th>
                  <th style={{ textAlign: 'right' }}>Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, i) => (
                  <tr key={d.id || i}>
                    <td style={{ textAlign: 'left' }}>
                      <span className="nama-donatur">{d.name}</span>
                      <span className="tgl-donasi">{formatTgl(d.date)} - Via {d.paymentMethod} {d.notes ? `(${d.notes})` : ''}</span>
                    </td>
                    <td className="nominal">{formatRp(d.amount)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={2} style={{ textAlign: 'center', color: '#999' }}>Tidak ada data donasi.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // -------------- RENDER 'ALL TETAP' -------------- 
  if (view === 'all-tetap') {
    const filtered = filterByMonth(fixedDonorsList, 'latestActivity');
    const opsiBulan = getMonthsOptions(fixedDonorsList.map(f => ({ latestActivity: f.latestActivity })));

    return (
      <div className="card" style={{ marginTop: '40px', maxWidth: '800px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px' }}>
          <button onClick={() => setView('home')} style={{ background: 'transparent', color: 'var(--primary)', border: '2px solid var(--primary)', borderRadius: '30px', padding: '10px 24px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', maxWidth: '300px', width: '100%' }}>
            Kembali ke Halaman Utama
          </button>
        </div>

        <h2 style={{ textAlign: 'left', marginBottom: '5px' }}>Semua Data Donatur Tetap</h2>
        <p style={{ textAlign: 'left', color: '#777', fontSize: '14px', marginTop: 0, marginBottom: '25px' }}>Menampilkan seluruh riwayat donasi secara lengkap dan transparan.</p>

        <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '130px', background: '#f4fafc', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#777' }}>Jumlah Donatur</p>
            <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: 'var(--primary)' }}>{filtered.length} orang</p>
          </div>
          <div style={{ flex: 1, minWidth: '130px', background: '#f4fafc', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#777' }}>Total Terkumpul</p>
            <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: 'var(--primary)' }}>{formatRp(filtered.reduce((s, d) => s + d.amount, 0))}</p>
          </div>
          <div style={{ flex: 1, minWidth: '130px', background: '#f4fafc', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#777' }}>Kontribusi Terbesar</p>
            <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: 'var(--primary)' }}>{formatRp(filtered.length > 0 ? Math.max(...filtered.map(d => d.amount)) : 0)}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
          <label style={{ fontWeight: 'bold' }}>Aktivitas Terakhir di Bulan:</label>
          <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={{ margin: 0, width: 'auto', padding: '5px 10px' }}>
            <option value="semua">Semua Waktu</option>
            {opsiBulan.map(b => {
              const [y, m] = b.split('-');
              const label = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
              return <option key={b} value={b}>{label}</option>;
            })}
          </select>
        </div>

        <div className="table-section" style={{ minHeight: '200px', marginTop: 0, borderTop: 'none' }}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Nama Donatur Tetap</th>
                  <th style={{ textAlign: 'right' }}>Total Semua Kontribusi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, i) => (
                  <tr key={d.name || i}>
                    <td style={{ textAlign: 'left' }}>
                      <span className="nama-donatur">{d.name}</span>
                      <span className="tgl-donasi">Setor Terakhir: {formatTglShort(d.latestActivity.toISOString())}</span>
                    </td>
                    <td className="nominal">{formatRp(d.amount)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={2} style={{ textAlign: 'center', color: '#999' }}>Tidak ada data aktivitas.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // -------------- RENDER 'HOME' -------------- 

  return (
    <div className="card" style={{ marginTop: '40px' }}>
      <div className="header">
        <h1>Pembangunan Halaman Masjid Darul Ihsan</h1>
        <p>InsyaAllah, halaman Masjid Darul Ihsan akan <strong>dipaving</strong> agar bermanfaat untuk <strong>kegiatan sekolah</strong> dan <strong>fasilitas umum</strong> bagi masyarakat. Mari ambil bagian dalam kebaikan ini.</p>
      </div>

      <div className="amount-section">
        <p className="amount-gathered">{formatRp(totalGathered)}</p>
        <p className="amount-target">terkumpul dari target <strong>{formatRp(TARGET)}</strong></p>
        <p className="amount-target">Donatur Tetap: <strong>{fixedDonorsList.length}</strong> orang</p>
      </div>

      <div className="progress-container">
        <div className="progress-bar" style={{ width: `${pct}%` }}></div>
      </div>
      <span className="percentage-text">{pct.toFixed(1)}%</span>

      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'umum' ? 'active' : ''}`} onClick={() => setActiveTab('umum')}>Donasi Terbaru</button>
        <button className={`tab-btn ${activeTab === 'tetap' ? 'active' : ''}`} onClick={() => setActiveTab('tetap')}>Donatur Tetap</button>
      </div>

      {loading ? <p style={{ padding: '40px', color: 'var(--primary)', fontWeight: 'bold' }}>Loading data...</p> : (
        <div className="table-section" style={{ minHeight: '200px', marginBottom: '15px' }}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {activeTab === 'umum' ? (
                    <>
                      <th style={{ textAlign: 'left' }}>Nama Donatur</th>
                      <th style={{ textAlign: 'right' }}>Jumlah</th>
                    </>
                  ) : (
                    <>
                      <th style={{ textAlign: 'left' }}>Nama Donatur Tetap</th>
                      <th style={{ textAlign: 'right' }}>Total Kontribusi</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {activeTab === 'umum' ? recentUmum5.map((d, i) => (
                  <tr key={d.id || i}>
                    <td style={{ textAlign: 'left' }}>
                      <span className="nama-donatur">{d.name}</span>
                      <span className="tgl-donasi">{formatTglShort(d.date)} - {d.paymentMethod}</span>
                    </td>
                    <td className="nominal">{formatRp(d.amount)}</td>
                  </tr>
                )) : recentFixed5.map((d, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: 'left' }}>
                      <span className="nama-donatur">{d.name}</span>
                      <span className="tgl-donasi">Update Terakhir: {formatTglShort(d.latestActivity.toISOString())}</span>
                    </td>
                    <td className="nominal">{formatRp(d.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'center' }}>
        {activeTab === 'umum' ? (
          <button onClick={() => { setFilterMonth('semua'); setView('all-umum'); }} style={{ background: 'transparent', color: 'var(--primary)', border: '2px solid var(--primary)', borderRadius: '30px', padding: '10px 24px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', maxWidth: '300px', width: '100%' }}>Lihat Semua Donatur</button>
        ) : (
          <button onClick={() => { setFilterMonth('semua'); setView('all-tetap'); }} style={{ background: 'transparent', color: 'var(--primary)', border: '2px solid var(--primary)', borderRadius: '30px', padding: '10px 24px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', maxWidth: '350px', width: '100%' }}>Lihat Semua Donatur Tetap</button>
        )}
      </div>

      <div className="info-box" style={{ backgroundColor: '#fbfbfb', border: '1px dashed #ccc' }}>
        <h3 style={{ color: '#333' }}>Salurkan Donasi Melalui:</h3>

        {/* Bank Section */}
        <div style={{ background: 'white', borderRadius: '8px', padding: '15px', marginBottom: '15px', border: '1px solid #eaeaea' }}>
          <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#888', marginBottom: '5px', textTransform: 'uppercase' }}>TRANSFER BANK KALTIMTARA</p>
          <p className="bank-account" style={{ color: 'var(--primary)', fontSize: '24px', margin: '5px 0' }}>1102122395</p>
          <p style={{ fontSize: '13px', color: '#555', margin: '0 0 15px 0' }}>a.n. Yayasan Darul Ihsan</p>
          <button onClick={() => {
            navigator.clipboard.writeText("1102122395");
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }} style={{ background: '#e8f7fd', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: '6px', padding: '8px 15px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', display: 'inline-block' }}>
            {copied ? 'Tersalin!' : 'Salin Rekening'}
          </button>
        </div>

        {/* DANA Section */}
        <div style={{ background: 'white', borderRadius: '8px', padding: '15px', marginBottom: '5px', border: '1px solid #eaeaea' }}>
          <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#888', marginBottom: '5px', textTransform: 'uppercase' }}>DANA / E-WALLET</p>
          <p className="bank-account" style={{ color: 'var(--primary)', fontSize: '24px', margin: '5px 0' }}>085299633636</p>
          <p style={{ fontSize: '13px', color: '#555', margin: '0 0 15px 0' }}>a.n. dai sabilarrosyad</p>
          <button onClick={() => {
            navigator.clipboard.writeText("085299633636");
            setCopiedDana(true);
            setTimeout(() => setCopiedDana(false), 2000);
          }} style={{ background: '#e8f7fd', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: '6px', padding: '8px 15px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', display: 'inline-block' }}>
            {copiedDana ? 'Tersalin!' : 'Salin Nomor'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <a href="https://wa.me/6285299633636?text=Assalamualaikum,%20saya%20ingin%20mengkonfirmasi%20donasi%20yang%20baru%20saja%20saya%20kirimkan." target="_blank" className="btn-wa">
          Konfirmasi Donasi (WhatsApp)
        </a>
        <a href="https://wa.me/6285299633636?text=Assalamualaikum,%20saya%20ingin%20mendaftar%20menjadi%20donatur%20tetap%20untuk%20pembangunan%20lapangan." target="_blank" className="btn-wa">
          Daftar Jadi Donatur Tetap
        </a>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px', textAlign: 'center', fontSize: '13px', color: '#666', lineHeight: '1.6' }}>
        <p style={{ color: 'var(--primary)', fontWeight: 'bold', margin: '0 0 5px 0' }}>Transparansi adalah prioritas kami.</p>
        <p style={{ margin: '0' }}>Laporan ini diperbarui secara berkala oleh bendahara panitia, Terima kasih atas kepercayaan dan dukungan Anda 🙏.</p>
      </div>
    </div>
  );
}
