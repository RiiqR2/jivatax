"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useState } from "react";
import { AdminUserTable } from "@/components/admin/users/admin-user-table";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { useAdminUsers } from "@/hooks/admin/use-admin-users";
import { useSession } from "@/hooks/use-session";
import type { UserPlatformRole, UserStatus } from "@/types/admin-user.types";

export function AdminUsersPage() {
  const session = useSession();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<UserStatus | "">("");
  const [platformRole, setPlatformRole] = useState<UserPlatformRole | "">("");
  const users = useAdminUsers({
    page,
    pageSize: 20,
    ...(search
      ? {
          search,
        }
      : {}),
    ...(status
      ? {
          status,
        }
      : {}),
    ...(platformRole
      ? {
          platformRole,
        }
      : {}),
  });

  if (session.data?.user.platformRole !== "metauser") {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8">
          <h1 className="text-2xl font-semibold text-red-950">
            Acceso denegado
          </h1>
          <p className="mt-2 text-red-800">
            No tienes permisos para acceder a la administración global.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl p-5 sm:p-8">
      <PageHeader
        title="Administración de usuarios"
        description="Gestiona accesos globales y membresías organizacionales."
        actions={
          <Button asChild>
            <Link href="/administration/users/new">
              <Plus className="mr-2 size-4" />
              Nuevo usuario
            </Link>
          </Button>
        }
      />
      <div className="my-6 grid gap-3 md:grid-cols-[minmax(260px,1fr)_220px_220px]">
        <SearchInput
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Buscar por nombre o correo"
        />
        <select
          aria-label="Filtrar por rol de plataforma"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2"
          value={platformRole}
          onChange={(event) => {
            setPlatformRole(event.target.value as UserPlatformRole | "");
            setPage(1);
          }}
        >
          <option value="">Todos los roles</option>
          <option value="user">Usuario</option>
          <option value="metauser">Metausuario</option>
        </select>
        <select
          aria-label="Filtrar por estado"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as UserStatus | "");
            setPage(1);
          }}
        >
          <option value="">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
          <option value="blocked">Bloqueado</option>
        </select>
      </div>
      {users.isPending ? (
        <LoadingState label="Cargando usuarios…" />
      ) : users.isError ? (
        <ErrorState
          description="No fue posible cargar los usuarios."
          onRetry={() => users.refetch()}
        />
      ) : (
        <>
          <AdminUserTable users={users.data.items} />
          <div className="mt-5 flex items-center justify-between text-sm">
            <span className="text-slate-500">
              {users.data.pagination.total} usuarios
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                disabled={page >= users.data.pagination.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
