import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { BalanceExplorerQueryDto } from "./accounting-explorer.dto";

test("normaliza filtros vacíos antes de validarlos", async () => {
  const query = plainToInstance(BalanceExplorerQueryDto, {
    code: "  ",
    name: "",
    section: "",
  });
  assert.equal(query.code, undefined);
  assert.equal(query.name, undefined);
  assert.equal(query.section, undefined);
  assert.deepEqual(await validate(query), []);
});

test("acepta una sección conocida y sigue rechazando valores desconocidos", async () => {
  const asset = plainToInstance(BalanceExplorerQueryDto, {
    section: " asset ",
  });
  assert.equal(asset.section, "asset");
  assert.deepEqual(await validate(asset), []);

  const unknown = plainToInstance(BalanceExplorerQueryDto, {
    section: "unknown",
  });
  assert.equal((await validate(unknown)).length, 1);
});
