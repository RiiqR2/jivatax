import type { ReactNode } from 'react';

export function PageHeader({ title, description, action }: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return <div className="page-header"><div><h1>{title}</h1><p className="description">{description}</p></div>{action}</div>;
}

export function EmptyState({ title, children, action }: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return <div className="state compact-state"><div className="state-icon">＋</div><h2>{title}</h2><p>{children}</p>{action}</div>;
}

export function ConfigurationState() {
  return <div className="configuration-state" role="status"><strong>Configura la organización actual</strong><p>Agrega <code>NEXT_PUBLIC_ORGANIZATION_ID</code> a tu archivo <code>.env</code> y reinicia el servidor web. Esta configuración es temporal hasta implementar autenticación y selección de organización.</p></div>;
}

export function LoadingState() {
  return <div className="state compact-state" role="status"><div className="spinner"/><p>Cargando información…</p></div>;
}

export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <div className="state compact-state" role="alert"><div className="state-icon">!</div><h2>No pudimos cargar la información</h2><p>{message}</p><button className="button button-secondary" onClick={retry}>Reintentar</button></div>;
}

export function StatusBadge({ status, context = 'membership' }: { status: string; context?: 'company' | 'membership' }) {
  const labels: Record<string, string> = {
    active: context === 'company' ? 'Activa' : 'Activo',
    inactive: 'Inactiva',
    invited: 'Invitado',
    suspended: 'Suspendido',
  };
  return <span className={`badge badge-${status}`}>{labels[status] ?? status}</span>;
}
