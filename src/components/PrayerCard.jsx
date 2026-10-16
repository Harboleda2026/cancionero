import { Heart, MessageCircle, Share2, Sparkles } from 'lucide-react';

export default function PrayerCard({ prayer, onTogglePray }) {
  return (
    <article className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
      
      {/* Encabezado: Autor y Categoría */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <img
            src={prayer.authorAvatar}
            alt={prayer.author}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100"
          />
          <div>
            <h4 className="font-bold text-slate-900 text-sm">{prayer.author}</h4>
            <span className="text-xs text-slate-500">{prayer.date}</span>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
          {prayer.category}
        </span>
      </div>

      {/* Contenido */}
      <h3 className="text-lg font-bold text-slate-900 mb-2 leading-snug">
        {prayer.title}
      </h3>
      <p className="text-slate-600 text-sm leading-relaxed mb-4">
        {prayer.description}
      </p>

      {/* Testimonio si existe */}
      {prayer.testimony && (
        <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200/60 flex items-start gap-2.5 text-xs text-amber-900">
          <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-semibold mb-0.5 text-amber-950">Testimonio de respuesta:</strong>
            {prayer.testimony}
          </div>
        </div>
      )}

      {/* Acciones e Interacción */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        
        {/* Botón Oremos juntos */}
        <button
          onClick={() => onTogglePray(prayer.id)}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all ${
            prayer.isPraying
              ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
          }`}
        >
          <Heart className={`w-4 h-4 ${prayer.isPraying ? 'fill-rose-500 text-rose-500' : ''}`} />
          <span>{prayer.isPraying ? 'Orando contigo' : 'Orar'}</span>
          <span className="ml-1 text-xs opacity-80 bg-white/60 px-1.5 py-0.5 rounded-md">
            {prayer.prayerCount}
          </span>
        </button>

        {/* Acciones secundarias */}
        <div className="flex items-center gap-1">
          <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
            <MessageCircle className="w-4 h-4" />
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
            <Share2 className="w-4 h-4" />
          </button>
        </div>

      </div>
    </article>
  );
}