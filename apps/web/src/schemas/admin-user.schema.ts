import { z } from "zod";

export const adminUserSchema = z.object({
  email: z.string().trim().email("Ingresa un correo válido.").optional(),
  firstName: z.string().trim().min(1, "Ingresa el nombre.").max(100),
  lastName: z.string().trim().min(1, "Ingresa el apellido.").max(100),
  temporaryPassword: z
    .string()
    .min(12, "Debe tener al menos 12 caracteres.")
    .max(128)
    .optional(),
  platformRole: z.enum(["user", "metauser"]),
  status: z.enum(["active", "inactive", "blocked"]).optional(),
});

export type AdminUserFormValues = z.infer<typeof adminUserSchema>;
