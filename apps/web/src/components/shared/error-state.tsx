import { CircleAlert } from "lucide-react";
interface ErrorStateProps {
  title?: string;
  description: string;
  onRetry?: () => void;
}
export function ErrorState({
  title = "Algo salió mal",
  description,
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      className="rounded-xl border border-red-200 bg-red-50 p-6 text-center"
      role="alert"
    >
      <CircleAlert className="mx-auto size-6 text-red-700" />
      <h2 className="mt-3 font-semibold text-red-950">{title}</h2>
      <p className="mt-1 text-sm text-red-700">{description}</p>
      {onRetry && (
        <button
          className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-800"
          onClick={onRetry}
          type="button"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
