'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';


type NavMenu = 'overview' | 'input-umum' | 'input-tetap' | 'migrasi' | 'riwayat';
type ShowMode = 'both' | 'income' | 'visitor';
type PeriodMode = 'monthly' | 'weekly' | 'daily' | 'hourly';

const PAYMENT_METHODS = ['Cash', 'Transfer Bank', 'E-Wallet DANA'];
const pad = (n: number) => String(n).padStart(2, '0');

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })
    .format(n).replace(/\s/g, '').replace(/Rp/i, 'Rp.');
}

function formatRpShort(v: number) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}M`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}jt`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}rb`;
  return v.toFixed(0);
}

function formatTgl(t: string) {
  const d = new Date(t);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function getLocalDatetime() {
  const tzoffset = (new Date()).getTimezoneOffset() * 60000;
  return new Date(Date.now() - tzoffset).toISOString().slice(0, 16);
}

function PaymentBadge({ method }: { method: string }) {
  const cls = method === 'Cash' ? 'badge-cash' : method === 'Transfer Bank' ? 'badge-bank' : 'badge-dana';
  return <span className={`badge ${cls}`}>{method}</span>;
}

function calcBalances(gDonations: any[], fDonations: any[], migrations: any[]) {
  let cash = 0, bank = 0, dana = 0;
  [...gDonations, ...fDonations].forEach(d => {
    if (d.paymentMethod === 'Cash') cash += d.amount;
    else if (d.paymentMethod === 'Transfer Bank') bank += d.amount;
    else if (d.paymentMethod === 'E-Wallet DANA') dana += d.amount;
  });
  migrations.forEach(m => {
    const apply = (method: string, sign: number) => {
      if (method === 'Cash') cash += sign * m.amount;
      else if (method === 'Transfer Bank') bank += sign * m.amount;
      else if (method === 'E-Wallet DANA') dana += sign * m.amount;
    };
    apply(m.fromMethod, -1);
    apply(m.toMethod, 1);
  });
  return { cash, bank, dana, total: cash + bank + dana };
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getIncomeKey(d: Date, period: PeriodMode): string {
  switch (period) {
    case 'hourly': return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}`;
    case 'weekly': return `${d.getFullYear()}-W${pad(getWeekNumber(d))}`;
    case 'monthly': return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    default: return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}

