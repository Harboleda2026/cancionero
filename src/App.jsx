import { useState, useEffect, useMemo } from 'react';
import { 
  Music, Search, Star, Cloud, PlusCircle, Download, 
  BookOpen, SlidersHorizontal, ChevronRight, X, ArrowLeft, RefreshCw
} from 'lucide-react';

// Respaldo base con normalización defensiva
const RAW_BACKUP = [
  {
    id: "1791515587314",
    title: "INPERSONA CHRISTI",
    category: "Iglesia",
    liturgicalTime: "ORDINARIO",
    subcategory: "COMUNIÓN",
    originalKey: "DO",
    bpm: "63",
    favorite: true,
    lastOpened: 1791515627481,
    body: `C                  G\nYa no soy yo quien vive,\n     F                 C\ntu eres quien vive en mi\nAm                 Em\nmi vida la he perdido\n      F              G\npues todo lo vivo en ti.\n\n(Coro)\n C     Em  F    G   Am    Em   F    G\nIn persona Christi, In persona Christi\n Am          Em     F          C\nEste es mi cuerpo, Esta es mi sangre\nAm     Em   F   G\nIn persona Christi\n Am      Em    F       C\nTomen y coman Tomen y beban\n     F        G   F         G   C\nQue este soy yo In persona Christi.`
  },
  {
    id: "1790379068484",
    title: "Yo sé que estas aquí",
    category: "Iglesia",
    liturgicalTime: "ORDINARIO",
    subcategory: "ENTRADA",
    originalKey: "REm",
    favorite: false,
    lastOpened: 1790549236924,
    body: `REm              LA7\n/Yo sé que estás aquí, mi Señor,\n                 REm\nyo sé que estás aquí./ (bis)\n   RE7              SOLm\n/Y mi alma te adora\n   DO7             FA\ny mi alma te adora,\n   LA#7          SOLm\ny mi alma te adora,\n   LA7                    REm\nporque sé que estás aquí./ (bis)`
  },
  {
    id: "1790379781362",
    title: "La Mano de Dios",
    category: "Iglesia",
    liturgicalTime: "ORDINARIO",
    subcategory: "ADORACIÓN",
    originalKey: "G#",
    favorite: false,
    lastOpened: 1791858018422,
    body: ` G#                     C#         G#\n//  La mano de Dios es la que me fortalece\n         C#                  D#           G#\ncuando estoy atravesando el valle de la muerte\nG#                    C#       G#\n La mano de Dios e la que me purifica\n          C#         D#               G#            D#\ny en el camino más oscuro tu eres mi guia  //`
  },
  {
    id: "1790550339820",
    title: "CAMINANDO DESDE ORIENTE",
    liturgicalTime: "NAVIDAD",
    subcategory: "ENTRADA",
    originalKey: "SOL",
    favorite: false,
    lastOpened: 1790892945962,
    body: `   Sol        Do     Sol\n1. Caminando desde Oriente \n    Mim           Sol\nse acercan ya los reyes\n           Do    Sol\ncaminando desde Oriente\n     Mim       Sol\n ya llegan a Belén.`
  },
  {
    id: "1790551743623",
    title: "ESTE ES EL MOMENTO",
    liturgicalTime: "ORDINARIO",
    subcategory: "OFRENDAS",
    originalKey: "FA",
    favorite: false,
    lastOpened: 1790608073804,
    body: `FA                      LAm\nEste es el momento de alegrar la mesa\nREm                   SOLm\ncon el vino y con el pan,\nSOLm                  DO7\nque consagraremos\n   SOLm             DO7\ny que ofreceremos\n    SOLm                        FA#  -    FA\ny que hemos de comulgar.`
  },
  {
    id: "1790552295899",
    title: "JUNTOS NOS ACERCAMOS",
    liturgicalTime: "ORDINARIO",
    subcategory: "OFRENDAS",
    originalKey: "DO",
    favorite: false,
    lastOpened: 1791757836851,
    body: `DO          SOL\nJuntos nos acercamos a esta\nLAm       FA\nmesa para ofrecer,\nDO           REm            SOL\ntodo lo que tenemos es para ti.`
  },
  {
    id: "1792002888547",
    title: "Te Entrego",
    subcategory: "ADORACIÓN",
    liturgicalTime: "ORDINARIO",
    originalKey: "SOL",
    artist: "Joan Sanchez",
    favorite: false,
    lastOpened: 1792003003138,
    body: `G                    Cadd9\n    Haz lo que quieras conmigo\n   G                       D/F#\n    haz lo  que quieras en mi\n   C                       C/B3\n    hoy yo te ofrezco mi vida\n   Am                    D/F#\n    hoy yo me rindo ante Ti //\n\nCORO\n      G              D/F#               Em7\nTe entrego todo lo que soy todo lo que tengo\n              D/F#                  C\ntodo lo que quiero y todo lo que sueño\n  Am          D/F#\na Ti Señor Jesus   //`
  },
  {
    id: "1792003220928",
    title: "Venimos a Adorar",
    subcategory: "ADORACIÓN",
    liturgicalTime: "ORDINARIO",
    originalKey: "RE",
    artist: "JESED",
    favorite: false,
    lastOpened: 0,
    body: `RE             MIm  LA                 RE    SIm\n El Rey del Universo y Señor de la creación\n                   MIm  SOL            LA\n se viene a ser presente en medio de nosotros.\nRE             MIm  LA             RE    SIm\n El santo sacramento, Jesús Eucaristía\n               MIm    SOL                  RE\n rodeado de sus ángeles ya está presente aquí.`
  }
];

