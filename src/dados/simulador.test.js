// Testes do simulador da tela "Como a IA funciona". Rodar com: npm test

import test from "node:test";
import assert from "node:assert/strict";
import { CENARIOS, LUGARES_DO_SIMULADOR, forcaDaChuva, fraseDoResultado, lugarDoPonto, responder, rotuloDaChuva } from "./simulador.js";
import { chuvaEm3h } from "./demo.js";

const [pouco, asVezes, muito] = LUGARES_DO_SIMULADOR;
const entrada = (id) => { const { chuva, agua, lixo } = CENARIOS.find((c) => c.id === id); return { chuva, agua, lixo }; };

test("os três lugares existem e vão do que alaga menos para o que alaga mais", () => {
  assert.equal(LUGARES_DO_SIMULADOR.length, 3);
  assert.ok(LUGARES_DO_SIMULADOR.every((l) => l.nome && l.regiao));
  assert.ok(pouco.sensibilidade < asVezes.sensibilidade && asVezes.sensibilidade < muito.sensibilidade);
  assert.equal(lugarDoPonto("nao-existe"), null);
});

test("sem chuva o risco é baixo em qualquer lugar", () => {
  for (const lugar of LUGARES_DO_SIMULADOR) {
    const r = responder(entrada("seco"), lugar);
    assert.equal(r.nivel, 1, lugar.nome);
    assert.equal(r.rotuloChuva, "Sem chuva");
  }
});

test("a mesma chuva dá mais chance no lugar que mais alaga", () => {
  for (const id of ["forte", "temporal"]) {
    const chances = LUGARES_DO_SIMULADOR.map((lugar) => responder(entrada(id), lugar).probabilidade);
    assert.ok(chances[0] < chances[1] && chances[1] < chances[2], id);
  }
  assert.equal(responder(entrada("temporal"), muito).nivelModelo, 4);
  assert.ok(responder(entrada("temporal"), pouco).nivelModelo <= 2);
});

test("o sensor muda o nível, nunca a chance", () => {
  const base = { chuva: 0.5, agua: 20, lixo: 20 };
  const semAjuste = responder(base, asVezes);
  const aguaAlta = responder({ ...base, agua: 85 }, asVezes);
  const comLixo = responder({ ...base, agua: 85, lixo: 80 }, asVezes);
  assert.equal(aguaAlta.probabilidade, semAjuste.probabilidade);
  assert.equal(comLixo.probabilidade, semAjuste.probabilidade);
  assert.equal(aguaAlta.nivel, semAjuste.nivel + 1);
  assert.equal(comLixo.nivel, Math.min(4, semAjuste.nivel + 2));
  assert.equal(aguaAlta.passos.find((p) => p.id === "agua").efeito, "sobe");
  assert.equal(comLixo.passos.find((p) => p.id === "lixo").efeito, "sobe");
  assert.match(fraseDoResultado(aguaAlta), /sobe o nível/);
  assert.match(fraseDoResultado(semAjuste), /não muda o nível/);
});

test("com o nível já em crítico, a leitura alta não aparece como subida", () => {
  const r = responder({ chuva: 1, agua: 85, lixo: 80 }, muito);
  assert.equal(r.nivelModelo, 4);
  assert.equal(r.nivel, 4);
  assert.equal(r.passos.find((p) => p.id === "agua").efeito, null);
  assert.equal(r.passos.find((p) => p.id === "lixo").efeito, null);
  assert.match(r.passos.find((p) => p.id === "agua").texto, /já está no máximo/);
  assert.match(fraseDoResultado(r), /não muda o nível/);
});

test("lixo alto sem chuva não sobe o nível", () => {
  const r = responder({ chuva: 0, agua: 10, lixo: 90 }, muito);
  assert.equal(r.nivel, 1);
  assert.match(r.passos.find((p) => p.id === "lixo").titulo, /sem chuva/);
});

test("água em 100% é transbordando: crítico e medido, em qualquer lugar e com qualquer chuva", () => {
  const r = responder({ chuva: 0, agua: 100, lixo: 0 }, pouco);
  assert.equal(r.nivel, 4);
  assert.equal(r.medicaoTransbordando, true);
  assert.equal(r.passos.find((p) => p.id === "agua").efeito, "medido");
  assert.match(fraseDoResultado(r), /medição vale mais/);
});

test("os nomes da chuva e a conversão de milímetros para força", () => {
  assert.deepEqual([0, 2, 10, 30, 60].map(rotuloDaChuva), ["Sem chuva", "Chuvisco", "Chuva moderada", "Chuva forte", "Temporal"]);
  for (const forca of [0, 0.22, 0.68, 1]) assert.ok(Math.abs(forcaDaChuva(chuvaEm3h(forca)) - forca) < 0.01);
  assert.equal(forcaDaChuva(500), 1);
});
