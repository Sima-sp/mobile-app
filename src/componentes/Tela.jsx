// Moldura das telas que abrem por cima do mapa (Busca, Bairros, Bueiro, Menu...).
// Cuida do que toda tela precisa: animação de entrada e saída, título da aba, foco para leitor
// de tela e o botão de voltar.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { IconeFechar, IconeVoltar } from "./Icones";
import { useRotaAnterior, useVoltar } from "./ganchos";

/** Chama `acao` quando a tecla Esc é apertada. */
export function useEsc(acao, ativo = true) {
  const ultima = useRef(acao);
  ultima.current = acao;
  useEffect(() => {
    if (!ativo) return undefined;
    const aoApertar = (evento) => {
      if (evento.key === "Escape" && !evento.defaultPrevented) ultima.current();
    };
    document.addEventListener("keydown", aoApertar);
    return () => document.removeEventListener("keydown", aoApertar);
  }, [ativo]);
}

const ContextoTela = createContext(null);

/**
 * Moldura de uma tela.
 *
 * Movimento: a tela SOBE de baixo quando a pessoa vem do mapa (como uma folha) e DESCE ao fechar.
 * Quando vem de outra tela (Menu → Bairros, por exemplo) só troca de conteúdo, com um esmaecer
 * rápido, para não ficar subindo e descendo a cada toque.
 *
 * @param {string} titulo     nome da tela (vai para o título da aba e para o leitor de tela)
 * @param {string} [classe]   classes extras
 */
export function Tela({ titulo, classe = "", children }) {
  const raiz = useRef(null);
  const voltar = useVoltar();
  const anterior = useRotaAnterior();
  const [veioDoMapa] = useState(() => anterior === null || anterior === "/");
  const [saindo, setSaindo] = useState(false);

  /** Fecha a tela com a animação de saída e só então volta no histórico. */
  const fechar = useCallback(() => setSaindo(true), []);
  useEsc(fechar); // Esc fecha a tela, como o botão de voltar

  useEffect(() => {
    if (!saindo) return undefined;
    const no = raiz.current;
    let feito = false;
    const concluir = (evento) => {
      if (feito || (evento && evento.target !== no)) return;
      feito = true;
      voltar();
    };
    no.addEventListener("animationend", concluir);
    const garantia = setTimeout(() => concluir(), 420); // se a animação não rodar, volta do mesmo jeito
    return () => {
      no.removeEventListener("animationend", concluir);
      clearTimeout(garantia);
    };
  }, [saindo, voltar]);

  useEffect(() => {
    const tituloAnterior = document.title;
    document.title = `${titulo} · SIMA`;
    // Leva o foco para a tela nova: quem usa teclado ou leitor de tela começa do topo dela.
    raiz.current?.focus({ preventScroll: true });
    return () => {
      document.title = tituloAnterior;
    };
  }, [titulo]);

  let movimento = veioDoMapa ? "tela-sobe" : "tela-troca";
  if (saindo) movimento = veioDoMapa ? "tela-desce" : "tela-some";

  return (
    <ContextoTela.Provider value={fechar}>
      <main ref={raiz} className={`tela ${movimento} ${classe}`} tabIndex={-1} aria-label={titulo} style={{ outline: "none" }}>
        {children}
      </main>
    </ContextoTela.Provider>
  );
}

/** Botão redondo de voltar (ou fechar, quando a tela funciona como uma folha). */
export function BotaoVoltar({ fechar = false, rotulo }) {
  const voltar = useVoltar();
  const fecharTela = useContext(ContextoTela);
  return (
    <button type="button" className="icon-btn" onClick={fecharTela ?? voltar} aria-label={rotulo ?? (fechar ? "Fechar" : "Voltar")}>
      {fechar ? <IconeFechar pequeno /> : <IconeVoltar />}
    </button>
  );
}

/** Cabeçalho padrão: botão de voltar e, logo abaixo, o título grande. */
export function CabecalhoTela({ titulo }) {
  return (
    <>
      <header className="nav"><BotaoVoltar /></header>
      <div className="ltitle"><h1 className="h1">{titulo}</h1></div>
    </>
  );
}
