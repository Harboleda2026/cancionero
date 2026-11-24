#!/usr/bin/env python3
"""Uso: python3 aplicar_mejoras.py ruta/a/App.jsx   (hace copia App.jsx.bak y aplica todos los cambios)"""
import sys, shutil
path = sys.argv[1]
shutil.copy(path, path + '.bak')
src = open(path, encoding='utf-8').read()

def rep(old, new, n=0):
    global src
    c = src.count(old)
    if c == 0:
        sys.exit('NO ENCONTRADO (el archivo difiere):\n' + old[:140])
    src = src.replace(old, new, n or c) if n else src.replace(old, new)

# 1. Firebase fuera del código público
rep(r'''const DEFAULT_CLOUD = 'https://mi-cancionero-6d816-default-rtdb.firebaseio.com/cancionero.json';''',
    "const DEFAULT_CLOUD = ''; // pega tu URL de Firebase en Ajustes de cada dispositivo")
rep('placeholder="https://mi-cancionero-6d816-default-rtdb.firebaseio.com/cancionero.json"',
    'placeholder="https://TU-PROYECTO-default-rtdb.firebaseio.com/RUTA-SECRETA.json"')

# 2. Fecha local y Adviento correcto
rep('function getCurrentLiturgicalSeason(', r'''const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
function getCurrentLiturgicalSeason(''')
rep('new Date().toISOString().slice(0, 10)', 'today()')
rep(r'''  if ((m === 11 && d >= 27) || (m === 12 && d <= 24)) return {''',
    r'''  const adv = new Date(y, 11, 25 - (new Date(y, 11, 25).getDay() || 7) - 21);
  if (new Date(y, m - 1, d) >= adv && (m === 11 || (m === 12 && d <= 24))) return {''')

# 3. Fusión por fecha de edición (updatedAt) + borrados
rep("lastOpened: Number(s.lastOpened) || 0,", "lastOpened: Number(s.lastOpened) || 0,\n    updatedAt: Number(s.updatedAt) || 0,")
rep("songIds: Array.isArray(l && l.songIds) ? l.songIds.map(String) : [],",
    "songIds: Array.isArray(l && l.songIds) ? l.songIds.map(String) : [],\n      updatedAt: Number(l && l.updatedAt) || 0,")
rep("audios: d.audios && typeof d.audios === 'object' ? d.audios : {},",
    "audios: d.audios && typeof d.audios === 'object' ? d.audios : {},\n    deleted: d.deleted && typeof d.deleted === 'object' ? d.deleted : {},")
rep('const SEED = {', r'''const mergeList = (a, b, deleted) => {
  const m = new Map();
  for (const x of [...a, ...b]) { const o = m.get(x.id); if (!o || (x.updatedAt || 0) > (o.updatedAt || 0)) m.set(x.id, x); }
  return [...m.values()].filter((x) => !(deleted[x.id] >= (x.updatedAt || 0)));
};
const mergeData = (L, R) => {
  const deleted = { ...R.deleted };
  for (const [k, v] of Object.entries(L.deleted || {})) deleted[k] = Math.max(v, deleted[k] || 0);
  const songs = mergeList(L.songs, R.songs, deleted);
  const ids = new Set(songs.map((s) => s.id));
  const audios = Object.fromEntries(Object.entries({ ...R.audios, ...L.audios }).filter(([k]) => ids.has(k)));
  return { ...L, songs, setlists: mergeList(L.setlists, R.setlists, deleted), audios, deleted };
};

const SEED = {''', 1)
rep("const patchSong = (id, p) => setD((d) => ({ ...d, songs: d.songs.map((s) => (s.id === id ? { ...s, ...p } : s)) }));",
    "const patchSong = (id, p, touch = true) => setD((d) => ({ ...d, songs: d.songs.map((s) => (s.id === id ? { ...s, ...p, ...(touch ? { updatedAt: Date.now() } : {}) } : s)) }));")
