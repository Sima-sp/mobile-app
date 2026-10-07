// O "ponto" é a unidade do app: um bueiro monitorado, com a última leitura do sensor (medido)
// e a última previsão da IA (previsto). Este arquivo transforma o que vem do backend nesse
// formato e reúne as regras de como cada coisa é dita na tela.
//
// Formato de um ponto:
//   id                    identificador do sensor
//   codigo                rótulo curto, ex.: "VG-01"
//   endereco, bairro      textos para a tela (endereco pode ser null)
//   lat, lon              posição
//   statusSensor          "ATIVO" | "INATIVO" | "MANUTENCAO" | null
//   nivel                 1 a 4, ou null sem previsão (já com o ajuste pela leitura do sensor)
//   nivelModelo           nível que o modelo deu antes do ajuste pelo sensor
//   ajusteSensorAplicado  true = a leitura do sensor subiu o nível
//   probabilidade         0 a 1, ou null (modo regras não devolve probabilidade)
//   probabilidadeSemSensor  a chance só pela chuva e pelo lugar, quando a origem informa as duas
//                         (hoje só a demonstração); serve para mostrar o quanto o sensor pesou
//   janelaHoras           horizonte da previsão (3)
//   status                "VALIDA" | "DESATUALIZADA" | "SEM_PREVISAO"
//   geradaEm, validaAte   Date ou null
//   medicaoTransbordando  true = o sensor mediu o bueiro transbordando (é medição, não previsão)
//   semLeituraSensor      true = previsão feita só com a chuva
//   simulada              true = chuva de demonstração ligada no backend
//   origem                "MODELO" | "REGRAS" | "INDISPONIVEL" | null
//   modeloVersao          versão do modelo de IA que gerou a previsão, ex.: "v1"
//   agua                  nível da água lido pelo sensor, em %, ou null
//                         (o sensor do SIMA mede só a água; o lixo saiu do projeto em 06/10/2026)
//   leituraEm             Date ou null
//   chuvaRecente3h, chuvaPrevista3h   mm, ou null
//   historicoAgua         lista de % das últimas 12 h (opcional)
//   freqHistorica         alagamentos registrados por ano perto do ponto (opcional)

import { CONFIG } from "../config.js";
import { nivelDeTexto, rotuloNivel, semAcento } from "./niveis.js";

/* ───────────── Do backend para o app ───────────── */

const numero = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

/**
 * O backend manda as datas no horário de São Paulo e sem fuso ("2026-10-06T13:18:18").
 * Sem tratamento, um aparelho em outro fuso leria esse texto no horário dele e erraria a validade
 * da previsão. Por isso, quando o texto vem sem fuso, o app acrescenta o de São Paulo (que não tem
 * horário de verão desde 2019). Se o backend passar a mandar o fuso, ele é respeitado.
 */
