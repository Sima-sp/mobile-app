// Escolhe, para cada bueiro, o trecho de rua em volta dele: a "rua afetada" que o mapa pinta
// quando o bueiro está em nível alto ou crítico.
//
// Este arquivo só faz contas (não acessa a rede nem o disco). Quem busca as ruas no OpenStreetMap
// e grava o resultado é o gerar-ruas.mjs, ao lado.
//
// A REGRA
//   1. A rua do bueiro é a via mais próxima dele. Se o endereço cadastrado tem um nome ("Av. do
//      Estado") e existe uma via com esse nome a até 80 m, ela ganha da mais próxima: perto de um
//      cruzamento ou de um viaduto, a via mais próxima nem sempre é a do endereço.
//   2. Entram também as outras vias com o mesmo nome: a continuação da rua e, nas avenidas, a
//      pista do outro sentido.
//   3. De cada via fica só o pedaço a até 300 m do bueiro. É o bastante para o trecho aparecer no
//      mapa na escala de um bairro, sem pintar a avenida inteira.
//   4. Os pedaços que se encostam são emendados (o OpenStreetMap divide uma rua em muitos pedaços),
//      o traçado é simplificado (tolerância de 2 m) e guardado em passos de 0,00001 grau (cerca
//      de 1 m) a partir da posição do bueiro, para o arquivo ficar pequeno.
//
// É uma aproximação: o SIMA monitora o bueiro, não a rua. O trecho mostra onde a água tende a
// aparecer primeiro, e não a mancha exata de um alagamento.

const METROS_POR_GRAU = 111320;

export const REGRAS_RUAS = {
  raioBusca: 320,      // m: até onde procurar vias em volta do bueiro
  raioTrecho: 300,     // m: quanto da rua é pintado para cada lado
  nomeAte: 80,         // m: até onde uma via com o nome do endereço ganha da mais próxima
  longeDemais: 60,     // m: sem via mais perto que isto, o bueiro fica sem trecho
  emenda: 0.6,         // m: pontas mais próximas que isto são a mesma ponta
  tolerancia: 2,       // m: simplificação do traçado
  pedacoMinimo: 10,    // m: pedaços menores que isto são descartados
  passo: 1e-5,         // graus: unidade em que o traçado é guardado
};

/** Tipos de via do OpenStreetMap que contam como rua para carros. */
export const TIPOS_DE_VIA = [
  "motorway", "trunk", "primary", "secondary", "tertiary", "residential", "unclassified", "living_street",
  "motorway_link", "trunk_link", "primary_link", "secondary_link", "tertiary_link",
];

const PALAVRAS_SEM_PESO = new Set([
  "de", "do", "da", "dos", "das", "e",
  "avenida", "rua", "praca", "estrada", "viaduto", "elevado", "ponte", "tunel", "largo", "marginal",
  "rodovia", "alameda", "travessa", "via", "pista", "complexo", "viario",
]);

/** Palavras que identificam uma via: sem acento, sem abreviações ("Av.", "Dr.") e sem "rua", "de"... */
export function palavrasDoNome(texto) {
  if (!texto) return [];
  const limpo = String(texto).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return limpo
    .replace(/[a-z]+\./g, " ") // abreviações terminam em ponto
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 2 && !PALAVRAS_SEM_PESO.has(p));
}

/** true se o nome da via contém todas as palavras do endereço. */
export function mesmoNome(endereco, nomeDaVia) {
  const procuradas = palavrasDoNome(endereco);
  if (procuradas.length === 0) return false;
  const daVia = new Set(palavrasDoNome(nomeDaVia));
  return procuradas.every((p) => daVia.has(p));
}

