'use client';
import { useCallback, useEffect, useState } from 'react';
import { getCurrentOrganization } from '../../lib/admin/organization-context';
import type { Membership, MembershipStatus, OrganizationRole } from '../../lib/admin/types';
import { UserInput, usersApi } from '../../lib/admin/users-api';
import { roleLabels, UserForm } from './user-form';
import { ConfigurationState, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from './ui';

export function UsersPage() {
  const { organizationId, isConfigured } = getCurrentOrganization();
  const [users, setUsers] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(isConfigured);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<OrganizationRole | ''>('');
  const [status, setStatus] = useState<MembershipStatus | ''>('');
  const [editingRole, setEditingRole] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true); setError('');
    try { setUsers(await usersApi.list(organizationId, { search: search || undefined, role: role || undefined, status: status || undefined })); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Error inesperado.'); }
    finally { setLoading(false); }
  }, [organizationId, search, role, status]);

  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer); }, [load]);

  async function submit(input: UserInput) {
    if (!organizationId) return;
    setSaving(true); setFormError('');
    try { await usersApi.create(organizationId, input); setOpen(false); setSuccess('Usuario agregado con estado invitado.'); await load(); }
    catch (caught) { setFormError(caught instanceof Error ? caught.message : 'No se pudo agregar el usuario.'); }
    finally { setSaving(false); }
  }
  async function update(member: Membership, input: { role?: OrganizationRole; status?: MembershipStatus }) {
    if (!organizationId) return;
    try { await usersApi.update(organizationId, member.userId, input); setEditingRole(null); setSuccess('Membresía actualizada correctamente.'); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo actualizar la membresía.'); }
  }

  return <main className="page admin-page"><PageHeader title="Usuarios" description="Gestiona las membresías y roles de tu organización." action={<button className="button" disabled={!isConfigured} onClick={() => { setFormError(''); setOpen(true); }}>Nuevo usuario</button>}/>{!isConfigured && <ConfigurationState/>}{success && <div className="alert success" role="status">{success}</div>}{isConfigured && <><div className="filters filters-three"><input aria-label="Buscar usuarios" placeholder="Buscar por nombre o correo" value={search} onChange={(event) => setSearch(event.target.value)}/><select aria-label="Filtrar por rol" value={role} onChange={(event) => setRole(event.target.value as OrganizationRole | '')}><option value="">Todos los roles</option>{Object.entries(roleLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><select aria-label="Filtrar por estado" value={status} onChange={(event) => setStatus(event.target.value as MembershipStatus | '')}><option value="">Todos los estados</option><option value="invited">Invitado</option><option value="active">Activo</option><option value="suspended">Suspendido</option></select></div><section className="card data-card">{loading ? <LoadingState/> : error ? <ErrorState message={error} retry={() => void load()}/> : users.length === 0 ? <EmptyState title="No hay usuarios" action={<button className="button" onClick={() => setOpen(true)}>Agregar usuario</button>}>Invita al primer colaborador de la organización.</EmptyState> : <><div className="table-wrap"><table className="admin-table"><thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Incorporación</th><th>Último acceso</th><th className="actions-column">Acciones</th></tr></thead><tbody>{users.map((member) => <tr key={member.membershipId}><td><div className="primary-cell"><strong>{member.firstName} {member.lastName}</strong><span>{member.email}</span></div></td><td>{editingRole === member.membershipId ? <select autoFocus value={member.role} aria-label={`Rol de ${member.email}`} onChange={(event) => void update(member, { role: event.target.value as OrganizationRole })} onBlur={() => setEditingRole(null)}>{Object.entries(roleLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select> : roleLabels[member.role]}</td><td><StatusBadge status={member.status}/></td><td>{member.joinedAt ? new Intl.DateTimeFormat('es-CL').format(new Date(member.joinedAt)) : 'Pendiente'}</td><td>{member.lastLoginAt ? new Intl.DateTimeFormat('es-CL').format(new Date(member.lastLoginAt)) : 'Sin acceso'}</td><td><div className="row-actions"><button className="small-action secondary-action" onClick={() => setEditingRole(member.membershipId)}>Editar rol</button><button className="small-action" onClick={() => void update(member, { status: member.status === 'suspended' ? 'active' : 'suspended' })}>{member.status === 'suspended' ? 'Activar' : 'Suspender'}</button></div></td></tr>)}</tbody></table></div><footer className="table-footer">{users.length} {users.length === 1 ? 'usuario' : 'usuarios'}</footer></>}</section></>}{open && <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}><UserForm saving={saving} backendError={formError} onCancel={() => setOpen(false)} onSubmit={submit}/></div>}</main>;
}
