// Service worker do SIMA: faz o app continuar abrindo quando a internet falha.
//
// O que ele guarda no aparelho:
// - o app (página, código, estilos e fontes);
// - os pedaços do mapa e as letras dos nomes de rua JÁ VISTOS. Área que nunca foi aberta com
//   internet aparece vazia sem ela.
// O que NÃO guarda: as rotas e a busca de endereço, que sempre precisam de internet.
//
// Regras:
// - A página é buscada sempre na internet primeiro (para pegar a versão nova); só se a rede não
//   responder em alguns segundos vale a cópia guardada.
// - Os arquivos em assets/ têm o conteúdo no nome, então nunca mudam: vale a cópia guardada.
// - Os pedaços do mapa também não mudam: vale a cópia guardada; a quantidade tem limite.
// - Qualquer erro aqui dentro cai no comportamento normal do navegador.
//
// Só é ligado no app publicado (ver src/main.jsx). No `npm run dev` ele não existe.

const VERSAO = "v1";
const CACHE_APP = `sima-app-${VERSAO}`;
const CACHE_MAPA = "sima-mapa-v1";
const SERVIDOR_DO_MAPA = "tiles.openfreemap.org";
/** Quantos pedaços de mapa e de letras ficam guardados, no máximo. */
const LIMITE_MAPA = 700;
/** Quanto esperar pela internet antes de usar a cópia guardada da página. */
const ESPERA_MS = 4000;

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE_APP)
      .then((cache) => cache.addAll(["./", "./manifest.webmanifest"]))
      .catch(() => {}) // sem internet na instalação: guarda depois, conforme o uso
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil((async () => {
    for (const nome of await caches.keys()) {
      if (nome.startsWith("sima-app-") && nome !== CACHE_APP) await caches.delete(nome);
    }
    await self.clients.claim();
  })());
});

// A página avisa quais arquivos já baixou antes de este service worker existir (primeira visita).
self.addEventListener("message", (evento) => {
  if (evento.data?.tipo === "guardar" && Array.isArray(evento.data.urls)) evento.waitUntil(guardarLista(evento.data.urls));
});

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET") return;
  let url;
  try {
    url = new URL(pedido.url);
  } catch {
    return;
  }

  if (url.hostname === SERVIDOR_DO_MAPA) {
    // .pbf = pedaço do mapa ou letras; o resto é a descrição do mapa, que muda de vez em quando.
    evento.respondWith(url.pathname.endsWith(".pbf") ? guardadoPrimeiro(pedido, CACHE_MAPA) : redePrimeiro(pedido, CACHE_MAPA));
    return;
  }
  if (url.origin !== self.location.origin) return; // rotas e busca de endereço: sempre pela internet

  if (pedido.mode === "navigate") evento.respondWith(redePrimeiro(pedido, CACHE_APP, "./"));
  else if (url.pathname.includes("/assets/")) evento.respondWith(guardadoPrimeiro(pedido, CACHE_APP));
  else evento.respondWith(redePrimeiro(pedido, CACHE_APP));
});

const servePraGuardar = (resposta) => resposta && resposta.status === 200 && (resposta.type === "basic" || resposta.type === "cors");

async function guardar(nomeDoCache, pedido, resposta) {
  if (!servePraGuardar(resposta)) return;
  try {
    const cache = await caches.open(nomeDoCache);
    await cache.put(pedido, resposta);
    // De vez em quando confere o tamanho do mapa guardado e apaga os pedaços mais antigos.
    if (nomeDoCache === CACHE_MAPA && Math.random() < 0.04) {
      const chaves = await cache.keys();
      for (const chave of chaves.slice(0, Math.max(0, chaves.length - LIMITE_MAPA))) await cache.delete(chave);
    }
  } catch {
    // Sem espaço no aparelho: segue sem guardar.
  }
}

/** Usa a cópia guardada; se não houver, busca na internet e guarda. */
async function guardadoPrimeiro(pedido, nomeDoCache) {
  try {
    const guardado = await caches.match(pedido);
    if (guardado) return guardado;
  } catch {
    // segue para a internet
  }
  const resposta = await fetch(pedido);
  guardar(nomeDoCache, pedido, resposta.clone());
  return resposta;
}

/** Busca na internet e guarda; se a rede falhar ou demorar, usa a cópia guardada. */
async function redePrimeiro(pedido, nomeDoCache, reserva) {
  const daRede = fetch(pedido).then((resposta) => {
    guardar(nomeDoCache, pedido, resposta.clone());
    return resposta;
  });
  daRede.catch(() => {}); // a falha é tratada abaixo; isto só evita o aviso de erro sem tratamento
  const guardada = async () => (await caches.match(pedido, { ignoreSearch: true })) || (reserva ? caches.match(reserva) : undefined);
  try {
    const demorou = new Promise((_, rejeitar) => setTimeout(() => rejeitar(new Error("demorou")), ESPERA_MS));
    return await Promise.race([daRede, demorou]);
  } catch {
    const copia = await guardada();
    if (copia) return copia;
    return daRede; // sem cópia: espera a internet o tempo que for (ou falha como falharia sem este arquivo)
  }
}

/** Guarda uma lista de endereços que a página já tinha baixado. */
async function guardarLista(urls) {
  for (const endereco of urls.slice(0, 300)) {
    try {
      const url = new URL(endereco);
      const doMapa = url.hostname === SERVIDOR_DO_MAPA;
      if (!doMapa && url.origin !== self.location.origin) continue;
      if (await caches.match(endereco)) continue;
      const resposta = await fetch(endereco, { mode: doMapa ? "cors" : "same-origin" });
      await guardar(doMapa ? CACHE_MAPA : CACHE_APP, endereco, resposta);
    } catch {
      // Um arquivo que falha não impede os outros.
    }
  }
}
