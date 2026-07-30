# Términos y sugerencias de cuentas SII

`sii_accounts` continúa siendo el único catálogo oficial. `sii_account_terms` sólo contiene conocimiento auditable para puntuar sugerencias; los datos del Manual MiPyme son auxiliares y sus códigos nunca se usan como códigos SII.

Ejecute explícitamente `pnpm --filter @jivatax/api sii-accounts:sync-terms` después de importar o actualizar el catálogo. El comando crea el nombre oficial de cada cuenta activa y el conocimiento curado de `data/sii-account-aliases.ts`. Es idempotente: no reactiva, elimina ni sobrescribe términos existentes.

Ejecute también, de forma explícita, `pnpm --filter @jivatax/api sii-accounts:sync-concepts` para cargar el conocimiento económico y contable versionado en `data/sii-account-concepts.ts`. Los conceptos complementan aliases y señales estructurales del ranking, pero nunca crean ni confirman mappings. El comando es idempotente y conserva conceptos inactivos, pesos editados y registros borrados lógicamente.

Para agregar un alias global, un metausuario debe revisar el código SII estable y agregarlo al archivo versionado (o administrarlo mediante una operación administrativa). Para desactivarlo, marque `active = false`; la sincronización conservará esa decisión. Los términos con `company_id` se aprenden sólo al confirmar una homologación de esa empresa y jamás se promueven globalmente.
