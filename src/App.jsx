import { useState, useEffect, useLayoutEffect, useRef } from 'react';

/* ============ Constantes, Liturgia Automática e i18n ============ */
const KEY = 'cancionero_cloud_v1';
const DEFAULT_CLOUD = 'https://mi-cancionero-6d816-default-rtdb.firebaseio.com/cancionero.json';

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
    brand: 'Mi Cancionero',
    sub: 'Atril Litúrgico Digital',
    home: 'Catálogo',
    sets: 'Repertorios',
    settings: 'Ajustes y Nube',
    catalogTitle: 'Catálogo Litúrgico',
    recent: 'Recientes',
    favs: 'Favoritas',
    allSongs: 'Catálogo de cantos',
    searchPlaceholder: 'Buscar por título, letra, tiempo, tono o autor...',
    filters: 'Filtros',
    onlyFavs: 'Solo favoritas',
    clear: 'Limpiar',
    liturgicalTimes: 'TIEMPOS LITÚRGICOS',
    massMoments: 'MOMENTOS DE LA MISA',
    continueWhere: 'CONTINUAR DONDE QUEDASTE',
    open: 'Abrir',
    playSetlist: 'Iniciar Misa (Modo Atril)',
    newSetlist: 'Nuevo repertorio',
    guide: 'Guía rápida',
    seasonBanner: 'Tiempo litúrgico actual sugerido:',
    filterSeason: 'Ver cantos de este tiempo',
  },
  en: {
    brand: 'My Songbook',
    sub: 'Digital Liturgical Stand',
    home: 'Catalog',
    sets: 'Setlists',
    settings: 'Settings & Cloud',
    catalogTitle: 'Liturgical Catalog',
    recent: 'Recent',
    favs: 'Favorites',
    allSongs: 'Song Catalog',
    searchPlaceholder: 'Search by title, lyrics, season, key or artist...',
    filters: 'Filters',
    onlyFavs: 'Favorites only',
    clear: 'Clear',
    liturgicalTimes: 'LITURGICAL SEASONS',
    massMoments: 'MASS PARTS',
    continueWhere: 'CONTINUE WHERE YOU LEFT OFF',
    open: 'Open',
    playSetlist: 'Start Mass (Live Player)',
    newSetlist: 'New Setlist',
    guide: 'Quick Guide',
    seasonBanner: 'Current suggested liturgical season:',
    filterSeason: 'Filter season songs',
  }
};

const SYNC_TXT = { local:'Local: guardado', busy:'Sincronizando…', ok:'Nube: Sincronizada', err:'Error de sincronización' };
const BADGE_TXT = { local:'Guardado local', busy:'Sincronizando…', ok:'Sincronizado', err:'Error de nube' };

// Motor de Calendario Litúrgico (adaptado de src/lib/liturgy.js)
function getCurrentLiturgicalSeason(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  if ((m === 12 && d >= 25) || (m === 1 && d <= 12)) return { key: 'NAVIDAD', color: '#FBBF24', label: 'Tiempo de Navidad' };
  if (m === 11 && d >= 27 || (m === 12 && d <= 24)) return { key: 'ADVIENTO', color: '#A855F7', label: 'Tiempo de Adviento' };
  // Cálculo de Pascua (Algoritmo de Butcher-Meeus)
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

/* ============ Motor de Acordes, Extracción y Auto-Relleno ============ */
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

// Función extractSong / chordLayout: limpia texto pegado de PDF o con acordes entre corchetes [DO]
function cleanAndExtractSongText(rawText) {
  const lines = String(rawText || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  for (let line of lines) {
    // Si tiene acordes entre corchetes tipo ChordPro: "Ya no [DO]soy yo quien [SOL]vive"
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

// Función fillChords: toma el patrón de acordes de la primera estrofa y lo replica en estrofas sin acordes
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

const normalizeCloudUrl = (url) => {
  const clean = String(url || '').trim();
  if (!clean) return '';
  if (clean.endsWith('.json')) return clean;
  return clean.replace(/\/+$/, '') + '/cancionero.json';
};

/* ============ Datos defensivos y Catálogo Inicial ============ */
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
    })),
    audios: d.audios && typeof d.audios === 'object' ? d.audios : {},
  };
};

