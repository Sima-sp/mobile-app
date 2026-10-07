// Testes do simulador da tela "Como a IA funciona". Rodar com: npm test

import test from "node:test";
import assert from "node:assert/strict";
import { CENARIOS, LUGARES_DO_SIMULADOR, forcaDaChuva, fraseDoResultado, lugarDoPonto, responder, rotuloDaChuva, vezes } from "./simulador.js";
import { chuvaEm3h } from "./demo.js";

const [pouco, asVezes, muito] = LUGARES_DO_SIMULADOR;
const entrada = (id) => { const { chuva, agua } = CENARIOS.find((c) => c.id === id); return { chuva, agua }; };

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
  assert.equal(responder(entrada("temporal"), muito).nivel, 4);
  assert.ok(responder(entrada("temporal"), pouco).nivelModelo <= 2);
});

test("a leitura do sensor entra na chance: bueiro enchendo multiplica, nunca diminui", () => {
  const base = { chuva: 0.4, agua: 20 };
  const semPeso = responder(base, asVezes);
  const aguaAlta = responder({ ...base, agua: 82 }, asVezes);
  assert.equal(semPeso.probabilidade, semPeso.probabilidadeSemSensor, "leitura baixa não muda a conta");
  assert.ok(aguaAlta.probabilidade > semPeso.probabilidade * 5, "água em 82% multiplica a chance por mais de 5");
  // A chance só pela chuva e pelo lugar é a mesma: o sensor entra por cima dela.
  assert.equal(aguaAlta.probabilidadeSemSensor, semPeso.probabilidadeSemSensor);
  assert.ok(aguaAlta.nivel >= semPeso.nivel);
  assert.deepEqual(aguaAlta.passos.map((p) => p.id), ["chuva", "lugar", "agua"]);
  assert.equal(aguaAlta.passos.find((p) => p.id === "agua").efeito, "sobe");
  assert.match(fraseDoResultado(aguaAlta), /Com o que o sensor mede, ela fica .+ vezes maior/);
  assert.match(fraseDoResultado(semPeso), /não muda a conta/);
});

test("o nível sai da chance final: mexer no sensor pode mudar o nível", () => {
  const enchendo = responder(entrada("enchendo"), asVezes);
  const mesmaChuvaVazio = responder({ ...entrada("enchendo"), agua: 20 }, asVezes);
  assert.equal(mesmaChuvaVazio.nivel, 1);
  assert.equal(enchendo.nivelModelo, 1, "pela chuva e pelo lugar seria baixo");
  assert.equal(enchendo.nivel, 3, "com o bueiro enchendo vira alto");
  assert.match(fraseDoResultado(enchendo), /O nível vai de baixo para/);
});

test("a chance nunca passa de 100%, e a frase diz o quanto ela cresceu de verdade", () => {
  const r = responder({ chuva: 1, agua: 99 }, muito);
  assert.ok(r.probabilidade > 0.8 && r.probabilidade < 1);
  assert.equal(r.nivel, 4);
  // Com 31% só pela chuva, a chance não tem como ficar 12 vezes maior: a frase usa o crescimento real.
  const cresceu = r.probabilidade / r.probabilidadeSemSensor;
  assert.ok(cresceu > 2 && cresceu < 3.3);
  assert.ok(fraseDoResultado(r).includes(`ela fica ${vezes(cresceu)} maior`));
  assert.ok(r.passos.find((p) => p.id === "agua").texto.includes(`${vezes(cresceu)} maior`));
});

test("bueiro quase cheio em dia seco não aparece como risco baixo", () => {
  const r = responder({ chuva: 0, agua: 92 }, pouco);
  assert.equal(r.nivelModelo, 1);
  assert.ok(r.nivel >= 2);
});

test("água em 100% é transbordando: crítico e medido, em qualquer lugar e com qualquer chuva", () => {
  const r = responder({ chuva: 0, agua: 100 }, pouco);
  assert.equal(r.nivel, 4);
  assert.equal(r.medicaoTransbordando, true);
  assert.equal(r.passos.find((p) => p.id === "agua").efeito, "medido");
  assert.match(fraseDoResultado(r), /medição, e vale mais que qualquer previsão/);
});

test("os nomes da chuva e a conversão de milímetros para força", () => {
  assert.deepEqual([0, 2, 10, 30, 60].map(rotuloDaChuva), ["Sem chuva", "Chuvisco", "Chuva moderada", "Chuva forte", "Temporal"]);
  for (const forca of [0, 0.22, 0.68, 1]) assert.ok(Math.abs(forcaDaChuva(chuvaEm3h(forca)) - forca) < 0.01);
  assert.equal(forcaDaChuva(500), 1);
  assert.deepEqual([2.94, 7.2, 12].map(vezes), ["2,9 vezes", "7,2 vezes", "12 vezes"]);
});
