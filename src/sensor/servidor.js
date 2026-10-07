// Conversa com o servidor do sensor: o programa em Node do grupo do IoT.
//
// O caminho da leitura no protótipo:
//   ESP32 ──Wi-Fi──▶ POST /api/leitura  (servidor do sensor, porta 3000)
//   esta tela ─────▶ GET  /api/leitura  (a última leitura, ou null se ainda não chegou nenhuma)
//                    GET  /api/limites  (as distâncias que separam os níveis)
// A tela pergunta uma vez por segundo. O servidor também oferece /api/stream (envio contínuo);
// a pergunta repetida foi escolhida por ser mais simples de acompanhar: cada resposta diz, ao
// mesmo tempo, que o servidor está de pé e qual é a última leitura.
//
// O que é preciso saber:
// - O app publicado é https, e o servidor do sensor é http. Com o servidor no MESMO computador
//   que mostra a tela (http://localhost:3000), o Chrome deixa, mas antes PERGUNTA se a página
//   pode acessar a rede local ou outros apps do dispositivo: é preciso permitir. Enquanto a
//   pergunta está aberta o pedido fica esperando; por isso a primeira espera é longa (ver
//   ESPERA_DA_PERGUNTA). Conferido no Chromium 141: sem permitir o pedido não sai; depois de
//   permitir, responde em milissegundos.
// - Para ler de OUTRO computador (http://192.168.0.10:3000), o caminho garantido é abrir o app por
//   `npm run demo` (http://localhost:5173): página http fala com http sem bloqueio.
// - O servidor precisa aceitar pedidos de outros endereços (CORS). O do grupo já aceita.

/** Onde o servidor do sensor costuma estar: neste computador, na porta do código do grupo. */
export const ENDERECO_PADRAO = "http://localhost:3000";
const PORTA_PADRAO = "3000";

/**
 * Arruma o endereço digitado em Ajustes: "192.168.0.10" vira "http://192.168.0.10:3000".
 * Sem "http://" vale http; sem porta vale 3000; o caminho (/api/...) é descartado.
 * @returns {string|null} null se o texto não é um endereço
 */
export function arrumarEndereco(texto) {
  let digitado = String(texto ?? "").trim();
  if (!digitado) return ENDERECO_PADRAO;
  if (/\s/.test(digitado)) return null; // endereço não tem espaço (há navegador que aceitaria)
  if (!/^https?:\/\//i.test(digitado)) digitado = `http://${digitado}`;
  try {
    const url = new URL(digitado);
    if (!/^(\[[0-9a-f:.]+\]|[a-z0-9]([a-z0-9.-]*[a-z0-9])?)$/i.test(url.hostname)) return null;
    const porta = url.port || (url.protocol === "http:" ? PORTA_PADRAO : "");
    return `${url.protocol}//${url.hostname}${porta ? `:${porta}` : ""}`;
  } catch {
    return null;
  }
}

/** true se o endereço é o do próprio computador. */
export function ehEsteComputador(endereco) {
  try {
    const nome = new URL(endereco).hostname;
    return nome === "localhost" || nome === "[::1]" || /^127\.\d+\.\d+\.\d+$/.test(nome);
  } catch {
    return false;
  }
}

/**
 * true se o navegador tende a bloquear o pedido: página em https pedindo a um http que não é
 * deste computador. A tela usa isto para explicar o que fazer.
 */
export function podeSerBloqueado(endereco, protocoloDaPagina = globalThis.location?.protocol) {
  return protocoloDaPagina === "https:" && /^http:\/\//i.test(endereco) && !ehEsteComputador(endereco);
}

/** Quanto a tela espera por uma resposta do servidor, em milissegundos. */
const ESPERA = 2500;
/** Espera do primeiro pedido quando o navegador ainda vai perguntar sobre a rede local: dá tempo de a pessoa responder. */
const ESPERA_DA_PERGUNTA = 60000;

/**
 * O que o navegador diz sobre esta página acessar a rede local (ou este computador):
 *   "granted"       já foi permitido
 *   "prompt"        ele ainda vai perguntar (ou nem precisa perguntar: página aberta em localhost)
 *   "denied"        a pessoa negou; só muda nas permissões do site
 *   "desconhecida"  este navegador não tem essa permissão (não pergunta nada)
 * O nome da permissão mudou entre versões do Chrome, então são tentados os três que existiram.
 */
export async function permissaoDaRede(endereco) {
  const nomes = ehEsteComputador(endereco) ? ["loopback-network", "local-network-access"] : ["local-network", "local-network-access"];
  for (const name of nomes) {
    try {
      return (await navigator.permissions.query({ name })).state;
    } catch {
      // nome desconhecido neste navegador: tenta o próximo
    }
  }
  return "desconhecida";
}

async function pedir(url, espera = ESPERA) {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), espera);
  try {
    const resposta = await fetch(url, { signal: controle.signal, cache: "no-store" });
    if (!resposta.ok) throw new Error(`O servidor do sensor respondeu ${resposta.status}`);
    return await resposta.json();
  } finally {
    clearTimeout(relogio);
  }
}

/** A última leitura guardada no servidor (o objeto cru), ou null se ainda não chegou nenhuma. */
export const buscarLeitura = (endereco, espera) => pedir(`${endereco}/api/leitura`, espera);
/** Os limites de distância que o servidor usa para classificar. */
export const buscarLimites = (endereco) => pedir(`${endereco}/api/limites`);

/**
 * Pergunta a leitura ao servidor de tempos em tempos, até alguém mandar parar.
 * @param {object} opcoes
 * @param {string} opcoes.endereco                 ex.: "http://localhost:3000"
 * @param {number} [opcoes.intervalo]              milissegundos entre uma pergunta e outra
 * @param {(resposta: object|null) => void} opcoes.aoReceber  o servidor respondeu (null = sem leitura ainda)
 * @param {(erro: Error) => void} opcoes.aoFalhar  o servidor não respondeu desta vez
 * @param {(permissao: string) => void} [opcoes.aoVerPermissao]  o que o navegador diz sobre a rede local (ver permissaoDaRede)
 * @returns {() => void} função que para de perguntar
 */
export function acompanharSensor({ endereco, intervalo = 1000, aoReceber, aoFalhar, aoVerPermissao }) {
  let vivo = true;
  let relogio = null;
  let jaRespondeu = false;
  const perguntar = async () => {
    const permissao = await permissaoDaRede(endereco);
    if (!vivo) return;
    aoVerPermissao?.(permissao);
    try {
      // Antes da primeira resposta o navegador pode estar com a pergunta da rede local aberta.
      const resposta = await buscarLeitura(endereco, permissao === "prompt" && !jaRespondeu ? ESPERA_DA_PERGUNTA : ESPERA);
      jaRespondeu = true;
      if (vivo) aoReceber(resposta);
    } catch (erro) {
      if (vivo) {
        aoVerPermissao?.(await permissaoDaRede(endereco)); // a pessoa pode ter acabado de negar
        if (vivo) aoFalhar(erro);
      }
    }
    if (vivo) relogio = setTimeout(perguntar, intervalo);
  };
  perguntar();
  return function parar() {
    vivo = false;
    clearTimeout(relogio);
  };
}