rep("patchSong(id, { lastOpened: Date.now() });", "patchSong(id, { lastOpened: Date.now() }, false);")
rep("const n = normSong({ ...s, title: s.title.trim() });", "const n = normSong({ ...s, title: s.title.trim(), updatedAt: Date.now() });")
rep("      songs: d.songs.filter((s) => s.id !== id),", "      deleted: { ...d.deleted, [id]: Date.now() },\n      songs: d.songs.filter((s) => s.id !== id),")
rep("const saveSetlist = (list) => {", "const saveSetlist = (list0) => {\n    const list = { ...list0, updatedAt: Date.now() };")
rep("(l.id === id ? { ...l, songIds: fn(l.songIds) } : l)", "(l.id === id ? { ...l, songIds: fn(l.songIds), updatedAt: Date.now() } : l)")
rep("setD((d) => ({ ...d, setlists: d.setlists.filter((x) => x.id !== l.id) }))",
    "setD((d) => ({ ...d, deleted: { ...d.deleted, [l.id]: Date.now() }, setlists: d.setlists.filter((x) => x.id !== l.id) }))")

# Subir = traer, fusionar y subir; Descargar = confirmar y fusionar (ya no pisa lo local)
rep(r'''      const r = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...D, exported: new Date().toISOString() }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      setSync('ok'); toast('Subido a Firebase correctamente');''',
r'''      const g = await fetch(endpoint);
      if (!g.ok) throw new Error('HTTP ' + g.status);
      const raw = await g.json();
      const merged = raw ? mergeData(D, normData(raw)) : D;
      const r = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...merged, exported: new Date().toISOString() }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      setD(merged); setSync('ok'); toast('Subido a Firebase correctamente');''')
rep(r'''      setD(d); setSync('ok'); toast(`Descargados ${d.songs.length} cantos de Firebase`);''',
r'''      if (!window.confirm(`La nube tiene ${d.songs.length} cantos. ¿Combinarlos con los de este dispositivo? (gana la edición más reciente)`)) { setSync('local'); return; }
      const m = mergeData(D, d);
      setD(m); setSync('ok'); toast(`Combinados: ${m.songs.length} cantos de Firebase`);''')

# 4. Filtro por tono propio + chips de tiempo y momento en Filtros
rep("useState({ q: '', time: '', moment: '', fav: false, show: false })", "useState({ q: '', key: '', time: '', moment: '', fav: false, show: false })")
rep("(!f.fav || s.favorite) &&", "(!f.fav || s.favorite) && (!f.key || s.originalKey === f.key) &&")
rep(r'''<button key={k} className={'chip' + (norm(f.q) === norm(k) ? ' on' : '')}
              onClick={() => setF({ ...f, q: norm(f.q) === norm(k) ? '' : k })}>Tono {k}</button>''',
    r'''<button key={k} className={'chip' + (f.key === k ? ' on' : '')}
              onClick={() => setF({ ...f, key: f.key === k ? '' : k })}>Tono {k}</button>''')
rep("{(f.time || f.moment || f.fav || f.q) && <button className=\"chip\" onClick={() => setF({ ...f, q: '', time: '', moment: '', fav: false })}>",
    "{(f.time || f.moment || f.fav || f.q || f.key) && <button className=\"chip\" onClick={() => setF({ ...f, q: '', key: '', time: '', moment: '', fav: false })}>")
rep("{T.onlyFavs}</button>", r'''{T.onlyFavs}</button>
          {times.map((t) => <button key={t} className={'chip' + (f.time === t ? ' on' : '')} onClick={() => setF({ ...f, time: f.time === t ? '' : t })}>{t[0] + t.slice(1).toLowerCase()}</button>)}
          {moments.map((t) => <button key={t} className={'chip' + (f.moment === t ? ' on' : '')} onClick={() => setF({ ...f, moment: f.moment === t ? '' : t })}>{t[0] + t.slice(1).toLowerCase()}</button>)}''', 1)

# 5. Pantalla encendida, auto-scroll fluido, service worker, título
rep("  const main = useRef(null);", "  const main = useRef(null);\n  const pos = useRef(0);\n  const bodyRef = useRef(null);")
rep("document.documentElement.dataset.theme = theme;", "document.documentElement.dataset.theme = theme;\n    document.title = 'Mi Cancionero';")
rep(r'''    if (!rd.auto || view !== 'lector') return;
    const i = setInterval(() => { if (main.current) main.current.scrollTop += rd.speed * 0.5; }, 40);
    return () => clearInterval(i);
  }, [rd.auto, rd.speed, view]);''',
r'''    if (!rd.auto || view !== 'lector' || !main.current) return;
    let raf, last = performance.now();
    pos.current = main.current.scrollTop;
    const tick = (t) => {
      const el = main.current;
      if (el) {
        if (Math.abs(el.scrollTop - pos.current) > 2) pos.current = el.scrollTop;
        pos.current += rd.speed * 12 * (t - last) / 1000;
        el.scrollTop = pos.current;
      }
      last = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rd.auto, rd.speed, view]);

  useEffect(() => {
    if (view !== 'lector' || !navigator.wakeLock) return;
    let lock, dead = false;
    const acquire = () => navigator.wakeLock.request('screen').then((l) => { if (dead) l.release(); else lock = l; }).catch(() => {});
    acquire();
    const onVis = () => document.visibilityState === 'visible' && acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => { dead = true; document.removeEventListener('visibilitychange', onVis); if (lock) lock.release(); };
  }, [view]);

  useEffect(() => {
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
  }, []);''')

