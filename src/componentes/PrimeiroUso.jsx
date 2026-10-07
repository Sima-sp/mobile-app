// Apresentação de primeiro uso: poucos passos, por cima do mapa, na primeira vez que o app abre.
// Explica só o que a pessoa precisa para ler o mapa sozinha: a tampa e os níveis, a diferença
// entre medido e previsto, o clima da demonstração (quando é demonstração) e a busca com rota.
// O último passo oferece usar a localização; o navegador só pergunta se a pessoa tocar no botão.
//
// Aparece uma vez por aparelho (fica anotado no próprio aparelho) e só quando o app abre no mapa:
// quem chega por um link direto para um bueiro vê o bueiro. Pode ser revista pelo Menu.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import { usePontos } from "../dados/PontosContexto";
import { corNivel, rotuloNivel } from "../dados/niveis";
import { Tampa } from "./Tampa";
import { IconeBusca, IconeChuva, IconeChuvisco, IconeRota, IconeSol, IconeTempestade } from "./Icones";

const CHAVE = "sima.apresentacao";
const Contexto = createContext(null);

function jaVista() {
  try {
    return localStorage.getItem(CHAVE) === "vista";
  } catch {
    return true; // sem acesso ao armazenamento não dá para lembrar: melhor não repetir a cada abertura
  }
}

/**
 * Guarda se a apresentação está aberta e o pedido de "usar minha localização" feito nela.
 * O mapa (src/telas/Mapa.jsx) lê os dois: fica fora do alcance do teclado enquanto ela está
 * aberta e centraliza na pessoa quando o pedido muda.
 */
