// Testes da leitura do protótipo do sensor: distância em cm → nível do bueiro.
import test from "node:test";
import assert from "node:assert/strict";
import {
  ALCANCE, LIMITES_PADRAO, arrumarLimites, distanciaFirme, distanciaValida, escalaDoDesenho, lerLeitura, lerLimitesDoServidor, limitesValidos, mediana,
  mesmosLimites, naZonaCega, nivelDaDistancia, textoDaDistancia,
} from "./nivel.js";
import { ENDERECO_PADRAO, arrumarEndereco, ehEsteComputador, podeSerBloqueado } from "./servidor.js";

test("o nível: quanto menor a distância, mais cheio; o crítico começa acima do mínimo do sensor", () => {
  assert.deepEqual(ALCANCE, { minimo: 20, maximo: 2000 });
  assert.deepEqual(LIMITES_PADRAO, { zonaCega: 20, critico: 30, alerta: 45, atencao: 60 });
  assert.equal(nivelDaDistancia(1500), 1, "longe da água: baixo");
  assert.equal(nivelDaDistancia(60.1), 1);
  assert.equal(nivelDaDistancia(60), 2, "no limite de atenção já é médio");
  assert.equal(nivelDaDistancia(45.1), 2);
  assert.equal(nivelDaDistancia(45), 3, "no limite de alerta já é alto");
  assert.equal(nivelDaDistancia(30.1), 3);
  assert.equal(nivelDaDistancia(30), 4, "no limite crítico já é crítico");
  assert.equal(nivelDaDistancia(20), 4, "no mínimo do sensor: crítico");
  assert.equal(nivelDaDistancia(8), 4, "mais perto que o sensor mede: continua crítico");
});

test("medida impossível não vira bueiro cheio", () => {
  // Sem o eco de volta, muito sensor de distância devolve 0. Pela regra pura, 0 seria "crítico".
  for (const ruim of [0, -1, 2001, 9999, NaN, Infinity, null, undefined, "32"]) {
    assert.equal(distanciaValida(ruim), false, `${ruim} não é medida`);
    assert.equal(nivelDaDistancia(ruim), null, `${ruim} não tem nível`);
  }
  assert.equal(distanciaValida(0.5), true);
  assert.equal(distanciaValida(601), true, "o sensor alcança 2000 cm");
  assert.equal(distanciaValida(2000), true);
});

test("zona cega: abaixo do mínimo do sensor a medida deixa de ser confiável", () => {
  assert.equal(naZonaCega(19.9), true);
  assert.equal(naZonaCega(20), false, "20 cm o sensor ainda mede");
  assert.equal(naZonaCega(0), false, "0 não é medida, então não é zona cega");
  assert.equal(naZonaCega(10, { ...LIMITES_PADRAO, zonaCega: 0 }), false);
});

test("os limites escolhidos em Ajustes valem quando cabem no sensor; senão, os padrão", () => {
  assert.deepEqual(arrumarLimites({ critico: 35, alerta: 50, atencao: 80 }), { zonaCega: 20, critico: 35, alerta: 50, atencao: 80 });
  assert.equal(nivelDaDistancia(40, arrumarLimites({ critico: 35, alerta: 50, atencao: 80 })), 3);
  assert.equal(arrumarLimites({ zonaCega: 3, critico: 35, alerta: 50, atencao: 80 }).zonaCega, 20, "a zona cega é do sensor, não é escolha");
  const ruins = [null, undefined, {}, { critico: 50, alerta: 40, atencao: 80 }, { critico: "35", alerta: 50, atencao: 80 }, { critico: 35, alerta: 50 },
    { critico: 20, alerta: 30, atencao: 45 }, { critico: 15, alerta: 30, atencao: 45 }, { critico: 35, alerta: 50, atencao: 2001 }];
  for (const ruim of ruins) {
    assert.equal(limitesValidos(ruim), false, JSON.stringify(ruim));
    assert.equal(arrumarLimites(ruim), LIMITES_PADRAO);
  }
  assert.equal(limitesValidos({ critico: 20.5, alerta: 30, atencao: 2000 }), true);
  assert.equal(limitesValidos(LIMITES_PADRAO), true);
});

test("os limites do servidor do sensor são lidos só para comparar", () => {
  assert.deepEqual(lerLimitesDoServidor({ zonaCega: 15, critico: 20, alerta: 30, atencao: 45 }), { critico: 20, alerta: 30, atencao: 45 });
  for (const ruim of [null, undefined, {}, "ok", { critico: 30, alerta: 20, atencao: 45 }, { critico: 20, alerta: 30 }]) assert.equal(lerLimitesDoServidor(ruim), null);
  assert.equal(mesmosLimites({ critico: 20, alerta: 30, atencao: 45 }, LIMITES_PADRAO), false);
  assert.equal(mesmosLimites({ critico: 30, alerta: 45, atencao: 60 }, LIMITES_PADRAO), true);
  assert.equal(mesmosLimites(null, LIMITES_PADRAO), false);
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
  assert.equal(textoDaDistancia(1873), "1873 cm");
  assert.equal(escalaDoDesenho(), 85);
  assert.equal(escalaDoDesenho({ zonaCega: 20, critico: 35, alerta: 50, atencao: 80 }), 105);
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
