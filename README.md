Monorepo basado en pnpm para una aplicación web con backend NestJS y frontend Next.js.

El sistema está organizado por dominios y utiliza TypeORM con migraciones, almacenamiento S3-compatible y autenticación basada en cookies HttpOnly.

---

# Stack

## Backend

- NestJS
- TypeORM
- MySQL
- Passport
- JWT
- class-validator
- class-transformer

## Frontend

- Next.js (App Router)
- React
- TypeScript
- TailwindCSS

## Infraestructura

- Docker Compose
- MySQL
- MinIO / S3 compatible
- Signed URLs

---

# Monorepo

- Node.js 22
- pnpm 9
- Docker Desktop

```
jivatax/

apps/
    api/
    web/

packages/
    shared/
```

---

# Convenciones

## Base de datos

- UUID como primary key.
- snake_case.
- synchronize=false.
- Todas las modificaciones mediante migraciones.
- No eliminar registros históricos.

## TypeScript

- camelCase
- DTOs explícitos
- No utilizar spreads para construir payloads.
- Servicios pequeños por dominio.
- Evitar lógica de negocio en controladores.

## Seguridad

- Access Token y Refresh Token en cookies HttpOnly.
- Nunca utilizar localStorage.
- Frontend siempre utiliza:

```ts
credentials: "include";
```

Autenticación mediante:

```
GET /auth/me
```

---

# Arquitectura

La aplicación está dividida por dominios.

Ejemplo:

```
accounting/
organizations/
companies/
tax-periods/
authentication/
users/
storage/
```

Cada dominio intenta contener:

```
controller
service
entity
dto
repository
validators
tests
```

---

# Flujo de documentos

El sistema nunca trabaja directamente sobre un archivo Excel.

El flujo normal es:

```
Archivo

↓

Documento

↓

Importación

↓

Filas normalizadas

↓

Validaciones

↓

Persistencia

↓

Procesamiento
```

Cada importación es inmutable.

Una nueva carga genera una nueva versión.

---

# Versionado

No se sobrescriben documentos.

```
Documento
    ↓

Importación v1

Importación v2

Importación v3
```

Solo una versión puede quedar activa.

Las anteriores permanecen para auditoría.

---

# Modelo de cuentas

Existen distintos conceptos que no deben confundirse.

## company_accounts

Catálogo interno acumulativo de una empresa.

Nunca se elimina.

Nunca depende de un período.

---

## company_account_mappings

Homologaciones persistentes.

Relacionan una cuenta interna con una cuenta del catálogo vigente.

No pertenecen a una importación.

---

## account_matching_confirmations

Historial de confirmaciones realizadas por usuarios.

Se utiliza para aprendizaje supervisado.

---

## account_matching_learning

Modelo agregado construido desde confirmaciones.

No contiene el historial completo.

Contiene estadísticas utilizadas por el motor de sugerencias.

---

## account_matching_learning_industries

Especialización del aprendizaje por industria.

Permite ajustar las sugerencias según contexto.

---

# Importaciones

Actualmente existen procesadores independientes para:

```
Balance

Libro Mayor

Libro Diario
```

Cada parser valida únicamente las reglas correspondientes a ese documento.

No reutilizar lógica entre documentos salvo utilidades comunes.

---

# Explorador Contable

El explorador consume información ya procesada.

No lee archivos.

Utiliza exclusivamente tablas normalizadas.

---

# Principios importantes

## Nunca

- modificar documentos originales
- reemplazar homologaciones automáticamente
- crear cuentas automáticamente
- eliminar historial

## Siempre

- mantener trazabilidad
- mantener versionado
- validar backend
- registrar auditoría

---

# Desarrollo

## Instalar

```bash
pnpm install
```

## Backend

```bash
pnpm --filter @jivatax/api dev
```

## Frontend

```bash
pnpm --filter @jivatax/web dev
```

## Build

```bash
pnpm --filter @jivatax/api build

pnpm --filter @jivatax/web build
```

---

# Calidad

Antes de crear un PR ejecutar:

```bash
pnpm format

pnpm lint

pnpm --filter @jivatax/api test

pnpm --filter @jivatax/api build

pnpm --filter @jivatax/web build
```

---

# Estado del proyecto

## Implementado

- autenticación
- organizaciones
- empresas
- períodos tributarios
- almacenamiento
- importaciones
- normalización
- homologación
- aprendizaje supervisado
- explorador contable
- conciliaciones

---

# Próximas etapas

- papeles de trabajo
- determinaciones
- procesos tributarios
- reportes
- exportaciones

---

# Reglas para contribuir

Antes de introducir una nueva entidad:

1. Verificar si ya existe un concepto equivalente.
2. Evitar duplicar modelos.
3. Mantener compatibilidad con importaciones anteriores.
4. Agregar pruebas.
5. Crear migraciones cuando corresponda.

---

# Filosofía del proyecto

El sistema privilegia:

- consistencia de datos
- trazabilidad
- versionado
- auditoría
- mantenibilidad

Por sobre optimizaciones prematuras o automatizaciones difíciles de explicar.
