// Testes da leitura do sensor pelo cabo. Rodar com: npm test

import test from "node:test";
import assert from "node:assert/strict";
import { SEM_CALIBRAGEM, estadoDaLeitura, interpretarLinha, quantoMolhado } from "./interpretar.js";

const estado = (linha, calibragem) => estadoDaLeitura(interpretarLinha(linha), calibragem);

test("o texto do sensor diz o estado, em português ou inglês", () => {
  for (const linha of ["molhado", "MOLHADO", "Agua detectada!", "água detectada", "Sensor: MOLHADO", "wet", "Estado = alagado", "Bueiro transbordando"]) {
    assert.equal(estado(linha), "molhado", linha);
  }
  for (const linha of ["seco", "SECO", "Sem agua", "sem água no sensor", "dry", "Estado: seco", "nao molhado", "Não detectado"]) {
    assert.equal(estado(linha), "seco", linha);
  }
});

test("0 e 1: 1 é molhado, a menos que a calibragem diga o contrário", () => {
  assert.equal(estado("1"), "molhado");
  assert.equal(estado("0"), "seco");
  assert.equal(estado("agua: 1"), "molhado");
  assert.equal(estado("digital=0"), "seco");
  // Sensor em que 0 é molhado: basta marcar "agora está molhado" com a água nele.
  assert.equal(estado("0", { seco: null, molhado: 0 }), "molhado");
  assert.equal(estado("1", { seco: null, molhado: 0 }), "seco");
  assert.equal(estado("0", { seco: 1, molhado: null }), "molhado");
});

test("valor bruto do sensor: só vira estado depois de calibrar, e vale a referência mais próxima", () => {
  assert.equal(estado("1830"), null, "sem calibragem não dá para saber");
  const cal = { seco: 200, molhado: 2600 };
  assert.equal(estado("1830", cal), "molhado");
  assert.equal(estado("412", cal), "seco");
  // Sensor em que o número CAI quando molha (comum nos módulos de chuva).
  const invertido = { seco: 4095, molhado: 1200 };
  assert.equal(estado("1300", invertido), "molhado");
  assert.equal(estado("3900", invertido), "seco");
  assert.equal(quantoMolhado(interpretarLinha("1400"), cal), 0.5);
  assert.equal(quantoMolhado(interpretarLinha("9999"), cal), 1);
  assert.equal(quantoMolhado(interpretarLinha("1830")), null);
  assert.equal(quantoMolhado(interpretarLinha("molhado")), 1);
});

test("campos com nome: acha o que traz a leitura", () => {
  assert.deepEqual(interpretarLinha("umidade: 1830"), { bruto: "umidade: 1830", tipo: "leitura", palavra: null, valor: 1830, campo: "umidade" });
  const dupla = interpretarLinha("Sensor: 1830 | Estado: MOLHADO");
  assert.deepEqual([dupla.palavra, dupla.valor], ["molhado", 1830]);
  assert.equal(interpretarLinha("temperatura=27.5 agua=1").valor, 1, "o campo da água ganha dos outros");
  assert.equal(interpretarLinha("Valor analogico = 512.5").valor, 512.5);
  assert.equal(estado("estado: ON"), "molhado");
  assert.equal(estado("estado: LOW"), "seco");
});

test("JSON", () => {
  assert.equal(estado('{"molhado": true}'), "molhado");
  assert.equal(estado('{"molhado": false}'), "seco");
  const j = interpretarLinha('{"sensorId": 3, "agua": 1830, "estado": "seco"}');
  assert.deepEqual([j.palavra, j.valor, j.campo], ["seco", 1830, "agua"]);
  assert.equal(interpretarLinha('{"quebrado": ').tipo, "texto");
});

test("números soltos e linhas que não são leitura", () => {
  assert.equal(interpretarLinha("1830,1").valor, 1830);
  assert.equal(interpretarLinha("Leitura do sensor 742").valor, 742);
  assert.equal(interpretarLinha(""), null);
  assert.equal(interpretarLinha("   \r"), null);
  assert.equal(interpretarLinha("Iniciando o SIMA...").tipo, "texto");
  for (const ruido of ["ets Jul 29 2019 12:21:46", "rst:0x1 (POWERON_RESET),boot:0x13", "load:0x3fff0030,len:1344", "entry 0x400805e4", "E (123) wifi: algo",
    "Conectando ao WiFi", "WiFi conectado", "IP: 192.168.0.12", "....."]) {
    assert.equal(interpretarLinha(ruido).tipo, "ruido", ruido);
    assert.equal(estado(ruido), null, ruido);
  }
});

test("caracteres estranhos do cabo não quebram a leitura", () => {
  assert.equal(estado("\u0000\u0007molhado\r"), "molhado");
  assert.equal(estadoDaLeitura(null, SEM_CALIBRAGEM), null);
});
