'use client';
import { FormEvent, useState } from 'react';
import type { UserInput } from '../../lib/admin/users-api';
import type { OrganizationRole } from '../../lib/admin/types';

export const roleLabels: Record<OrganizationRole, string> = { owner: 'Propietario', admin: 'Administrador', accountant: 'Contador', auditor: 'Auditor', viewer: 'Consulta' };

export function UserForm({ saving, backendError, onCancel, onSubmit }: { saving: boolean; backendError: string; onCancel: () => void; onSubmit: (input: UserInput) => Promise<void> }) {
  const [form, setForm] = useState<UserInput>({ email: '', firstName: '', lastName: '', role: 'accountant' });
  const [validation, setValidation] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); if (!form.firstName.trim() || !form.lastName.trim() || !/^\S+@\S+\.\S+$/.test(form.email)) return setValidation('Completa nombre, apellido y un correo válido.'); setValidation(''); await onSubmit(form); }
  return <form className="modal" onSubmit={submit}><h2>Nuevo usuario</h2><p className="modal-intro">El usuario será agregado a la organización con estado invitado. La autenticación se implementará en una etapa posterior.</p>{(validation || backendError) && <div className="alert" role="alert">{validation || backendError}</div>}<label className="field">Nombre<input maxLength={100} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })}/></label><label className="field">Apellido<input maxLength={100} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })}/></label><label className="field">Correo<input type="email" maxLength={255} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}/></label><label className="field">Rol<select required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as OrganizationRole })}>{Object.entries(roleLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><div className="actions"><button type="button" className="button button-secondary" onClick={onCancel}>Cancelar</button><button className="button" disabled={saving}>{saving ? 'Agregando…' : 'Agregar usuario'}</button></div></form>;
}
