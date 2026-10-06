// Testes do simulador da tela "Como a IA funciona". Rodar com: npm test

import test from "node:test";
import assert from "node:assert/strict";
import { CENARIOS, LUGARES_DO_SIMULADOR, forcaDaChuva, fraseDoResultado, lugarDoPonto, responder, rotuloDaChuva, vezes } from "./simulador.js";
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
  assert.equal(responder(entrada("temporal"), muito).nivel, 4);
  assert.ok(responder(entrada("temporal"), pouco).nivelModelo <= 2);
});

test("a leitura do sensor entra na chance: água e lixo multiplicam, nunca diminuem", () => {
  const base = { chuva: 0.5, agua: 20, lixo: 20 };
  const semPeso = responder(base, asVezes);
  const aguaAlta = responder({ ...base, agua: 82 }, asVezes);
  const comLixo = responder({ ...base, agua: 82, lixo: 80 }, asVezes);
  assert.equal(semPeso.probabilidade, semPeso.probabilidadeSemSensor, "leituras baixas não mudam a conta");
  assert.ok(aguaAlta.probabilidade > semPeso.probabilidade * 5, "água em 82% multiplica a chance por mais de 5");
  assert.ok(comLixo.probabilidade > aguaAlta.probabilidade * 3, "lixo em 80% com chuva multiplica por mais de 3");
  // A chance só pela chuva e pelo lugar é a mesma nos três casos: o sensor entra por cima dela.
  assert.equal(aguaAlta.probabilidadeSemSensor, semPeso.probabilidadeSemSensor);
  assert.equal(comLixo.probabilidadeSemSensor, semPeso.probabilidadeSemSensor);
  assert.ok(aguaAlta.nivel >= semPeso.nivel && comLixo.nivel >= aguaAlta.nivel);
  assert.equal(aguaAlta.passos.find((p) => p.id === "agua").efeito, "sobe");
  assert.equal(comLixo.passos.find((p) => p.id === "lixo").efeito, "sobe");
  assert.match(fraseDoResultado(comLixo), /Com o que o sensor mede, ela fica .+ vezes maior/);
  assert.match(fraseDoResultado(semPeso), /não mudam a conta/);
});

test("o nível sai da chance final: mexer no sensor pode mudar o nível", () => {
  const seco = responder({ chuva: 0.5, agua: 20, lixo: 20 }, asVezes);
  const entupido = responder(entrada("entupido"), asVezes);
  assert.equal(seco.nivel, 1);
  assert.equal(entupido.nivelModelo, 1, "pela chuva e pelo lugar seria baixo");
  assert.equal(entupido.nivel, 3, "com o bueiro entupido vira alto");
  assert.match(fraseDoResultado(entupido), /O nível vai de baixo para alto/);
});

test("a chance nunca passa de 100%, mesmo com tudo no máximo", () => {
  const r = responder({ chuva: 1, agua: 99, lixo: 100 }, muito);
  assert.ok(r.probabilidade > 0.9 && r.probabilidade < 1);
  assert.equal(r.nivel, 4);
});

test("lixo alto sem chuva não muda a chance", () => {
  const r = responder({ chuva: 0, agua: 10, lixo: 90 }, muito);
  assert.equal(r.probabilidade, r.probabilidadeSemSensor);
  assert.equal(r.nivel, 1);
  assert.match(r.passos.find((p) => p.id === "lixo").titulo, /sem chuva/);
});

test("bueiro quase cheio em dia seco não aparece como risco baixo", () => {
  const r = responder({ chuva: 0, agua: 92, lixo: 10 }, pouco);
  assert.equal(r.nivelModelo, 1);
  assert.ok(r.nivel >= 2);
});

test("água em 100% é transbordando: crítico e medido, em qualquer lugar e com qualquer chuva", () => {
  const r = responder({ chuva: 0, agua: 100, lixo: 0 }, pouco);
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