export function ProvedorApresentacao({ children }) {
  const local = useLocation();
  const [aberta, setAberta] = useState(() => local.pathname === "/" && !local.search && !jaVista());
  const [pedidoDeLocalizacao, setPedido] = useState(0);

  const abrir = useCallback(() => setAberta(true), []);
  const fechar = useCallback(() => {
    setAberta(false);
    try {
      localStorage.setItem(CHAVE, "vista");
    } catch {
      // Aba anônima ou sem espaço: a apresentação volta a aparecer na próxima abertura.
    }
  }, []);
  const pedirLocalizacao = useCallback(() => setPedido((n) => n + 1), []);

  const valor = useMemo(() => ({ aberta, abrir, fechar, pedidoDeLocalizacao, pedirLocalizacao }),
    [aberta, abrir, fechar, pedidoDeLocalizacao, pedirLocalizacao]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** @returns {{ aberta: boolean, abrir: () => void, fechar: () => void, pedidoDeLocalizacao: number, pedirLocalizacao: () => void }} */
export function useApresentacao() {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("useApresentacao precisa estar dentro de <ProvedorApresentacao>.");
  return valor;
}

/* ───────────── Os passos ───────────── */

function DesenhoNiveis() {
  return (
    <div className="pu-niveis">
      {[1, 2, 3, 4].map((n) => (
        <span key={n} style={{ color: corNivel(n) }}><Tampa nivel={n} tamanho={44} />{rotuloNivel(n)}</span>
      ))}
    </div>
  );
}

function DesenhoMedidoPrevisto() {
  return (
    <div className="pu-fatos">
      <div><span className="pu-etiqueta">Medido</span><b>Água 71%</b><span>pelo sensor</span></div>
      <div><span className="pu-etiqueta pu-etiqueta-ia">Previsto</span><b>Chance 2,4%</b><span>pela IA, em 3 h</span></div>
    </div>
  );
}

function DesenhoClima() {
  return (
    <div className="pu-clima">
      <span><IconeSol /></span><span><IconeChuvisco /></span><span className="pu-clima-on"><IconeChuva /></span><span><IconeTempestade /></span>
    </div>
  );
}

function DesenhoBusca() {
  return (
    <div className="pu-busca">
      <IconeBusca /><span>Buscar lugar ou bueiro</span><i><IconeRota pequeno /></i>
    </div>
  );
}

const PASSO_NIVEIS = {
  id: "niveis", titulo: "O risco de cada bueiro, na tampa", desenho: <DesenhoNiveis />,
  texto: "Cada tampa no mapa é um bueiro monitorado. Ela enche conforme o risco de alagar nas próximas 3 horas. Quando o risco é alto, a rua em volta também fica pintada.",
};
const PASSO_MEDIDO = {
  id: "medido", titulo: "Medido pelo sensor, previsto pela IA", desenho: <DesenhoMedidoPrevisto />,
  texto: "Toque numa tampa. O nível da água é leitura do sensor. Com ele, a chuva e o histórico do lugar, a IA estima a chance de alagar: um risco, não uma certeza.",
};
const PASSO_CLIMA = {
  id: "clima", titulo: "Faça chover", desenho: <DesenhoClima />,
  texto: "Esta é uma demonstração, com chuva e leituras de exemplo. Toque nas nuvens, no alto do mapa, e veja a chuva atravessar a cidade.",
};
const PASSO_BUSCA = {
  id: "busca", titulo: "Para onde você vai?", desenho: <DesenhoBusca />,
  texto: "Busque um lugar na barra de baixo: o SIMA traça o caminho de carro desviando dos bueiros em risco. Com a sua localização, a rota já sai de onde você está.",
};

/** A apresentação em si. Renderizar uma vez, na raiz do app; ela decide sozinha se aparece. */
export function PrimeiroUso() {
  const { aberta, fechar, pedirLocalizacao } = useApresentacao();
  const { fonte } = usePontos();
  const [indice, setIndice] = useState(0);
  const cartao = useRef(null);

  const passos = useMemo(
    () => (fonte === "demo" ? [PASSO_NIVEIS, PASSO_MEDIDO, PASSO_CLIMA, PASSO_BUSCA] : [PASSO_NIVEIS, PASSO_MEDIDO, PASSO_BUSCA]),
    [fonte],
  );

  // Cada vez que abre, começa do primeiro passo.
  useEffect(() => {
    if (aberta) setIndice(0);
  }, [aberta]);
  // O foco vai para o cartão a cada passo: o leitor de tela lê o título e o texto novos, e quem
  // usa teclado chega ao botão principal com um Tab.
  useEffect(() => {
    if (aberta) cartao.current?.focus({ preventScroll: true });
  }, [aberta, indice]);
  useEffect(() => {
    if (!aberta) return undefined;
    const aoApertar = (evento) => {
      if (evento.key !== "Escape") return;
      evento.preventDefault(); // não deixa o Esc fechar também o que está por baixo
      fechar();
    };
    document.addEventListener("keydown", aoApertar, true);
    return () => document.removeEventListener("keydown", aoApertar, true);
  }, [aberta, fechar]);

  if (!aberta) return null;
  const passo = passos[Math.min(indice, passos.length - 1)];
  const ultimo = indice >= passos.length - 1;

  return (
    <div className="pu" role="dialog" aria-modal="true" aria-labelledby="pu-titulo" aria-describedby="pu-texto">
      <div ref={cartao} className="lg lg-strong pu-cartao" tabIndex={-1}>
        <div className="pu-topo">
          <span className="pu-conta" role="img" aria-label={`Passo ${indice + 1} de ${passos.length}`}>
            {passos.map((p, i) => <i key={p.id} className={i === indice ? "pu-ponto pu-ponto-on" : "pu-ponto"} />)}
          </span>
          {indice > 0 ? <button type="button" className="pu-pular" onClick={() => setIndice(indice - 1)}>Voltar</button> : null}
        </div>
        <div className="pu-desenho" aria-hidden="true">{passo.desenho}</div>
        <h2 id="pu-titulo" className="pu-titulo">{passo.titulo}</h2>
        <p id="pu-texto" className="pu-texto">{passo.texto}</p>
        <div className="pu-acoes">
          {ultimo ? (
            <>
              <button type="button" className="btn btn-bone" onClick={() => { fechar(); pedirLocalizacao(); }}>Usar minha localização</button>
              <button type="button" className="btn btn-iron" onClick={fechar}>Agora não</button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-bone" onClick={() => setIndice(indice + 1)}>Continuar</button>
              <button type="button" className="btn btn-iron" onClick={fechar}>Pular</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
