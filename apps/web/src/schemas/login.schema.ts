import { z } from "zod";
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Ingresa un correo válido.")
    .max(255)
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres.")
    .max(128),
});
export type LoginFormValues = z.input<typeof loginSchema>;