function distanciaAoSegmento(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const tamanho2 = dx * dx + dy * dy;
  const t = tamanho2 === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / tamanho2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** Menor distância da origem até um caminho em metros (lista de [x, y]). */
function distanciaDaOrigem(caminho) {
  if (caminho.length === 1) return Math.hypot(caminho[0][0], caminho[0][1]);
  let menor = Infinity;
  for (let i = 1; i < caminho.length; i += 1) {
    const d = distanciaAoSegmento(caminho[i - 1][0], caminho[i - 1][1], caminho[i][0], caminho[i][1]);
    if (d < menor) menor = d;
  }
  return menor;
}

/** Fica só com as partes do caminho dentro do círculo de raio `raio` em volta da origem. */
export function recortarNoCirculo(caminho, raio) {
  const pedacos = [];
  let atual = [];
  const dentro = ([x, y]) => x * x + y * y <= raio * raio;
  for (let i = 1; i < caminho.length; i += 1) {
    const a = caminho[i - 1];
    const b = caminho[i];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    // Onde o segmento a→b cruza o círculo: |a + t·(b − a)|² = raio²
    const A = dx * dx + dy * dy;
    const B = 2 * (a[0] * dx + a[1] * dy);
    const C = a[0] * a[0] + a[1] * a[1] - raio * raio;
    const delta = B * B - 4 * A * C;
    let entra = null;
    let sai = null;
    if (A > 0 && delta >= 0) {
      const raiz = Math.sqrt(delta);
      const t1 = (-B - raiz) / (2 * A);
      const t2 = (-B + raiz) / (2 * A);
      if (t1 > 0 && t1 < 1) entra = [a[0] + t1 * dx, a[1] + t1 * dy];
      if (t2 > 0 && t2 < 1) sai = [a[0] + t2 * dx, a[1] + t2 * dy];
    }
    if (dentro(a)) {
      if (atual.length === 0) atual.push(a);
      if (dentro(b)) atual.push(b);
      else {
        atual.push(sai ?? b);
        pedacos.push(atual);
        atual = [];
      }
    } else if (dentro(b)) {
      atual = [entra ?? a, b];
    } else if (entra && sai) {
      pedacos.push([entra, sai]); // o segmento atravessa o círculo de fora a fora
    }
  }
  if (atual.length >= 2) pedacos.push(atual);
  return pedacos;
}

/** Simplificação de Douglas-Peucker: tira os vértices que desviam menos que a tolerância. */
export function simplificar(caminho, tolerancia) {
  if (caminho.length <= 2) return caminho;
  const [ax, ay] = caminho[0];
  const [bx, by] = caminho[caminho.length - 1];
  let maior = 0;
  let onde = 0;
  for (let i = 1; i < caminho.length - 1; i += 1) {
    const d = distanciaAoSegmento(ax - caminho[i][0], ay - caminho[i][1], bx - caminho[i][0], by - caminho[i][1]);
    if (d > maior) { maior = d; onde = i; }
  }
  if (maior <= tolerancia) return [caminho[0], caminho[caminho.length - 1]];
  const antes = simplificar(caminho.slice(0, onde + 1), tolerancia);
  const depois = simplificar(caminho.slice(onde), tolerancia);
  return [...antes.slice(0, -1), ...depois];
}

/**
 * Emenda os pedaços que se encostam pelas pontas, formando linhas contínuas. Num entroncamento
 * (três pontas no mesmo lugar) emenda duas e deixa a terceira como linha à parte.
 */
export function emendar(pedacos, folga) {
  const perto = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= folga;
  const restantes = pedacos.map((p) => [...p]);
  const linhas = [];
  while (restantes.length) {
    let linha = restantes.shift();
    for (let achou = true; achou;) {
      achou = false;
      for (let i = 0; i < restantes.length; i += 1) {
        const outro = restantes[i];
        const fim = linha[linha.length - 1];
        const inicio = linha[0];
        if (perto(fim, outro[0])) linha = [...linha, ...outro.slice(1)];
        else if (perto(fim, outro[outro.length - 1])) linha = [...linha, ...outro.slice(0, -1).reverse()];
        else if (perto(inicio, outro[outro.length - 1])) linha = [...outro.slice(0, -1), ...linha];
        else if (perto(inicio, outro[0])) linha = [...outro.slice(1).reverse(), ...linha];
        else continue;
        restantes.splice(i, 1);
        achou = true;
        break;
      }
    }
    linhas.push(linha);
  }
  return linhas;
}

const comprimento = (caminho) => caminho.slice(1).reduce((soma, p, i) => soma + Math.hypot(p[0] - caminho[i][0], p[1] - caminho[i][1]), 0);

/**
 * O trecho de rua de um bueiro.
 * @param {{ lat: number, lon: number, endereco?: string }} ponto
 * @param {Array<{ id, nome?: string, tipo?: string, geometria: Array<[lon, lat]> }>} vias
 * @returns {{ via: string|null, pelaNome: boolean, distancia: number|null, metros: number,
 *             linhas: number[][] }}  cada linha é [dLon, dLat, dLon, dLat, ...] em passos de
 *   REGRAS_RUAS.passo a partir do ponto
 */
export function trechoDoPonto(ponto, vias, regras = REGRAS_RUAS) {
  const escalaX = Math.cos((ponto.lat * Math.PI) / 180) * METROS_POR_GRAU;
  const emMetros = ([lon, lat]) => [(lon - ponto.lon) * escalaX, (lat - ponto.lat) * METROS_POR_GRAU];

  const perto = [];
  for (const via of vias) {
    if (!via.geometria || via.geometria.length < 2) continue;
    const caminho = via.geometria.map(emMetros);
    const distancia = distanciaDaOrigem(caminho);
    if (distancia <= regras.raioBusca) perto.push({ via, caminho, distancia });
  }
  perto.sort((a, b) => a.distancia - b.distancia);
  const vazio = { via: null, pelaNome: false, distancia: perto[0]?.distancia ?? null, metros: 0, linhas: [] };
  if (perto.length === 0) return vazio;

  const comNome = perto.find((c) => c.distancia <= regras.nomeAte && mesmoNome(ponto.endereco, c.via.nome));
  const escolhida = comNome ?? perto[0];
  if (escolhida.distancia > regras.longeDemais && !comNome) return vazio;

  const chave = palavrasDoNome(escolhida.via.nome).join(" ");
  const daRua = chave
    ? perto.filter((c) => palavrasDoNome(c.via.nome).join(" ") === chave)
    : [escolhida];

  const pedacos = daRua.flatMap(({ caminho }) => recortarNoCirculo(caminho, regras.raioTrecho));
  const linhas = [];
  let total = 0;
  for (const emendada of emendar(pedacos, regras.emenda)) {
    const simples = simplificar(emendada, regras.tolerancia);
    const tamanho = comprimento(simples);
    if (tamanho < regras.pedacoMinimo) continue;
    total += tamanho;
    const linha = [];
    for (const [x, y] of simples) {
      linha.push(Math.round(x / escalaX / regras.passo), Math.round(y / METROS_POR_GRAU / regras.passo));
    }
    linhas.push(linha);
  }
  return { via: escolhida.via.nome ?? null, pelaNome: Boolean(comNome), distancia: Math.round(escolhida.distancia), metros: Math.round(total), linhas };
}

/** A consulta ao OpenStreetMap (Overpass) que traz as vias em volta de uma lista de pontos. */
export function consultaDasVias(pontos, raio = REGRAS_RUAS.raioBusca) {
  const tipos = `^(${TIPOS_DE_VIA.join("|")})$`;
  const partes = pontos.map((p) => `way(around:${raio},${p.lat},${p.lon})[highway~"${tipos}"];`);
  return `[out:json][timeout:90];(${partes.join("")});out tags geom;`;
}

/** Converte a resposta do Overpass na lista de vias que trechoDoPonto espera. */
export function viasDaResposta(resposta) {
  return (resposta.elements ?? [])
    .filter((e) => e.type === "way" && Array.isArray(e.geometry))
    .map((e) => ({ id: e.id, nome: e.tags?.name ?? null, tipo: e.tags?.highway ?? null, geometria: e.geometry.map((g) => [g.lon, g.lat]) }));
}

/** Soma de verificação de um texto (FNV-1a), para conferir que o arquivo não se corrompeu. */
export function somaDeVerificacao(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i += 1) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * O texto do arquivo src/dados/ruasDosBueiros.js.
 * @param {Array<{ id: string, linhas: number[][] }>} trechos  um por ponto, na ordem dos pontos
 * @param {string} data  dia em que as ruas foram buscadas, "AAAA-MM-DD"
 */
export function textoDoArquivo(trechos, data) {
  const corpo = trechos.map((t) => `  ${JSON.stringify(String(t.id))}: ${JSON.stringify(t.linhas)},`).join("\n");
  const soma = somaDeVerificacao(trechos.map((t) => `${t.id} ${JSON.stringify(t.linhas)} ${somaDeVerificacao(JSON.stringify(t.linhas))}`).join("\n"));
  const semTrecho = trechos.filter((t) => t.linhas.length === 0).map((t) => t.id);
  return `// Trecho de rua em volta de cada ponto monitorado: a "rua afetada" que o mapa pinta quando o
// bueiro está em nível alto ou crítico (ver src/mapa/ruasAfetadas.js).
//
// ARQUIVO GERADO por ferramentas/gerar-ruas.mjs em ${data}. Não edite à mão: rode o gerador
// (npm run ruas). A regra de escolha do trecho está em ferramentas/ruas-nucleo.mjs.
//
// Fonte do traçado: OpenStreetMap (© colaboradores do OpenStreetMap, licença ODbL), consultado
// pelo serviço Overpass.
//
// Formato: para cada id de ponto (os de pontosCapital.js), uma lista de linhas. Cada linha é
// [dLon, dLat, dLon, dLat, ...]: passos de PASSO graus (cerca de 1 m) a partir da posição do ponto.
// Pontos sem rua de carro a até ${REGRAS_RUAS.longeDemais} m ficam com a lista vazia${semTrecho.length ? ` (hoje: ${semTrecho.join(", ")})` : ""}.

export const PASSO = ${REGRAS_RUAS.passo};

/** Soma de verificação do conteúdo, impressa pelo gerador. Serve para conferir uma cópia. */
export const SOMA = "${soma}";

export const RUAS_DOS_BUEIROS = {
${corpo}
};
`;
}
