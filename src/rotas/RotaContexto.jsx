// Estado das rotas, compartilhado entre a tela de escolher partida e chegada (src/telas/Rotas.jsx)
// e o mapa (src/telas/Mapa.jsx), que desenha o caminho e mostra o cartão da rota.
//
// A rota só é traçada enquanto o mapa está no "modo rota" (`ativa`). Ela é refeita sozinha quando:
// - a partida ou a chegada mudam;
// - a lista de bueiros em risco muda (na demonstração, ao trocar o clima). Durante a troca do
//   clima o app espera a cidade assentar e refaz uma vez só.
// O caminho mais rápido depende só da partida e da chegada, então fica guardado e não é pedido de
// novo a cada mudança de clima.
//
// A VIAGEM (tela de navegação, src/telas/Viagem.jsx) guarda uma cópia da rota escolhida no
// momento de "Começar viagem". Durante a viagem a rota daqui não é refeita: quem cuida de mudar o
// caminho no meio da viagem é a própria tela, que troca a cópia com `trocarRotaDaViagem`.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePontos } from "../dados/PontosContexto";
import { assinaturaDoRisco, planejarRota } from "./planejar";
import { pedirRotaDeCarro } from "./servico";

const CHAVE = "sima.rota";
const Contexto = createContext(null);

const lugarValido = (l) => l && typeof l.lon === "number" && typeof l.lat === "number" && typeof l.nome === "string";

/** Lê a última partida e chegada usadas. "Minha localização" não é guardada: ela muda. */
function lerGuardado() {
  try {
    const dados = JSON.parse(localStorage.getItem(CHAVE) || "{}") || {};
    return { origem: lugarValido(dados.origem) ? dados.origem : null, destino: lugarValido(dados.destino) ? dados.destino : null };
  } catch {
    return { origem: null, destino: null };
  }
}

const ESTADO_VAZIO = { fase: "parada", resultado: null, viagem: null, erro: null, atualizando: false };

