"use client";

import { AdminUserForm } from "./admin-user-form";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { useAdminUser } from "@/hooks/admin/use-admin-users";

export function EditAdminUserPage({ userId }: { userId: string }) {
  const user = useAdminUser(userId);

  if (user.isPending) {
    return <LoadingState label="Cargando usuario…" />;
  }

  if (user.isError) {
    return (
      <ErrorState
        description="No fue posible cargar el usuario."
        onRetry={() => user.refetch()}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl p-5 sm:p-8">
      <PageHeader
        title="Editar usuario"
        description={`${user.data.firstName} ${user.data.lastName}`}
      />
      <AdminUserForm user={user.data} />
    </main>
  );
}
