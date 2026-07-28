import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import * as argon2 from "argon2";
import dataSource from "../../database/data-source";
import { UserEntity } from "../../users/entities/user.entity";
async function main() {
  const index = process.argv.indexOf("--email");
  const email = process.argv[index + 1]?.trim().toLowerCase();
  if (!email)
    throw new Error("Uso: auth:set-password --email correo@dominio.cl");
  const prompt = createInterface({
    input: stdin,
    output: stdout,
    terminal: true,
  });
  const password = await prompt.question(
    "Nueva contraseña (mínimo 12 caracteres): ",
  );
  prompt.close();
  if (password.length < 12 || password.length > 128)
    throw new Error("La contraseña debe contener entre 12 y 128 caracteres.");
  await dataSource.initialize();
  try {
    const repository = dataSource.getRepository(UserEntity);
    const user = await repository.findOne({ where: { email } });
    if (!user) throw new Error("Usuario no encontrado.");
    await repository
      .createQueryBuilder()
      .update()
      .set({
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      })
      .where("id = :id", { id: user.id })
      .execute();
    stdout.write("Contraseña actualizada.\n");
  } finally {
    await dataSource.destroy();
  }
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : "No se pudo actualizar la contraseña.",
  );
  process.exitCode = 1;
});
