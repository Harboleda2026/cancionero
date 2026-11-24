import { useState, useEffect, useLayoutEffect, useRef } from 'react';

/* ============ Constantes, Liturgia e i18n ============ */
const KEY = 'cancionero_cloud_v1';
const DEFAULT_CLOUD = ''; // pega tu URL de Firebase en Ajustes de cada dispositivo

const LAT_SH = ['DO','DO#','RE','RE#','MI','FA','FA#','SOL','SOL#','LA','LA#','SI'];
const LAT_FL = ['DO','REb','RE','MIb','MI','FA','SOLb','SOL','LAb','LA','SIb','SI'];
const AM_SH = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const AM_FL = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const BASE = { DO:0, RE:2, MI:4, FA:5, SOL:7, LA:9, SI:11, C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
const ROOT = /^(DO|Do|RE|Re|MI|Mi|FA|Fa|SOL|Sol|LA|La|SI|Si|[A-G])([#b])?/;
const REST = /^(?:m|im|maj|M|min|dim|aug|sus|add|\d|[#b+\-º°()])*$/;
const TIEMPOS = ['ORDINARIO','ADVIENTO','NAVIDAD','CUARESMA','PASCUA'];
const MOMENTOS = ['ENTRADA','PIEDAD','GLORIA','ALELUYA','OFRENDAS','SANTO','PAZ','CORDERO','COMUNIÓN','ADORACIÓN','SALIDA'];

const THEMES = [
  ['nocturno','Atril Nocturno','Carbón cálido y terracota'],
  ['escenario','Modo Escenario','Slate con acordes ámbar'],
  ['misal','Misal Editorial','Pergamino con acordes rojos'],
  ['estudio','Modo Estudio','Perla con acentos índigo'],
];

const I18N = {
  es: {
    brand: 'Mi Cancionero', sub: 'Atril Litúrgico Digital', home: 'Catálogo', sets: 'Repertorios',
    settings: 'Ajustes y Nube', catalogTitle: 'Catálogo Litúrgico', recent: 'Recientes', favs: 'Favoritas',
    allSongs: 'Catálogo de cantos', searchPlaceholder: 'Buscar por título, letra, tiempo, tono o autor...',
    filters: 'Filtros', onlyFavs: 'Solo favoritas', clear: 'Limpiar', liturgicalTimes: 'TIEMPOS LITÚRGICOS',
    massMoments: 'MOMENTOS DE LA MISA', continueWhere: 'CONTINUAR DONDE QUEDASTE', open: 'Abrir',
    playSetlist: 'Iniciar Misa', newSetlist: 'Nuevo repertorio', guide: 'Guía rápida',
    seasonBanner: 'Tiempo litúrgico actual sugerido:', filterSeason: 'Ver cantos del tiempo',
  },
  en: {
    brand: 'My Songbook', sub: 'Digital Liturgical Stand', home: 'Catalog', sets: 'Setlists',
    settings: 'Settings & Cloud', catalogTitle: 'Liturgical Catalog', recent: 'Recent', favs: 'Favorites',
    allSongs: 'Song Catalog', searchPlaceholder: 'Search by title, lyrics, season, key or artist...',
    filters: 'Filters', onlyFavs: 'Favorites only', clear: 'Clear', liturgicalTimes: 'LITURGICAL SEASONS',
    massMoments: 'MASS PARTS', continueWhere: 'CONTINUE WHERE YOU LEFT OFF', open: 'Open',
    playSetlist: 'Start Mass', newSetlist: 'New Setlist', guide: 'Quick Guide',
    seasonBanner: 'Current suggested season:', filterSeason: 'Filter season songs',
  }
};

const SYNC_TXT = { local:'Local: guardado', busy:'Sincronizando…', ok:'Nube: Sincronizada', err:'Error de sincronización' };
const BADGE_TXT = { local:'Guardado local', busy:'Sincronizando…', ok:'Sincronizado', err:'Error de nube' };

const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
function getCurrentLiturgicalSeason(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  if ((m === 12 && d >= 25) || (m === 1 && d <= 12)) return { key: 'NAVIDAD', color: '#FBBF24', label: 'Tiempo de Navidad' };
  const adv = new Date(y, 11, 25 - (new Date(y, 11, 25).getDay() || 7) - 21);
  if (new Date(y, m - 1, d) >= adv && (m === 11 || (m === 12 && d <= 24))) return { key: 'ADVIENTO', color: '#A855F7', label: 'Tiempo de Adviento' };
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d1 = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d1 - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m1 = Math.floor((a + 11 * h + 22 * l) / 451);
  const easterMonth = Math.floor((h + l - 7 * m1 + 114) / 31);
  const easterDay = ((h + l - 7 * m1 + 114) % 31) + 1;
  const easter = new Date(y, easterMonth - 1, easterDay);
  const diffDays = Math.round((date - easter) / (1000 * 60 * 60 * 24));
  if (diffDays >= -46 && diffDays < 0) return { key: 'CUARESMA', color: '#9333EA', label: 'Tiempo de Cuaresma' };
  if (diffDays >= 0 && diffDays <= 49) return { key: 'PASCUA', color: '#F59E0B', label: 'Tiempo de Pascua' };
  return { key: 'ORDINARIO', color: '#10B981', label: 'Tiempo Ordinario' };
}

/* ============ Motor de Acordes ============ */
const parsePart = (t) => {
  const m = ROOT.exec(t);
  if (!m) return null;
  const rest = t.slice(m[0].length);
  return REST.test(rest) ? { root: m[1], acc: m[2] || '', rest } : null;
};

const parseChord = (t) => {
  const [a, b, ...x] = t.split('/');
  if (x.length) return null;
  const p = parsePart(a);
  if (!p) return null;
  let bass = null;
  if (b !== undefined) {
    bass = parsePart(b);
    if (!bass || (bass.rest && !/^\d$/.test(bass.rest))) return null;
  }
  return { p, bass };
};

const isChordLine = (line) => {
  if (!line.trim()) return false;
  const tk = line.trim().split(/\s+/);
  if (tk.length === 1 && /^(Do|Re|Mi|Fa|Sol|La|Si)$/.test(tk[0])) return false;
  return tk.every((t) => parseChord(t));
};

const fmtRoot = (p, steps, mode) => {
  const b = BASE[p.root.toUpperCase()];
  const idx = (b + (p.acc === '#' ? 1 : p.acc === 'b' ? -1 : 0) + steps + 120) % 12;
  const flat = p.acc === 'b';
  const latin = mode === 'lat' || (mode === 'orig' && p.root.length > 1);
  if (!latin) return (flat ? AM_FL : AM_SH)[idx];
  const n = (flat ? LAT_FL : LAT_SH)[idx];
  const upper = p.root.length > 1 && p.root === p.root.toUpperCase();
  return upper ? n : n[0] + n.slice(1).replace(/^[A-Z]+/, (s) => s.toLowerCase());
};

const fmtChord = (t, steps, mode) => {
  const c = parseChord(t);
  if (!c) return t;
  let rest = c.p.rest;
  const latinOut = mode === 'lat' || (mode === 'orig' && c.p.root.length > 1);
  if (!latinOut && rest.startsWith('im') && !/^i?m?(dim)/.test(rest)) rest = 'm' + rest.slice(2);
  let out = fmtRoot(c.p, steps, mode) + rest;
  if (c.bass) out += '/' + fmtRoot(c.bass, steps, mode) + c.bass.rest;
  return out;
};

const convLine = (line, steps, mode) => {
  let drift = 0, out = '', m;
  const re = /(\S+)(\s*)/g;
  while ((m = re.exec(line))) {
    const n = fmtChord(m[1], steps, mode);
    drift += n.length - m[1].length;
    let gap = m[2];
    if (gap.length && drift) {
      const g = Math.max(1, gap.length - drift);
      drift -= gap.length - g;
      gap = ' '.repeat(g);
    }
    out += n + gap;
  }
  return line.match(/^\s*/)[0] + out;
};

/* ============ Limpieza de Texto y Auto-Relleno ============ */
function cleanAndExtractSongText(rawText) {
  const lines = String(rawText || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  for (let line of lines) {
    if (/\[([A-Za-z#b0-9/]+)\]/.test(line)) {
      let chordLine = '';
      let lyricLine = '';
      let lastIdx = 0;
      const re = /\[([^\]]+)\]/g;
      let match;
      while ((match = re.exec(line)) !== null) {
        lyricLine += line.slice(lastIdx, match.index);
        while (chordLine.length < lyricLine.length) chordLine += ' ';
        chordLine += match[1] + ' ';
        lastIdx = re.lastIndex;
      }
      lyricLine += line.slice(lastIdx);
      if (chordLine.trim()) out.push(chordLine.trimEnd());
      out.push(lyricLine.trimEnd());
    } else {
      out.push(line.replace(/\t/g, '    ').trimEnd());
    }
  }
  return out.join('\n');
}

function autoFillMissingChords(bodyText) {
  const blocks = String(bodyText || '').trim().split(/\n\s*\n/);
  if (blocks.length < 2) return bodyText;
  let patternChords = [];
  for (const b of blocks) {
    const lines = b.split('\n');
    const cLines = lines.filter((l) => isChordLine(l));
    if (cLines.length > 0) {
      patternChords = cLines;
      break;
    }
  }
  if (!patternChords.length) return bodyText;

  const filledBlocks = blocks.map((b) => {
    const lines = b.split('\n');
    const hasChords = lines.some((l) => isChordLine(l));
    if (hasChords) return b;
    const result = [];
    let cIdx = 0;
    for (const l of lines) {
      if (l.trim() && cIdx < patternChords.length) {
        result.push(patternChords[cIdx % patternChords.length]);
        cIdx++;
      }
      result.push(l);
    }
    return result.join('\n');
  });
  return filledBlocks.join('\n\n');
}

/* ============ Lector PDF con alineación por coordenadas ============ */
let pdfjsLibInstance = null;
async function getPdfJs() {
  if (pdfjsLibInstance) return pdfjsLibInstance;
  if (window.pdfjsLib) {
    pdfjsLibInstance = window.pdfjsLib;
    return pdfjsLibInstance;
  }
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      pdfjsLibInstance = window.pdfjsLib;
      res();
    };
    s.onerror = rej;
    document.head.appendChild(s);
  });
  return pdfjsLibInstance;
}

const rowText = (r) => r.items.map((i) => i.s).join(' ').replace(/\s+/g, ' ').trim();
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const rowChars = (r, cw) => {
  const xs = []; let text = '', end = null;
  for (const it of r.items) {
    if (end !== null && it.x - end > cw * 0.4 && !text.endsWith(' ') && !it.s.startsWith(' ')) { text += ' '; xs.push(end); }
    for (let k = 0; k < it.s.length; k++) { text += it.s[k]; xs.push(it.x + it.w * (k / it.s.length)); }
    end = it.x + it.w;
  }
  return { text, xs };
};

async function pdfToSong(file) {
  const pdfjs = await getPdfJs();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const tc = await (await pdf.getPage(p)).getTextContent();
    const rows = [];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const y = it.transform[5];
      let row = rows.find((r) => Math.abs(r.y - y) <= 2.5);
      if (!row) rows.push((row = { y, items: [] }));
      row.items.push({ x: it.transform[4], w: it.width, s: it.str });
    }
    rows.forEach((r) => r.items.sort((a, b) => a.x - b.x));
    pages.push(rows.sort((a, b) => b.y - a.y));
  }
  const all = pages.flat();
  if (!all.length) throw new Error('sin-texto');
  const cw = median(all.flatMap((r) => r.items).filter((i) => i.s.length > 2).map((i) => i.w / i.s.length)) || 5;
  const lines = [];
  pages.forEach((rows, pi) => {
    const mg = median(rows.slice(1).map((r, i) => rows[i].y - r.y)) || 12;
    const xmin = Math.min(...rows.map((r) => r.items[0].x));
    for (let i = 0; i < rows.length; i++) {
      if (i && rows[i - 1].y - rows[i].y > mg * 1.7) lines.push('');
      const r = rows[i];
      if (!isChordLine(rowText(r))) { lines.push(rowChars(r, cw).text.trimEnd()); continue; }
      const next = rows[i + 1];
      const lyric = next && !isChordLine(rowText(next)) ? rowChars(next, cw) : null;
      let line = '';
      for (const it of r.items) {
        for (const m of it.s.matchAll(/\S+/g)) {
          const x = it.x + it.w * (m.index / it.s.length);
          let col = lyric && lyric.xs.length
            ? lyric.xs.reduce((b, cx, k) => (Math.abs(cx - x) < Math.abs(lyric.xs[b] - x) ? k : b), 0)
            : Math.round((x - xmin) / cw);
          col = Math.max(col, line.length ? line.length + 1 : 0);
          line = line.padEnd(col) + m[0];
        }
      }
      lines.push(line);
    }
    if (pi < pages.length - 1) lines.push('');
  });
  const body = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const ls = body.split('\n');
  const ti = ls.findIndex((l) => l.trim() && !isChordLine(l));
  const hasTitle = ti >= 0 && ti < 4;
  const rest = hasTitle ? ls.filter((_, i) => i !== ti).join('\n').trim() : body;
  const first = rest.split('\n').find(isChordLine)?.trim().split(/\s+/)[0];
  const c = first && parseChord(first);
  return {
    title: hasTitle ? ls[ti].trim() : file.name.replace(/\.pdf$/i, ''),
    body: rest,
    originalKey: c ? fmtRoot(c.p, 0, 'lat').toUpperCase() + (/^(m(?!aj)|im)/.test(c.p.rest) ? 'm' : '') : '',
  };
}

/* ============ Audio por Canto (IndexedDB local) ============ */
const idb = () => new Promise((res, rej) => {
  const r = indexedDB.open('cancionero_audio', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('audios');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const idbRun = async (mode, fn) => {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction('audios', mode);
    const req = fn(tx.objectStore('audios'));
    tx.oncomplete = () => res(req && req.result);
    tx.onerror = () => rej(tx.error);
  });
};
const audioPut = (id, blob) => idbRun('readwrite', (st) => st.put(blob, id));
const audioGet = (id) => idbRun('readonly', (st) => st.get(id));
const audioDel = (id) => idbRun('readwrite', (st) => st.delete(id));

const normalizeCloudUrl = (url) => {
  const clean = String(url || '').trim();
  if (!clean) return '';
  if (clean.endsWith('.json')) return clean;
  return clean.replace(/\/+$/, '') + '/cancionero.json';
};

/* ============ Datos iniciales y Catálogo ============ */
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const normSong = (s) => {
  s = s && typeof s === 'object' ? s : {};
  return {
    id: String(s.id ?? Date.now() + Math.random().toString(36).slice(2, 6)),
    title: String(s.title || 'Sin título'),
    category: String(s.category || ''),
    liturgicalTime: String(s.liturgicalTime || 'ORDINARIO').toUpperCase(),
    subcategory: String(s.subcategory || s.category || 'COMUNIÓN').toUpperCase(),
    originalKey: String(s.originalKey || ''),
    artist: String(s.artist || ''),
    bpm: String(s.bpm ?? ''),
    notes: String(s.notes || ''),
    favorite: (s.favorite ?? false) === true,
    lastOpened: Number(s.lastOpened) || 0,
    updatedAt: Number(s.updatedAt) || 0,
    body: String(s.body || ''),
  };
};

const normData = (d) => {
  d = d && typeof d === 'object' ? d : {};
  return {
    app: 'cancionero',
    version: 1,
    songs: (Array.isArray(d.songs) ? d.songs : []).map(normSong),
    setlists: (Array.isArray(d.setlists) ? d.setlists : []).map((l) => ({
      id: String((l && l.id) || Date.now()),
      name: String((l && l.name) || 'Repertorio'),
      date: String((l && l.date) || ''),
      notes: String((l && l.notes) || ''),
      songIds: Array.isArray(l && l.songIds) ? l.songIds.map(String) : [],
      updatedAt: Number(l && l.updatedAt) || 0,
    })),
    audios: d.audios && typeof d.audios === 'object' ? d.audios : {},
    deleted: d.deleted && typeof d.deleted === 'object' ? d.deleted : {},
  };
};

const mergeList = (a, b, deleted) => {
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

const SEED = {
  songs: [
    {
      id: '1791515587314', title: 'IN PERSONA CHRISTI', category: 'Iglesia', liturgicalTime: 'ORDINARIO',
      subcategory: 'COMUNIÓN', originalKey: 'DO', artist: 'JESED', bpm: '63', favorite: true,
      lastOpened: Date.now(),
      body: `DO                 SOL/SI              LAm          LAm/SOL
Ya no soy yo quien vive, tú eres quien vive en mí
FA                  DO/MI             REm              SOL
mi vida la he perdido, pues todo lo vivo en ti.
LAm                MI/SOL#            DO/SOL           RE/FA#
Tú pronuncias con mis labios las palabras de tu boca
FA                 DO/MI              REm              SOL
y levantas en mis manos el misterio de tu cuerpo.

FA                 SOL                DO        SOL/SI    LAm
Tu espíritu mora en mí y mi espíritu mora en ti.

DO        SOL/SI      LAm     LAm/SOL   FA        DO/MI     REm       SOL
In persona Christi, In persona Christi, este es mi cuerpo, esta es mi sangre.
DO        SOL/SI      LAm     LAm/SOL   FA           SOL         DO
In persona Christi, In persona Christi, tomen y coman, tomen y beban.
FA                 SOL                MI7              LAm
Que este sacrificio sea agradable a Dios Padre,
FA                 SOL                DO
por la salvación del mundo entero.`,
    },
    {
      id: '1791515587315', title: 'Yo sé que estás aquí', category: 'Iglesia', liturgicalTime: 'ORDINARIO',
      subcategory: 'ADORACIÓN', originalKey: 'REm', artist: 'Renovación', bpm: '68', favorite: true,
      lastOpened: Date.now() - 10000,
      body: `REm                      SOLm
Yo sé que estás aquí, mi Señor,
DO                       FA       LA7
yo sé que estás aquí. (2)

REm                      SOLm
Y mi alma te alaba, y mi alma te alaba,
DO                       FA       LA7
y mi alma te alaba, porque sé que estás aquí. (2)`,
    },
    {
      id: '1791515587316', title: 'La Mano de Dios', category: 'Iglesia', liturgicalTime: 'ORDINARIO',
      subcategory: 'ADORACIÓN', originalKey: 'SOL', artist: 'Jon Carlo', bpm: '70', favorite: true,
      lastOpened: Date.now() - 20000,
      body: `SOL                     RE/FA#
Hay una mano que conmigo está
MIm                     RE
cuando no tengo fuerzas,
DO                      SOL/SI
y sin pensarlo me ha de levantar
LAm7                    RE
cuando llegan las pruebas.

SOL                     RE/FA#
Hay una mano que ayudó a Moisés
MIm                     RE
y el mar lo dividió en dos,
DO                      SOL/SI
y es la misma que hoy me acompaña,
LAm7        RE          SOL
es la mano de Dios.`,
    },
    {
      id: '1791515587317', title: 'CAMINANDO DESDE ORIENTE', category: 'Iglesia', liturgicalTime: 'NAVIDAD',
      subcategory: 'ENTRADA', originalKey: 'SOL', artist: 'Tradicional', bpm: '96', favorite: false,
      lastOpened: Date.now() - 30000,
      body: `SOL                               RE
Caminando desde Oriente se acercan ya los Reyes,
DO                  RE            SOL
caminando desde Oriente hacia Belén. (2)

SOL                               DO
Con incienso, oro y mirra quieren hoy adorar
RE                                SOL
al Niño que ha nacido en el portal.`,
    },
    {
      id: '1791515587318', title: 'ESTE ES EL MOMENTO', category: 'Iglesia', liturgicalTime: 'ORDINARIO',
      subcategory: 'OFRENDAS', originalKey: 'FA', artist: 'Liturgia', bpm: '74', favorite: false,
      lastOpened: Date.now() - 40000,
      body: `FA                      REm
Este es el momento de alegrar la mesa
SIb                     DO
con el vino y con el pan,
SOLm                    DO7
que consagraremos y que ofreceremos
FA                      DO7
y que hemos de comulgar.`,
    },
    {
      id: '1791515587319', title: 'JUNTOS NOS ACERCAMOS', category: 'Iglesia', liturgicalTime: 'ORDINARIO',
      subcategory: 'OFRENDAS', originalKey: 'DO', artist: 'Tradicional', bpm: '76', favorite: false,
      lastOpened: Date.now() - 50000,
      body: `DO                  SOL             LAm
Juntos nos acercamos a esta mesa para ofrecer
FA                  REm             SOL
todo lo que tenemos que es para Ti.
DO                  SOL             LAm
Es nuestra vida, nuestra esperanza, nuestro dolor y amor,
FA                  SOL             DO
deja que nuestras manos lleguen a Ti.`,
    },
    {
      id: '1791515587320', title: 'Te Entrego', category: 'Iglesia', liturgicalTime: 'ORDINARIO',
      subcategory: 'ADORACIÓN', originalKey: 'SOL', artist: 'Joan Sánchez', bpm: '66', favorite: true,
      lastOpened: Date.now() - 60000,
      body: `SOL                 DO
Haz lo que quieras conmigo,
SOL                 RE
haz lo que quieras de mí,
MIm                 DO
hoy yo te ofrezco mi vida,
LAm7                RE
hoy yo me rindo ante Ti.

SOL                 RE/FA#
Te entrego todo lo que soy, todo lo que tengo,
MIm                 RE
todo lo que quiero y todo lo que sueño
DO                  LAm7            RE
a Ti Señor Jesús.
SOL                 RE/FA#
Te entrego, mi vida y mi corazón
MIm                 DO              RE          SOL
para amarte a Ti, mi Señor.`,
    },
    {
      id: '1791515587321', title: 'Venimos a Adorar', category: 'Iglesia', liturgicalTime: 'ORDINARIO',
      subcategory: 'ADORACIÓN', originalKey: 'RE', artist: 'Ministerio', bpm: '70', favorite: false,
      lastOpened: Date.now() - 70000,
      body: `RE                  LA/DO#          SIm
El Rey del universo y Señor de la creación
SOL                 MIm             LA
se viene a hacer presente en medio de nosotros.

RE                  LA/DO#          SIm     SIm/LA
Venimos a adorar, venimos a cantar
SOL                 MIm             LA          RE
al Señor que está en el altar.`,
    },
  ],
  setlists: [
    {
      id: 'set-domingo',
      name: 'Misa Dominical',
      date: today(),
      notes: 'Celebración Eucarística Dominical',
      songIds: ['1791515587317', '1791515587318', '1791515587314', '1791515587320'],
    }
  ]
};

const load = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem('cancionero_v1') || 'null');
    if (raw && raw.data && Array.isArray(raw.data.songs) && raw.data.songs.length > 0) {
      return {
        data: normData(raw.data),
        theme: raw.theme || 'nocturno',
        cloud: String(raw.cloud || DEFAULT_CLOUD),
        lang: raw.lang || 'es',
      };
    }
  } catch { /* storage vacío */ }
  return { data: normData(SEED), theme: 'nocturno', cloud: DEFAULT_CLOUD, lang: 'es' };
};

/* ============ Iconos ============ */
const PATHS = {
  home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4',
  plus: 'M12 5v14M5 12h14',
  star: 'M12 2l3 6.9 7.4.7-5.6 5 1.7 7.3L12 18l-6.5 3.9 1.7-7.3-5.6-5 7.4-.7z',
  play: 'M6 4l14 8-14 8z',
  pause: 'M7 4v16M17 4v16',
  back: 'M15 18l-6-6 6-6',
  next: 'M9 18l6-6-6-6',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  expand: 'M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3',
  wand: 'M15 4V2m0 14v-2M8 9h2m10 0h2m-4.2-3.8L19 4m-1.2 9.8L19 15M3 21l9-9m.2-6.8L11 4',
  globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 0c2.5 2.5 4 6 4 10s-1.5 7.5-4 10c-2.5-2.5-4-6-4-10s1.5-7.5 4-10zM2 12h20',
  music: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm12 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  filePdf: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 15v-4h2a1.5 1.5 0 0 1 0 3H9',
};
const Icon = ({ n, size = 18, fill = 'none' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={PATHS[n]} />
  </svg>
);

/* ============ Componentes ============ */
function Card({ s, onOpen, onFav }) {
  return (
    <div className="card" data-testid="song-card" onClick={() => onOpen(s.id)}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <button className="card-title" aria-label={`Abrir ${s.title}`}><b>{s.title}</b></button>
        <button className="ghost" data-testid="fav-btn" aria-label="Favorita" onClick={(e) => onFav(e, s)}
          style={{ border: 0, padding: 2, color: s.favorite ? 'var(--accent-primary)' : 'var(--mut)' }}>
          <Icon n="star" fill={s.favorite ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="meta">{s.artist || 'Sin autor'}</div>
      {[s.liturgicalTime, s.subcategory, s.originalKey && 'Tono ' + s.originalKey, s.bpm && s.bpm + ' BPM']
        .filter(Boolean).map((t) => <span className="tag" key={t}>{t}</span>)}
    </div>
  );
}

function Section({ id, title, list, empty, ...cardProps }) {
  return (
    <section data-testid={id}>
      <h2>{title}</h2>
      {list.length
        ? <div className="grid">{list.map((s) => <Card key={s.id} s={s} {...cardProps} />)}</div>
        : <div className="empty">{empty}</div>}
    </section>
  );
}

/* Reproductor de Audio para el Atril */
function AudioPanel({ song, meta, onMeta, toast }) {
  const [url, setUrl] = useState(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let u = null, live = true;
    setUrl(null); setMissing(false);
    if (meta) {
      audioGet(song.id).then((b) => {
        if (b && live) {
          u = URL.createObjectURL(b);
          setUrl(u);
        } else if (live) setMissing(true);
      }).catch(() => {});
    }
    return () => { live = false; if (u) URL.revokeObjectURL(u); };
  }, [song.id, meta]);

  const pick = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      await audioPut(song.id, file);
      onMeta({ name: file.name, size: file.size, type: file.type });
      toast('Audio del canto guardado');
    } catch {
      toast('No se pudo guardar el audio en el navegador');
    }
  };

  const remove = async () => {
    try { await audioDel(song.id); } catch { /* noop */ }
    onMeta(null);
    toast('Audio eliminado');
  };

  return (
    <div className="audio-box">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 8 }}>
          <Icon n="music" size={18} />
          <label className="ghost row" style={{ border: '1px solid var(--bd2)', borderRadius: 'var(--ri)', padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
            {meta ? 'Reemplazar audio' : 'Subir audio del canto'}
            <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={pick} />
          </label>
          {meta && <span className="meta" style={{ margin: 0, fontSize: 12 }}>{meta.name}</span>}
        </div>
        {meta && <button className="ghost" style={{ fontSize: 12, color: '#EF4444' }} onClick={remove}>Quitar audio</button>}
      </div>
      {meta && missing && <div className="meta">Este audio se subió desde otro dispositivo; el audio se guarda solo donde lo subes. Súbelo de nuevo aquí.</div>}
      {url && (
        <audio controls src={url} style={{ width: '100%', marginTop: 10, height: 36 }} />
      )}
    </div>
  );
}

/* Cajón Deslizante con Lector PDF y Asistente de Acordes */
function SongEditorDrawer({ init, edit, onSave, onClose, onDelete, onToast }) {
  const [s, setS] = useState(init);
  const tryClose = () => (JSON.stringify(s) === JSON.stringify(init) || window.confirm('Tienes cambios sin guardar. ¿Cerrar sin guardar?')) && onClose();
  const [loadingPdf, setLoadingPdf] = useState(false);
  const set = (k) => (e) => setS((x) => ({ ...x, [k]: e.target.value }));
  const field = (k, label, placeholder = '') => (
    <div><label>{label}</label><input data-testid={`field-${k}`} aria-label={label} placeholder={placeholder} value={s[k]} onChange={set(k)} /></div>
  );

  const handleCleanText = () => {
    setS((x) => ({ ...x, body: cleanAndExtractSongText(x.body) }));
    onToast('Formato de acordes alineado');
  };

  const handleAutoFillChords = () => {
    setS((x) => ({ ...x, body: autoFillMissingChords(x.body) }));
    onToast('Acordes replicados en el resto de estrofas');
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setLoadingPdf(true);
    onToast('Procesando PDF con acordes...');
    try {
      const parsed = await pdfToSong(file);
      setS((prev) => ({
        ...prev,
        title: prev.title === 'Sin título' || !prev.title ? parsed.title : prev.title,
        body: parsed.body,
        originalKey: parsed.originalKey || prev.originalKey,
      }));
      onToast('Canto importado del PDF con éxito');
    } catch (err) {
      onToast(err.message === 'sin-texto' ? 'El PDF no contiene texto seleccionable' : 'Error al procesar el PDF');
    } finally {
      setLoadingPdf(false);
    }
  };

  return (
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && tryClose()}>
      <div className="drawer" role="dialog" aria-label="Editor de Canto">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{edit ? 'Editar canto' : 'Nuevo canto'}</h2>
          <button className="ghost" onClick={tryClose}>✕</button>
        </div>

        {/* Botón para importar PDF directamente dentro del editor */}
        <div className="pdf-bar">
          <label className="primary row" style={{ cursor: 'pointer', padding: '7px 12px', fontSize: 13, gap: 6 }}>
            <Icon n="filePdf" size={16} />{loadingPdf ? 'Leyendo PDF...' : 'Cargar desde archivo PDF'}
            <input type="file" accept="application/pdf" style={{ display: 'none' }} disabled={loadingPdf} onChange={handlePdfUpload} />
          </label>
          <span className="meta" style={{ margin: 0, fontSize: 12 }}>Importa acordes alineados automáticamente</span>
        </div>

        {field('title', 'Título del canto', 'Ej. Pescador de Hombres')}
        <div className="two">
          {field('artist', 'Autor / Ministerio', 'Ej. Cesáreo Gabaráin')}
          {field('originalKey', 'Tono original', 'Ej. DO, REm, SOL')}
          {field('bpm', 'BPM (Tempo)', 'Ej. 72')}
          <div>
            <label>Tiempo litúrgico</label>
            <select data-testid="field-liturgicalTime" value={s.liturgicalTime} onChange={set('liturgicalTime')}>
              <option value="">—</option>
              {[...new Set([...TIEMPOS, s.liturgicalTime])].filter(Boolean).map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <label>Momento de la misa</label>
        <select data-testid="field-subcategory" value={s.subcategory} onChange={set('subcategory')}>
          <option value="">—</option>
          {[...new Set([...MOMENTOS, s.subcategory])].filter(Boolean).map((t) => <option key={t}>{t}</option>)}
        </select>

        <div className="row" style={{ justifyContent: 'space-between', marginTop: 14, marginBottom: 4 }}>
          <label style={{ margin: 0 }}>Letra y acordes</label>
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="ghost" style={{ padding: '4px 9px', fontSize: 12 }} onClick={handleCleanText} title="Limpia texto de PDF o convierte acordes entre [corchetes]">
              Limpiar PDF / [Acordes]
            </button>
            <button type="button" className="ghost row" style={{ padding: '4px 9px', fontSize: 12, gap: 4 }} onClick={handleAutoFillChords} title="Copia los acordes de la 1ª estrofa al resto">
              <Icon n="wand" size={14} />Auto-rellenar acordes
            </button>
          </div>
        </div>
        <textarea data-testid="field-body" aria-label="Letra y acordes" placeholder="Los acordes deben ir en su propia línea sobre la letra..." value={s.body} onChange={set('body')} />
        <label>Notas de interpretación / Cejilla</label>
        <input data-testid="field-notes" aria-label="Notas" placeholder="Ej. Cejilla en 2º traste" value={s.notes} onChange={set('notes')} />

        <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
          {edit && <button className="ghost" style={{ marginRight: 'auto', color: '#EF4444' }} onClick={() => onDelete(s.id)}>Eliminar</button>}
          <button className="ghost" onClick={tryClose}>Cancelar</button>
          <button className="primary" data-testid="save-song" onClick={() => onSave(s)}>Guardar canto</button>
        </div>
      </div>
    </div>
  );
}

/* Cajón de Creación/Edición de Repertorios */
function SetlistEditorDrawer({ init, songs, onSave, onClose }) {
  const [list, setList] = useState(init);
  const [search, setSearch] = useState('');

  const toggleSong = (sid) => {
    setList((prev) => ({
      ...prev,
      songIds: prev.songIds.includes(sid)
        ? prev.songIds.filter((id) => id !== sid)
        : [...prev.songIds, sid]
    }));
  };

  const filtered = songs.filter((s) => !search || norm(s.title).includes(norm(search)) || norm(s.subcategory).includes(norm(search)));

  return (
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer" role="dialog" aria-label="Editor de Repertorio">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{init.name ? 'Editar Repertorio' : 'Nuevo Repertorio'}</h2>
          <button className="ghost" onClick={onClose}>✕</button>
        </div>
        <label>Nombre de la celebración</label>
        <input value={list.name} placeholder="Ej. Misa Domingo 10:00 AM" onChange={(e) => setList({ ...list, name: e.target.value })} />
        <div className="two">
          <div>
            <label>Fecha</label>
            <input type="date" value={list.date || ''} onChange={(e) => setList({ ...list, date: e.target.value })} />
          </div>
          <div>
            <label>Notas</label>
            <input value={list.notes || ''} placeholder="Ej. Coro Parroquial" onChange={(e) => setList({ ...list, notes: e.target.value })} />
          </div>
        </div>
        <label style={{ marginTop: 14 }}>Seleccionar cantos ({list.songIds.length} elegidos)</label>
        <input type="search" placeholder="Buscar por título o momento..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 8 }} />
        <div style={{ maxHeight: 280, overflowY: 'auto', display: 'grid', gap: 6, paddingRight: 4 }}>
          {filtered.map((s) => {
            const active = list.songIds.includes(s.id);
            return (
              <div key={s.id} className="card" style={{ padding: '10px 12px', borderColor: active ? 'var(--accent-primary)' : undefined, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => toggleSong(s.id)}>
                <div>
                  <b style={{ fontSize: 15 }}>{s.title}</b>
                  <span className="meta">{s.subcategory} · Tono {s.originalKey || '—'}</span>
                </div>
                <span className="badge" style={{ opacity: active ? 1 : 0.25 }}>{active ? '✓ Incluido' : '+ Añadir'}</span>
              </div>
            );
          })}
        </div>
        <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
          <button className="ghost" onClick={onClose}>Cancelar</button>
          <button className="primary" onClick={() => list.name.trim() && onSave(list)}>Guardar repertorio</button>
        </div>
      </div>
    </div>
  );
}

/* ============ Aplicación Principal ============ */
export default function App() {
  const boot = useRef(null);
  if (!boot.current) boot.current = load();
  const [D, setD] = useState(boot.current.data);
  const [theme, setTheme] = useState(boot.current.theme);
  const [cloud, setCloud] = useState(boot.current.cloud);
  const [lang, setLang] = useState(boot.current.lang || 'es');
  const [view, setView] = useState('inicio');
  const [openId, setOpenId] = useState(null);
  const [activeSetlistId, setActiveSetlistId] = useState(null);
  const [f, setF] = useState({ q: '', key: '', time: '', moment: '', fav: false, show: false });
  const [modal, setModal] = useState(null);
  const [setlistModal, setSetlistModal] = useState(null);
  const [rd, setRd] = useState({ steps: 0, mode: 'orig', fs: 17, auto: false, speed: 2, stage: false });
  const [sync, setSync] = useState('local');
  const [toasts, setToasts] = useState([]);
  const [backup, setBackup] = useState('');
  const main = useRef(null);
  const pos = useRef(0);
  const bodyRef = useRef(null);

  const T = I18N[lang] || I18N.es;
  const currentSeason = getCurrentLiturgicalSeason();

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.title = 'Mi Cancionero';
    try { localStorage.setItem(KEY, JSON.stringify({ data: D, theme, cloud, lang })); } catch { /* sin storage */ }
  }, [D, theme, cloud, lang]);

  useEffect(() => {
    if (!rd.auto || view !== 'lector' || !main.current) return;
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
  }, []);

  const toast = (t) => {
    const id = Math.random();
    setToasts((x) => [...x, { id, t }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 2600);
  };
  const patchSong = (id, p, touch = true) => setD((d) => ({ ...d, songs: d.songs.map((s) => (s.id === id ? { ...s, ...p, ...(touch ? { updatedAt: Date.now() } : {}) } : s)) }));
  const go = (v) => { setView(v); setOpenId(null); setActiveSetlistId(null); setRd((r) => ({ ...r, auto: false, stage: false })); };

  const openSong = (id, setlistId = null) => {
    patchSong(id, { lastOpened: Date.now() }, false);
    setOpenId(id);
    setActiveSetlistId(setlistId);
    setView('lector');
    setRd((r) => ({ ...r, steps: 0, mode: 'orig', auto: false }));
    if (main.current) main.current.scrollTop = 0;
  };

  const toggleFav = (e, s) => { e.stopPropagation(); patchSong(s.id, { favorite: !s.favorite }); };
  const saveSong = (s) => {
    const n = normSong({ ...s, title: s.title.trim(), updatedAt: Date.now() });
    setD((d) => ({ ...d, songs: d.songs.some((x) => x.id === n.id) ? d.songs.map((x) => (x.id === n.id ? n : x)) : [n, ...d.songs] }));
    setModal(null); toast('Canto guardado');
  };
  const delSong = (id) => {
    if (!window.confirm('¿Eliminar este canto?')) return;
    audioDel(id).catch(() => {});
    setD((d) => ({
      ...d,
      deleted: { ...d.deleted, [id]: Date.now() },
      songs: d.songs.filter((s) => s.id !== id),
      audios: Object.fromEntries(Object.entries(d.audios || {}).filter(([k]) => k !== id)),
      setlists: d.setlists.map((l) => ({ ...l, songIds: l.songIds.filter((x) => x !== id) }))
    }));
    setModal(null); go('inicio'); toast('Canto eliminado');
  };

  const saveSetlist = (list0) => {
    const list = { ...list0, updatedAt: Date.now() };
    setD((d) => ({
      ...d,
      setlists: d.setlists.some((x) => x.id === list.id)
        ? d.setlists.map((x) => (x.id === list.id ? list : x))
        : [...d.setlists, list]
    }));
    setSetlistModal(null);
    toast('Repertorio guardado');
  };

  const patchList = (id, fn) => setD((d) => ({ ...d, setlists: d.setlists.map((l) => (l.id === id ? { ...l, songIds: fn(l.songIds), updatedAt: Date.now() } : l)) }));
  const moveInList = (lid, sid, dir) => patchList(lid, (ids) => {
    const i = ids.indexOf(sid), j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return ids;
    const c = [...ids]; [c[i], c[j]] = [c[j], c[i]]; return c;
  });

  /* Sincronización con Firebase Realtime Database */
  const pushToCloud = async () => {
    const endpoint = normalizeCloudUrl(cloud);
    if (!endpoint) return toast('Escribe primero la URL de Firebase');
    setCloud(endpoint);
    setSync('busy');
    try {
      const g = await fetch(endpoint);
      if (!g.ok) throw new Error('HTTP ' + g.status);
      const raw = await g.json();
      const merged = raw ? mergeData(D, normData(raw)) : D;
      const r = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...merged, exported: new Date().toISOString() }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      setD(merged); setSync('ok'); toast('Subido a Firebase correctamente');
    } catch (e) { setSync('err'); toast('No se pudo subir: ' + (e.message || 'error de red')); }
  };

  const pullFromCloud = async () => {
    const endpoint = normalizeCloudUrl(cloud);
    if (!endpoint) return toast('Escribe primero la URL de Firebase');
    setCloud(endpoint);
    setSync('busy');
    try {
      const r = await fetch(endpoint);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = normData(await r.json());
      if (!d.songs.length && !d.setlists.length) throw new Error('la nube está vacía');
      if (!window.confirm(`La nube tiene ${d.songs.length} cantos. ¿Combinarlos con los de este dispositivo? (gana la edición más reciente)`)) { setSync('local'); return; }
      const m = mergeData(D, d);
      setD(m); setSync('ok'); toast(`Combinados: ${m.songs.length} cantos de Firebase`);
    } catch (e) { setSync('err'); toast('No se pudo descargar: ' + (e.message || 'error de red')); }
  };

  const doImport = (txt) => {
    try {
      const d = normData(JSON.parse(txt));
      if (!d.songs.length && !d.setlists.length) throw new Error('vacío');
      setD(d); toast(`Importados ${d.songs.length} cantos`);
    } catch { toast('El respaldo no es válido'); }
  };

  const doExport = () => {
    const j = JSON.stringify({ ...D, exported: new Date().toISOString() }, null, 2);
    setBackup(j);
    try {
      const u = URL.createObjectURL(new Blob([j], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = u; a.download = 'cancionero-respaldo.json';
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 1000);
    } catch { /* noop */ }
    navigator.clipboard?.writeText(j).then(() => toast('Respaldo copiado'), () => toast('Respaldo generado'));
  };

  /* ---- Derivados ---- */
  const q = norm(f.q);
  const all = D.songs.filter((s) =>
    (!f.time || s.liturgicalTime === f.time) && (!f.moment || s.subcategory === f.moment) && (!f.fav || s.favorite) && (!f.key || s.originalKey === f.key) &&
    (!q || [s.title, s.body, s.subcategory, s.liturgicalTime, s.originalKey, s.artist].some((x) => norm(x).includes(q))));
  const recent = all.filter((s) => s.lastOpened).sort((a, b) => b.lastOpened - a.lastOpened).slice(0, 6);
  const favs = all.filter((s) => s.favorite);
  const last = [...D.songs].filter((s) => s.lastOpened).sort((a, b) => b.lastOpened - a.lastOpened)[0];
  const times = [...new Set([...TIEMPOS, ...D.songs.map((s) => s.liturgicalTime)])].filter(Boolean);
  const moments = [...new Set([...MOMENTOS, ...D.songs.map((s) => s.subcategory)])].filter(Boolean);
  const keys = [...new Set(D.songs.map((s) => s.originalKey).filter(Boolean))];
  const song = D.songs.find((s) => s.id === openId);
  const activeSetlist = D.setlists.find((l) => l.id === activeSetlistId);
  const setlistSongs = activeSetlist ? activeSetlist.songIds.map((id) => D.songs.find((s) => s.id === id)).filter(Boolean) : [];
  const currentSetIdx = setlistSongs.findIndex((s) => s.id === openId);

  const fitFont = () => {
    const el = bodyRef.current;
    if (!el || !song) return;
    const lines = song.body.split('\n').map((l) => (isChordLine(l) ? convLine(l, rd.steps, rd.mode) : l));
    const longest = Math.max(1, ...lines.map((l) => l.trimEnd().length));
    setRd((r) => ({ ...r, fs: Math.max(11, Math.min(40, Math.floor(el.clientWidth / (longest * 0.6)))) }));
  };

  const cardProps = { onOpen: (id) => openSong(id, null), onFav: toggleFav };

  const currentKeyLabel = song && song.originalKey
    ? (rd.steps !== 0 || rd.mode !== 'orig'
        ? `Tono ${song.originalKey} → ${fmtChord(song.originalKey, rd.steps, rd.mode)}`
        : `Tono ${song.originalKey}`)
    : '';

  const filBtn = (field, v) => (
    <button key={v} className={'fil' + (f[field] === v ? ' on' : '')}
      onClick={() => { setF({ ...f, [field]: f[field] === v ? '' : v }); setView('inicio'); setOpenId(null); }}>
      <span>{v[0] + v.slice(1).toLowerCase()}</span>
      <span>{D.songs.filter((s) => s[field === 'time' ? 'liturgicalTime' : 'subcategory'] === v).length}</span>
    </button>
  );

  const nav = (v, icon, label) => (
    <button className={'nav' + ((view === v || (v === 'inicio' && view === 'lector')) ? ' on' : '')} onClick={() => go(v)}>
      <Icon n={icon} /><span>{label}</span>
    </button>
  );

  /* ---- Vistas ---- */
  const inicio = (
    <>
      <div className="head">
        <h1>{T.catalogTitle}</h1>
        <span className="badge" data-testid="sync-badge">{BADGE_TXT[sync]}</span>
        <span style={{ flex: 1 }} />
        <label className="ghost row" style={{ border: '1px solid var(--bd2)', borderRadius: 'var(--ri)', padding: '7px 12px', cursor: 'pointer', fontSize: 13, gap: 6 }}>
          <Icon n="filePdf" size={16} />Importar PDF
          <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={async (e) => {
            const file = e.target.files[0];
            e.target.value = '';
            if (!file) return;
            toast('Leyendo PDF…');
            try {
              const parsed = await pdfToSong(file);
              setModal({ edit: false, song: normSong({ id: String(Date.now()), ...parsed }) });
            } catch (err) {
              toast(err.message === 'sin-texto' ? 'El PDF no tiene texto seleccionable' : 'No se pudo leer el PDF');
            }
          }} />
        </label>
        <button className="ghost row" onClick={() => setLang(lang === 'es' ? 'en' : 'es')} title="Idioma">
          <Icon n="globe" size={16} />{lang.toUpperCase()}
        </button>
        <button className="ghost" onClick={pullFromCloud}>Descargar de Firebase</button>
        <button className="ghost" onClick={() => window.alert('1. Toca + para crear un canto o pulsa "Importar PDF".\n2. En el atril puedes subir el audio MP3 del canto para ensayar.\n3. En Repertorios pulsa "Iniciar Misa" para pasar de canto en vivo.')}>{T.guide}</button>
      </div>

      <div className="season-banner">
        <span className="season-dot" style={{ background: currentSeason.color }} />
        <div style={{ flex: 1 }}>
          <small style={{ color: 'var(--mut)', display: 'block', fontSize: 11 }}>{T.seasonBanner}</small>
          <b>{currentSeason.label}</b>
        </div>
        <button className={'chip' + (f.time === currentSeason.key ? ' on' : '')}
          onClick={() => setF({ ...f, time: f.time === currentSeason.key ? '' : currentSeason.key })}>
          {f.time === currentSeason.key ? 'Mostrando ' + currentSeason.key : T.filterSeason}
        </button>
      </div>

      <div className="search">
        <input type="search" data-testid="search-input" aria-label="Buscar" placeholder={T.searchPlaceholder}
          value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <button className="ghost row" onClick={() => setF({ ...f, show: !f.show })}><Icon n="filter" size={16} />{T.filters}</button>
      </div>
      {f.show && (
        <div className="chips">
          <button className={'chip' + (f.fav ? ' on' : '')} onClick={() => setF({ ...f, fav: !f.fav })}>{T.onlyFavs}</button>
          {times.map((t) => <button key={t} className={'chip' + (f.time === t ? ' on' : '')} onClick={() => setF({ ...f, time: f.time === t ? '' : t })}>{t[0] + t.slice(1).toLowerCase()}</button>)}
          {moments.map((t) => <button key={t} className={'chip' + (f.moment === t ? ' on' : '')} onClick={() => setF({ ...f, moment: f.moment === t ? '' : t })}>{t[0] + t.slice(1).toLowerCase()}</button>)}
          {keys.map((k) => (
            <button key={k} className={'chip' + (f.key === k ? ' on' : '')}
              onClick={() => setF({ ...f, key: f.key === k ? '' : k })}>Tono {k}</button>
          ))}
          {(f.time || f.moment || f.fav || f.q || f.key) && <button className="chip" onClick={() => setF({ ...f, q: '', key: '', time: '', moment: '', fav: false })}>{T.clear}</button>}
        </div>
      )}
      <Section id="sec-recientes" title={T.recent} list={recent} empty="Los cantos que abras aparecerán aquí." {...cardProps} />
      <Section id="sec-favoritas" title={T.favs} list={favs} empty="Marca la estrella de un canto para tenerlo a mano." {...cardProps} />
      <Section id="sec-catalogo" title={<>{T.allSongs} <span style={{ font: '14px Inter,sans-serif', color: 'var(--mut)' }}>({all.length})</span></>}
        list={all} empty={D.songs.length ? 'Ningún canto coincide con la búsqueda.' : 'Aún no hay cantos. Crea uno con el botón +.'} {...cardProps} />
    </>
  );

  const lector = !song ? <p>Canto no encontrado.</p> : (
    <>
      {activeSetlist && setlistSongs.length > 0 && (
        <div className="setlist-player-bar">
          <div className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
            <span style={{ fontSize: 13, color: 'var(--mut)' }}>
              Repertorio: <b style={{ color: 'var(--tx)' }}>{activeSetlist.name}</b> ({currentSetIdx + 1} de {setlistSongs.length})
            </span>
            <div className="row" style={{ gap: 6 }}>
              <button className="ghost row" disabled={currentSetIdx <= 0}
                onClick={() => openSong(setlistSongs[currentSetIdx - 1].id, activeSetlist.id)}>
                <Icon n="back" size={14} />Anterior
              </button>
              <button className="primary row" disabled={currentSetIdx >= setlistSongs.length - 1}
                onClick={() => openSong(setlistSongs[currentSetIdx + 1].id, activeSetlist.id)}>
                Siguiente<Icon n="next" size={14} />
              </button>
            </div>
          </div>
          <div className="chips" style={{ margin: '8px 0 0' }}>
            {setlistSongs.map((item, idx) => (
              <button key={item.id} className={'chip' + (item.id === song.id ? ' on' : '')}
                onClick={() => openSong(item.id, activeSetlist.id)}>
                {idx + 1}. {item.subcategory}: {item.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="tools">
        <div className="row">
          <button className="ghost row" onClick={() => go(activeSetlist ? 'sets' : 'inicio')}>
            <Icon n="back" size={16} />{activeSetlist ? 'Repertorios' : T.home}
          </button>
          <button className="ghost" data-testid="fav-toggle" aria-label="Favorita" onClick={(e) => toggleFav(e, song)}
            style={{ color: song.favorite ? 'var(--accent-primary)' : 'var(--mut)' }}><Icon n="star" fill={song.favorite ? 'currentColor' : 'none'} /></button>
          <button className="ghost" data-testid="edit-song" onClick={() => setModal({ edit: true, song })}>Editar</button>
          <button className={'ghost row' + (rd.stage ? ' primary' : '')} title="Modo Atril Completo" onClick={() => setRd({ ...rd, stage: !rd.stage })}>
            <Icon n="expand" size={16} />{rd.stage ? 'Salir de Atril' : 'Modo Atril'}
          </button>
          <span style={{ flex: 1 }} />
          <button className="ghost" data-testid="transpose-down" aria-label="Bajar medio tono" onClick={() => setRd({ ...rd, steps: ((rd.steps - 1 + 18) % 12) - 6 })}>− ½</button>
          <span className="val" data-testid="transpose-value" title="Semitonos">{rd.steps > 0 ? '+' + rd.steps : rd.steps}</span>
          <button className="ghost" data-testid="transpose-up" aria-label="Subir medio tono" onClick={() => setRd({ ...rd, steps: ((rd.steps + 1 + 18) % 12) - 6 })}>+ ½</button>
          {rd.steps !== 0 && <button className="ghost" onClick={() => setRd({ ...rd, steps: 0 })}>0</button>}
          <select data-testid="notation-select" aria-label="Notación" value={rd.mode} onChange={(e) => setRd({ ...rd, mode: e.target.value })}>
            <option value="orig">Original</option><option value="lat">DO-RE-MI</option><option value="am">C-D-E</option>
          </select>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="ghost" aria-label="Reducir letra" onClick={() => setRd({ ...rd, fs: Math.max(11, rd.fs - 2) })}>A−</button>
          <span className="val">{rd.fs}</span>
          <button className="ghost" aria-label="Aumentar letra" onClick={() => setRd({ ...rd, fs: Math.min(40, rd.fs + 2) })}>A+</button>
          <button className="ghost" onClick={fitFont}>Ajustar ancho</button>
          <span style={{ flex: 1 }} />
          <button className={(rd.auto ? 'primary' : 'ghost') + ' row'} onClick={() => setRd({ ...rd, auto: !rd.auto })}>
            <Icon n={rd.auto ? 'pause' : 'play'} size={14} />Auto-scroll</button>
          <label className="row" style={{ color: 'var(--mut)', fontSize: 13 }}>Velocidad
            <input type="range" min="1" max="8" value={rd.speed} style={{ width: 90 }} onChange={(e) => setRd({ ...rd, speed: +e.target.value })} /></label>
        </div>
      </div>
      <h1>{song.title}</h1>
      <div className="meta" style={{ marginBottom: 14 }}>
        {[song.artist, currentKeyLabel, song.bpm && song.bpm + ' BPM', song.liturgicalTime, song.subcategory].filter(Boolean).join(' · ')}
      </div>
      {song.notes && <p className="meta">{song.notes}</p>}

      {/* Reproductor de Audio del Canto */}
      <AudioPanel
        song={song}
        meta={D.audios && D.audios[song.id]}
        toast={toast}
        onMeta={(m) => setD((d) => {
          const a = { ...(d.audios || {}) };
          if (m) a[song.id] = m; else delete a[song.id];
          return { ...d, audios: a };
        })}
      />

      <pre className="body" ref={bodyRef} data-testid="song-body" style={{ '--fs': rd.fs + 'px' }}>
        {song.body.split('\n').map((l, i) => (
          <span key={i} className={isChordLine(l) ? 'ch' : undefined}>{isChordLine(l) ? convLine(l, rd.steps, rd.mode) : l}{'\n'}</span>
        ))}
      </pre>
    </>
  );

  const sets = (
    <>
      <div className="head">
        <h1>{T.sets}</h1>
        <span style={{ flex: 1 }} />
        <button className="primary row" onClick={() => setSetlistModal({ id: String(Date.now()), name: '', date: today(), notes: '', songIds: [] })}>
          <Icon n="plus" size={16} />{T.newSetlist}
        </button>
      </div>
      {!D.setlists.length && <p className="empty" style={{ marginTop: 20 }}>Crea un repertorio para ordenar los cantos de una celebración.</p>}
      {D.setlists.map((l) => {
        const items = l.songIds.map((id) => D.songs.find((s) => s.id === id)).filter(Boolean);
        return (
          <div key={l.id} className="setlist-box">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <h2 style={{ margin: 0 }}>{l.name}</h2>
                {(l.date || l.notes) && <div className="meta">{[l.date, l.notes].filter(Boolean).join(' · ')}</div>}
              </div>
              <div className="row">
                {items.length > 0 && (
                  <button className="primary row" onClick={() => openSong(items[0].id, l.id)}>
                    <Icon n="play" size={14} />{T.playSetlist}
                  </button>
                )}
                <button className="ghost" onClick={() => setSetlistModal(l)}>Editar lista</button>
                <button className="ghost" style={{ color: '#EF4444' }}
                  onClick={() => window.confirm('¿Eliminar este repertorio?') && setD((d) => ({ ...d, deleted: { ...d.deleted, [l.id]: Date.now() }, setlists: d.setlists.filter((x) => x.id !== l.id) }))}>
                  Eliminar
                </button>
              </div>
            </div>
            <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
              {items.map((s, i) => (
                <li className="row" key={s.id} data-testid="setlist-item">
                  <span className="val">{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Card s={s} onOpen={(id) => openSong(id, l.id)} onFav={toggleFav} />
                  </div>
                  <button className="ghost" data-testid="move-up" aria-label={`Subir ${s.title}`} disabled={i === 0} onClick={() => moveInList(l.id, s.id, -1)}>↑</button>
                  <button className="ghost" data-testid="move-down" aria-label={`Bajar ${s.title}`} disabled={i === items.length - 1} onClick={() => moveInList(l.id, s.id, 1)}>↓</button>
                  <button className="ghost" data-testid="remove-from-setlist" aria-label={`Quitar ${s.title}`} onClick={() => patchList(l.id, (ids) => ids.filter((x) => x !== s.id))}>✕</button>
                </li>
              ))}
            </ol>
            {!items.length && <div className="empty">Repertorio vacío. Usa "Editar lista" para elegir los cantos.</div>}
          </div>
        );
      })}
    </>
  );

  const ajustes = (
    <>
      <h1>{T.settings}</h1>
      <h2>Tema visual</h2>
      <div className="themes">
        {THEMES.map(([id, name, desc]) => (
          <button key={id} className="card" style={theme === id ? { borderColor: 'var(--accent-primary)' } : undefined}
            onClick={() => { setTheme(id); toast('Tema aplicado'); }}><b>{name}</b><div className="meta">{desc}</div></button>
        ))}
      </div>
      <h2>Nube (Firebase Realtime Database)</h2>
      <p className="meta">Enlace de tu base de datos para sincronizar entre computador, tablet y celular:</p>
      <input className="ta" data-testid="cloud-url" aria-label="URL de la nube" placeholder="https://TU-PROYECTO-default-rtdb.firebaseio.com/RUTA-SECRETA.json"
        value={cloud} onChange={(e) => setCloud(e.target.value.trim())} />
      <div className="row" style={{ marginTop: 10 }}>
        <button className="primary" data-testid="push-cloud" onClick={pushToCloud}>Subir a Firebase</button>
        <button data-testid="pull-cloud" onClick={pullFromCloud}>Descargar de Firebase</button>
      </div>
      <h2>Respaldo en archivo JSON</h2>
      <p className="meta">Exporta o restaura tus cantos y repertorios mediante un archivo JSON local.</p>
      <textarea className="ta" rows={8} data-testid="backup-text" aria-label="Respaldo JSON" placeholder="Respaldo JSON"
        style={{ font: "13px 'JetBrains Mono',monospace" }} value={backup} onChange={(e) => setBackup(e.target.value)} />
      <div className="row" style={{ marginTop: 10 }}>
        <button className="primary" data-testid="export-btn" onClick={doExport}>Exportar respaldo</button>
        <button data-testid="import-btn" onClick={() => doImport(backup)}>Importar desde el texto</button>
        <input type="file" accept=".json,application/json" data-testid="import-file" aria-label="Importar archivo JSON"
          onChange={(e) => { const file = e.target.files[0]; if (file) { const r = new FileReader(); r.onload = () => doImport(String(r.result)); r.readAsText(file); } }} />
      </div>
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className={'app' + (rd.stage && view === 'lector' ? ' stage' : '')}>
        {!(rd.stage && view === 'lector') && (
          <aside>
            <h1 className="brand">{T.brand}</h1>
            <p className="sub">{T.sub}</p>
            {nav('inicio', 'home', T.home)}
            {nav('sets', 'list', T.sets)}
            {nav('ajustes', 'gear', T.settings)}
            <div className="sidefil">
              <div className="sec">{T.liturgicalTimes}</div>{times.map((t) => filBtn('time', t))}
              <div className="sec">{T.massMoments}</div>{moments.map((t) => filBtn('moment', t))}
            </div>
            <div className="sync">
              <span className="dot" style={sync === 'err' ? { background: '#EF4444', animation: 'none' } : undefined} />
              <span data-testid="sync-status">{SYNC_TXT[sync]}</span>
            </div>
          </aside>
        )}
        <main ref={main}>
          <svg className="mark" viewBox="0 0 100 200" fill="currentColor" aria-hidden="true">
            <path d="M52 8c-14 14-18 34-12 54 4 12 12 22 20 32 12 14 14 30 4 40-10 9-26 6-30-6-3-9 2-18 11-20 7-1 12 4 11 10-1 4-5 6-8 4 2 6 12 4 14-4 2-9-5-16-14-14-14 3-20 18-14 31 7 14 26 18 40 8 16-12 14-36 2-50-10-12-18-22-18-36 0-12 6-22 12-30 4-6 3-12-2-17-4-4-9-4-14-2z" />
          </svg>
          {view === 'lector' ? lector : view === 'sets' ? sets : view === 'ajustes' ? ajustes : inicio}
          {view !== 'lector' && last && (
            <div className="cont">
              <div style={{ flex: 1, minWidth: 0 }}><small>{T.continueWhere}</small><b>{last.title}</b></div>
              <button className="primary" onClick={() => openSong(last.id)}>{T.open}</button>
            </div>
          )}
          {view !== 'lector' && (
            <button className="primary fab" data-testid="fab-new" aria-label="Nuevo canto" onClick={() => setModal({ edit: false, song: normSong({ id: String(Date.now()) }) })}>
              <Icon n="plus" size={24} />
            </button>
          )}
        </main>

        {!(rd.stage && view === 'lector') && (
          <nav className="mobile-tabbar" aria-label="Navegación móvil">
            {nav('inicio', 'home', T.home)}
            {nav('sets', 'list', T.sets)}
            {nav('ajustes', 'gear', T.settings)}
          </nav>
        )}
      </div>

      {modal && <SongEditorDrawer key={modal.song.id} init={modal.song} edit={modal.edit} onSave={saveSong} onClose={() => setModal(null)} onDelete={delSong} onToast={toast} />}
      {setlistModal && <SetlistEditorDrawer init={setlistModal} songs={D.songs} onSave={saveSetlist} onClose={() => setSetlistModal(null)} />}
      <div id="toasts" aria-live="polite">{toasts.map((x) => <div className="toast" key={x.id}>{x.t}</div>)}</div>
    </>
  );
}

/* ============ Estilos ============ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap');
:root{--bg-app:#12100E;--bg-panel:#1A1714;--bd:rgba(255,255,255,.07);--bd2:rgba(255,255,255,.12);--tx:#EDE6DD;--mut:#9A8F84;--accent-primary:#DF8A65;--ink:#12100E;--chord:#DF8A65;--ok:#10B981;--r:14px;--ri:8px;--ease:cubic-bezier(.22,1,.36,1);color-scheme:dark}
:root[data-theme=escenario]{--bg-app:#090D16;--bg-panel:#0F1524;--accent-primary:#FBBF24;--chord:#FBBF24;--ink:#090D16;--tx:#E8ECF4;--mut:#8792A8}
:root[data-theme=misal]{--bg-app:#FAF6F0;--bg-panel:#F2EBDF;--bd:rgba(60,40,20,.12);--bd2:rgba(60,40,20,.18);--tx:#2A211A;--mut:#7A6A5A;--accent-primary:#991B1B;--ink:#fff;--chord:#991B1B;color-scheme:light}
:root[data-theme=estudio]{--bg-app:#F1F5F9;--bg-panel:#fff;--bd:rgba(15,23,42,.1);--bd2:rgba(15,23,42,.16);--tx:#0F172A;--mut:#64748B;--accent-primary:#4F46E5;--ink:#fff;--chord:#4F46E5;color-scheme:light}
*,*::before,*::after{box-sizing:border-box}
html,body,#root{height:100%;margin:0}
body{background:var(--bg-app);color:var(--tx);font:15px/1.5 Inter,system-ui,sans-serif;font-variant-numeric:tabular-nums;overflow:hidden}
button,input,select,textarea{font:inherit;color:inherit}
button{cursor:pointer;border:1px solid var(--bd2);background:transparent;border-radius:var(--ri);padding:8px 14px;transition:transform 150ms var(--ease),background 150ms var(--ease)}
button:active{transform:scale(.97)}
button:disabled{opacity:.35;cursor:default}
button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--accent-primary);outline-offset:2px}
.primary{background:var(--accent-primary);color:var(--ink);border-color:transparent;font-weight:600}
.ghost:hover{background:var(--bd)}
.app{display:grid;grid-template-columns:260px 1fr;height:100%}
.app.stage{grid-template-columns:1fr}
aside{background:var(--bg-panel);border-right:1px solid var(--bd);padding:22px 16px;display:flex;flex-direction:column;gap:6px;overflow-y:auto}
.brand{font:700 24px/1.1 'Playfair Display',Georgia,serif;margin:0}
.sub{color:var(--mut);font-size:13px;margin:2px 0 18px}
.nav{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;padding:10px 12px}
.nav.on{background:var(--accent-primary);color:var(--ink);font-weight:600}
.sec{color:var(--mut);font-size:12px;margin:18px 12px 4px;letter-spacing:.04em}
.fil{display:flex;justify-content:space-between;width:100%;border:0;text-align:left;padding:7px 12px;color:var(--mut)}
.fil.on{color:var(--tx);background:var(--bd)}
.sync{margin-top:auto;padding:12px;font-size:13px;color:var(--mut);display:flex;align-items:center;gap:8px}
.dot{width:8px;height:8px;border-radius:50%;background:var(--ok);animation:pulse 2s infinite}
@keyframes pulse{50%{opacity:.35}}
main{position:relative;overflow-y:auto;padding:26px clamp(16px,4vw,40px) 140px}
.mark{position:fixed;right:-4%;top:12%;width:min(60vw,420px);height:min(70vh,520px);opacity:.03;pointer-events:none;color:var(--tx);z-index:0}
h1,h2{font-family:'Playfair Display',Georgia,serif;font-weight:700;margin:0}
h1{font-size:32px}h2{font-size:22px;margin:30px 0 12px}
.head{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.badge{font-size:12px;color:var(--ok);border:1px solid color-mix(in srgb,var(--ok) 40%,transparent);border-radius:99px;padding:2px 10px}
.season-banner{display:flex;align-items:center;gap:12px;background:var(--bg-panel);border:1px solid var(--bd2);border-radius:var(--r);padding:12px 16px;margin-top:16px}
.season-dot{width:12px;height:12px;border-radius:50%;flex-shrink:0}
.search{display:flex;gap:10px;margin:16px 0 6px}
.search input{flex:1;background:var(--bg-panel);border:1px solid var(--bd2);border-radius:var(--ri);padding:11px 14px}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
.chip{border-radius:99px;padding:4px 12px;font-size:13px}
.chip.on{background:var(--accent-primary);color:var(--ink);border-color:transparent;font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
.card{background:var(--bg-panel);border:1px solid var(--bd);border-radius:var(--r);padding:16px;text-align:left;display:block;width:100%;cursor:pointer}
.card:hover{border-color:var(--bd2)}
.card-title{border:0;padding:0;background:none;text-align:left;flex:1}.card-title:active{transform:none}
.card b{font:700 17px/1.25 'Playfair Display',Georgia,serif;display:block}
.meta{color:var(--mut);font-size:13px;margin-top:6px}
.tag{display:inline-block;border:1px solid var(--bd2);border-radius:99px;padding:0 8px;font-size:12px;margin:8px 6px 0 0;color:var(--mut)}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.fab{position:fixed;right:24px;bottom:24px;width:56px;height:56px;border-radius:50%;padding:0;display:grid;place-items:center;z-index:20;box-shadow:0 8px 24px rgba(0,0,0,.35)}
.cont{position:fixed;left:284px;right:96px;bottom:20px;max-width:460px;background:var(--bg-panel);border:1px solid var(--bd2);border-radius:var(--r);padding:10px 12px 10px 16px;display:flex;align-items:center;gap:12px;z-index:15}
.cont small{display:block;color:var(--mut);font-size:11px;letter-spacing:.06em}
.cont b{font-family:'Playfair Display',Georgia,serif}
.setlist-box{background:var(--bg-panel);border:1px solid var(--bd);border-radius:var(--r);padding:18px;margin-top:18px}
.setlist-player-bar{background:var(--bg-panel);border:1px solid var(--bd2);border-radius:var(--r);padding:12px 16px;margin-bottom:14px}
.audio-box{background:var(--bg-panel);border:1px solid var(--bd2);border-radius:var(--r);padding:12px 16px;margin-bottom:18px}
.pdf-bar{display:flex;align-items:center;gap:10px;background:var(--bg-app);border:1px dashed var(--bd2);border-radius:var(--ri);padding:10px 12px;margin:12px 0}
.tools{position:sticky;top:-26px;z-index:5;background:var(--bg-app);padding:10px 0;border-bottom:1px solid var(--bd);margin-bottom:14px}
.val{min-width:34px;text-align:center;font-weight:600}
pre.body{font:400 var(--fs,16px)/1.65 'JetBrains Mono',ui-monospace,monospace;white-space:pre;overflow-x:auto;margin:0}
.ch{color:var(--chord);font-weight:600}
.drawer-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;justify-content:flex-end;z-index:40;animation:fade 180ms var(--ease)}
@keyframes fade{from{opacity:0}}
.drawer{background:var(--bg-panel);border-left:1px solid var(--bd2);padding:24px;width:min(560px,100%);height:100%;overflow-y:auto;animation:slideIn 240ms var(--ease)}
@keyframes slideIn{from{transform:translateX(100%)}}
.drawer label{display:block;font-size:13px;color:var(--mut);margin:10px 0 4px}
.drawer input,.drawer select,.drawer textarea,.ta{width:100%;background:var(--bg-app);border:1px solid var(--bd2);border-radius:var(--ri);padding:9px 12px}
.drawer textarea{font-family:'JetBrains Mono',monospace;font-size:13px;min-height:200px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
#toasts{position:fixed;right:20px;bottom:96px;display:flex;flex-direction:column;gap:8px;z-index:60}
.toast{background:var(--bg-panel);border:1px solid var(--bd2);border-radius:var(--ri);padding:10px 14px;animation:fade 200ms var(--ease)}
.themes{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
.empty{color:var(--mut);padding:18px;border:1px dashed var(--bd2);border-radius:var(--r)}
.mobile-tabbar{display:none}
@media(max-width:1024px){.app{grid-template-columns:220px 1fr}.cont{left:244px}}
@media(max-width:700px){
  .app{grid-template-columns:1fr;grid-template-rows:1fr auto}
  aside{display:none}
  main{padding-bottom:160px}
  .mobile-tabbar{display:flex;justify-content:space-around;background:var(--bg-panel);border-top:1px solid var(--bd2);padding:6px 8px;z-index:25}
  .mobile-tabbar .nav{justify-content:center;flex-direction:column;gap:4px;font-size:12px;padding:8px;border-radius:var(--ri)}
  .cont{left:12px;right:84px;bottom:76px}
  .fab{bottom:76px;right:16px}
  .two{grid-template-columns:1fr}
}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;