import { LoaderCircle } from "lucide-react";
export function LoadingState({ label = "Cargando…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-500"
      role="status"
    >
      <LoaderCircle className="size-5 animate-spin text-emerald-700" />
      <span>{label}</span>
    </div>
  );
}
