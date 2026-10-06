// Simulador da tela "Como a IA funciona" (src/telas/ComoFunciona.jsx): os lugares e cenários
// oferecidos e as frases que explicam cada resposta.
//
// A conta em si é a de src/dados/demo.js (simularPrevisao), a mesma que move a demonstração do
// mapa. Não é o modelo de verdade rodando no aparelho: é uma versão simplificada que responde do
// mesmo jeito (mais chuva e mais histórico de alagamento dão mais chance; o sensor ajusta o nível).

import { LIMIARES, PONTOS_BASE, simularPrevisao } from "./demo.js";
import { rotuloNivel } from "./niveis.js";

const formato = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** Lugar do simulador a partir de um ponto monitorado (os da demonstração têm tudo o que precisa). */
export function lugarDoPonto(id) {
  const base = PONTOS_BASE.find((p) => p.id === String(id));
  if (!base) return null;
  return {
    id: base.id, nome: base.endereco, regiao: base.bairro, sensibilidade: base.sensibilidade,
    freqHistorica: base.freqHistorica, distCorrego: base.distCorrego,
  };
}

/**
 * Três lugares reais, escolhidos para mostrar que a mesma chuva dá respostas diferentes:
 * um que quase nunca alaga, um intermediário e o que mais alaga entre os pontos monitorados.
 */
export const LUGARES_DO_SIMULADOR = [
  { ...lugarDoPonto("66"), rotulo: "Alaga pouco" },
  { ...lugarDoPonto("31"), rotulo: "Alaga às vezes" },
  { ...lugarDoPonto("2"), rotulo: "Alaga muito" },
];

/** Atalhos: cada um ajusta os controles para uma situação que vale a pena ver. */
export const CENARIOS = [
  { id: "seco", rotulo: "Dia seco", chuva: 0, agua: 8, lixo: 20 },
  { id: "forte", rotulo: "Chuva forte", chuva: 0.68, agua: 45, lixo: 20 },
  { id: "temporal", rotulo: "Temporal", chuva: 1, agua: 70, lixo: 20 },
  { id: "entupido", rotulo: "Bueiro entupido", chuva: 0.5, agua: 85, lixo: 80 },
  { id: "transbordando", rotulo: "Transbordando", chuva: 0.85, agua: 100, lixo: 40 },
];

/** Nome da chuva pelos milímetros em 3 horas. */
export function rotuloDaChuva(mm) {
  if (mm < 0.5) return "Sem chuva";
  if (mm < 5) return "Chuvisco";
  if (mm < 20) return "Chuva moderada";
  if (mm < 45) return "Chuva forte";
  return "Temporal";
}

/** Força da chuva (0 a 1) que dá esses milímetros em 3 horas: o caminho inverso de chuvaEm3h. */
export function forcaDaChuva(mm) {
  return Math.min(1, Math.max(0, (Math.max(0, mm) / 66) ** (1 / 2.2)));
}

const vezesPorAno = (freq) => {
  if (freq < 1) return "menos de 1 vez por ano";
  const arredondado = Math.round(freq);
  return `cerca de ${arredondado} ${arredondado === 1 ? "vez" : "vezes"} por ano`;
};

/**
 * Responde à simulação e explica a resposta em frases curtas.
 * @param {{ chuva: number, agua: number, lixo: number }} entrada  chuva de 0 a 1; água e lixo em %
 * @param {{ nome, sensibilidade, freqHistorica, distCorrego }} lugar
 * @returns {{ ...resultado de simularPrevisao, rotuloChuva: string,
 *   passos: Array<{ id: "chuva"|"lugar"|"agua"|"lixo", titulo: string, texto: string, efeito: "sobe"|"medido"|null }> }}
 */
