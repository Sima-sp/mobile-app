// Testes da regra da tela de viagem, sem tela e sem internet.
// Rodar com: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { metros } from "./geometria.js";
import {
  caminhoQueFalta, descreverManobra, giro, horaDeChegada, pontoNoMetro, prepararViagem, rumoEntre, rumoNoMetro, situacaoDaViagem,
  textoAteManobra,
} from "./viagem.js";

// Um "L": segue para leste por ~1 km, vira à esquerda e sobe ~500 m para o norte.
const A = [-46.66, -23.55];
const B = [-46.65, -23.55];
const C = [-46.65, -23.5455];
const CAMINHO = [A, [-46.655, -23.55], B, C];
const ROTA = {
  caminho: CAMINHO,
  minutos: 3,
  manobras: [
    { tipo: 1, texto: "Siga para leste na Avenida Um.", rua: "Avenida Um", segundos: 120, inicio: 0 },
    { tipo: 15, texto: "Vire à esquerda na Rua Dois.", rua: "Rua Dois", segundos: 60, inicio: 2 },
    { tipo: 4, texto: "Você chegou ao destino.", rua: "", segundos: 0, inicio: 3 },
  ],
};
const perto = (a, b, folga) => Math.abs(a - b) <= folga;

test("preparar: mede o caminho e marca o metro de cada manobra", () => {
  const v = prepararViagem(ROTA);
  assert.ok(perto(v.metros, metros(A, B) + metros(B, C), 0.01));
  assert.equal(v.manobras[0].metro, 0);
  assert.ok(perto(v.manobras[1].metro, metros(A, B), 0.01));
  assert.ok(perto(v.manobras[2].metro, v.metros, 0.01));
  assert.equal(v.segundos, 180);
  assert.deepEqual(v.manobras.map((m) => m.faltam), [180, 60, 0]);
});

test("preparar: sem passo a passo, a viagem ainda tem partida e chegada", () => {
  const v = prepararViagem({ caminho: CAMINHO, minutos: 3 });
  assert.equal(v.manobras.length, 2);
  assert.equal(v.segundos, 180);
  const s = situacaoDaViagem(v, 10);
  assert.equal(descreverManobra(s.proxima).seta, "chegada");
});

test("ponto no metro: anda sobre o caminho e não passa das pontas", () => {
  const v = prepararViagem(ROTA);
  assert.deepEqual(pontoNoMetro(v, -50), A);
  assert.deepEqual(pontoNoMetro(v, v.metros + 50), C);
  const meio = pontoNoMetro(v, metros(A, B) / 2);
  assert.ok(perto(meio[0], -46.655, 1e-6) && perto(meio[1], -23.55, 1e-9));
  // Depois da esquina, a longitude para de mudar e a latitude sobe.
  const depois = pontoNoMetro(v, metros(A, B) + 100);
  assert.ok(perto(depois[0], -46.65, 1e-9) && depois[1] > -23.55);
});

test("rumo: leste no primeiro trecho, norte no segundo, e gira na esquina", () => {
  const v = prepararViagem(ROTA);
  assert.ok(perto(rumoEntre(A, B), 90, 0.01));
  assert.ok(perto(rumoEntre(B, C), 0, 0.01));
  assert.ok(perto(rumoNoMetro(v, 100), 90, 0.5));
  assert.ok(perto(rumoNoMetro(v, metros(A, B) + 100), 0, 0.5));
  const naEsquina = rumoNoMetro(v, metros(A, B) - 9); // metade do olhar à frente já dobrou a esquina
  assert.ok(naEsquina > 5 && naEsquina < 85, `na esquina o rumo está entre norte e leste (${naEsquina})`);
  assert.ok(perto(rumoNoMetro(v, v.metros), 0, 0.5), "no fim, usa o último trecho");
});

test("giro: sempre pelo lado mais curto", () => {
  assert.equal(giro(350, 10), 20);
  assert.equal(giro(10, 350), -20);
  assert.equal(giro(90, 270), -180);
  assert.equal(giro(0, 0), 0);
});

