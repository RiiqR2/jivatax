# Arquitectura frontend de JivaTax

## Propósito y alcance

Esta base permite reconstruir `apps/web` de forma incremental, sin interrumpir las rutas existentes ni reescribir de una vez los flujos que ya funcionan. El proyecto usa **Next.js App Router**: las rutas viven en `src/app`, emplean `layout.tsx` y componentes de servidor por defecto. Empresas y Usuarios quedan expresamente fuera de esta primera migración.

## Inventario actual (antes de la reconstrucción)

### Estructura y rutas

La implementación encontrada era pequeña y se distribuía así:

- `app/layout.tsx`, `app/globals.css` y `app/page.tsx`: layout global, estilos y portada.
- `app/companies/[companyId]/files/page.tsx`: ruta dinámica `/companies/:companyId/files`.
- `components/files/`: vista de archivos, tabla y diálogo de carga.
- `lib/files/`: cliente del módulo, DTOs, formateadores, validación y flujo de carga.
- `lib/http/api-client.ts`: cliente HTTP basado en `fetch` que permanece como compatibilidad temporal.
- `tests/files.test.ts`: pruebas unitarias del flujo de archivos.

Las rutas que deben continuar funcionando durante la transición son `/` y `/companies/[companyId]/files`. No existía `lib/admin` en el árbol inspeccionado; si aparece en desarrollo futuro, se considera legado protegido y no debe borrarse durante esta fase.

### Componentes reutilizables encontrados

- `FilesPage`: orquestación del listado, carga y descarga.
- `FileList`: tabla de archivos y acciones de descarga.
- `UploadDialog`: formulario, validación y progreso de carga.
- Formateadores y máquina de estado simple en `lib/files/formatters.ts` y `lib/files/view-state.ts`.

Estos componentes siguen en sus ubicaciones originales. La ruta de App Router los consume temporalmente; no deben adaptarse al patrón nuevo hasta que exista una migración funcional y cubierta por pruebas.

### Dependencias encontradas

El paquete solo declaraba Next.js 15, React 19 y React DOM 19, más TypeScript, ESLint y sus tipos/configuración. La nueva base declara Tailwind CSS, la configuración shadcn/ui y sus utilidades, React Hook Form, Zod, resolvers, TanStack Query, Axios y Lucide React. No se añade una dependencia llamada `shadcn`: shadcn/ui distribuye código de componentes y se configura mediante `components.json`.

### Deuda técnica identificada

1. Componentes de página concentran consulta, mutaciones, mensajes, estado de servidor y presentación.
2. El módulo de archivos usa `useEffect`/`useState` para estado remoto en lugar de React Query.
3. El formulario de carga mantiene validación manual y tipos de error locales en vez de React Hook Form y Zod.
4. DTOs, servicios y lógica de interfaz están agrupados bajo el antiguo `lib/files`.
5. El cliente HTTP antiguo usa `fetch`, no normaliza de forma centralizada todos los errores y lee configuración sin validación tipada.
6. Los estilos globales antiguos usan clases semánticas globales y reglas de elementos, lo que dificulta aislamiento y composición.
7. No había primitives de UI, providers, navegación ni layout modular.
8. La navegación móvil del nuevo shell es solo el punto visual inicial; debe conectarse a un drawer accesible al abordar el layout completo.

## Responsabilidades por directorio

### `src/app`

Define rutas, layouts, límites de carga/error y metadatos. Las páginas deben ser delgadas: componen módulos y traducen parámetros de ruta, pero no declaran DTOs, clientes HTTP ni lógica de negocio. Los componentes son de servidor salvo que necesiten explícitamente APIs del navegador o hooks.

### `src/components`

Contiene presentación React:

- `ui/`: primitives shadcn/ui, sin conocimiento del negocio.
- `layout/`: shell, header, sidebar y composición estructural.
- `shared/`: patrones reutilizables entre dominios.
- `<module>/`: componentes propios de cada módulo, por ejemplo `companies/` o `users/`.

### `src/services`

Encapsula llamadas HTTP por dominio. Recibe y devuelve tipos explícitos, usa la instancia Axios de `src/lib/api.ts` y no contiene estado React.

### `src/hooks`

Expone hooks de aplicación y hooks React Query por dominio. Define query keys, consultas, mutaciones, invalidación y adaptación del estado para la UI.

### `src/schemas`

Contiene esquemas Zod reutilizables para formularios, parámetros y datos que cruzan límites no confiables. Los tipos de formulario se infieren del esquema cuando sea posible.

### `src/types`

Contiene tipos compartidos, DTOs y contratos API. Los tipos exclusivos de un módulo pueden agruparse en un archivo `<module>.types.ts`; nunca se declaran dentro de una página.

### `src/lib`

Infraestructura transversal sin UI: instancia Axios, entorno validado, composición de clases y adaptadores técnicos. No es un cajón para lógica de dominio.

### `src/providers`

