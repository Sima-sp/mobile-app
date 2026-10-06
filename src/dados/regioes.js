// Aviso por região: olha os bueiros de cada região (subprefeitura) em conjunto.
//
// Por que existe: o aviso de um bueiro sozinho erra muito. Nos testes do modelo de IA, de cada 100
// horas com aviso de nível alto num ponto, menos de 2 tiveram alagamento registrado. Juntando os
// pontos da mesma subprefeitura, o aviso de risco alto acertou 8 em cada 100 (5 vezes mais).
// O nível de cada bueiro continua sendo a base do mapa e do desvio de rota; a região é contexto.
//
// A regra é a mesma do serviço de IA (ADR 0005 do ml-service):
//   - só recebe aviso a região com pelo menos 3 pontos monitorados (cobertura mínima);
//   - vale a MAIOR chance entre os pontos da região;
//   - limiares próprios, mais altos que os de um ponto: atenção a partir de 1,02 % e risco alto a
//     partir de 2,10 %. Não existe "crítico" por região.
// O app acrescenta uma coisa que é medição, não previsão: se algum bueiro da região está
// transbordando agora, a região entra em risco alto e o aviso diz isso.
//
// O backend tem GET /previsoes/regioes com essa mesma conta. O app ainda calcula por conta própria,
// a partir das previsões de cada ponto, porque o formato daquela resposta não foi conferido.
// Quando for, basta trocar a origem dos dados: as telas só usam o que avisosPorRegiao devolve.

import { compararPorGravidade, nivelVisivel, statusAgora } from "./modelo.js";

export const REGRA_REGIAO = { coberturaMinima: 3, atencao: 0.0102, alto: 0.021 };

/** Nomes do aviso de região. São só dois níveis de aviso; sem aviso, nada é dito. */
export const ROTULO_AVISO = { 2: "Atenção", 3: "Risco alto" };

/**
 * Situação de cada região.
 * @returns {Array<{
 *   nome: string, total: number,
 *   cobertura: boolean,        // tem pontos suficientes para um aviso de região
 *   nivel: 2|3|null,           // 3 = risco alto, 2 = atenção, null = sem aviso
 *   maiorChance: number|null,  // a maior probabilidade válida entre os pontos
 *   transbordando: number,     // quantos bueiros o sensor mediu transbordando agora
 *   emRisco: number,           // quantos bueiros estão em nível alto ou crítico
 *   pontos: object[],          // do mais grave ao mais tranquilo
 * }>} do aviso mais grave para o mais leve; depois as regiões sem aviso, em ordem alfabética.
 */
export function avisosPorRegiao(pontos, agora = new Date()) {
  const grupos = new Map();
  for (const ponto of pontos) {
    if (!grupos.has(ponto.bairro)) grupos.set(ponto.bairro, []);
    grupos.get(ponto.bairro).push(ponto);
  }

  const regioes = [...grupos.entries()].map(([nome, lista]) => {
    let maiorChance = null;
    let transbordando = 0;
    let emRisco = 0;
    for (const ponto of lista) {
      if (ponto.medicaoTransbordando) transbordando += 1;
      if (ponto.medicaoTransbordando || (nivelVisivel(ponto, agora) ?? 0) >= 3) emRisco += 1;
      // Só entra na conta a previsão que ainda vale e que veio com probabilidade.
      const chance = statusAgora(ponto, agora) === "VALIDA" ? ponto.probabilidade : null;
      if (chance !== null && chance !== undefined && (maiorChance === null || chance > maiorChance)) maiorChance = chance;
    }
    const cobertura = lista.length >= REGRA_REGIAO.coberturaMinima;
    let nivel = null;
    if (cobertura) {
      if (transbordando > 0 || (maiorChance ?? 0) >= REGRA_REGIAO.alto) nivel = 3;
      else if ((maiorChance ?? 0) >= REGRA_REGIAO.atencao) nivel = 2;
    }
    return { nome, total: lista.length, cobertura, nivel, maiorChance, transbordando, emRisco, pontos: [...lista].sort(compararPorGravidade) };
  });

  return regioes.sort((a, b) => (b.nivel ?? 0) - (a.nivel ?? 0) || b.transbordando - a.transbordando
    || (b.nivel ? (b.maiorChance ?? 0) - (a.maiorChance ?? 0) : 0) || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** "Sé", "Sé e Mooca", "Sé, Mooca e Lapa" */
function listar(nomes) {
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

/**
 * O aviso curto que vai sobre o mapa, ou null quando nenhuma região está em aviso.
 * Mostra o nível mais grave: com alguma região em risco alto, fala só delas.
 * @returns {{ nivel: 2|3, texto: string, descricao: string }|null}
 */
export function resumoDosAvisos(regioes) {
  const emAlto = regioes.filter((r) => r.nivel === 3);
  const emAtencao = regioes.filter((r) => r.nivel === 2);
  const grupo = emAlto.length ? emAlto : emAtencao;
  if (grupo.length === 0) return null;
  const nivel = emAlto.length ? 3 : 2;
  const rotulo = ROTULO_AVISO[nivel];
  // Até duas regiões cabem pelo nome; acima disso, o número.
  const texto = grupo.length <= 2
    ? `${rotulo}: ${listar(grupo.map((r) => r.nome.split(" / ")[0]))}`
    : `${rotulo} em ${grupo.length} regiões`;
  const descricao = `${rotulo} de alagamento nas próximas 3 horas em ${grupo.length === 1 ? "1 região" : `${grupo.length} regiões`}: ${listar(grupo.map((r) => r.nome))}. Ver os avisos por região.`;
  return { nivel, texto, descricao };
}

/**
 * Em que o aviso da região se apoia, numa linha: quantos bueiros estão em risco. Usada nas listas
 * que já dizem o nível no título do grupo.
 */
export function apoioDaRegiao(regiao) {
  const emRisco = regiao.emRisco
    ? `${regiao.emRisco} de ${regiao.total} bueiros em nível alto ou crítico`
    : "Nenhum bueiro em nível alto por enquanto";
  if (regiao.transbordando > 0) {
    return `${regiao.transbordando === 1 ? "1 bueiro transbordando" : `${regiao.transbordando} bueiros transbordando`} agora · ${emRisco}`;
  }
  return emRisco;
}

/** Frase da região para a tela: o que o aviso diz e em que ele se apoia. */
export function fraseDaRegiao(regiao) {
  if (!regiao.cobertura) {
    return `Com ${regiao.total === 1 ? "1 bueiro monitorado" : `${regiao.total} bueiros monitorados`}, esta região não recebe aviso (o mínimo é ${REGRA_REGIAO.coberturaMinima}). Vale o nível de cada bueiro.`;
  }
  const quantos = (n) => `${n} de ${regiao.total} bueiros`;
  if (regiao.transbordando > 0) {
    return `${regiao.transbordando === 1 ? "1 bueiro transbordando" : `${regiao.transbordando} bueiros transbordando`} agora, medido pelo sensor. ${quantos(regiao.emRisco)} em nível alto ou crítico.`;
  }
  if (regiao.nivel === 3) return `Risco alto de alagamento nas próximas 3 horas. ${quantos(regiao.emRisco)} em nível alto ou crítico.`;
  if (regiao.nivel === 2) {
    return regiao.emRisco
      ? `Risco acima do normal nas próximas 3 horas. ${quantos(regiao.emRisco)} em nível alto ou crítico.`
      : "Risco acima do normal nas próximas 3 horas. Nenhum bueiro em nível alto por enquanto.";
  }
  return "Nenhum sinal de risco acima do normal nas próximas 3 horas.";
}
