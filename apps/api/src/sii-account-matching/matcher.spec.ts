import assert from "node:assert/strict";
import test from "node:test";
import { rankSiiAccounts } from "./matcher";

test("prioriza el alias aprendido sólo dentro de su empresa y explica el puntaje", () => {
  const accounts = [
    {
      id: "available",
      code: "1",
      name: "Disponible",
      terms: [
        {
          term: "Banco Santander",
          type: "alias",
          weight: 60,
          companyId: "company-a",
        },
      ],
    },
    { id: "debt", code: "2", name: "Obligaciones bancarias", terms: [] },
  ];
  const own = rankSiiAccounts("BANCO SANTANDER", "company-a", accounts);
  assert.equal(own[0]?.id, "available");
  assert.equal(own[0]?.reasons[0]?.signal, "company_history");
  assert.equal(
    rankSiiAccounts("BANCO SANTANDER", "company-b", accounts).length,
    0,
  );
});

test("un término negativo reduce el puntaje de forma auditable", () => {
  const [result] = rankSiiAccounts("préstamo banco", "company", [
    {
      id: "1",
      code: "1",
      name: "Banco",
      terms: [{ term: "préstamo", type: "negative_term", weight: -30 }],
    },
  ]);
  assert.equal(result, undefined);
});