const ROOT_MAP = {
  'DO': 0, 'DO#': 1, 'REB': 1, 'RE': 2, 'RE#': 3, 'MIB': 3, 'MI': 4,
  'FA': 5, 'FA#': 6, 'SOLB': 6, 'SOL': 7, 'SOL#': 8, 'LAB': 8, 'LA': 9, 'LA#': 10, 'SIB': 10, 'SI': 11,
  'C': 0, 'C#': 1, 'DB': 1, 'D': 2, 'D#': 3, 'EB': 3, 'E': 4,
  'F': 5, 'F#': 6, 'GB': 6, 'G': 7, 'G#': 8, 'AB': 8, 'A': 9, 'A#': 10, 'BB': 10, 'B': 11
};
const SCALE_LATIN = ['DO', 'DO#', 'RE', 'RE#', 'MI', 'FA', 'FA#', 'SOL', 'SOL#', 'LA', 'LA#', 'SI'];
const SCALE_AMERICAN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export default function App() {
  const [songs, setSongs] = useState(() => {
    const saved = localStorage.getItem('cancionero_cloud_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.songs && Array.isArray(parsed.songs)) return parsed.songs;
      } catch (e) {}
    }
    return RAW_BACKUP;
  });

  const [activeTab, setActiveTab] = useState('inicio'); // 'inicio' | 'repertorios' | 'ajustes'
  const [selectedSongId, setSelectedSongId] = useState(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('TODOS');
  const [transpose, setTranspose] = useState(0);
  const [notation, setNotation] = useState('original');
  const [fontSize, setFontSize] = useState(16);

  // Nube / Firebase
  const [cloudUrl, setCloudUrl] = useState(() => localStorage.getItem('cancionero_cloud_url') || '');
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('Sincronizado');

  // Guardado local reactivo
  useEffect(() => {
    localStorage.setItem('cancionero_cloud_v1', JSON.stringify({
      app: 'cancionero',
      version: 1,
      exported: new Date().toISOString(),
      songs
    }));
  }, [songs]);

  // Canto seleccionado y normalización
  const selectedSong = useMemo(() => {
    return songs.find(s => s.id === selectedSongId) || null;
  }, [songs, selectedSongId]);

  // Último canto abierto para la barra flotante
  const lastSong = useMemo(() => {
    const list = [...songs].sort((a, b) => (b.lastOpened || 0) - (a.lastOpened || 0));
    return list[0] || songs[0];
  }, [songs]);

  // Recientes (ordenados por lastOpened)
  const recentSongs = useMemo(() => {
    return [...songs]
      .filter(s => (s.lastOpened || 0) > 0)
      .sort((a, b) => b.lastOpened - a.lastOpened)
      .slice(0, 4);
  }, [songs]);

  // Favoritas
  const favoriteSongs = useMemo(() => {
    return songs.filter(s => s.favorite === true);
  }, [songs]);

  // Catálogo completo filtrado
  const filteredCatalog = useMemo(() => {
    const q = search.toLowerCase();
    return songs.filter(s => {
      const matchesSearch = s.title.toLowerCase().includes(q) ||
        (s.body && s.body.toLowerCase().includes(q)) ||
        (s.artist && s.artist.toLowerCase().includes(q));
      const momentTag = (s.subcategory || s.category || '').toUpperCase();
      const seasonTag = (s.liturgicalTime || '').toUpperCase();
      const matchesFilter = activeFilter === 'TODOS' || momentTag === activeFilter || seasonTag === activeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [songs, search, activeFilter]);

  // Lista única de Tiempos Litúrgicos para la barra lateral
  const liturgicalTimes = useMemo(() => {
    const set = new Set();
    songs.forEach(s => {
      if (s.liturgicalTime) set.add(s.liturgicalTime.toUpperCase());
    });
    return Array.from(set);
  }, [songs]);

  const openSong = (id) => {
    setSelectedSongId(id);
    setTranspose(0);
    setSongs(prev => prev.map(s => s.id === id ? { ...s, lastOpened: Date.now() } : s));
  };

  const toggleFavorite = (id, e) => {
    e.stopPropagation();
    setSongs(prev => prev.map(s => s.id === id ? { ...s, favorite: !s.favorite } : s));
  };

  // Motor de transposición de acordes
  const isChordLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    const tokens = trimmed.replace(/[\/\-\(\)~]/g, ' ').split(/\s+/).filter(Boolean);
    if (!tokens.length) return false;
    const regex = /^(DO|RE|MI|FA|SOL|LA|SI|Do|Re|Mi|Fa|Sol|La|Si|[A-G])(#|b)?(m|im|maj|dim|aug|sus|add)?[0-9]*(\/(DO|RE|MI|FA|SOL|LA|SI|Do|Re|Mi|Fa|Sol|La|Si|[A-G])(#|b)?[0-9]*)?$/;
    const count = tokens.filter(t => regex.test(t)).length;
    return count / tokens.length >= 0.6;
  };

  const transposeToken = (token) => {
    const match = token.match(/^(DO|RE|MI|FA|SOL|LA|SI|Do|Re|Mi|Fa|Sol|La|Si|[A-G])(#|b)?(.*)$/);
    if (!match) return token;
    const rawRoot = (match[1] + (match[2] || '')).toUpperCase();
    let suffix = match[3] || '';
    const isLatin = match[1].length > 1;
    if (!(rawRoot in ROOT_MAP)) return token;

    const idx = (ROOT_MAP[rawRoot] + transpose + 120) % 12;
    let useLatin = isLatin;
    if (notation === 'latina') useLatin = true;
    if (notation === 'americana') useLatin = false;
    if (suffix.startsWith('im')) suffix = 'm' + suffix.slice(2);

    const newRoot = useLatin ? SCALE_LATIN[idx] : SCALE_AMERICAN[idx];
    return newRoot + suffix;
  };

  const processChordLine = (line) => {
    return line.replace(
      /(DO|RE|MI|FA|SOL|LA|SI|Do|Re|Mi|Fa|Sol|La|Si|[A-G])(#|b)?(m|im|maj|dim|aug|sus|add)?[0-9]*(\/(DO|RE|MI|FA|SOL|LA|SI|Do|Re|Mi|Fa|Sol|La|Si|[A-G])(#|b)?[0-9]*)?/g,
      (full) => full.includes('/') ? full.split('/').map(transposeToken).join('/') : transposeToken(full)
    );
  };

  // Subir / Descargar de Firebase
  const pushToFirebase = async () => {
    if (!cloudUrl.trim()) return alert('Ingresa la URL de tu base de datos Firebase.');
    setIsSyncing(true);
    try {
      const url = cloudUrl.trim().endsWith('.json') ? cloudUrl.trim() : `${cloudUrl.trim().replace(/\/$/, '')}/cancionero.json`;
      localStorage.setItem('cancionero_cloud_url', url);
      setCloudUrl(url);

      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: 'cancionero', version: 1, exported: new Date().toISOString(), songs })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSyncStatus('Sincronizado');
      alert('¡Repertorio subido a Firebase con éxito!');
      setIsCloudModalOpen(false);
    } catch (err) {
      alert('Error al conectar con Firebase: revisa la URL.');
    } finally {
      setIsSyncing(false);
    }
  };

  const pullFromFirebase = async () => {
    if (!cloudUrl.trim()) return alert('Ingresa la URL de Firebase.');
    setIsSyncing(true);
    try {
      const url = cloudUrl.trim().endsWith('.json') ? cloudUrl.trim() : `${cloudUrl.trim().replace(/\/$/, '')}/cancionero.json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && Array.isArray(data.songs)) {
        setSongs(data.songs);
        alert(`¡${data.songs.length} canciones descargadas de Firebase!`);
        setIsCloudModalOpen(false);
      } else {
        alert('La base de datos aún no tiene cantos guardados.');
      }
    } catch (err) {
      alert('Error al descargar desde Firebase.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Exportar archivo JSON para Google Drive
  const exportToDriveBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      app: 'cancionero',
      version: 1,
      exported: new Date().toISOString(),
      songs
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `cancionero-respaldo-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="flex min-h-screen relative" style={{ backgroundColor: '#12100E' }}>
      
      {/* MARCA DE AGUA: Clave de Sol centrada de fondo idéntica a tu captura */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
        <svg 
          viewBox="0 0 100 160" 
          className="w-[620px] h-[620px] text-stone-800/25 select-none"
          fill="currentColor"
        >
          <path d="M48 20 C42 20 38 25 38 32 C38 42 46 48 48 55 C50 62 46 68 40 70 C34 72 26 68 26 60 C26 50 34 45 36 40 C37 37 36 35 34 35 C31 35 20 42 20 58 C20 74 32 82 44 82 C46 82 48 81 50 80 L44 125 C40 126 36 128 34 132 C30 138 32 148 40 150 C48 152 56 144 54 135 C53 128 48 124 45 124 L52 75 C58 72 64 66 64 56 C64 42 54 30 48 20 Z" />
        </svg>
      </div>

      {/* SIDEBAR IZQUIERDO */}
      <aside className="w-64 border-r border-stone-800/80 p-5 flex flex-col justify-between z-10 shrink-0" style={{ backgroundColor: '#181512' }}>
        <div className="space-y-6">
          {/* Logo y Nombre */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-100 serif-title">Mi Cancionero</h1>
            <p className="text-xs text-stone-400 mt-0.5">Atril Litúrgico Digital</p>
          </div>

          {/* Menú Principal */}
          <nav className="space-y-1.5">
            <button
              onClick={() => { setActiveTab('inicio'); setSelectedSongId(null); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all ${
                activeTab === 'inicio' && !selectedSongId
                  ? 'bg-[#DF8A65] text-[#12100E] shadow-sm'
                  : 'text-stone-300 hover:bg-stone-800/60'
              }`}
            >
              <Music className="w-4 h-4" />
              <span>Inicio</span>
            </button>

            <button
              onClick={() => { setActiveTab('repertorios'); setSelectedSongId(null); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all ${
                activeTab === 'repertorios'
                  ? 'bg-[#DF8A65] text-[#12100E]'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Repertorios</span>
            </button>

            <button
              onClick={() => setIsCloudModalOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold text-stone-400 hover:text-stone-200 hover:bg-stone-800/60 transition-all"
            >
              <Cloud className="w-4 h-4" />
              <span>Ajustes y Drive</span>
            </button>
          </nav>

          {/* TIEMPOS LITÚRGICOS */}
          <div className="pt-2">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-2 px-1">
              TIEMPOS LITÚRGICOS
            </span>
            <div className="space-y-1">
              {liturgicalTimes.map(time => (
                <button
                  key={time}
                  onClick={() => { setActiveFilter(time); setSelectedSongId(null); }}
                  className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                    activeFilter === time ? 'text-[#DF8A65] bg-[#DF8A65]/10 font-bold' : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Badge inferior de sincronización */}
        <div 
          onClick={() => setIsCloudModalOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-stone-900/90 border border-stone-800 text-stone-300 cursor-pointer hover:border-stone-700 transition-colors"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Drive: {cloudUrl ? 'Sincronizado' : 'Conectar'}</span>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <main className="flex-1 p-8 z-10 overflow-y-auto max-h-screen pb-28">
        
        {/* VISTA A: DETALLE DEL CANTO (Si se abrió una canción) */}
        {selectedSong ? (
          <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
            <button
              onClick={() => setSelectedSongId(null)}
              className="flex items-center gap-2 text-xs font-bold text-stone-400 hover:text-stone-200 mb-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Volver al catálogo
            </button>

            <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-stone-800">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#DF8A65]/20 text-[#DF8A65]">
                    {selectedSong.subcategory || selectedSong.category}
                  </span>
                  {selectedSong.liturgicalTime && (
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-stone-800 text-stone-300">
                      {selectedSong.liturgicalTime}
                    </span>
                  )}
                </div>
                <h2 className="text-3xl font-extrabold text-stone-100 serif-title">{selectedSong.title}</h2>
                <p className="text-xs text-stone-400 mt-1">
                  Tono Original: {selectedSong.originalKey || 'DO'} {selectedSong.artist ? `• ${selectedSong.artist}` : ''}
                </p>
              </div>

              {/* Controles de Tono */}
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-xl bg-stone-900 border border-stone-800 text-xs font-bold tabular-nums">
                  <button onClick={() => setTranspose(t => t - 1)} className="px-3 py-1.5 hover:bg-stone-800">- ½</button>
                  <span className="px-3 py-1.5 border-x border-stone-800 min-w-[85px] text-center text-[#DF8A65]">
                    {transpose === 0 ? 'Orig.' : `${transpose > 0 ? '+' : ''}${transpose} semit.`}
                  </span>
                  <button onClick={() => setTranspose(t => t + 1)} className="px-3 py-1.5 hover:bg-stone-800">+ ½</button>
                </div>

                <button
                  onClick={() => {
                    const modes = ['original', 'latina', 'americana'];
                    setNotation(modes[(modes.indexOf(notation) + 1) % modes.length]);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 text-xs font-bold text-stone-300"
                >
                  Notación: {notation === 'original' ? 'Orig.' : notation === 'latina' ? 'DO-RE' : 'C-D-E'}
                </button>
              </div>
            </div>

            {/* Letra y Acordes */}
            <div className="chord-sheet text-base select-text overflow-x-auto leading-relaxed pt-2" style={{ fontSize: `${fontSize}px` }}>
              {selectedSong.body.split('\n').map((line, i) => {
                const chord = isChordLine(line);
                return (
                  <div key={i} style={{ color: chord ? '#F59E0B' : '#E7E5E4', fontWeight: chord ? 700 : 400 }}>
                    {chord ? processChordLine(line) : (line || ' ')}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* VISTA B: CATÁLOGO LITÚRGICO (Tu pantalla de la captura corregida) */
          <div className="max-w-5xl mx-auto space-y-8">
            
            {/* Header del Catálogo */}
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-extrabold text-stone-100 serif-title">Catálogo Litúrgico</h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-900 border border-stone-800 text-xs text-stone-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{syncStatus}</span>
                </div>
                <button 
                  onClick={() => alert('Cancionero Digital: Busca cantos, pulsa para ver la letra, cambia de tono y sincroniza en la nube.')}
                  className="px-4 py-1.5 rounded-xl bg-stone-900/80 border border-stone-800 text-xs text-stone-300 hover:bg-stone-800 transition-colors font-semibold"
                >
                  Guía rápida
                </button>
              </div>
            </div>

            {/* Buscador + Filtros */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-4 top-3.5 text-stone-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar canto por título, letra, acorde o autor..."
                  className="w-full pl-11 pr-4 py-3 rounded-2xl bg-stone-900/90 border border-stone-800 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-[#DF8A65]/50 transition-colors"
                />
              </div>
              <button 
                onClick={() => setActiveFilter(activeFilter === 'TODOS' ? 'COMUNIÓN' : 'TODOS')}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-stone-900/90 border border-stone-800 text-sm font-semibold text-stone-300 hover:bg-stone-800 transition-colors"
              >
                <SlidersHorizontal className="w-4 h-4 text-stone-400" />
                <span>Filtros {activeFilter !== 'TODOS' ? `(${activeFilter})` : ''}</span>
              </button>
            </div>

            {/* SECCIÓN 1: RECIENTES */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-stone-200 serif-title">Recientes</h3>
                <span className="text-xs text-stone-500 font-medium">Acceso rápido de atril</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {recentSongs.map(song => (
                  <div
                    key={song.id}
                    onClick={() => openSong(song.id)}
                    className="p-4 rounded-2xl bg-stone-900/70 border border-stone-800/80 hover:border-[#DF8A65]/50 cursor-pointer transition-all hover:scale-101"
                  >
                    <span className="text-[10px] font-bold text-[#DF8A65] uppercase tracking-wider block mb-1">
                      {song.subcategory || song.category}
                    </span>
                    <h4 className="font-bold text-stone-200 text-sm truncate">{song.title}</h4>
                    <p className="text-[11px] text-stone-500 mt-1">Tono: {song.originalKey || 'DO'}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* SECCIÓN 2: FAVORITAS */}
            {favoriteSongs.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-lg font-bold text-stone-200 serif-title">Favoritas</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {favoriteSongs.map(song => (
                    <div
                      key={song.id}
                      onClick={() => openSong(song.id)}
                      className="p-4 rounded-2xl bg-stone-900/70 border border-stone-800/80 hover:border-[#DF8A65]/50 cursor-pointer transition-all flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-[#DF8A65] uppercase block">{song.subcategory || song.category}</span>
                        <h4 className="font-bold text-stone-200 text-sm truncate">{song.title}</h4>
                      </div>
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400 shrink-0 ml-2" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* SECCIÓN 3: CATÁLOGO DE CANTOS */}
            <section className="space-y-3">
              <h3 className="text-lg font-bold text-stone-200 serif-title">Catálogo de Cantos ({filteredCatalog.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredCatalog.map(song => (
                  <div
                    key={song.id}
                    onClick={() => openSong(song.id)}
                    className="p-4 rounded-2xl bg-stone-900/60 border border-stone-800/80 hover:border-stone-700 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div className="min-w-0 pr-2">
                      <h4 className="font-bold text-stone-200 text-sm truncate group-hover:text-[#DF8A65] transition-colors">
                        {song.title}
                      </h4>
                      <p className="text-xs text-stone-400 mt-1 flex items-center gap-2">
                        <span className="font-semibold text-stone-300">{song.subcategory || song.category}</span>
                        {song.liturgicalTime && <span>• {song.liturgicalTime}</span>}
                        {song.originalKey && <span>• Tono {song.originalKey}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => toggleFavorite(song.id, e)}
                        className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-500 hover:text-amber-400"
                      >
                        <Star className={`w-4 h-4 ${song.favorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>
                      <ChevronRight className="w-4 h-4 text-stone-600 group-hover:text-stone-300 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </section>

          </div>
        )}
      </main>

      {/* BARRA FLOTANTE INFERIOR: CONTINUAR DONDE QUEDASTE */}
      {lastSong && !selectedSongId && (
        <div className="fixed bottom-5 left-72 z-30">
          <div className="flex items-center gap-4 px-5 py-3 rounded-2xl bg-[#1C1815]/95 border border-stone-800/90 shadow-2xl backdrop-blur-md">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 block">
                CONTINUAR DONDE QUEDASTE
              </span>
              <span className="text-sm font-bold text-stone-100">{lastSong.title}</span>
            </div>
            <button
              onClick={() => openSong(lastSong.id)}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-[#DF8A65] text-[#12100E] hover:opacity-90 transition-opacity"
            >
              Abrir
            </button>
          </div>
        </div>
      )}

      {/* BOTÓN FLOTANTE (FAB) PARA AGREGAR NUEVO CANTO */}
      <button
        onClick={() => {
          const t = prompt('Título del nuevo canto:');
          if (!t) return;
          const body = prompt('Pega los acordes y la letra:');
          if (!body) return;
          const newSong = {
            id: Date.now().toString(),
            title: t.trim(),
            subcategory: 'ADORACIÓN',
            liturgicalTime: 'ORDINARIO',
            originalKey: 'DO',
            favorite: false,
            lastOpened: Date.now(),
            body
          };
          setSongs([newSong, ...songs]);
          openSong(newSong.id);
        }}
        className="fixed bottom-6 right-6 z-30 w-12 h-12 rounded-2xl bg-[#DF8A65] text-[#12100E] flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all"
        title="Nuevo Canto"
      >
        <PlusCircle className="w-6 h-6" />
      </button>

      {/* MODAL: AJUSTES, FIREBASE Y GOOGLE DRIVE */}
      {isCloudModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl p-6 space-y-5 bg-[#1C1815] border border-stone-800 text-stone-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-[#DF8A65]" />
                <h3 className="font-bold text-lg serif-title">Almacenamiento en Línea y Drive</h3>
              </div>
              <button onClick={() => setIsCloudModalOpen(false)}><X className="w-5 h-5 text-stone-400" /></button>
            </div>

            {/* Opción 1: Conexión en Tiempo Real (Firebase) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase text-stone-400">
                1. URL de Base de Datos Firebase
              </label>
              <input
                type="url"
                value={cloudUrl}
                onChange={(e) => setCloudUrl(e.target.value)}
                placeholder="https://tu-proyecto.firebaseio.com/cancionero.json"
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-900 border border-stone-800 text-sm text-stone-100 focus:outline-none focus:border-[#DF8A65]"
              />
              <div className="flex gap-2 pt-1">
                <button
                  onClick={pushToFirebase}
                  disabled={isSyncing}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#DF8A65] text-[#12100E] hover:opacity-90"
                >
                  {isSyncing ? 'Sincronizando...' : 'Subir a Firebase'}
                </button>
                <button
                  onClick={pullFromFirebase}
                  disabled={isSyncing}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-800 hover:bg-stone-700 text-stone-200"
                >
                  Descargar de Firebase
                </button>
              </div>
            </div>

            {/* Opción 2: Respaldo en Google Drive */}
            <div className="pt-4 border-t border-stone-800 space-y-2">
              <label className="block text-xs font-bold uppercase text-stone-400">
                2. Respaldo para Google Drive
              </label>
              <p className="text-xs text-stone-400">
                Descarga el archivo maestro `.json` con todas tus canciones para guardarlo en tu Google Drive personal o compartirlo con el ministerio.
              </p>
              <button
                onClick={exportToDriveBackup}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-stone-800 hover:bg-stone-700 text-stone-200"
              >
                <Download className="w-4 h-4" />
                <span>Descargar archivo de respaldo JSON</span>
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setIsCloudModalOpen(false)} className="text-xs text-stone-400 hover:text-stone-200">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}