const FUSO_DO_BACKEND = "-03:00";
export function lerData(v) {
  if (!v) return null;
  const texto = String(v);
  const temFuso = /(Z|[+-]\d{2}:?\d{2})$/.test(texto);
  const d = new Date(temFuso ? texto : `${texto}${FUSO_DO_BACKEND}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Separa a vizinhança do sensor em endereço e bairro.
 * O backend guarda um texto só (TX_VIZINHANCA). Quando ele vem como
 * "R. Chico Pontes — Vila Maria / Vila Guilherme" (com travessão), a primeira parte é o endereço.
 */
export function separarVizinhanca(texto) {
  if (!texto) return { endereco: null, bairro: null };
  const partes = String(texto).split(/\s+[—–]\s+/);
  if (partes.length >= 2) return { endereco: partes[0].trim(), bairro: partes.slice(1).join(" - ").trim() };
  return { endereco: null, bairro: String(texto).trim() };
}

/** Monta o código curto do ponto a partir do bairro e do id: ("Vila Guilherme", 5) → "VG-05". */
export function codigoDoPonto(bairro, id) {
  const palavras = semAcento(bairro || "")
    .split("/")[0]
    .split(/\s+/)
    .filter((p) => p && !["de", "do", "da", "dos", "das"].includes(p.toLowerCase()));
  let sigla = "PT";
  if (palavras.length >= 2) sigla = palavras[0][0] + palavras[1][0];
  else if (palavras.length === 1) sigla = palavras[0].slice(0, 2);
  const numeroId = String(id).padStart(2, "0");
  return `${sigla.toUpperCase()}-${numeroId}`;
}

/**
 * Converte um item de GET /previsoes (PrevisaoResponse do backend) no formato do app.
 *
 * Campos que o backend manda hoje (conferido em 06/10/2026):
 *   sensorId, latitude, longitude, vizinhanca, status, probabilidadeAlagamento, nivelRisco,
 *   nivelRiscoModelo, janelaHoras, geradaEm, validaAte, horaReferencia, medicaoTransbordando,
 *   ajusteSensorAplicado, semLeituraSensor, motivosAjuste, chuvaRecente3hMm, chuvaPrevista3hMm,
 *   origem, modeloVersao, simulada.
 *
 * Campos que AINDA NÃO vêm e que a tela sabe mostrar assim que vierem (nomes sugeridos):
 *   statusSensor ("ATIVO" | "INATIVO" | "MANUTENCAO"), nivelAgua, dataLeitura.
 *   (Se o backend mandar porcentagemLixo, o app ignora: o sensor não mede lixo.)
 *   Sem eles o app mostra "Sem leitura" e não distingue sensor inativo de sensor em manutenção.
 *
 * Devolve null quando o item não tem id ou posição: sem isso não há o que pôr no mapa.
 */
export function normalizarPrevisao(item) {
  const id = item?.sensorId ?? null;
  const lat = numero(item?.latitude);
  const lon = numero(item?.longitude);
  if (id === null || lat === null || lon === null) return null;

  const { endereco, bairro } = separarVizinhanca(item.vizinhanca);
  const nivel = nivelDeTexto(item.nivelRisco);

  return {
    id: String(id),
    codigo: codigoDoPonto(bairro, id),
    endereco,
    bairro: bairro || "Sem bairro",
    lat,
    lon,
    statusSensor: item.statusSensor ?? null,
    nivel,
    nivelModelo: nivelDeTexto(item.nivelRiscoModelo),
    probabilidade: numero(item.probabilidadeAlagamento),
    probabilidadeSemSensor: null, // o backend ainda não manda a chance antes e depois do sensor
    janelaHoras: numero(item.janelaHoras) ?? CONFIG.janelaHorasPadrao,
    status: item.status || (nivel ? "VALIDA" : "SEM_PREVISAO"),
    geradaEm: lerData(item.geradaEm),
    validaAte: lerData(item.validaAte),
    medicaoTransbordando: item.medicaoTransbordando === true,
    ajusteSensorAplicado: item.ajusteSensorAplicado === true,
    semLeituraSensor: item.semLeituraSensor === true,
    simulada: item.simulada === true,
    origem: item.origem ?? null,
    modeloVersao: item.modeloVersao ?? null,
    agua: numero(item.nivelAgua),
    leituraEm: lerData(item.dataLeitura),
    chuvaRecente3h: numero(item.chuvaRecente3hMm),
    chuvaPrevista3h: numero(item.chuvaPrevista3hMm),
    historicoAgua: null,
    freqHistorica: null,
  };
}

/* ───────────── Estado da previsão ───────────── */

/**
 * Status da previsão no relógio do aparelho.
 * Mesmo que o backend tenha dito VALIDA, uma previsão que passou do `validaAte` enquanto o app
 * estava aberto ou sem conexão vira DESATUALIZADA: o número deixa de ser mostrado.
 */
export function statusAgora(ponto, agora = new Date()) {
  if (!ponto.nivel || ponto.status === "SEM_PREVISAO") return "SEM_PREVISAO";
  if (ponto.status === "DESATUALIZADA") return "DESATUALIZADA";
  if (ponto.validaAte && ponto.validaAte.getTime() < agora.getTime()) return "DESATUALIZADA";
  return "VALIDA";
}

/** Nível usado para desenhar a tampa: sem previsão não há nível. */
export function nivelVisivel(ponto, agora) {
  return statusAgora(ponto, agora) === "SEM_PREVISAO" ? null : ponto.nivel;
}

/* ───────────── Como cada coisa é dita na tela ───────────── */

// As horas aparecem sempre no horário de São Paulo, onde quer que o aparelho esteja.
const formatoHora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const formatoNumero = (casas) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** "14:20" */
export function horaCurta(quando) {
  return quando ? formatoHora.format(quando) : "—";
}

/** "agora", "há 3 min", "há 2 h", "há 4 dias" */
export function haQuanto(quando, agora = new Date()) {
  if (!quando) return "—";
  const minutos = Math.max(0, Math.round((agora.getTime() - quando.getTime()) / 60000));
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

/** "18 mm", "7,5 mm" */
export function milimetros(valor) {
  if (valor === null || valor === undefined) return "—";
  return `${formatoNumero(valor < 10 && valor % 1 !== 0 ? 1 : 0).format(valor)} mm`;
}

/** "71%" */
export function porcento(valor) {
  if (valor === null || valor === undefined) return "—";
  return `${Math.round(valor)}%`;
}

/**
 * Probabilidade calibrada do modelo como texto.
 *
 * As probabilidades do modelo são pequenas por natureza (alagamento é raro): o nível ALTO começa
 * perto de 1,2 %. Por isso o app mostra o NÍVEL como informação principal e a porcentagem em
 * segundo plano. Como exibir esse número é decisão em aberto do grupo (recomendação R3 do
 * serviço de IA) — toda a exibição passa por esta função para mudar num lugar só.
 */
export function textoProbabilidade(probabilidade) {
  if (probabilidade === null || probabilidade === undefined) return null;
  const pct = probabilidade * 100;
  if (pct < 0.1) return "menos de 0,1%";
  if (pct < 10) return `${formatoNumero(1).format(pct)}%`;
  return `${Math.round(pct)}%`;
}

/**
 * Resumo do lado "previsto" de um ponto, pronto para a tela.
 * `tipo` diz qual situação é; `titulo` e `detalhe` são os textos.
 */
export function resumoPrevisao(ponto, agora = new Date()) {
  const status = statusAgora(ponto, agora);
  if (ponto.medicaoTransbordando) {
    return { tipo: "transbordando", titulo: "Transbordando agora", detalhe: "Medido pelo sensor" };
  }
  if (status === "SEM_PREVISAO") {
    return { tipo: "sem-previsao", titulo: "Sem previsão", detalhe: "Ainda não há estimativa para este ponto" };
  }
  if (status === "DESATUALIZADA") {
    return { tipo: "desatualizada", titulo: "Previsão desatualizada", detalhe: `Última às ${horaCurta(ponto.geradaEm)}` };
  }
  const chance = textoProbabilidade(ponto.probabilidade);
  if (chance) {
    return { tipo: "probabilidade", titulo: `${chance} em ${ponto.janelaHoras} h`, detalhe: "Chance de alagar" };
  }
  return { tipo: "regras", titulo: `Risco ${rotuloNivel(ponto.nivel).toLowerCase()}`, detalhe: "Estimado por regras, sem a IA" };
}

/**
 * Os dois números do cartão do bueiro, lado a lado: um MEDIDO pelo sensor (o nível da água) e um
 * PREVISTO pela IA (chance de alagar na janela). Com o bueiro transbordando, o segundo deixa de
 * ser previsão e diz "Agora". Quando falta o dado o valor vem como "—", e a
 * `descricao` (lida pelo leitor de tela) diz o motivo por extenso.
 */
export function fatosDoCartao(ponto, agora = new Date()) {
  const semSensor = ponto.statusSensor === "INATIVO" || ponto.agua === null || ponto.semLeituraSensor;
  const status = statusAgora(ponto, agora);
  const janela = ponto.janelaHoras ?? CONFIG.janelaHorasPadrao;
  const chance = status === "VALIDA" ? textoProbabilidade(ponto.probabilidade) : null;

  let previsto;
  if (ponto.medicaoTransbordando) {
    // Bueiro cheio é medição: a coluna da previsão não mostra uma chance ao lado de um fato.
    previsto = { rotulo: "Transbordando", valor: "Agora", descricao: "Transbordando agora, medido pelo sensor" };
  } else if (chance) {
    previsto = { rotulo: `Chance em ${janela} h`, valor: chance.replace("menos de ", "< "), descricao: `${chance} de chance de alagar nas próximas ${janela} horas, previsto pela IA` };
  } else if (status === "VALIDA") {
    previsto = { rotulo: `Risco em ${janela} h`, valor: rotuloNivel(ponto.nivel), descricao: `Risco ${rotuloNivel(ponto.nivel).toLowerCase()} nas próximas ${janela} horas, estimado por regras` };
  } else {
    const motivo = status === "DESATUALIZADA" ? "previsão desatualizada" : "ainda sem previsão";
    previsto = { rotulo: `Chance em ${janela} h`, valor: "—", descricao: `Chance de alagar: ${motivo}` };
  }

  return [
    { id: "agua", rotulo: "Água no bueiro", valor: semSensor ? "—" : porcento(ponto.agua),
      descricao: semSensor ? "Água: sem leitura do sensor" : `Água em ${porcento(ponto.agua)} da capacidade, medida pelo sensor` },
    { id: "previsto", ...previsto },
  ];
}

/** Resumo do lado "medido": leitura do sensor. */
export function resumoLeitura(ponto, agora = new Date()) {
  if (ponto.statusSensor === "INATIVO") return { tipo: "inativo", titulo: "Sensor inativo", detalhe: "Sem leitura neste ponto" };
  if (ponto.agua === null || ponto.semLeituraSensor) {
    const motivo = ponto.statusSensor === "MANUTENCAO" ? "Sensor em manutenção" : "Sensor sem leitura recente";
    return { tipo: "sem-leitura", titulo: "Sem leitura", detalhe: motivo };
  }
  return { tipo: "leitura", titulo: `${porcento(ponto.agua)} de água`, detalhe: "Medido pelo sensor", quando: haQuanto(ponto.leituraEm, agora) };
}

/**
 * A leitura do sensor ainda é recente? O backend só manda para a IA leituras com até 30 minutos
 * (ia.idade-maxima-leitura); o app usa a mesma régua para dizer "sensor online".
 */
export function leituraRecente(ponto, agora = new Date()) {
  return Boolean(ponto.leituraEm) && agora.getTime() - ponto.leituraEm.getTime() <= 30 * 60000;
}

/** Linha de situação do cartão: "Alto · leitura há 3 min". */
export function linhaSituacao(ponto, agora = new Date()) {
  const status = statusAgora(ponto, agora);
  const partes = [];
  if (ponto.medicaoTransbordando) partes.push("Transbordando agora");
  else if (status === "SEM_PREVISAO") partes.push("Sem previsão");
  else if (status === "DESATUALIZADA") partes.push(`${rotuloNivel(ponto.nivel)} · previsão desatualizada`);
  else partes.push(rotuloNivel(ponto.nivel));

  if (ponto.statusSensor === "INATIVO") partes.push("sensor inativo");
  else if (ponto.statusSensor === "MANUTENCAO") partes.push("sensor em manutenção");
  else if (ponto.leituraEm) partes.push(`leitura ${haQuanto(ponto.leituraEm, agora)}`);
  return partes.join(" · ");
}

/** Ordem de gravidade para listas: transbordando primeiro, depois nível, depois água. */
export function compararPorGravidade(a, b) {
  const peso = (p) => (p.medicaoTransbordando ? 10 : 0) + (p.nivel ?? 0);
  return peso(b) - peso(a) || (b.agua ?? -1) - (a.agua ?? -1) || a.codigo.localeCompare(b.codigo);
}