const SEED = {
  songs: [
    {
      id: '1791515587314',
      title: 'IN PERSONA CHRISTI',
      category: 'Iglesia',
      liturgicalTime: 'ORDINARIO',
      subcategory: 'COMUNIÓN',
      originalKey: 'DO',
      artist: 'JESED',
      bpm: '63',
      favorite: true,
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
      id: '1791515587315',
      title: 'Yo sé que estás aquí',
      category: 'Iglesia',
      liturgicalTime: 'ORDINARIO',
      subcategory: 'ADORACIÓN',
      originalKey: 'REm',
      artist: 'Renovación',
      bpm: '68',
      favorite: true,
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
      id: '1791515587316',
      title: 'La Mano de Dios',
      category: 'Iglesia',
      liturgicalTime: 'ORDINARIO',
      subcategory: 'ADORACIÓN',
      originalKey: 'SOL',
      artist: 'Jon Carlo',
      bpm: '70',
      favorite: true,
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
      id: '1791515587317',
      title: 'CAMINANDO DESDE ORIENTE',
      category: 'Iglesia',
      liturgicalTime: 'NAVIDAD',
      subcategory: 'ENTRADA',
      originalKey: 'SOL',
      artist: 'Tradicional',
      bpm: '96',
      favorite: false,
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
      id: '1791515587318',
      title: 'ESTE ES EL MOMENTO',
      category: 'Iglesia',
      liturgicalTime: 'ORDINARIO',
      subcategory: 'OFRENDAS',
      originalKey: 'FA',
      artist: 'Liturgia',
      bpm: '74',
      favorite: false,
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
      id: '1791515587319',
      title: 'JUNTOS NOS ACERCAMOS',
      category: 'Iglesia',
      liturgicalTime: 'ORDINARIO',
      subcategory: 'OFRENDAS',
      originalKey: 'DO',
      artist: 'Tradicional',
      bpm: '76',
      favorite: false,
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
      id: '1791515587320',
      title: 'Te Entrego',
      category: 'Iglesia',
      liturgicalTime: 'ORDINARIO',
      subcategory: 'ADORACIÓN',
      originalKey: 'SOL',
      artist: 'Joan Sánchez',
      bpm: '66',
      favorite: true,
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
      id: '1791515587321',
      title: 'Venimos a Adorar',
      category: 'Iglesia',
      liturgicalTime: 'ORDINARIO',
      subcategory: 'ADORACIÓN',
      originalKey: 'RE',
      artist: 'Ministerio',
      bpm: '70',
      favorite: false,
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
      date: new Date().toISOString().slice(0, 10),
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

/* ============ Iconos SVG ============ */
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
};
const Icon = ({ n, size = 18, fill = 'none' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={PATHS[n]} />
  </svg>
);

/* ============ Componentes Modulares ============ */
function Card({ s, onOpen, onFav }) {
  return (
    <div className="card" role="button" tabIndex={0} data-testid="song-card" aria-label={`Abrir ${s.title}`}
      onClick={() => onOpen(s.id)} onKeyDown={(e) => e.key === 'Enter' && onOpen(s.id)}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <b>{s.title}</b>
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

/* Cajón Deslizante de Edición de Canto (SongEditorDrawer + extractSong + fillChords) */
function SongEditorDrawer({ init, edit, onSave, onClose, onDelete, onToast }) {
  const [s, setS] = useState(init);
  const set = (k) => (e) => setS((x) => ({ ...x, [k]: e.target.value }));
  const field = (k, label, placeholder = '') => (
    <div><label>{label}</label><input data-testid={`field-${k}`} aria-label={label} placeholder={placeholder} value={s[k]} onChange={set(k)} /></div>
  );

  const handleCleanText = () => {
    setS((x) => ({ ...x, body: cleanAndExtractSongText(x.body) }));
    onToast('Formato de letra y acordes alineado');
  };

  const handleAutoFillChords = () => {
    setS((x) => ({ ...x, body: autoFillMissingChords(x.body) }));
    onToast('Acordes replicados en las estrofas siguientes');
  };

  return (
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer" role="dialog" aria-label="Editor de Canto">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{edit ? 'Editar canto' : 'Nuevo canto'}</h2>
          <button className="ghost" onClick={onClose}>✕</button>
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
            <button type="button" className="ghost" style={{ padding: '4px 9px', fontSize: 12 }} onClick={handleCleanText} title="Convierte acordes entre [corchetes] o limpia texto pegado de PDF">
              Limpiar PDF / [Acordes]
            </button>
            <button type="button" className="ghost row" style={{ padding: '4px 9px', fontSize: 12, gap: 4 }} onClick={handleAutoFillChords} title="Copia los acordes de la 1ª estrofa en las demás estrofas sin acordes">
              <Icon n="wand" size={14} />Auto-rellenar acordes
            </button>
          </div>
        </div>
        <textarea data-testid="field-body" aria-label="Letra y acordes" placeholder="Escribe los acordes en su propia línea sobre la letra, o pega letra con [DO] acordes..." value={s.body} onChange={set('body')} />
        <label>Notas de interpretación / Cejilla (Capo)</label>
        <input data-testid="field-notes" aria-label="Notas" placeholder="Ej. Cejilla en 2º traste, arpegio suave en la introducción" value={s.notes} onChange={set('notes')} />
        <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
          {edit && <button className="ghost" style={{ marginRight: 'auto', color: '#EF4444' }} onClick={() => onDelete(s.id)}>Eliminar</button>}
          <button className="ghost" onClick={onClose}>Cancelar</button>
          <button className="primary" data-testid="save-song" onClick={() => onSave(s)}>Guardar canto</button>
        </div>
      </div>
    </div>
  );
}

/* Cajón Deslizante para Crear/Editar Repertorios (SetlistEditorDrawer) */
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
            <input value={list.notes || ''} placeholder="Ej. Coro parroquial" onChange={(e) => setList({ ...list, notes: e.target.value })} />
          </div>
        </div>
        <label style={{ marginTop: 14 }}>Seleccionar cantos ({list.songIds.length} elegidos)</label>
        <input type="search" placeholder="Filtrar cantos por nombre o momento..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 8 }} />
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

/* ============ App Principal ============ */
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
  const [f, setF] = useState({ q: '', time: '', moment: '', fav: false, show: false });
  const [modal, setModal] = useState(null);
  const [setlistModal, setSetlistModal] = useState(null);
  const [rd, setRd] = useState({ steps: 0, mode: 'orig', fs: 17, auto: false, speed: 2, stage: false });
  const [sync, setSync] = useState('local');
  const [toasts, setToasts] = useState([]);
  const [backup, setBackup] = useState('');
  const main = useRef(null);

  const T = I18N[lang] || I18N.es;
  const currentSeason = getCurrentLiturgicalSeason();

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(KEY, JSON.stringify({ data: D, theme, cloud, lang })); } catch { /* sin almacenamiento */ }
  }, [D, theme, cloud, lang]);

  useEffect(() => {
    if (!rd.auto || view !== 'lector') return;
    const i = setInterval(() => { if (main.current) main.current.scrollTop += rd.speed * 0.5; }, 40);
    return () => clearInterval(i);
  }, [rd.auto, rd.speed, view]);

  const toast = (t) => {
    const id = Math.random();
    setToasts((x) => [...x, { id, t }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 2600);
  };
  const patchSong = (id, p) => setD((d) => ({ ...d, songs: d.songs.map((s) => (s.id === id ? { ...s, ...p } : s)) }));
  const go = (v) => { setView(v); setOpenId(null); setActiveSetlistId(null); setRd((r) => ({ ...r, auto: false, stage: false })); };

  const openSong = (id, setlistId = null) => {
    patchSong(id, { lastOpened: Date.now() });
    setOpenId(id);
    setActiveSetlistId(setlistId);
    setView('lector');
    setRd((r) => ({ ...r, steps: 0, mode: 'orig', auto: false }));
    if (main.current) main.current.scrollTop = 0;
  };

  const toggleFav = (e, s) => { e.stopPropagation(); patchSong(s.id, { favorite: !s.favorite }); };
  const saveSong = (s) => {
    const n = normSong({ ...s, title: s.title.trim() });
    setD((d) => ({ ...d, songs: d.songs.some((x) => x.id === n.id) ? d.songs.map((x) => (x.id === n.id ? n : x)) : [n, ...d.songs] }));
    setModal(null); toast('Canto guardado');
  };
  const delSong = (id) => {
    if (!window.confirm('¿Eliminar este canto?')) return;
    setD((d) => ({ ...d, songs: d.songs.filter((s) => s.id !== id), setlists: d.setlists.map((l) => ({ ...l, songIds: l.songIds.filter((x) => x !== id) })) }));
    setModal(null); go('inicio'); toast('Canto eliminado');
  };

  const saveSetlist = (list) => {
    setD((d) => ({
      ...d,
      setlists: d.setlists.some((x) => x.id === list.id)
        ? d.setlists.map((x) => (x.id === list.id ? list : x))
        : [...d.setlists, list]
    }));
    setSetlistModal(null);
    toast('Repertorio guardado');
  };

  const patchList = (id, fn) => setD((d) => ({ ...d, setlists: d.setlists.map((l) => (l.id === id ? { ...l, songIds: fn(l.songIds) } : l)) }));
  const moveInList = (lid, sid, dir) => patchList(lid, (ids) => {
    const i = ids.indexOf(sid), j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return ids;
    const c = [...ids]; [c[i], c[j]] = [c[j], c[i]]; return c;
  });

  // Sincronización Firebase Realtime Database
  const pushToCloud = async () => {
    const endpoint = normalizeCloudUrl(cloud);
    if (!endpoint) return toast('Escribe primero la URL de Firebase');
    setCloud(endpoint);
    setSync('busy');
    try {
      const r = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...D, exported: new Date().toISOString() }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      setSync('ok'); toast('Subido a Firebase correctamente');
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
      setD(d); setSync('ok'); toast(`Descargados ${d.songs.length} cantos de Firebase`);
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
    } catch { /* fallback en texto */ }
    navigator.clipboard?.writeText(j).then(() => toast('Respaldo copiado'), () => toast('Respaldo generado'));
  };

  /* ---- Derivados y SetlistPlayer ---- */
  const q = norm(f.q);
  const all = D.songs.filter((s) =>
    (!f.time || s.liturgicalTime === f.time) && (!f.moment || s.subcategory === f.moment) && (!f.fav || s.favorite) &&
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
        <button className="ghost row" onClick={() => setLang(lang === 'es' ? 'en' : 'es')} title="Cambiar idioma">
          <Icon n="globe" size={16} />{lang.toUpperCase()}
        </button>
        <button className="ghost" onClick={pullFromCloud}>Descargar de Firebase</button>
        <button className="ghost" onClick={() => window.alert('1. Toca + para crear un canto o pegar desde PDF.\n2. Usa "Auto-rellenar acordes" para copiar los acordes de la 1ª estrofa al resto.\n3. En Repertorios pulsa "Iniciar Misa" para pasar de canto en canto en vivo.')}>{T.guide}</button>
      </div>

      {/* Banner de Tiempo Litúrgico Automático (src/lib/liturgy.js) */}
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
          {keys.map((k) => (
            <button key={k} className={'chip' + (norm(f.q) === norm(k) ? ' on' : '')}
              onClick={() => setF({ ...f, q: norm(f.q) === norm(k) ? '' : k })}>Tono {k}</button>
          ))}
          {(f.time || f.moment || f.fav || f.q) && <button className="chip" onClick={() => setF({ ...f, q: '', time: '', moment: '', fav: false })}>{T.clear}</button>}
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
      {/* Barra de Reproductor de Misa en Vivo (SetlistPlayer.jsx) si se abrió desde un repertorio */}
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
          <span style={{ flex: 1 }} />
          <button className={(rd.auto ? 'primary' : 'ghost') + ' row'} onClick={() => setRd({ ...rd, auto: !rd.auto })}>
            <Icon n={rd.auto ? 'pause' : 'play'} size={14} />Auto-scroll</button>
          <label className="row" style={{ color: 'var(--mut)', fontSize: 13 }}>Velocidad
            <input type="range" min="1" max="8" value={rd.speed} style={{ width: 90 }} onChange={(e) => setRd({ ...rd, speed: +e.target.value })} /></label>
        </div>
      </div>
      <h1>{song.title}</h1>
      <div className="meta" style={{ marginBottom: 18 }}>
        {[song.artist, currentKeyLabel, song.bpm && song.bpm + ' BPM', song.liturgicalTime, song.subcategory].filter(Boolean).join(' · ')}
      </div>
      {song.notes && <p className="meta">{song.notes}</p>}
      <pre className="body" data-testid="song-body" style={{ '--fs': rd.fs + 'px' }}>
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
        <button className="primary row" onClick={() => setSetlistModal({ id: String(Date.now()), name: '', date: new Date().toISOString().slice(0, 10), notes: '', songIds: [] })}>
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
                  onClick={() => window.confirm('¿Eliminar este repertorio?') && setD((d) => ({ ...d, setlists: d.setlists.filter((x) => x.id !== l.id) }))}>
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
      <p className="meta">Enlace de tu base de datos en tiempo real para sincronizar entre computador, tablet y celular:</p>
      <input className="ta" data-testid="cloud-url" aria-label="URL de la nube" placeholder="https://mi-cancionero-6d816-default-rtdb.firebaseio.com/cancionero.json"
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

        {/* Barra de Navegación Inferior Móvil (MobileTabBar.jsx) */}
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

/* ============ Estilos (Tokens Semánticos + Drawers + MobileTabBar + SetlistPlayer) ============ */
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
.tools{position:sticky;top:-26px;z-index:5;background:var(--bg-app);padding:10px 0;border-bottom:1px solid var(--bd);margin-bottom:14px}
.val{min-width:34px;text-align:center;font-weight:600}
pre.body{font:400 var(--fs,16px)/1.65 'JetBrains Mono',ui-monospace,monospace;white-space:pre-wrap;margin:0}
.ch{color:var(--chord);font-weight:600}
/* Cajones Deslizantes (Drawers) */
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
@media(max-width:820px){
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