Providers de React necesarios en el árbol raíz. `AppProviders` es el único punto de composición global y actualmente instala `QueryProvider`, que crea un `QueryClient` estable por sesión del navegador.

### `src/config`

Configuración declarativa de la aplicación, como navegación, flags y constantes visuales. No realiza efectos ni peticiones.

## Patrón obligatorio por módulo

Cada módulo nuevo o migrado debe seguir este flujo (se crean solo las piezas que necesite):

```text
src/components/<module>/       # UI del dominio
src/services/<module>.service.ts
src/hooks/use-<resource>.ts     # queries y mutations
src/schemas/<module>.schema.ts
src/types/<module>.types.ts
```

La dirección de dependencias es `app → components → hooks → services → lib/api`; schemas y types pueden compartirse sin importar componentes. Un componente no llama al transporte directamente.

## Reglas obligatorias

1. **No usar `fetch` directamente en componentes.** Todo acceso nuevo pasa por un service y por la instancia Axios compartida. `lib/http/api-client.ts` es una excepción legado temporal.
2. **No declarar DTOs dentro de páginas.** Se ubican en `src/types` y se comparten con services/hooks.
3. **Usar React Query para estado servidor.** Consultas, caché, reintentos, invalidación y mutaciones no se replican con `useEffect` y `useState`.
4. **Usar React Hook Form y Zod para formularios.** La validación se define en `src/schemas` y se conecta mediante `@hookform/resolvers`.
5. Las páginas coordinan composición y routing; la lógica de negocio reside fuera de `src/app`.
6. No crear mocks dentro de producción. Las pruebas usan dobles locales tipados cuando sean necesarios.

## Convenciones de nombres

- Archivos y carpetas: `kebab-case` (`page-header.tsx`, `company.service.ts`).
- Componentes y tipos: `PascalCase` (`PageHeader`, `ApiErrorResponse`).
- Funciones, variables y hooks: `camelCase`; los hooks comienzan por `use`.
- Esquemas: sufijo `Schema` (`companyFormSchema`).
- Servicios: objeto o funciones con verbos explícitos (`listCompanies`, `createCompany`).
- Query keys: factories estables por dominio (`companyKeys.list(filters)`).
- Imports internos: alias `@/*`; imports relativos solo para archivos estrechamente vecinos o legado no migrado.
- Componentes cliente: incluir `'use client'` únicamente donde sea necesario.

## Archivos por migrar y archivos eliminables después

| Legado protegido                           | Destino previsto                           | Eliminable únicamente cuando…                   |
| ------------------------------------------ | ------------------------------------------ | ----------------------------------------------- |
| `components/files/files-page.tsx`          | `src/components/files/` + hook de consulta | la ruta nueva tenga paridad funcional y pruebas |
| `components/files/file-list.tsx`           | `src/components/files/` y primitives `ui/` | la tabla migrada cubra estados y descarga       |
| `components/files/upload-dialog.tsx`       | componente nuevo + schema/RHF              | carga, progreso y errores estén cubiertos       |
| `lib/files/files-api.ts`                   | `src/services/files.service.ts`            | todas las operaciones usen Axios/React Query    |
| `lib/files/types.ts`                       | `src/types/files.types.ts`                 | no queden consumidores legado                   |
| `lib/files/upload-file.ts`                 | service/hook/schema del módulo             | preserve upload firmado y confirmación          |
| `lib/files/formatters.ts`                  | utilidades del módulo                      | pruebas apunten al reemplazo                    |
| `lib/files/view-state.ts`                  | estado derivado de React Query             | los estados visuales tengan paridad             |
| `lib/http/api-client.ts`                   | `src/lib/api.ts` + normalizador de error   | ninguna ruta funcional use `apiRequest`         |
| reglas CSS legado en `src/app/globals.css` | Tailwind + componentes UI                  | ningún componente legado dependa de ellas       |

No se elimina ninguno durante esta etapa. `tests/files.test.ts` también se conserva y se migrará junto con su módulo.

## Plan de migración incremental

1. Consolidar primitives shadcn/ui, accesibilidad del shell y pruebas de providers.
2. Migrar **Archivos** verticalmente: types → schema → service → hooks React Query → componentes, manteniendo temporalmente el cliente legado.
3. Comparar carga, descarga, errores y estados vacíos con el flujo actual; cambiar la ruta solo tras conseguir paridad y pruebas.
4. Eliminar dependencias legado de Archivos únicamente cuando no existan imports consumidores.
5. Diseñar y migrar **Empresas** en una entrega separada.
6. Diseñar y migrar **Usuarios** en una entrega separada.
7. Retirar CSS y cliente HTTP antiguos después de verificar todas las rutas y ejecutar lint, build y pruebas.

## Variables de entorno

`src/lib/env.ts` valida `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_MAX_FILE_SIZE_BYTES` con Zod. La URL es obligatoria; una compilación o ejecución sin configuración válida debe fallar temprano con un mensaje claro. Los secretos nunca deben usar el prefijo `NEXT_PUBLIC_`.
