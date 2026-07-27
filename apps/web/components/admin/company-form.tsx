'use client';
import { FormEvent, useState } from 'react';
import type { CompanyInput } from '../../lib/admin/companies-api';
import type { Company } from '../../lib/admin/types';

export function CompanyForm({ company, saving, backendError, onCancel, onSubmit }: {
  company?: Company | null;
  saving: boolean;
  backendError: string;
  onCancel: () => void;
  onSubmit: (input: CompanyInput) => Promise<void>;
}) {
  const [form, setForm] = useState<CompanyInput>({ rut: company?.rut ?? '', legalName: company?.legalName ?? '', tradeName: company?.tradeName ?? '', businessActivity: company?.businessActivity ?? '' });
  const [validation, setValidation] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.rut.trim() || !form.legalName.trim()) return setValidation('El RUT y la razón social son obligatorios.');
    if (!/^[0-9.]+-[0-9kK]$/.test(form.rut.trim())) return setValidation('Ingresa un RUT con formato 76123456-7.');
    setValidation('');
    await onSubmit({ ...form, rut: form.rut.replace(/[.\s]/g, '') });
  }
  return <form className="modal" onSubmit={submit}><h2>{company ? 'Editar empresa' : 'Nueva empresa'}</h2><p className="modal-intro">Ingresa los datos tributarios de la empresa.</p>{(validation || backendError) && <div className="alert" role="alert">{validation || backendError}</div>}<label className="field">RUT<input disabled={!!company} maxLength={14} value={form.rut} onChange={(e) => setForm({ ...form, rut: e.target.value })} placeholder="76123456-7"/></label><label className="field">Razón social<input maxLength={255} value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })}/></label><label className="field">Nombre de fantasía <small>(opcional)</small><input maxLength={255} value={form.tradeName} onChange={(e) => setForm({ ...form, tradeName: e.target.value })}/></label><label className="field">Giro <small>(opcional)</small><input maxLength={255} value={form.businessActivity} onChange={(e) => setForm({ ...form, businessActivity: e.target.value })}/></label><div className="actions"><button type="button" className="button button-secondary" onClick={onCancel}>Cancelar</button><button className="button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar empresa'}</button></div></form>;
}
