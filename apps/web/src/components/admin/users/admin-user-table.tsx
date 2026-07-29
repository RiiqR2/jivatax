import Link from "next/link";
import type { AdminUser } from "@/types/admin-user.types";

interface AdminUserTableProps {
  users: AdminUser[];
}

export function AdminUserTable({ users }: AdminUserTableProps) {
  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <h2 className="font-semibold text-slate-900">No hay usuarios</h2>
        <p className="mt-1 text-sm text-slate-500">
          Ajusta los filtros o crea el primer usuario.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Correo</th>
            <th>Rol de plataforma</th>
            <th>Estado</th>
            <th>Organizaciones</th>
            <th>Último acceso</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td className="font-medium text-slate-900">
                {user.firstName} {user.lastName}
              </td>
              <td>{user.email}</td>
              <td>
                <span className="badge">
                  {user.platformRole === "metauser" ? "Metausuario" : "Usuario"}
                </span>
              </td>
              <td>{user.status}</td>
              <td>
                {user.organizations.length > 0
                  ? user.organizations
                      .map((organization) => organization.name)
                      .join(", ")
                  : "Sin membresías"}
              </td>
              <td>
                {user.lastLoginAt
                  ? new Intl.DateTimeFormat("es-CL").format(
                      new Date(user.lastLoginAt),
                    )
                  : "Nunca"}
              </td>
              <td>
                <Link
                  className="font-medium text-emerald-700 hover:underline"
                  href={`/admin/users/${user.id}/edit`}
                >
                  Ver y editar
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