test("situação: a próxima manobra, a distância até ela e o que falta", () => {
  const v = prepararViagem(ROTA);
  const esquina = metros(A, B);

  const inicio = situacaoDaViagem(v, 0);
  assert.equal(inicio.proxima.rua, "Rua Dois");
  assert.ok(perto(inicio.ateProxima, esquina, 0.01));
  assert.equal(inicio.seguinte.tipo, 4);
  assert.equal(inicio.ruaAtual, "Avenida Um");
  assert.ok(perto(inicio.restanteSegundos, 180, 0.01));
  assert.equal(inicio.chegou, false);

  const meio = situacaoDaViagem(v, esquina / 2);
  assert.ok(perto(meio.restanteSegundos, 60 + 60, 0.01), "metade do primeiro trecho (60 s) mais o segundo (60 s)");
  assert.ok(perto(meio.restanteMetros, v.metros - esquina / 2, 0.01));

  const depois = situacaoDaViagem(v, esquina + 10);
  assert.equal(depois.proxima.tipo, 4, "depois da esquina, a próxima manobra é a chegada");
  assert.equal(depois.seguinte, null);
  assert.equal(depois.ruaAtual, "Rua Dois");
  assert.ok(depois.restanteSegundos < 60);

  const fim = situacaoDaViagem(v, v.metros + 30);
  assert.equal(fim.chegou, true);
  assert.equal(fim.restanteSegundos, 0);
  assert.equal(fim.restanteMetros, 0);
  assert.deepEqual(fim.ponto, C);
});

test("caminho que falta: começa onde o carro está e termina no destino", () => {
  const v = prepararViagem(ROTA);
  const falta = caminhoQueFalta(v, metros(A, B) / 2 + 10);
  assert.equal(falta.length, 3);
  assert.ok(falta[0][0] > -46.655 && falta[0][0] < -46.65);
  assert.deepEqual(falta[falta.length - 1], C);
  assert.deepEqual(caminhoQueFalta(v, 0), [A, ...CAMINHO.slice(1)]);
});

test("manobra: seta e frase curta; rotatória diz a saída; tipo desconhecido usa a frase do serviço", () => {
  assert.deepEqual(descreverManobra({ tipo: 10, rua: "Rua Augusta" }), { seta: "direita", frase: "Vire à direita", rua: "Rua Augusta" });
  assert.equal(descreverManobra({ tipo: 15, rua: "" }).seta, "esquerda");
  assert.equal(descreverManobra({ tipo: 26, saida: 2, rua: "Rua X" }).frase, "Na rotatória, pegue a 2ª saída");
  assert.equal(descreverManobra({ tipo: 26, rua: "" }).frase, "Entre na rotatória");
  assert.equal(descreverManobra({ tipo: 5, rua: "" }).seta, "chegada");
  assert.deepEqual(descreverManobra({ tipo: 28, texto: "Pegue a balsa.", rua: "" }), { seta: "frente", frase: "Pegue a balsa.", rua: "" });
  assert.equal(descreverManobra({ tipo: 99, texto: "", rua: "" }).frase, "Siga em frente");
});

test("textos: distância até a manobra e hora de chegada", () => {
  assert.equal(textoAteManobra(4), "agora");
  assert.equal(textoAteManobra(18), "20 m");
  assert.equal(textoAteManobra(84), "80 m");
  assert.equal(textoAteManobra(340), "350 m");
  assert.equal(textoAteManobra(980), "1 km");
  assert.equal(textoAteManobra(1240), "1,2 km");
  assert.equal(textoAteManobra(12400), "12 km");
  assert.equal(horaDeChegada(new Date(2026, 9, 7, 14, 20, 0), 12 * 60), "14:32");
  assert.equal(horaDeChegada(new Date(2026, 9, 7, 23, 55, 0), 10 * 60), "00:05");
});
