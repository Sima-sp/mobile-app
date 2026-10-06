// Pequenos ganchos (hooks) usados por mais de uma tela.

import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";

const ContextoRota = createContext(null);

/**
 * Guarda o endereço da tela anterior (ex.: "/menu"), ou null quando o app acabou de abrir.
 * As telas usam isso para escolher a animação: quem vem do mapa sobe de baixo; quem vem de outra
 * tela só troca de conteúdo.
 */
export function ProvedorRota({ children }) {
  const { pathname } = useLocation();
  const registro = useRef({ atual: pathname, anterior: null });
  if (registro.current.atual !== pathname) registro.current = { atual: pathname, anterior: registro.current.atual };
  return createElement(ContextoRota.Provider, { value: registro.current.anterior }, children);
}

/** Endereço da tela de onde a pessoa veio, ou null. */
export function useRotaAnterior() {
  return useContext(ContextoRota);
}

/**
 * Função de "voltar": volta uma tela no histórico; se a pessoa abriu o app direto nesta tela
 * (por um link, por exemplo), vai para o mapa.
 */
export function useVoltar() {
  const navegar = useNavigate();
  const local = useLocation();
  return useCallback(() => {
    // O react-router marca a primeira entrada do histórico com a chave "default".
    if (local.key === "default") navegar("/", { replace: true });
    else navegar(-1);
  }, [navegar, local.key]);
}

/** true em telas largas (computador, tablet deitado), onde as telas viram uma coluna ao lado do mapa. */
export function useTelaLarga() {
  const consulta = "(min-width: 900px)";
  const [larga, setLarga] = useState(() => window.matchMedia(consulta).matches);
  useEffect(() => {
    const midia = window.matchMedia(consulta);
    const aoMudar = () => setLarga(midia.matches);
    midia.addEventListener("change", aoMudar);
    return () => midia.removeEventListener("change", aoMudar);
  }, []);
  return larga;
}
