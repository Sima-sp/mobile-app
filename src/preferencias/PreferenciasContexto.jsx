// Preferências do usuário guardadas no aparelho: tema e animações.
// Nada daqui vai para o backend.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const CHAVE = "sima.preferencias";
const Contexto = createContext(null);

/** Tema do sistema, usado enquanto a pessoa não escolhe um. */
function temaDoSistema() {
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "claro" : "escuro";
}

function lerGuardado() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) || "{}") || {};
  } catch {
    return {};
  }
}

/**
 * Põe a classe do tema no <html>. É chamada na hora da troca (e não num efeito) porque o mapa lê
 * as cores do CSS logo em seguida para montar o próprio estilo.
 * A mesma regra roda antes do React em index.html, para a tela não piscar.
 */
function aplicarTema(tema) {
  const raiz = document.documentElement;
  raiz.classList.toggle("thm-light", tema === "claro");
  raiz.classList.toggle("thm-dark", tema !== "claro");
  const cor = getComputedStyle(document.documentElement).getPropertyValue("--iron-800").trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", cor || "#15171a");
}

const MOVIMENTO_REDUZIDO = "(prefers-reduced-motion: reduce)";

/**
 * Liga ou desliga as animações do app (classe .mov-reduzido no <html>, usada pelo CSS).
 * "sistema" segue o aparelho: quem pediu menos movimento nas configurações de acessibilidade não
 * vê telas deslizando. "ligadas" e "reduzidas" valem independentemente do aparelho.
 */
function aplicarAnimacoes(escolha) {
  const reduzir = escolha === "reduzidas" || (escolha !== "ligadas" && window.matchMedia?.(MOVIMENTO_REDUZIDO).matches);
  document.documentElement.classList.toggle("mov-reduzido", Boolean(reduzir));
}

export function ProvedorPreferencias({ children }) {
  const [prefs, setPrefs] = useState(() => {
    const guardado = lerGuardado();
    const inicial = {
      tema: guardado.tema === "claro" || guardado.tema === "escuro" ? guardado.tema : temaDoSistema(),
      animacoes: ["ligadas", "reduzidas"].includes(guardado.animacoes) ? guardado.animacoes : "sistema",
    };
    aplicarTema(inicial.tema);
    aplicarAnimacoes(inicial.animacoes);
    return inicial;
  });

  // Em "sistema", acompanha se a pessoa mudar a configuração do aparelho com o app aberto.
  useEffect(() => {
    aplicarAnimacoes(prefs.animacoes);
    const midia = window.matchMedia?.(MOVIMENTO_REDUZIDO);
    if (!midia) return undefined;
    const aoMudar = () => aplicarAnimacoes(prefs.animacoes);
    midia.addEventListener("change", aoMudar);
    return () => midia.removeEventListener("change", aoMudar);
  }, [prefs.animacoes]);

  const mudar = useCallback((parcial) => {
    if (parcial.tema) aplicarTema(parcial.tema);
    setPrefs((anterior) => {
      const novo = { ...anterior, ...parcial };
      try {
        localStorage.setItem(CHAVE, JSON.stringify(novo));
      } catch {
        // Aba anônima ou sem espaço: a preferência vale só até fechar o app.
      }
      return novo;
    });
  }, []);

  const valor = useMemo(() => ({ ...prefs, mudar }), [prefs, mudar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** @returns {{ tema: "escuro"|"claro", animacoes: "sistema"|"ligadas"|"reduzidas", mudar: (parcial: object) => void }} */
export function usePreferencias() {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("usePreferencias precisa estar dentro de <ProvedorPreferencias>.");
  return valor;
}
