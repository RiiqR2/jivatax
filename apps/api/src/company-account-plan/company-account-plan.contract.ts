export const ACCOUNT_PLAN_FILE_CONTRACT = {
  fileName: "plan-cuentas-jivatax.xlsx",
  sheetName: "Plan de cuentas",
  instructionsSheetName: "Instrucciones",
  maximumRows: 20_000,
  maximumFileSizeBytes: 10_000_000,
  allowedExtensions: ["xlsx", "xls", "csv"],
  columns: [
    {
      key: "code",
      header: "Código",
      required: true,
      aliases: [
        "Código",
        "Codigo",
        "Cod Cuenta",
        "Código Cuenta",
        "Account Code",
      ],
    },
    {
      key: "name",
      header: "Nombre",
      required: true,
      aliases: [
        "Nombre",
        "Descripción",
        "Nombre Cuenta",
        "Cuenta Contable",
        "Glosa",
        "Account Name",
      ],
    },
    {
      key: "description",
      header: "Descripción",
      required: false,
      aliases: ["Detalle", "Descripción Cuenta", "Description"],
    },
    {
      key: "level",
      header: "Nivel",
      required: false,
      aliases: ["Level"],
    },
    {
      key: "parentCode",
      header: "Código padre",
      required: false,
      aliases: ["Cuenta padre", "Parent Code"],
    },
    {
      key: "status",
      header: "Estado",
      required: false,
      aliases: ["Status"],
    },
  ],
  example: {
    code: "110101",
    name: "Caja General",
    description: "Caja principal de la empresa",
    level: 3,
    parentCode: "1101",
    status: "active",
  },
} as const;

export type AccountPlanColumnKey =
  (typeof ACCOUNT_PLAN_FILE_CONTRACT.columns)[number]["key"];

export const ACCOUNT_PLAN_ERROR_LIMIT = 100;
