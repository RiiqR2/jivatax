"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  useCreateAdminUser,
  useUpdateAdminUser,
} from "@/hooks/admin/use-admin-users";
import {
  adminUserSchema,
  type AdminUserFormValues,
} from "@/schemas/admin-user.schema";
import type { AdminUser } from "@/types/admin-user.types";

interface AdminUserFormProps {
  user?: AdminUser;
}

export function AdminUserForm({ user }: AdminUserFormProps) {
  const router = useRouter();
  const createUser = useCreateAdminUser();
  const updateUser = useUpdateAdminUser(user?.id ?? "");
  const mutation = user ? updateUser : createUser;
  const form = useForm<AdminUserFormValues>({
    resolver: zodResolver(adminUserSchema),
    defaultValues: {
      email: user?.email ?? "",
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      temporaryPassword: user ? undefined : "",
      platformRole: user?.platformRole ?? "user",
      status: user?.status ?? "active",
    },
  });
  const platformRole = form.watch("platformRole");

  const submit = form.handleSubmit(async (values) => {
    if (
      values.platformRole === "metauser" &&
      user?.platformRole !== "metauser" &&
      !window.confirm(
        "¿Confirmas que deseas otorgar acceso administrativo global?",
      )
    ) {
      return;
    }

    const input = user
      ? {
          firstName: values.firstName,
          lastName: values.lastName,
          platformRole: values.platformRole,
          status: values.status,
        }
      : {
          email: values.email,
          firstName: values.firstName,
          lastName: values.lastName,
          temporaryPassword: values.temporaryPassword,
          platformRole: values.platformRole,
          memberships: [],
        };
    await mutation.mutateAsync(input);
    router.push("/administration/users");
  });

  return (
    <form
      className="mt-7 max-w-2xl space-y-5 rounded-xl border border-slate-200 bg-white p-6"
      onSubmit={submit}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nombre" error={form.formState.errors.firstName?.message}>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            {...form.register("firstName")}
          />
        </Field>
        <Field label="Apellido" error={form.formState.errors.lastName?.message}>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            {...form.register("lastName")}
          />
        </Field>
      </div>
      <Field label="Correo" error={form.formState.errors.email?.message}>
        <input
          className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"
          type="email"
          disabled={Boolean(user)}
          {...form.register("email")}
        />
      </Field>
      {!user && (
        <Field
          label="Contraseña temporal"
          error={form.formState.errors.temporaryPassword?.message}
        >
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            type="password"
            autoComplete="new-password"
            {...form.register("temporaryPassword")}
          />
        </Field>
      )}
      <Field label="Rol de plataforma">
        <select
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          {...form.register("platformRole")}
        >
          <option value="user">Usuario</option>
          <option value="metauser">Metausuario</option>
        </select>
      </Field>
      {platformRole === "metauser" && (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
          role="alert"
        >
          Los metausuarios pueden administrar todos los usuarios, organizaciones
          y empresas de la plataforma.
        </div>
      )}
      {user && (
        <Field label="Estado">
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            {...form.register("status")}
          >
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
            <option value="blocked">Bloqueado</option>
          </select>
        </Field>
      )}
      {mutation.isError && (
        <p className="text-sm text-red-700" role="alert">
          No fue posible guardar el usuario. Revisa los datos e inténtalo
          nuevamente.
        </p>
      )}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && (
            <LoaderCircle className="mr-2 size-4 animate-spin" />
          )}
          Guardar usuario
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: Readonly<{
  label: string;
  error?: string;
  children: React.ReactNode;
}>) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-800">
      {label}
      {children}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </label>
  );
}
