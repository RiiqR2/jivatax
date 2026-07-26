# JivaTax

Base monorepo para el desarrollo de JivaTax.

## Requisitos

- Node.js 22
- pnpm 9
- Docker Desktop

## Inicio rápido

```bash
nvm use
cp .env.example .env
pnpm install
pnpm infra:up
pnpm --filter @jivatax/api migration:run
pnpm dev
```

## Estructura

- `apps/api`: API NestJS
- `apps/web`: frontend Next.js
- `packages/shared`: código compartido
- `infra`: infraestructura y scripts
