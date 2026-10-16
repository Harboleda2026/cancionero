import { HeartHandshake, Users, BookOpen, User, PlusCircle } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onOpenNewPrayer }) {
  const navItems = [
    { id: 'prayers', label: 'Oraciones', icon: HeartHandshake },
    { id: 'directory', label: 'Directorio', icon: Users },
    { id: 'devotional', label: 'Devocional', icon: BookOpen },
    { id: 'profile', label: 'Perfil', icon: User },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
        <div 
          onClick={() => setActiveTab('prayers')}
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
            <HeartHandshake className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-slate-900 block leading-none">Comunión</span>
            <span className="text-xs text-blue-600 font-medium">Unidos en oración</span>
          </div>
        </div>

        <nav className="hidden sm:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  isActive
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <button
          onClick={onOpenNewPrayer}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-md shadow-blue-500/20 transition-all hover:scale-102 active:scale-98"
        >
          <PlusCircle className="w-4 h-4" />
          <span className="hidden xs:inline">Pedir Oración</span>
        </button>
      </div>
    </header>
  );
}