// Testes da leitura do protótipo do sensor: distância em cm → nível do bueiro.
import test from "node:test";
import assert from "node:assert/strict";
import {
  LIMITES_PADRAO, arrumarLimites, distanciaFirme, distanciaValida, escalaDoDesenho, lerLeitura, mediana, naZonaCega, nivelDaDistancia, textoDaDistancia,
} from "./nivel.js";
import { ENDERECO_PADRAO, arrumarEndereco, ehEsteComputador, podeSerBloqueado } from "./servidor.js";

test("o nível segue a mesma regra do servidor do sensor: quanto menor a distância, mais cheio", () => {
  assert.equal(nivelDaDistancia(80), 1, "longe da água: baixo");
  assert.equal(nivelDaDistancia(45.1), 1);
  assert.equal(nivelDaDistancia(45), 2, "no limite de atenção já é médio");
  assert.equal(nivelDaDistancia(30.1), 2);
  assert.equal(nivelDaDistancia(30), 3, "no limite de alerta já é alto");
  assert.equal(nivelDaDistancia(20.1), 3);
  assert.equal(nivelDaDistancia(20), 4, "no limite crítico já é crítico");
  assert.equal(nivelDaDistancia(3), 4);
});

test("medida impossível não vira bueiro cheio", () => {
  // Sem o eco de volta, muito sensor de distância devolve 0. Pela regra pura, 0 seria "crítico".
  for (const ruim of [0, -1, 601, 9999, NaN, Infinity, null, undefined, "32"]) {
    assert.equal(distanciaValida(ruim), false, `${ruim} não é medida`);
    assert.equal(nivelDaDistancia(ruim), null, `${ruim} não tem nível`);
  }
  assert.equal(distanciaValida(0.5), true);
  assert.equal(distanciaValida(600), true);
});

test("zona cega: perto demais do sensor a medida deixa de ser confiável", () => {
  assert.equal(naZonaCega(14.9), true);
  assert.equal(naZonaCega(15), false);
  assert.equal(naZonaCega(0), false, "0 não é medida, então não é zona cega");
  assert.equal(naZonaCega(10, { ...LIMITES_PADRAO, zonaCega: 0 }), false);
});

test("os limites do servidor valem quando fazem sentido; senão, os do app", () => {
  assert.deepEqual(arrumarLimites({ zonaCega: 3, critico: 8, alerta: 15, atencao: 25 }), { zonaCega: 3, critico: 8, alerta: 15, atencao: 25 });
  assert.equal(nivelDaDistancia(12, arrumarLimites({ critico: 8, alerta: 15, atencao: 25 })), 3);
  assert.deepEqual(arrumarLimites({ critico: 8, alerta: 15, atencao: 25 }).zonaCega, 0, "sem zona cega informada, vale 0");
  for (const ruim of [null, undefined, {}, { critico: 30, alerta: 20, atencao: 45 }, { critico: "20", alerta: 30, atencao: 45 }, { critico: 20, alerta: 30 }]) {
    assert.equal(arrumarLimites(ruim), LIMITES_PADRAO);
  }
  assert.equal(arrumarLimites({ zonaCega: 50, critico: 20, alerta: 30, atencao: 45 }).zonaCega, 0, "zona cega maior que o crítico não faz sentido");
});

test("a distância mostrada é a mediana das leituras válidas recentes", () => {
  assert.equal(mediana([]), null);
  assert.equal(mediana([5]), 5);
  assert.equal(mediana([10, 30]), 20);
  assert.equal(mediana([30, 10, 20]), 20);
  assert.equal(distanciaFirme([50, 12, 51]), 50, "uma medida isolada fora do lugar não muda o nível");
  assert.equal(distanciaFirme([50, 0, 52]), 51, "o 0 de uma leitura falha é descartado");
  assert.equal(distanciaFirme([0, 0, 0]), null, "só leituras falhas: não há medida");
  assert.equal(distanciaFirme([]), null);
  assert.equal(distanciaFirme([32]), 32);
});

test("lê a resposta de GET /api/leitura do servidor do sensor", () => {
  const resposta = { device: "esp32-01", distancia: 32.4, status: "atencao", nivel: 1, titulo: "Atenção", mensagem: "Nível de água subindo.", em: "2026-10-07T12:00:00.000Z" };
  assert.deepEqual(lerLeitura(resposta), { distancia: 32.4, em: Date.parse("2026-10-07T12:00:00.000Z"), marca: "2026-10-07T12:00:00.000Z", aparelho: "esp32-01" });
  assert.equal(lerLeitura(null), null, "o servidor responde null antes da primeira leitura");
  assert.equal(lerLeitura({ device: "x" }), null);
  assert.equal(lerLeitura({ distancia: "32" }), null, "o servidor só guarda número");
  assert.deepEqual(lerLeitura({ distancia: 0 }), { distancia: 0, em: null, marca: "", aparelho: null }, "leitura falha chega até a tela, que avisa");
  assert.equal(lerLeitura({ distancia: 10, em: "ontem" }).em, null);
});

test("textos e escala do desenho", () => {
  assert.equal(textoDaDistancia(32.4), "32 cm");
  assert.equal(textoDaDistancia(19.6), "20 cm");
  assert.equal(escalaDoDesenho(), 70);
  assert.equal(escalaDoDesenho({ zonaCega: 0, critico: 8, alerta: 15, atencao: 25 }), 50);
});

test("endereço do servidor do sensor digitado em Ajustes", () => {
  assert.equal(arrumarEndereco(""), ENDERECO_PADRAO);
  assert.equal(arrumarEndereco("  "), ENDERECO_PADRAO);
  assert.equal(arrumarEndereco("192.168.0.10"), "http://192.168.0.10:3000", "sem porta vale a 3000 do código do grupo");
  assert.equal(arrumarEndereco("192.168.0.10:8080"), "http://192.168.0.10:8080");
  assert.equal(arrumarEndereco("http://localhost:3000/"), "http://localhost:3000");
  assert.equal(arrumarEndereco("http://192.168.0.10:3000/api/leitura"), "http://192.168.0.10:3000", "o caminho é descartado");
  assert.equal(arrumarEndereco("https://sensor.exemplo.com"), "https://sensor.exemplo.com");
  assert.equal(arrumarEndereco("http://"), null);
  assert.equal(arrumarEndereco("isto não é endereço"), null);
  assert.equal(arrumarEndereco("localhost 3000"), null, "com espaço não é endereço");
  assert.equal(arrumarEndereco("http://[::1]:3000"), "http://[::1]:3000");
  assert.equal(arrumarEndereco("notebook-do-grupo.local"), "http://notebook-do-grupo.local:3000");
});

test("https só fala com http quando o servidor está neste computador", () => {
  assert.equal(ehEsteComputador("http://localhost:3000"), true);
  assert.equal(ehEsteComputador("http://127.0.0.1:3000"), true);
  assert.equal(ehEsteComputador("http://192.168.0.10:3000"), false);
  assert.equal(podeSerBloqueado("http://localhost:3000", "https:"), false);
  assert.equal(podeSerBloqueado("http://192.168.0.10:3000", "https:"), true);
  assert.equal(podeSerBloqueado("http://192.168.0.10:3000", "http:"), false, "pelo npm run demo não há bloqueio");
  assert.equal(podeSerBloqueado("https://sensor.exemplo.com", "https:"), false);
});