export function ProvedorRotas({ children }) {
  const { pontos, agora, demo } = usePontos();
  const [guardado] = useState(lerGuardado);
  const [origem, setOrigem] = useState(guardado.origem);
  const [destino, setDestino] = useState(guardado.destino);
  const [ativa, definirAtiva] = useState(false);
  const [escolhida, escolher] = useState("segura");
  const [estado, setEstado] = useState(ESTADO_VAZIO);
  const [tentativa, setTentativa] = useState(0);
  const [viagemEmCurso, setViagemEmCurso] = useState(null);

  // O cálculo roda depois, fora do desenho: lê sempre os pontos mais recentes.
  const recentes = useRef({ pontos, agora });
  recentes.current = { pontos, agora };
  const rapidaGuardada = useRef({ viagem: null, rota: null });

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ origem: origem?.eu ? null : origem, destino }));
    } catch {
      // Aba anônima ou sem espaço: a rota vale só até fechar o app.
    }
  }, [origem, destino]);

  const viagem = origem && destino ? `${origem.lon},${origem.lat};${destino.lon},${destino.lat}` : null;
  const risco = useMemo(() => assinaturaDoRisco(pontos, agora), [pontos, agora]);
  const climaMudando = Boolean(demo?.mudando);

  useEffect(() => {
    if (!ativa || !viagem || climaMudando) return undefined;
    const controle = new AbortController();
    // Um instante de espera junta mudanças seguidas (trocar partida e chegada, por exemplo) num pedido só.
    const relogio = setTimeout(async () => {
      setEstado((anterior) => (anterior.viagem === viagem && anterior.resultado
        ? { ...anterior, atualizando: true, erro: null }
        : { ...ESTADO_VAZIO, fase: "calculando", viagem }));
      const extremos = { origem: [origem.lon, origem.lat], destino: [destino.lon, destino.lat] };
      try {
        const resultado = await planejarRota({
          ...extremos,
          pontos: recentes.current.pontos,
          agora: recentes.current.agora,
          rapidaPronta: rapidaGuardada.current.viagem === viagem ? rapidaGuardada.current.rota : null,
          pedirRota: (areas) => pedirRotaDeCarro({ ...extremos, areas, sinal: controle.signal }),
        });
        if (controle.signal.aborted) return;
        rapidaGuardada.current = { viagem, rota: resultado.rapida };
        setEstado({ fase: "pronta", resultado, viagem, erro: null, atualizando: false });
      } catch (erro) {
        if (controle.signal.aborted) return;
        console.warn("[SIMA] Não foi possível traçar a rota.", erro);
        let texto = "O serviço de rotas não respondeu. Confira a internet e tente de novo.";
        if (erro?.tipo === "sem-caminho") texto = "Não há caminho de carro entre esses dois lugares.";
        else if (erro?.tipo === "servico") texto = "O serviço de rotas não conseguiu traçar este caminho. Tente de novo em instantes.";
        setEstado((anterior) => ({ ...anterior, fase: anterior.resultado && anterior.viagem === viagem ? "pronta" : "erro", erro: texto, atualizando: false }));
      }
    }, 250);
    return () => {
      clearTimeout(relogio);
      controle.abort();
    };
    // `origem` e `destino` entram pela `viagem`, que muda junto com eles.
  }, [ativa, viagem, risco, climaMudando, tentativa]);

  const definirOrigem = useCallback((lugar) => setOrigem(lugar), []);
  const definirDestino = useCallback((lugar) => setDestino(lugar), []);
  const inverter = useCallback(() => {
    setOrigem(destino);
    setDestino(origem);
  }, [origem, destino]);
  const tentarDeNovo = useCallback(() => setTentativa((n) => n + 1), []);
  // `partida` numera as viagens começadas (cada uma tem um número novo, mesmo depois de a anterior
  // ter sido encerrada); `troca` conta as mudanças de caminho dentro da mesma viagem.
  const viagensComecadas = useRef(0);
  const iniciarViagem = useCallback((rota, lugarDeChegada) => {
    viagensComecadas.current += 1;
    setViagemEmCurso({ rota, destino: lugarDeChegada, partida: viagensComecadas.current, troca: 0 });
  }, []);
  const trocarRotaDaViagem = useCallback((rota) => {
    setViagemEmCurso((anterior) => (anterior ? { ...anterior, rota, troca: anterior.troca + 1 } : anterior));
  }, []);
  const encerrarViagem = useCallback(() => setViagemEmCurso(null), []);

  // O resultado só vale para a viagem atual: ao trocar o destino, o caminho antigo some na hora.
  const doMomento = estado.viagem === viagem ? estado : { ...ESTADO_VAZIO, fase: viagem && ativa ? "calculando" : "parada" };
  const temDuasOpcoes = doMomento.resultado?.situacao === "desvia" || doMomento.resultado?.situacao === "parcial";

  const valor = useMemo(() => ({
    origem, destino, definirOrigem, definirDestino, inverter,
    ativa, definirAtiva,
    fase: doMomento.fase,
    resultado: doMomento.resultado,
    erro: doMomento.erro,
    atualizando: doMomento.atualizando || (climaMudando && ativa && Boolean(doMomento.resultado)),
    escolhida: temDuasOpcoes ? escolhida : "segura",
    escolher,
    tentarDeNovo,
    viagem: viagemEmCurso, iniciarViagem, trocarRotaDaViagem, encerrarViagem,
  }), [origem, destino, definirOrigem, definirDestino, inverter, ativa, doMomento.fase, doMomento.resultado, doMomento.erro,
    doMomento.atualizando, climaMudando, temDuasOpcoes, escolhida, tentarDeNovo, viagemEmCurso, iniciarViagem, trocarRotaDaViagem,
    encerrarViagem]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/**
 * @returns {{
 *   origem: object|null, destino: object|null, definirOrigem: Function, definirDestino: Function, inverter: Function,
 *   ativa: boolean, definirAtiva: Function,
 *   fase: "parada"|"calculando"|"pronta"|"erro", resultado: object|null, erro: string|null, atualizando: boolean,
 *   escolhida: "segura"|"rapida", escolher: Function, tentarDeNovo: Function,
 *   viagem: { rota: object, destino: object, partida: number, troca: number }|null,
 *   iniciarViagem: (rota: object, destino: object) => void, trocarRotaDaViagem: (rota: object) => void, encerrarViagem: () => void,
 * }}
 */
export function useRotas() {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("useRotas precisa estar dentro de <ProvedorRotas>.");
  return valor;
}
