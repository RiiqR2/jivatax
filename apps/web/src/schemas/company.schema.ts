import { z } from "zod";
import { isValidChileanRut, normalizeChileanRut } from "@/lib/chilean-rut";
export const companySchema = z.object({
  legalName: z
    .string()
    .trim()
    .min(2, "Ingresa la razón social.")
    .max(255, "La razón social es demasiado larga."),
  tradeName: z
    .string()
    .trim()
    .max(255, "El nombre es demasiado largo.")
    .optional(),
  taxId: z
    .string()
    .trim()
    .refine(isValidChileanRut, "Ingresa un RUT chileno válido."),
  status: z.enum(["active", "inactive"]).optional(),
});
export type CompanyFormValues = z.infer<typeof companySchema>;
export function companyPayload(values: CompanyFormValues) {
  return {
    ...values,
    taxId: normalizeChileanRut(values.taxId),
    tradeName: values.tradeName?.trim() || null,
  };
}
