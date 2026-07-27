'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { companiesApi, CompanyInput } from '../../lib/admin/companies-api';
import { getCurrentOrganization } from '../../lib/admin/organization-context';
import type { Company, CompanyStatus } from '../../lib/admin/types';
import { CompanyForm } from './company-form';
import { ConfigurationState, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from './ui';

export function CompaniesPage({ cards = false }: { cards?: boolean }) {
  const { organizationId, isConfigured } = getCurrentOrganization();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(isConfigured);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CompanyStatus | ''>('');
  const [formCompany, setFormCompany] = useState<Company | null | undefined>();
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError('');
    try { setCompanies(await companiesApi.list(organizationId, { search: search || undefined, status: status || undefined })); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Error inesperado.'); }
    finally { setLoading(false); }
  }, [organizationId, search, status]);

  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer); }, [load]);

  function openForm(company: Company | null) { if (!organizationId) return; setFormError(''); setFormCompany(company); }
  async function submit(input: CompanyInput) {
    if (!organizationId) return;
    setSaving(true); setFormError('');
    try {
      if (formCompany) await companiesApi.update(organizationId, formCompany.id, { legalName: input.legalName, tradeName: input.tradeName, businessActivity: input.businessActivity });
      else await companiesApi.create(organizationId, input);
      setFormCompany(undefined); setSuccess(formCompany ? 'Empresa actualizada correctamente.' : 'Empresa creada correctamente.'); await load();
    } catch (caught) { setFormError(caught instanceof Error ? caught.message : 'No se pudo guardar la empresa.'); }
    finally { setSaving(false); }
  }

  return <main className="page admin-page"><PageHeader title={cards ? 'Selecciona una empresa' : 'Empresas'} description={cards ? 'Elige una empresa para administrar sus archivos contables.' : 'Administra las empresas de tu organización.'} action={<button className="button" disabled={!isConfigured} onClick={() => openForm(null)}>Nueva empresa</button>}/>{!isConfigured && <ConfigurationState/>}{success && <div className="alert success" role="status">{success}</div>}{isConfigured && !cards && <div className="filters"><input aria-label="Buscar empresas" placeholder="Buscar por RUT, razón social o fantasía" value={search} onChange={(event) => setSearch(event.target.value)}/><select aria-label="Filtrar por estado" value={status} onChange={(event) => setStatus(event.target.value as CompanyStatus | '')}><option value="">Todos los estados</option><option value="active">Activas</option><option value="inactive">Inactivas</option></select></div>}{isConfigured && <section className="card data-card">{loading ? <LoadingState/> : error ? <ErrorState message={error} retry={() => void load()}/> : companies.length === 0 ? <EmptyState title="Aún no hay empresas" action={<button className="button" onClick={() => openForm(null)}>Crear primera empresa</button>}>Crea una empresa para comenzar a cargar su balance y libro diario.</EmptyState> : cards ? <div className="company-grid">{companies.map((company) => <article className="company-card" key={company.id}><StatusBadge status={company.status} context="company"/><h2>{company.legalName}</h2><p>{company.tradeName || 'Sin nombre de fantasía'}</p><strong>{company.rut}</strong><Link className="button" href={`/companies/${company.id}/files`}>Administrar archivos</Link></article>)}</div> : <><div className="table-wrap"><table className="admin-table"><thead><tr><th>Empresa</th><th>RUT</th><th>Giro</th><th>Estado</th><th>Creada</th><th className="actions-column">Acciones</th></tr></thead><tbody>{companies.map((company) => <tr key={company.id}><td><div className="primary-cell"><strong>{company.legalName}</strong>{company.tradeName && <span>{company.tradeName}</span>}</div></td><td>{company.rut}</td><td className="truncate-cell">{company.businessActivity || '—'}</td><td><StatusBadge status={company.status} context="company"/></td><td>{new Intl.DateTimeFormat('es-CL').format(new Date(company.createdAt))}</td><td><div className="row-actions"><Link className="small-action" href={`/companies/${company.id}/files`}>Archivos</Link><button className="small-action secondary-action" onClick={() => openForm(company)}>Editar</button></div></td></tr>)}</tbody></table></div><footer className="table-footer">{companies.length} {companies.length === 1 ? 'empresa' : 'empresas'}</footer></>}</section>}{formCompany !== undefined && <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && setFormCompany(undefined)}><CompanyForm key={formCompany?.id ?? 'new'} company={formCompany} saving={saving} backendError={formError} onCancel={() => setFormCompany(undefined)} onSubmit={submit}/></div>}</main>;
}