// ── CATMULL-ROM SVG PATH ──────────────────────────────────────────────
function catmullRomPath(pts: [number, number][]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

function catmullRomArea(pts: [number, number][], baseY: number): string {
  if (pts.length < 2) return '';
  const linePath = catmullRomPath(pts);
  const last = pts[pts.length - 1];
  const first = pts[0];
  return `${linePath} L ${last[0].toFixed(2)},${baseY.toFixed(2)} L ${first[0].toFixed(2)},${baseY.toFixed(2)} Z`;
}

// ── COMBINED AREA CHART ────────────────────────────────────────────────
function CombinedChart({ gDonations, fDonations }: { gDonations: any[]; fDonations: any[] }) {
  const [show, setShow] = useState<ShowMode>('both');
  const [period, setPeriod] = useState<PeriodMode>('monthly');
  const [visitorRows, setVisitorRows] = useState<{ date: string; count: number; label: string }[]>([]);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/visitor?g=${period}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.data)) setVisitorRows(d.data); })
      .catch(() => {});
  }, [period]);

  const allDonations = useMemo(() => [...gDonations, ...fDonations], [gDonations, fDonations]);

  const incomeByKey = useMemo(() => {
    const map: Record<string, number> = {};
    allDonations.forEach(d => {
      const key = getIncomeKey(new Date(d.date), period);
      map[key] = (map[key] || 0) + d.amount;
    });
    return map;
  }, [allDonations, period]);

  const incomeData = visitorRows.map(r => ({ label: r.label, value: incomeByKey[r.date] || 0 }));
  const visitorData = visitorRows.map(r => ({ label: r.label, value: r.count }));

  const INCOME_COLOR = '#00AEEF';
  const VISITOR_COLOR = '#8b5cf6';

  // SVG dimensions
  const W = 900, H = 340;
  const padL = 16, padR = 16, padT = 20, padB = 48;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const baseY = padT + plotH;
  const n = visitorRows.length;

  const maxIncome = Math.max(...incomeData.map(d => d.value), 1);
  const maxVisitor = Math.max(...visitorData.map(d => d.value), 1);

  const getX = (i: number) => n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW;
  // Each series independently fills the full chart height for visual impact
  const getIncomeY = (v: number) => padT + (1 - v / maxIncome) * plotH;
  const getVisitorY = (v: number) => padT + (1 - v / maxVisitor) * plotH;

  const incomePts: [number, number][] = incomeData.map((d, i) => [getX(i), getIncomeY(d.value)]);
  const visitorPts: [number, number][] = visitorData.map((d, i) => [getX(i), getVisitorY(d.value)]);

  // X-axis step
  const xStep = n > 20 ? 4 : n > 12 ? 2 : 1;

  // Tooltip boundary
  const tooltipX = hoverIdx !== null ? Math.min(Math.max(getX(hoverIdx) - 70, 4), W - 148) : 0;
  const hasIncomeSpike = incomeData.some(d => d.value > 0);
  const hasVisitorData = visitorData.some(d => d.value > 0);

  const tabBtn = (active: boolean, label: string, color: string, onClick: () => void) => (
    <button onClick={onClick}
      style={{ padding: '7px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s', background: active ? 'white' : 'transparent', color: active ? color : '#9ca3af', boxShadow: active ? 'var(--card-shadow)' : 'none' }}>
      {label}
    </button>
  );

  return (
    <div className="admin-panel" style={{ marginBottom: '24px' }}>
      {/* HEADER */}
      <div className="admin-panel-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3>Grafik Analitik</h3>
          <p>Pemasukan donasi &amp; pengunjung website dalam satu tampilan</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* SHOW TOGGLE */}
          <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '10px', padding: '3px', gap: '2px' }}>
            {tabBtn(show === 'both', 'Keduanya', '#374151', () => setShow('both'))}
            {tabBtn(show === 'income', 'Pemasukan', INCOME_COLOR, () => setShow('income'))}
            {tabBtn(show === 'visitor', 'Pengunjung', VISITOR_COLOR, () => setShow('visitor'))}
          </div>
          {/* PERIOD TOGGLE */}
          <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '10px', padding: '3px', gap: '2px' }}>
            {(['hourly', 'daily', 'weekly', 'monthly'] as PeriodMode[]).map(p => (
              tabBtn(period === p, p === 'hourly' ? 'Per Jam' : p === 'daily' ? 'Harian' : p === 'weekly' ? 'Mingguan' : 'Bulanan', 'var(--primary)', () => setPeriod(p))
            ))}
          </div>
        </div>
      </div>

      <div className="admin-panel-body" style={{ padding: '0 0 0 0' }}>
        {/* LEGEND */}
        <div style={{ display: 'flex', gap: '20px', padding: '14px 24px 0', flexWrap: 'wrap' }}>
          {(show === 'both' || show === 'income') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px' }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: INCOME_COLOR, flexShrink: 0 }} />
              <span style={{ fontWeight: 700, color: '#374151' }}>Pemasukan</span>
              {show === 'both' && <span style={{ color: '#9ca3af', fontSize: '11px' }}>(skala independen)</span>}
            </div>
          )}
          {(show === 'both' || show === 'visitor') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px' }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: VISITOR_COLOR, flexShrink: 0 }} />
              <span style={{ fontWeight: 700, color: '#374151' }}>Pengunjung</span>
              {show === 'both' && <span style={{ color: '#9ca3af', fontSize: '11px' }}>(skala independen)</span>}
            </div>
          )}
        </div>

        {/* SVG CHART */}
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: '100%', minWidth: '480px', height: '300px', display: 'block' }}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <defs>
              <linearGradient id="ag-income" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={INCOME_COLOR} stopOpacity="0.45" />
                <stop offset="85%" stopColor={INCOME_COLOR} stopOpacity="0.06" />
                <stop offset="100%" stopColor={INCOME_COLOR} stopOpacity="0" />
              </linearGradient>
              <linearGradient id="ag-visitor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={VISITOR_COLOR} stopOpacity="0.42" />
                <stop offset="85%" stopColor={VISITOR_COLOR} stopOpacity="0.05" />
                <stop offset="100%" stopColor={VISITOR_COLOR} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* SUBTLE GRID LINES */}
            {[0.25, 0.5, 0.75].map(f => (
              <line key={f}
                x1={padL} y1={(padT + (1 - f) * plotH).toFixed(1)}
                x2={padL + plotW} y2={(padT + (1 - f) * plotH).toFixed(1)}
                stroke="#f0f1f3" strokeWidth="1"
              />
            ))}

            {/* HOVER VERTICAL LINE */}
            {hoverIdx !== null && n > 0 && (
              <line
                x1={getX(hoverIdx).toFixed(2)} y1={padT}
                x2={getX(hoverIdx).toFixed(2)} y2={baseY}
                stroke="#d1d5db" strokeWidth="1.5" strokeDasharray="5,4"
              />
            )}

            {/* VISITOR SERIES (render first so income is on top when overlapping) */}
            {(show === 'both' || show === 'visitor') && visitorPts.length >= 2 && (
              <>
                <path d={catmullRomArea(visitorPts, baseY)} fill="url(#ag-visitor)" />
                <path d={catmullRomPath(visitorPts)} fill="none" stroke={VISITOR_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {hoverIdx !== null && (
                  <circle cx={visitorPts[hoverIdx][0].toFixed(2)} cy={visitorPts[hoverIdx][1].toFixed(2)}
                    r="5" fill="white" stroke={VISITOR_COLOR} strokeWidth="2.5" />
                )}
              </>
            )}

            {/* INCOME SERIES */}
            {(show === 'both' || show === 'income') && incomePts.length >= 2 && (
              <>
                <path d={catmullRomArea(incomePts, baseY)} fill="url(#ag-income)" />
                <path d={catmullRomPath(incomePts)} fill="none" stroke={INCOME_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {hoverIdx !== null && (
                  <circle cx={incomePts[hoverIdx][0].toFixed(2)} cy={incomePts[hoverIdx][1].toFixed(2)}
                    r="5" fill="white" stroke={INCOME_COLOR} strokeWidth="2.5" />
                )}
              </>
            )}

            {/* INVISIBLE HOVER CAPTURE STRIP */}
            {visitorRows.map((_, i) => (
              <rect key={i}
                x={(getX(i) - plotW / n / 2).toFixed(2)} y={padT}
                width={Math.max(20, plotW / n).toFixed(2)} height={plotH}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
                style={{ cursor: 'crosshair' }}
              />
            ))}

            {/* X-AXIS BASE LINE */}
            <line x1={padL} y1={baseY} x2={padL + plotW} y2={baseY} stroke="#e5e7eb" strokeWidth="1" />

            {/* X-AXIS LABELS */}
            {visitorRows.map((r, i) => {
              if (i % xStep !== 0 && i !== n - 1) return null;
              return (
                <text key={i} x={getX(i).toFixed(2)} y={baseY + 18} textAnchor="middle"
                  fontSize="11" fill="#9ca3af" fontFamily="Inter,sans-serif">
                  {r.label}
                </text>
              );
            })}

            {/* HOVER TOOLTIP */}
            {hoverIdx !== null && n > 0 && (
              <g>
                <rect x={tooltipX} y={padT + 6}
                  width="144"
                  height={show === 'both' ? 60 : 38}
                  rx="8" fill="white" stroke="#e5e7eb" strokeWidth="1"
                  style={{ filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.1))' }}
                />
                <text x={tooltipX + 10} y={padT + 22} fontSize="11" fill="#6b7280" fontWeight="700" fontFamily="Inter,sans-serif">
                  {visitorRows[hoverIdx]?.label}
                </text>
                {(show === 'both' || show === 'income') && (
                  <text x={tooltipX + 10} y={padT + 38} fontSize="11" fill={INCOME_COLOR} fontWeight="700" fontFamily="Inter,sans-serif">
                    {`Rp ${formatRpShort(incomeData[hoverIdx]?.value || 0)}`}
                  </text>
                )}
                {(show === 'both' || show === 'visitor') && (
                  <text x={tooltipX + 10} y={padT + (show === 'both' ? 54 : 38)} fontSize="11" fill={VISITOR_COLOR} fontWeight="700" fontFamily="Inter,sans-serif">
                    {`${visitorData[hoverIdx]?.value || 0} kunjungan`}
                  </text>
                )}
              </g>
            )}

            {/* EMPTY STATE */}
            {!hasIncomeSpike && !hasVisitorData && (
              <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="13" fill="#c9cdd4" fontFamily="Inter,sans-serif">
                Belum ada data untuk periode ini
              </text>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}

// ── OVERVIEW SECTION ──────────────────────────────────────────────────
function OverviewSection({ gDonations, fDonations, migrations, visitorTotal }: {
  gDonations: any[]; fDonations: any[]; migrations: any[]; visitorTotal: number;
}) {
  const TARGET = 200000000;
  const { cash, bank, dana, total } = calcBalances(gDonations, fDonations, migrations);
  const pct = Math.min(100, (total / TARGET) * 100);

  return (
    <div>
      {/* STAT CARDS */}
      <div className="stats-grid">
        <div className="stat-card cash">
          <div className="label">Saldo Cash</div>
          <div className="value">{formatRp(cash)}</div>
          <div className="sublabel">Uang tunai aktif</div>
        </div>
        <div className="stat-card bank">
          <div className="label">Saldo Bank</div>
          <div className="value">{formatRp(bank)}</div>
          <div className="sublabel">Transfer rekening</div>
        </div>
        <div className="stat-card dana">
          <div className="label">Saldo DANA</div>
          <div className="value">{formatRp(dana)}</div>
          <div className="sublabel">E-Wallet DANA</div>
        </div>
        <div className="stat-card total">
          <div className="label">Total Dana</div>
          <div className="value">{formatRp(total)}</div>
          <div className="sublabel">Dari target {formatRp(TARGET)}</div>
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div className="admin-panel" style={{ marginBottom: '24px' }}>
        <div className="admin-panel-body" style={{ padding: '18px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontWeight: 700, color: '#374151', fontSize: '14px' }}>Progress Target Pembangunan</span>
            <span style={{ fontWeight: 800, color: pct >= 100 ? '#10b981' : 'var(--primary)', fontSize: '20px' }}>{pct.toFixed(1)}%</span>
          </div>
          <div className="prog-bar-bg">
            <div className="prog-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>Terkumpul: {formatRp(total)}</span>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>Target: {formatRp(TARGET)}</span>
          </div>
        </div>
      </div>

      {/* COMBINED CHART */}
      <CombinedChart gDonations={gDonations} fDonations={fDonations} />

      {/* QUICK STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[
          { label: 'Donatur Umum', value: new Set(gDonations.map(d => d.name)).size, sub: `${gDonations.length} transaksi`, color: '#374151' },
          { label: 'Donatur Tetap', value: new Set(fDonations.map(d => d.donor?.name)).size, sub: `${fDonations.length} setoran`, color: '#374151' },
          { label: 'Migrasi Dana', value: migrations.length, sub: 'transaksi migrasi', color: '#374151' },
          { label: 'Total Pengunjung', value: visitorTotal.toLocaleString('id-ID'), sub: 'kunjungan tercatat', color: '#8b5cf6' },
        ].map(s => (
          <div key={s.label} className="admin-panel" style={{ marginBottom: 0 }}>
            <div className="admin-panel-body" style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>{s.label}</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── INPUT UMUM SECTION ────────────────────────────────────────────────
function InputUmumSection({ passcode, onSuccess }: { passcode: string; onSuccess: () => void }) {
  const [form, setForm] = useState({ date: getLocalDatetime(), name: '', amount: '', paymentMethod: 'Cash', notes: '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setMsg(null);
    const res = await fetch('/api/general-donations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode, ...form }),
    });
    setLoading(false);
    if (res.ok) {
      setMsg({ type: 'ok', text: 'Donasi berhasil dicatat.' });
      setForm({ date: getLocalDatetime(), name: '', amount: '', paymentMethod: 'Cash', notes: '' });
      onSuccess();
    } else { setMsg({ type: 'err', text: 'Gagal! Cek passcode atau koneksi.' }); }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-header"><div><h3>Input Donasi Umum</h3><p>Catat donasi satu kali dari masyarakat umum</p></div></div>
      <div className="admin-panel-body">
        {msg && <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', background: msg.type === 'ok' ? '#f0fdf4' : '#fef2f2', color: msg.type === 'ok' ? '#16a34a' : '#dc2626', border: `1px solid ${msg.type === 'ok' ? '#bbf7d0' : '#fecaca'}`, fontWeight: 600, fontSize: '14px' }}>{msg.text}</div>}
        <form onSubmit={handleSubmit} className="admin-form">
          <div className="form-grid">
            <div><label>Tanggal &amp; Waktu</label><input type="datetime-local" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required /></div>
            <div><label>Metode Pembayaran</label>
              <select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })}>
                <option value="Cash">Uang Tunai (Cash)</option>
                <option value="Transfer Bank">Transfer Rekening Bank</option>
                <option value="E-Wallet DANA">E-Wallet DANA</option>
              </select>
            </div>
            <div className="full-width"><label>Nama Lengkap Donatur</label><input type="text" placeholder="Contoh: Bapak Ahmad Fulan" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
            <div><label>Jumlah Donasi (Rp)</label><input type="number" placeholder="500000" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required min="1000" /></div>
            <div><label>Catatan Opsional</label><input type="text" placeholder="misal: Titip beli semen" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <button type="submit" className="btn-submit" disabled={loading} style={{ marginTop: '8px' }}>
            {loading ? 'Menyimpan...' : 'Tambahkan Donasi Umum'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── INPUT TETAP SECTION ───────────────────────────────────────────────
function InputTetapSection({ passcode, fixedDonors, onSuccess, onRefreshDonors }: {
  passcode: string; fixedDonors: any[]; onSuccess: () => void; onRefreshDonors: () => void;
}) {
  const [tab, setTab] = useState<'setoran' | 'registrasi'>('setoran');
  const [formSetoran, setFormSetoran] = useState({ date: getLocalDatetime(), donorId: '', amount: '', paymentMethod: 'Cash', notes: '' });
  const [formBaru, setFormBaru] = useState({ date: new Date().toISOString().split('T')[0], name: '', whatsapp: '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleSetoran = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setMsg(null);
    const res = await fetch('/api/fixed-donations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passcode, ...formSetoran }) });
    setLoading(false);
    if (res.ok) { setMsg({ type: 'ok', text: 'Setoran berhasil dicatat.' }); setFormSetoran({ date: getLocalDatetime(), donorId: '', amount: '', paymentMethod: 'Cash', notes: '' }); onSuccess(); }
    else { setMsg({ type: 'err', text: 'Gagal menyimpan setoran.' }); }
  };

  const handleRegistrasi = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setMsg(null);
    const res = await fetch('/api/fixed-donors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passcode, ...formBaru }) });
    setLoading(false);
    if (res.ok) { setMsg({ type: 'ok', text: 'Donatur baru berhasil didaftarkan.' }); setFormBaru({ date: new Date().toISOString().split('T')[0], name: '', whatsapp: '' }); onRefreshDonors(); }
    else { const j = await res.json().catch(() => ({})); setMsg({ type: 'err', text: j.error || 'Gagal registrasi.' }); }
  };

  const msgEl = msg && (
    <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', background: msg.type === 'ok' ? '#f0fdf4' : '#fef2f2', color: msg.type === 'ok' ? '#16a34a' : '#dc2626', border: `1px solid ${msg.type === 'ok' ? '#bbf7d0' : '#fecaca'}`, fontWeight: 600, fontSize: '14px' }}>{msg.text}</div>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button onClick={() => { setTab('setoran'); setMsg(null); }} className="btn-submit"
          style={{ flex: 1, background: tab === 'setoran' ? 'var(--primary)' : '#f3f4f6', color: tab === 'setoran' ? 'white' : '#6b7280', fontWeight: 600 }}>
          Input Setoran Donatur Tetap
        </button>
        <button onClick={() => { setTab('registrasi'); setMsg(null); }} className="btn-submit"
          style={{ flex: 1, background: tab === 'registrasi' ? '#6366f1' : '#f3f4f6', color: tab === 'registrasi' ? 'white' : '#6b7280', fontWeight: 600 }}>
          Registrasi Donatur Baru
        </button>
      </div>

      {tab === 'setoran' && (
        <div className="admin-panel">
          <div className="admin-panel-header"><div><h3>Input Setoran Komitmen</h3><p>Catat setoran rutin dari donatur tetap yang sudah terdaftar</p></div></div>
          <div className="admin-panel-body">
            {msgEl}
            <form onSubmit={handleSetoran} className="admin-form">
              <div className="form-grid">
                <div><label>Tanggal &amp; Waktu</label><input type="datetime-local" value={formSetoran.date} onChange={e => setFormSetoran({ ...formSetoran, date: e.target.value })} required /></div>
                <div><label>Metode Pembayaran</label>
                  <select value={formSetoran.paymentMethod} onChange={e => setFormSetoran({ ...formSetoran, paymentMethod: e.target.value })}>
                    <option value="Cash">Uang Tunai (Cash)</option>
                    <option value="Transfer Bank">Transfer Rekening Bank</option>
                    <option value="E-Wallet DANA">E-Wallet DANA</option>
                  </select>
                </div>
                <div className="full-width"><label>Pilih Donatur Tetap</label>
                  <select value={formSetoran.donorId} onChange={e => setFormSetoran({ ...formSetoran, donorId: e.target.value })} required>
                    <option value="" disabled>Pilih donatur...</option>
                    {fixedDonors.map(fd => <option key={fd.id} value={fd.id}>{fd.name}</option>)}
                  </select>
                </div>
                <div><label>Jumlah Setoran (Rp)</label><input type="number" placeholder="20000" value={formSetoran.amount} onChange={e => setFormSetoran({ ...formSetoran, amount: e.target.value })} required min="1000" /></div>
                <div><label>Catatan Opsional</label><input type="text" placeholder="misal: Setoran Bulan ke-3" value={formSetoran.notes} onChange={e => setFormSetoran({ ...formSetoran, notes: e.target.value })} /></div>
              </div>
              <button type="submit" className="btn-submit" disabled={loading} style={{ marginTop: '8px' }}>{loading ? 'Menyimpan...' : 'Catat Setoran'}</button>
            </form>
          </div>
        </div>
      )}

      {tab === 'registrasi' && (
        <div className="admin-panel">
          <div className="admin-panel-header"><div><h3>Registrasi Donatur Tetap Baru</h3><p>Daftarkan identitas donatur tetap baru ke sistem</p></div></div>
          <div className="admin-panel-body">
            {msgEl}
            <form onSubmit={handleRegistrasi} className="admin-form">
              <div className="form-grid">
                <div><label>Tanggal Daftar</label><input type="date" value={formBaru.date} onChange={e => setFormBaru({ ...formBaru, date: e.target.value })} required /></div>
                <div><label>Nomor WhatsApp (Opsional)</label><input type="text" placeholder="628123..." value={formBaru.whatsapp} onChange={e => setFormBaru({ ...formBaru, whatsapp: e.target.value })} /></div>
                <div className="full-width"><label>Nama Lengkap</label><input type="text" placeholder="Bapak Ahmad Fulan" value={formBaru.name} onChange={e => setFormBaru({ ...formBaru, name: e.target.value })} required /></div>
              </div>
              <button type="submit" className="btn-submit" disabled={loading} style={{ marginTop: '8px', background: '#6366f1' }}>{loading ? 'Menyimpan...' : 'Daftarkan Donatur Baru'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MIGRASI SECTION ───────────────────────────────────────────────────
function MigrasiSection({ passcode, gDonations, fDonations, migrations, onRefresh }: {
  passcode: string; gDonations: any[]; fDonations: any[]; migrations: any[]; onRefresh: () => void;
}) {
  const { cash, bank, dana } = calcBalances(gDonations, fDonations, migrations);
  const [form, setForm] = useState({ date: getLocalDatetime(), fromMethod: 'Cash', toMethod: 'Transfer Bank', amount: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const saldoOf = (m: string) => m === 'Cash' ? cash : m === 'Transfer Bank' ? bank : dana;
  const methodColor = (m: string) => m === 'Cash' ? '#f59e0b' : m === 'Transfer Bank' ? 'var(--primary)' : '#6366f1';
  const methodBg = (m: string) => m === 'Cash' ? '#fffbeb' : m === 'Transfer Bank' ? 'var(--primary-light)' : '#eef2ff';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.fromMethod === form.toMethod) { setMsg({ type: 'err', text: 'Metode asal dan tujuan tidak boleh sama.' }); return; }
    const amt = Number(form.amount);
    if (amt > saldoOf(form.fromMethod)) { setMsg({ type: 'err', text: `Saldo ${form.fromMethod} tidak cukup (${formatRp(saldoOf(form.fromMethod))}).` }); return; }
    setLoading(true); setMsg(null);
    const res = await fetch('/api/migrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passcode, ...form }) });
    setLoading(false);
    if (res.ok) {
      setMsg({ type: 'ok', text: `Migrasi ${formatRp(Number(form.amount))} dari ${form.fromMethod} ke ${form.toMethod} berhasil.` });
      setForm({ date: getLocalDatetime(), fromMethod: 'Cash', toMethod: 'Transfer Bank', amount: '', notes: '' });
      onRefresh();
    } else { setMsg({ type: 'err', text: 'Gagal menyimpan migrasi.' }); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin hapus riwayat migrasi ini?')) return;
    const res = await fetch('/api/migrations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passcode, id }) });
    if (res.ok) onRefresh(); else alert('Gagal menghapus!');
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginBottom: '24px' }}>
        {[{ m: 'Cash', s: cash }, { m: 'Transfer Bank', s: bank }, { m: 'E-Wallet DANA', s: dana }].map(({ m, s }) => (
          <div key={m} className="admin-panel" style={{ marginBottom: 0, borderTop: `3px solid ${methodColor(m)}` }}>
            <div className="admin-panel-body" style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Saldo {m}</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: methodColor(m) }}>{formatRp(s)}</div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>Setelah migrasi</div>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-panel" style={{ marginBottom: '24px' }}>
        <div className="admin-panel-header"><div><h3>Pindahkan Dana Antar Metode</h3><p>Catat perpindahan saldo dari satu metode ke metode lain</p></div></div>
        <div className="admin-panel-body">
          {msg && <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', background: msg.type === 'ok' ? '#f0fdf4' : '#fef2f2', color: msg.type === 'ok' ? '#16a34a' : '#dc2626', border: `1px solid ${msg.type === 'ok' ? '#bbf7d0' : '#fecaca'}`, fontWeight: 600, fontSize: '14px' }}>{msg.text}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: '#f9fafb', borderRadius: '10px', marginBottom: '24px', border: '1px solid var(--border)' }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: methodBg(form.fromMethod), borderRadius: '8px', border: `2px solid ${methodColor(form.fromMethod)}` }}>
              <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 700, marginBottom: '4px' }}>DARI</div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: methodColor(form.fromMethod) }}>{form.fromMethod}</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Saldo: {formatRp(saldoOf(form.fromMethod))}</div>
            </div>
            <div style={{ fontSize: '20px', color: '#9ca3af' }}>→</div>
            <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: methodBg(form.toMethod), borderRadius: '8px', border: `2px solid ${methodColor(form.toMethod)}` }}>
              <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 700, marginBottom: '4px' }}>KE</div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: methodColor(form.toMethod) }}>{form.toMethod}</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Saldo: {formatRp(saldoOf(form.toMethod))}</div>
            </div>
            {form.amount && Number(form.amount) > 0 && (
              <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '2px solid #bbf7d0' }}>
                <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 700, marginBottom: '4px' }}>JUMLAH</div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#16a34a' }}>{formatRp(Number(form.amount))}</div>
              </div>
            )}
          </div>
          <form onSubmit={handleSubmit} className="admin-form">
            <div className="form-grid">
              <div><label>Dari Metode</label><select value={form.fromMethod} onChange={e => setForm({ ...form, fromMethod: e.target.value })}>{PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
              <div><label>Ke Metode</label><select value={form.toMethod} onChange={e => setForm({ ...form, toMethod: e.target.value })}>{PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
              <div><label>Jumlah (Rp)</label><input type="number" placeholder="1000000" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required min="1000" /></div>
              <div><label>Tanggal Migrasi</label><input type="datetime-local" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required /></div>
              <div className="full-width"><label>Catatan (Opsional)</label><input type="text" placeholder="misal: Setor tunai ke rekening bank Kaltimtara" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <button type="submit" className="btn-submit" disabled={loading} style={{ marginTop: '8px' }}>{loading ? 'Memproses...' : 'Konfirmasi Migrasi Dana'}</button>
          </form>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-header"><h3>Riwayat Migrasi Dana</h3></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead><tr><th>Tanggal</th><th>Dari</th><th>Ke</th><th style={{ textAlign: 'right' }}>Jumlah</th><th>Catatan</th><th style={{ textAlign: 'center' }}>Hapus</th></tr></thead>
            <tbody>
              {migrations.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9ca3af', padding: '32px' }}>Belum ada riwayat migrasi.</td></tr>}
              {migrations.map(m => (
                <tr key={m.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>{formatTgl(m.date)}</td>
                  <td><PaymentBadge method={m.fromMethod} /></td>
                  <td><PaymentBadge method={m.toMethod} /></td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>{formatRp(m.amount)}</td>
                  <td style={{ color: '#6b7280', fontSize: '12px' }}>{m.notes || '-'}</td>
                  <td style={{ textAlign: 'center' }}><button className="btn-danger" onClick={() => handleDelete(m.id)}>Hapus</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── RIWAYAT SECTION ───────────────────────────────────────────────────
function RiwayatSection({ passcode, gDonations, fDonations, onRefresh }: {
  passcode: string; gDonations: any[]; fDonations: any[]; onRefresh: () => void;
}) {
  const [filter, setFilter] = useState<'all' | 'umum' | 'tetap'>('all');
  const [filterMethod, setFilterMethod] = useState('semua');
  const [filterMonth, setFilterMonth] = useState('semua');
  const [search, setSearch] = useState('');

  const allTxs = useMemo(() => [
    ...gDonations.map(d => ({ ...d, cat: 'Umum' as const })),
    ...fDonations.map(d => ({ ...d, name: d.donor?.name || '-', cat: 'Tetap' as const })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [gDonations, fDonations]);

  const months = useMemo(() => Array.from(new Set(allTxs.map(d => {
    const dt = new Date(d.date);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  }))).sort().reverse(), [allTxs]);

  const filtered = useMemo(() => allTxs.filter(d => {
    if (filter !== 'all' && d.cat.toLowerCase() !== filter) return false;
    if (filterMethod !== 'semua' && d.paymentMethod !== filterMethod) return false;
    if (filterMonth !== 'semua') {
      const dt = new Date(d.date);
      const mStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      if (mStr !== filterMonth) return false;
    }
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [allTxs, filter, filterMethod, filterMonth, search]);

  const handleDelete = async (id: string, cat: 'Umum' | 'Tetap') => {
    if (!confirm('Yakin ingin hapus data donasi ini?')) return;
    const ep = cat === 'Umum' ? '/api/general-donations' : '/api/fixed-donations';
    const res = await fetch(ep, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passcode, id }) });
    if (res.ok) onRefresh(); else alert('Gagal menghapus!');
  };

  const filterBtn = (active: boolean) => ({
    padding: '7px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '12px',
    fontWeight: 600, background: active ? 'var(--primary)' : '#f3f4f6',
    color: active ? 'white' : '#6b7280', transition: '0.15s',
  });

  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <div><h3>Riwayat Seluruh Transaksi</h3><p>{filtered.length} dari {allTxs.length} transaksi</p></div>
      </div>
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="text" placeholder="Cari nama donatur..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: '1', minWidth: '180px', margin: 0, padding: '8px 12px', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '13px' }} />
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['all', 'umum', 'tetap'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={filterBtn(filter === f)}>
              {f === 'all' ? 'Semua' : f === 'umum' ? 'Umum' : 'Tetap'}
            </button>
          ))}
        </div>
        <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)} style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '13px', margin: 0, width: 'auto' }}>
          <option value="semua">Semua Metode</option>
          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '13px', margin: 0, width: 'auto' }}>
          <option value="semua">Semua Bulan</option>
          {months.map(b => {
            const [y, m] = b.split('-');
            return <option key={b} value={b}>{new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</option>;
          })}
        </select>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="admin-table">
          <thead><tr><th>Nama Donatur</th><th>Kategori</th><th>Metode</th><th>Tanggal</th><th style={{ textAlign: 'right' }}>Jumlah</th><th>Catatan</th><th style={{ textAlign: 'center' }}>Aksi</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#9ca3af', padding: '32px' }}>Tidak ada data yang ditemukan.</td></tr>}
            {filtered.map(d => (
              <tr key={d.id}>
                <td style={{ fontWeight: 600, color: '#1f2937' }}>{d.name}</td>
                <td><span className={`badge ${d.cat === 'Umum' ? 'badge-umum' : 'badge-tetap'}`}>{d.cat}</span></td>
                <td><PaymentBadge method={d.paymentMethod} /></td>
                <td style={{ fontSize: '12px', whiteSpace: 'nowrap', color: '#6b7280' }}>{formatTgl(d.date)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>{formatRp(d.amount)}</td>
                <td style={{ fontSize: '12px', color: '#6b7280' }}>{d.notes || '-'}</td>
                <td style={{ textAlign: 'center' }}><button className="btn-danger" onClick={() => handleDelete(d.id, d.cat)}>Hapus</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── MAIN ADMIN PAGE ───────────────────────────────────────────────────
export default function AdminPage() {
  const [inputPass, setInputPass] = useState('');
  const [passcode, setPasscode] = useState('');
  const [isAuth, setIsAuth] = useState(false);
  const [menu, setMenu] = useState<NavMenu>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);

  const [gDonations, setGDonations] = useState<any[]>([]);
  const [fDonations, setFDonations] = useState<any[]>([]);
  const [fixedDonors, setFixedDonors] = useState<any[]>([]);
  const [migrations, setMigrations] = useState<any[]>([]);
  const [visitorTotal, setVisitorTotal] = useState(0);

  const fetchAll = useCallback(() => {
    fetch('/api/general-donations').then(r => r.json()).then(d => setGDonations(Array.isArray(d) ? d : []));
    fetch('/api/fixed-donations').then(r => r.json()).then(d => setFDonations(Array.isArray(d) ? d : []));
    fetch('/api/fixed-donors').then(r => r.json()).then(d => setFixedDonors(Array.isArray(d) ? d : []));
    fetch('/api/migrations').then(r => r.json()).then(d => setMigrations(Array.isArray(d) ? d : []));
    fetch('/api/visitor?g=daily').then(r => r.json()).then(d => { if (typeof d.total === 'number') setVisitorTotal(d.total); });
  }, []);

  useEffect(() => { if (isAuth) fetchAll(); }, [isAuth, fetchAll]);

  const handleLogin = () => {
    if (inputPass.trim() === '124159') { setPasscode(inputPass); setIsAuth(true); }
    else { alert('Passcode salah!'); }
  };


  if (!isAuth) {
    return (
      <div className="admin-login">
        <div className="login-box">
          <div className="login-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00AEEF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <h2>Admin Darul Ihsan</h2>
          <p>Masukkan passcode untuk mengakses dashboard pengelolaan donasi</p>
          <input
            type="password" 
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Masukkan passcode"
            value={inputPass} onChange={e => setInputPass(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
          <button onClick={handleLogin}>Masuk ke Dashboard</button>
        </div>
      </div>
    );
  }

  const navItems: { id: NavMenu; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'input-umum', label: 'Input Donasi Umum' },
    { id: 'input-tetap', label: 'Input Donatur Tetap' },
    { id: 'migrasi', label: 'Migrasi Dana' },
    { id: 'riwayat', label: 'Riwayat & Hapus' },
  ];

  const pageTitle: Record<NavMenu, string> = {
    'overview': 'Overview Dashboard',
    'input-umum': 'Input Donasi Umum',
    'input-tetap': 'Input Donatur Tetap',
    'migrasi': 'Migrasi Dana',
    'riwayat': 'Riwayat Transaksi',
  };

  // Nav icon SVGs (no emoji)
  const navIcons: Record<NavMenu, React.ReactElement> = {
    'overview': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    'input-umum': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
    'input-tetap': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    'migrasi': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
    'riwayat': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  };

  const NavItems = ({ onItemClick }: { onItemClick?: () => void }) => (
    <>
      {navItems.map(item => (
        <button key={item.id} className={`sidebar-item ${menu === item.id ? 'active' : ''}`}
          onClick={() => { setMenu(item.id); onItemClick?.(); }}>
          <span className="icon">{navIcons[item.id]}</span>
          {item.label}
        </button>
      ))}
    </>
  );

  return (
    <div className="admin-root" style={{ padding: 0 }}>
      {/* SIDEBAR — desktop only */}
      <aside className="admin-sidebar">
        <div className="sidebar-logo">
          <h2>Darul Ihsan</h2>
          <p>Panel Admin Donasi</p>
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Menu Utama</div>
          <NavItems />
          <div className="sidebar-section-label" style={{ marginTop: '16px' }}>Navigasi</div>
          <a href="/" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
            <div className="sidebar-item">
              <span className="icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              </span>
              Halaman Publik
            </div>
          </a>
        </nav>
        <div className="sidebar-footer">
          <button className="sidebar-logout" onClick={() => { setIsAuth(false); setInputPass(''); setPasscode(''); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Keluar
          </button>
        </div>
      </aside>

      {/* MOBILE DRAWER */}
      {mobileOpen && (
        <div className="mobile-nav-wrapper">
          <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />
          <nav className="mobile-drawer">
            <div className="mobile-drawer-header">
              <span style={{ color: 'white', fontWeight: 800, fontSize: '15px' }}>Darul Ihsan</span>
              <button className="mobile-drawer-close" onClick={() => setMobileOpen(false)}>✕</button>
            </div>
            <div className="mobile-drawer-nav">
              <div className="sidebar-section-label">Menu Utama</div>
              <NavItems onItemClick={() => setMobileOpen(false)} />
              <div className="sidebar-section-label" style={{ marginTop: '12px' }}>Navigasi</div>
              <a href="/" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                <div className="sidebar-item" onClick={() => setMobileOpen(false)}>Halaman Publik</div>
              </a>
            </div>
            <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
              <button className="sidebar-logout" onClick={() => { setIsAuth(false); setInputPass(''); setPasscode(''); setMobileOpen(false); }}>
                Keluar
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* MAIN */}
      <main className="admin-main">
        {/* TOP BAR */}
        <div className="admin-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Hamburger — mobile only */}
            <button className="mobile-hamburger" onClick={() => setMobileOpen(true)} aria-label="Buka menu">
              <span /><span /><span />
            </button>
            <h1>{pageTitle[menu]}</h1>
          </div>
        </div>

        {/* CONTENT */}
        <div className="admin-content">
          {menu === 'overview' && <OverviewSection gDonations={gDonations} fDonations={fDonations} migrations={migrations} visitorTotal={visitorTotal} />}
          {menu === 'input-umum' && <InputUmumSection passcode={passcode} onSuccess={fetchAll} />}
          {menu === 'input-tetap' && <InputTetapSection passcode={passcode} fixedDonors={fixedDonors} onSuccess={fetchAll} onRefreshDonors={fetchAll} />}
          {menu === 'migrasi' && <MigrasiSection passcode={passcode} gDonations={gDonations} fDonations={fDonations} migrations={migrations} onRefresh={fetchAll} />}
          {menu === 'riwayat' && <RiwayatSection passcode={passcode} gDonations={gDonations} fDonations={fDonations} onRefresh={fetchAll} />}
        </div>
      </main>
    </div>
  );
}


