// Demo ad seeder — run once: node seed-demo-ads.js
// Creates sample ads in all placements so you can see how they look on the site.
const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port: 4000, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d))); });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function run() {
  // 1. Login
  const { token } = await post('/admin/login', { username: 'admin', password: 'changeme123' });
  if (!token) { console.error('Login failed'); process.exit(1); }

  function api(body) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const req = http.request({
        hostname: 'localhost', port: 4000, path: '/admin/ads', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'Content-Length': Buffer.byteLength(payload) },
      }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d))); });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  const demos = [
    {
      title: '🟥 Header Banner — 728×90',
      type: 'banner', placement: 'header',
      html: `<div style="width:100%;max-width:728px;height:90px;margin:0 auto;background:linear-gradient(135deg,#1a1a2e,#16213e);border:2px dashed rgba(168,85,247,.5);border-radius:10px;display:flex;align-items:center;justify-content:center;gap:16px;font-family:Inter,sans-serif">
        <span style="font-size:1.4rem">🎯</span>
        <div>
          <div style="color:#a78bfa;font-weight:700;font-size:.95rem">Header Leaderboard — 728 × 90</div>
          <div style="color:#64748b;font-size:.78rem;margin-top:2px">Replace this with your real ad code in AdPanel → Manage Ads</div>
        </div>
        <span style="background:rgba(168,85,247,.2);color:#a78bfa;padding:4px 10px;border-radius:6px;font-size:.75rem;font-weight:600">AD</span>
      </div>`,
      active: true, priority: 9,
    },
    {
      title: '🟦 In-Content Banner — 300×250',
      type: 'banner', placement: 'in-content',
      html: `<div style="width:300px;height:250px;margin:0 auto;background:linear-gradient(135deg,#0d1117,#161b22);border:2px dashed rgba(37,99,235,.5);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;font-family:Inter,sans-serif">
        <span style="font-size:2rem">📢</span>
        <div style="text-align:center;padding:0 16px">
          <div style="color:#93c5fd;font-weight:700;font-size:1rem">In-Content Ad</div>
          <div style="color:#475569;font-size:.78rem;margin-top:4px">Medium Rectangle<br>300 × 250 px</div>
        </div>
        <span style="background:rgba(37,99,235,.2);color:#93c5fd;padding:4px 12px;border-radius:6px;font-size:.75rem;font-weight:600">DEMO AD</span>
      </div>`,
      active: true, priority: 8,
    },
    {
      title: '🟩 Footer Banner — 728×90',
      type: 'banner', placement: 'footer',
      html: `<div style="width:100%;max-width:728px;height:90px;margin:0 auto;background:linear-gradient(135deg,#064e35,#022619);border:2px dashed rgba(16,185,129,.5);border-radius:10px;display:flex;align-items:center;justify-content:center;gap:16px;font-family:Inter,sans-serif">
        <span style="font-size:1.4rem">⬇️</span>
        <div>
          <div style="color:#6ee7b7;font-weight:700;font-size:.95rem">Footer Leaderboard — 728 × 90</div>
          <div style="color:#064e35;filter:brightness(3);font-size:.78rem;margin-top:2px">Replace this with your real ad code in AdPanel</div>
        </div>
        <span style="background:rgba(16,185,129,.2);color:#6ee7b7;padding:4px 10px;border-radius:6px;font-size:.75rem;font-weight:600">AD</span>
      </div>`,
      active: true, priority: 7,
    },
    {
      title: '🟨 Sidebar Left — 300×600',
      type: 'sidebar', placement: 'sidebar-left',
      html: `<div style="width:300px;height:600px;background:linear-gradient(180deg,#2d1b69,#1a103d);border:2px dashed rgba(168,85,247,.4);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;font-family:Inter,sans-serif">
        <span style="font-size:2.5rem">◀️</span>
        <div style="text-align:center;padding:0 20px">
          <div style="color:#a78bfa;font-weight:700;font-size:1rem">Left Sidebar</div>
          <div style="color:#6d28d9;filter:brightness(2);font-size:.8rem;margin-top:6px">Half Page Ad<br>300 × 600 px</div>
        </div>
        <span style="background:rgba(168,85,247,.2);color:#a78bfa;padding:5px 14px;border-radius:6px;font-size:.78rem;font-weight:600">DEMO AD</span>
      </div>`,
      active: true, priority: 6,
    },
  ];

  console.log('\n Creating demo ads...\n');
  for (const ad of demos) {
    const result = await api(ad);
    console.log(` ✓ ${ad.title}  (id: ${result.id})`);
  }

  console.log('\n All demo ads created!');
  console.log(' → Open http://localhost:3000 to see them on the site');
  console.log(' → Open http://localhost:4000/dashboard to manage them\n');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
