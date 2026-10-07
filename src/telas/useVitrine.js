// Modo vitrine: faz o app passear sozinho quando ninguém está mexendo (ver src/dados/vitrine.js,
// que tem o roteiro). Este arquivo conta o tempo, percebe o toque e comanda o mapa.
//
// Como funciona:
//   1. Com o modo ligado, qualquer toque, tecla ou rolagem zera um relógio. Passado ESPERA_MS sem
//      nada disso, o passeio começa. O Menu também pode mandar começar na hora (comecarVitrine).
//   2. O passeio toca as CENAS em ordem e recomeça: troca o clima da demonstração e ou mostra a
//      cidade inteira, ou seleciona um bueiro em risco (o mapa aproxima e o cartão dele abre).
//   3. No primeiro toque o passeio para. Nada é desfeito: o clima e o mapa ficam como estavam,
//      e quem tocou continua dali.
//   4. Enquanto o modo estiver ligado, o app pede ao aparelho para não apagar a tela (Wake Lock).
//      Nem todo navegador atende; nesse caso vale a configuração de tela do próprio aparelho.

import { useEffect, useRef, useState } from "react";
import { CENAS, ESPERA_MS, escolherBueiro } from "../dados/vitrine";

/** O que conta como "alguém está mexendo". */
const SINAIS_DE_USO = ["pointerdown", "keydown", "wheel", "touchstart"];
/** Aviso que o Menu manda para o passeio começar sem esperar. */
const PEDIDO_DE_INICIO = "sima:vitrine-comecar";

/** Começa o passeio agora (botão "Começar agora" do Menu). Só tem efeito com o modo ligado. */
export function comecarVitrine() {
  window.dispatchEvent(new Event(PEDIDO_DE_INICIO));
}

/**
 * @param {object} opcoes
 * @param {boolean} opcoes.ligada      o modo está ligado no Menu e o app está na demonstração
 * @param {boolean} opcoes.bloqueada   algo na tela pede atenção (a apresentação de primeiro uso): não começa
 * @param {object} opcoes.mapaRef      ref do MapaBase (usa enquadrarTudo)
 * @param {Array} opcoes.pontos        os bueiros de agora
 * @param {Date} opcoes.agora
 * @param {object|null} opcoes.demo    { clima, definirClima } da demonstração
 * @param {Function} opcoes.navegar    o navigate do roteador
 * @returns {{ rodando: boolean }}     true enquanto o app está passeando sozinho
 */
export function useVitrine({ ligada, bloqueada, mapaRef, pontos, agora, demo, navegar }) {
  const [rodando, setRodando] = useState(false);
  // Os relógios leem sempre os valores mais recentes, sem recomeçar a cada desenho da tela.
  const atual = useRef(null);
  atual.current = { bloqueada, pontos, agora, demo, navegar };

  // 1. Espera pela falta de toque (ou pelo pedido do Menu) e para ao primeiro toque.
  useEffect(() => {
    if (!ligada) {
      setRodando(false);
      return undefined;
    }
    let relogio = null;
    const podeComecar = () => document.visibilityState === "visible" && !atual.current.bloqueada;
    const armar = () => {
      clearTimeout(relogio);
      relogio = setTimeout(() => (podeComecar() ? setRodando(true) : armar()), ESPERA_MS);
    };
    const aoMexer = () => {
      setRodando(false);
      armar();
    };
    const aoPedirInicio = () => {
      clearTimeout(relogio);
      if (podeComecar()) setRodando(true);
      else armar();
    };
    SINAIS_DE_USO.forEach((sinal) => window.addEventListener(sinal, aoMexer, { capture: true, passive: true }));
    window.addEventListener(PEDIDO_DE_INICIO, aoPedirInicio);
    armar();
    return () => {
      clearTimeout(relogio);
      SINAIS_DE_USO.forEach((sinal) => window.removeEventListener(sinal, aoMexer, { capture: true }));
      window.removeEventListener(PEDIDO_DE_INICIO, aoPedirInicio);
    };
  }, [ligada]);

  // A apresentação de primeiro uso abriu no meio do passeio: para.
  useEffect(() => {
    if (bloqueada) setRodando(false);
  }, [bloqueada]);

  // 2. O passeio: uma cena de cada vez, em roda.
  useEffect(() => {
    if (!rodando) return undefined;
    let relogio = null;
    let indice = 0;
    const visitados = new Set();
    const tocarCena = () => {
      const cena = CENAS[indice % CENAS.length];
      if (indice % CENAS.length === 0) visitados.clear();
      const { demo: demonstracao, navegar: ir, pontos: bueiros, agora: instante } = atual.current;
      if (demonstracao && demonstracao.clima !== cena.clima) demonstracao.definirClima(cena.clima);
      const alvo = cena.camera === "bueiro" ? escolherBueiro(bueiros, instante, { nivelMinimo: cena.nivelMinimo, evitar: visitados }) : null;
      if (alvo) {
        // Selecionar o bueiro já aproxima o mapa e abre o cartão (ver src/telas/Mapa.jsx).
        visitados.add(alvo.id);
        ir({ pathname: "/", search: `?ponto=${encodeURIComponent(alvo.id)}` }, { replace: true });
      } else {
        // Fecha o que estiver aberto (cartão, outra tela, rota) e mostra a cidade inteira.
        ir("/", { replace: true });
        mapaRef.current?.enquadrarTudo();
      }
      indice += 1;
      relogio = setTimeout(tocarCena, cena.ms);
    };
    tocarCena();
    return () => clearTimeout(relogio);
  }, [rodando, mapaRef]);

  // 3. Tela acesa enquanto o modo estiver ligado. O aparelho solta a trava quando o app sai da
  //    frente; ao voltar, o app pede de novo.
  useEffect(() => {
    if (!ligada || !navigator.wakeLock) return undefined;
    let trava = null;
    let vivo = true;
    const pedir = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const nova = await navigator.wakeLock.request("screen");
        if (vivo) trava = nova;
        else nova.release().catch(() => {});
      } catch {
        // Bateria fraca ou navegador que não deixa: o app segue igual, só não segura a tela.
      }
    };
    pedir();
    document.addEventListener("visibilitychange", pedir);
    return () => {
      vivo = false;
      document.removeEventListener("visibilitychange", pedir);
      trava?.release().catch(() => {});
    };
  }, [ligada]);

  return { rodando };
}
