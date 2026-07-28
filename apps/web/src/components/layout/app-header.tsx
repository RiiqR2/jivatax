import { Bell, CircleUserRound, Menu } from "lucide-react";
export function AppHeader() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-lg p-2 text-slate-500 lg:hidden"
          aria-label="Abrir navegación"
        >
          <Menu className="size-5" />
        </button>
        <div>
          <p className="text-sm font-medium text-slate-900">
            Panel administrativo
          </p>
          <p className="hidden text-xs text-slate-500 sm:block">
            Organiza la operación tributaria de tu equipo
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-lg p-2 text-slate-500"
          aria-label="Notificaciones"
        >
          <Bell className="size-5" />
        </button>
        <span className="h-6 w-px bg-slate-200" />
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg p-2 text-sm font-medium text-slate-700"
        >
          <CircleUserRound className="size-5" />
          <span className="hidden sm:inline">Administración</span>
        </button>
      </div>
    </header>
  );
}