export function responder(entrada, lugar) {
  const resultado = simularPrevisao({ ...entrada, sensibilidade: lugar.sensibilidade });
  const { chuvaRecente3h: mm, motivos } = resultado;
  const rotuloChuva = rotuloDaChuva(mm);

  const chuva = {
    id: "chuva",
    titulo: mm < 0.5 ? "Sem chuva" : `${rotuloChuva}: ${formato.format(mm)} mm em 3 h`,
    texto: mm < 0.5 ? "Sem chuva, a chance fica no mínimo em qualquer lugar." : "Quanto mais chuva nas últimas horas, maior a chance.",
    efeito: null,
  };
  const lugarPasso = {
    id: "lugar",
    titulo: lugar.nome,
    texto: `Alagou ${vezesPorAno(lugar.freqHistorica)} nos registros e fica a ${Math.round(lugar.distCorrego)} m de um córrego. Lugar que já alagou mais reage mais à mesma chuva.`,
    efeito: null,
  };

  // Com o nível do modelo já em crítico não há degrau para subir: a leitura conta, mas não muda nada.
  const noTeto = resultado.nivelModelo === 4;

  let agua;
  if (motivos.includes("agua-cheia")) {
    agua = { titulo: "Água em 100%: transbordando", texto: "O sensor mediu o bueiro cheio. O app mostra “Transbordando agora”: é medição, não previsão.", efeito: "medido" };
  } else if (motivos.includes("agua-alta")) {
    agua = noTeto
      ? { titulo: `Água em ${entrada.agua}%: perto do limite`, texto: "A partir de 80% o nível sobe um degrau. Aqui ele já está no máximo.", efeito: null }
      : { titulo: `Água em ${entrada.agua}%: perto do limite`, texto: "A partir de 80% o nível sobe um degrau, mesmo que a chance pela chuva seja pequena.", efeito: "sobe" };
  } else {
    agua = { titulo: `Água em ${entrada.agua}%`, texto: "Abaixo de 80% a leitura não muda o nível.", efeito: null };
  }

  let lixo;
  if (motivos.includes("lixo")) {
    lixo = noTeto
      ? { titulo: `Lixo em ${entrada.lixo}% com chuva`, texto: "Com muito lixo a água escoa pior e o nível sobe um degrau. Aqui ele já está no máximo.", efeito: null }
      : { titulo: `Lixo em ${entrada.lixo}% com chuva`, texto: "Com muito lixo a água escoa pior: o nível sobe um degrau.", efeito: "sobe" };
  } else if (entrada.lixo >= 60 && !motivos.includes("agua-cheia")) {
    lixo = { titulo: `Lixo em ${entrada.lixo}%, sem chuva`, texto: "Muito lixo só pesa quando chove.", efeito: null };
  } else {
    lixo = { titulo: `Lixo em ${entrada.lixo}%`, texto: "Abaixo de 60% a leitura não muda o nível.", efeito: null };
  }

  return { ...resultado, rotuloChuva, passos: [chuva, lugarPasso, { id: "agua", ...agua }, { id: "lixo", ...lixo }] };
}

/** Frase que liga os dois passos: o que a IA disse e o que o sensor fez com isso. */
export function fraseDoResultado(resultado) {
  const daIa = rotuloNivel(resultado.nivelModelo).toLowerCase();
  if (resultado.medicaoTransbordando) return `Pela chuva e pelo lugar a IA diria ${daIa}. Mas o sensor mediu o bueiro cheio, e a medição vale mais que a previsão.`;
  if (resultado.nivel > resultado.nivelModelo) return `Pela chuva e pelo lugar a IA diz ${daIa}. A leitura do sensor sobe o nível para ${rotuloNivel(resultado.nivel).toLowerCase()}.`;
  return `Pela chuva e pelo lugar a IA diz ${daIa}. A leitura do sensor não muda o nível.`;
}

/** Os limiares do modelo em texto, para a explicação dos níveis. */
export const LIMIARES_EM_TEXTO = {
  2: `${formato.format(LIMIARES.medio * 100)}%`,
  3: `${formato.format(LIMIARES.alto * 100)}%`,
  4: `${formato.format(LIMIARES.critico * 100)}%`,
};
