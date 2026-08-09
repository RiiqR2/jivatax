import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ApproveAccountSuggestionsBatchDto } from "./account-mappings.dto";

// Mirrors the global ValidationPipe configuration in main.ts.
const pipeOptions = { whitelist: true, forbidNonWhitelisted: true } as const;
const uuid = "3d3251a6-f3e5-45ca-989a-c8a921d4ee88";

test("acepta allowReview en la aprobación por lote (no lo trata como propiedad prohibida)", async () => {
  const dto = plainToInstance(ApproveAccountSuggestionsBatchDto, {
    companyAccountIds: [uuid],
    allowReview: true,
  });
  assert.deepEqual(await validate(dto, pipeOptions), []);
  assert.equal(dto.allowReview, true);
});

test("allowReview es opcional", async () => {
  const dto = plainToInstance(ApproveAccountSuggestionsBatchDto, {
    companyAccountIds: [uuid],
  });
  assert.deepEqual(await validate(dto, pipeOptions), []);
});

test("sigue rechazando propiedades desconocidas y allowReview no booleano", async () => {
  const unknown = plainToInstance(ApproveAccountSuggestionsBatchDto, {
    companyAccountIds: [uuid],
    somethingElse: true,
  });
  assert.equal((await validate(unknown, pipeOptions)).length, 1);

  const wrongType = plainToInstance(ApproveAccountSuggestionsBatchDto, {
    companyAccountIds: [uuid],
    allowReview: "yes",
  });
  assert.equal((await validate(wrongType, pipeOptions)).length, 1);
});