# 6. Acordes alineados: sin partir líneas + botón "Ajustar ancho"
rep("white-space:pre-wrap;margin:0}", "white-space:pre;overflow-x:auto;margin:0}")
rep("const cardProps = {", r'''const fitFont = () => {
    const el = bodyRef.current;
    if (!el || !song) return;
    const lines = song.body.split('\n').map((l) => (isChordLine(l) ? convLine(l, rd.steps, rd.mode) : l));
    const longest = Math.max(1, ...lines.map((l) => l.trimEnd().length));
    setRd((r) => ({ ...r, fs: Math.max(11, Math.min(40, Math.floor(el.clientWidth / (longest * 0.6)))) }));
  };

  const cardProps = {''', 1)
rep(">A+</button>", ">A+</button>\n          <button className=\"ghost\" onClick={fitFont}>Ajustar ancho</button>", 1)
rep('<pre className="body" data-testid="song-body"', '<pre className="body" ref={bodyRef} data-testid="song-body"')

# 7. iPad en vertical conserva la barra lateral
rep("@media(max-width:820px){", "@media(max-width:1024px){.app{grid-template-columns:220px 1fr}.cont{left:244px}}\n@media(max-width:700px){")

# 8. Tarjeta accesible (sin botón dentro de role=button)
rep(r'''<div className="card" role="button" tabIndex={0} data-testid="song-card" aria-label={`Abrir ${s.title}`}
      onClick={() => onOpen(s.id)} onKeyDown={(e) => e.key === 'Enter' && onOpen(s.id)}>''',
    '<div className="card" data-testid="song-card" onClick={() => onOpen(s.id)}>')
rep("        <b>{s.title}</b>\n", "        <button className=\"card-title\" aria-label={`Abrir ${s.title}`}><b>{s.title}</b></button>\n", 1)
rep(".card:hover{border-color:var(--bd2)}", ".card:hover{border-color:var(--bd2)}\n.card-title{border:0;padding:0;background:none;text-align:left;flex:1}.card-title:active{transform:none}")

# 9. Editor: confirmar si hay cambios sin guardar
rep("const [s, setS] = useState(init);", "const [s, setS] = useState(init);\n  const tryClose = () => (JSON.stringify(s) === JSON.stringify(init) || window.confirm('Tienes cambios sin guardar. ¿Cerrar sin guardar?')) && onClose();", 1)
rep("e.target === e.currentTarget && onClose()}>", "e.target === e.currentTarget && tryClose()}>", 1)
rep('<button className="ghost" onClick={onClose}>✕</button>', '<button className="ghost" onClick={tryClose}>✕</button>', 1)
rep('<button className="ghost" onClick={onClose}>Cancelar</button>', '<button className="ghost" onClick={tryClose}>Cancelar</button>', 1)

# 10. Audio: avisar si solo existe en otro dispositivo
rep("const [url, setUrl] = useState(null);", "const [url, setUrl] = useState(null);\n  const [missing, setMissing] = useState(false);")
rep("    setUrl(null);\n    if (meta) {", "    setUrl(null); setMissing(false);\n    if (meta) {")
rep("          setUrl(u);\n        }\n      }).catch", "          setUrl(u);\n        } else if (live) setMissing(true);\n      }).catch")
rep("      {url && (", "      {meta && missing && <div className=\"meta\">Este audio se subió desde otro dispositivo; el audio se guarda solo donde lo subes. Súbelo de nuevo aquí.</div>}\n      {url && (")

open(path, 'w', encoding='utf-8').write(src)
print('Listo: todos los cambios aplicados. Copia de seguridad en', path + '.bak')
