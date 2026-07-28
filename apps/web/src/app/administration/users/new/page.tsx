import { AdminUserForm } from "@/components/admin/users/admin-user-form";
import { PageHeader } from "@/components/shared/page-header";

export default function NewAdminUserPage() {
  return (
    <main className="mx-auto w-full max-w-7xl p-5 sm:p-8">
      <PageHeader
        title="Nuevo usuario"
        description="Crea un acceso y define su rol de plataforma."
      />
      <AdminUserForm />
    </main>
  );
}
