"use client";

import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { use } from "react";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { companyUsersService } from "@/services/company-users.service";

export default function CompanyUsersPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = use(params);
  const users = useQuery({
    queryKey: ["companies", companyId, "users"],
    queryFn: () => companyUsersService.list(companyId),
  });

  if (users.isPending) {
    return <LoadingState label="Cargando usuarios de la empresa…" />;
  }
  if (users.isError) {
    return (
      <main className="p-8">
        <ErrorState
          title="No pudimos cargar los usuarios"
          description="Verifica tu acceso a la empresa e intenta nuevamente."
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-5 sm:p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Usuarios</h1>
      <p className="mt-1 text-slate-500">
        Miembros asociados a la organización de esta empresa.
      </p>
      <section className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {users.data.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="mx-auto size-10 text-slate-400" />
            <p className="mt-3 text-slate-600">No hay miembros activos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Rol</th>
                </tr>
              </thead>
              <tbody>
                {users.data.map((user) => (
                  <tr key={user.id}>
                    <td className="font-medium">
                      {user.firstName} {user.lastName}
                    </td>
                    <td>{user.email}</td>
                    <td className="capitalize">{user.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
