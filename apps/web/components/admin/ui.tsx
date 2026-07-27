import type { ReactNode } from 'react';
export function PageHeader({title,description,action}:{title:string;description:string;action?:ReactNode}) { return <div className="page-header"><div><h1>{title}</h1><p className="description">{description}</p></div>{action}</div> }
export function EmptyState({title,children,action}:{title:string;children:ReactNode;action?:ReactNode}) { return <div className="state"><div className="state-icon">＋</div><h2>{title}</h2><p>{children}</p>{action}</div> }
export function LoadingState(){return <div className="state" role="status"><div className="spinner"/><p>Cargando información…</p></div>}
export function ErrorState({message,retry}:{message:string;retry:()=>void}){return <div className="state" role="alert"><div className="state-icon">!</div><h2>No pudimos cargar la información</h2><p>{message}</p><button className="button button-secondary" onClick={retry}>Reintentar</button></div>}
export function StatusBadge({status}:{status:string}) { const labels:Record<string,string>={active:'Activo',inactive:'Inactivo',invited:'Invitado',suspended:'Suspendido'}; return <span className={`badge badge-${status}`}>{labels[status]??status}</span> }
