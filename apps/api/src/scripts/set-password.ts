import 'reflect-metadata';
import * as argon2 from 'argon2';
import { DataSource } from 'typeorm';
import AppDataSource from '../database/data-source';
import { UserEntity, UserStatus } from '../users/entities/user.entity';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('Este comando está deshabilitado en producción.');
  const emailArg = process.argv.findIndex((value) => value === '--email');
  const email = emailArg >= 0 ? process.argv[emailArg + 1]?.trim().toLowerCase() : undefined;
  const password = process.env.JIVATAX_DEV_PASSWORD;
  if (!email || !password) throw new Error('Usa --email y define temporalmente JIVATAX_DEV_PASSWORD (mínimo 12 caracteres).');
  if (password.length < 12 || password.length > 128) throw new Error('La contraseña debe tener entre 12 y 128 caracteres.');
  const dataSource: DataSource = await AppDataSource.initialize();
  try {
    const repository = dataSource.getRepository(UserEntity);
    const user = await repository.findOne({ where: { email } });
    if (!user) throw new Error('Usuario no encontrado.');
    user.passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    user.passwordChangedAt = new Date();
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.status = UserStatus.ACTIVE;
    await repository.save(user);
    console.log('Contraseña actualizada de forma segura.');
  } finally { await dataSource.destroy(); }
}
void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'No se pudo actualizar la contraseña.'); process.exitCode = 1; });
