// Tela "Sensor ao vivo": mostra o protótipo do sensor (ESP32) funcionando, em tempo real.
//
// É uma tela simples, para a bancada de uma apresentação. O protótipo mede a DISTÂNCIA do sensor
// até a água (em cm) e envia pelo Wi-Fi para o servidor do sensor, o programa em Node do grupo do
// IoT. Esta tela pergunta a última leitura a esse servidor uma vez por segundo e mostra:
//   - o nível (baixo, médio, alto, crítico), na mesma escala do mapa;
//   - um desenho do bueiro em corte, com a água subindo e as marcas de cada nível;
//   - como aquele bueiro apareceria no mapa do SIMA.
//
// De onde vem a leitura:
//   - do servidor do sensor (src/sensor/servidor.js), depois de tocar em "Conectar ao sensor"; ou
//   - da simulação desta tela ("Simular sem o sensor"), sempre identificada como simulação. É a
//     reserva se o Wi-Fi ou o protótipo falharem, e serve para mostrar a tela num celular.
// A conta da distância para o nível está em src/sensor/nivel.js (com testes).
//
// Esta tela ainda NÃO liga o sensor ao mapa: a leitura não vira um bueiro do mapa nem vai para o
// backend do SIMA. Isso é o passo seguinte (o ESP32 enviar a leitura ao backend em Java).

import { useCallback, useEffect, useRef, useState } from "react";
import { rotuloNivel } from "../dados/niveis";
import {
  LIMITES_PADRAO, arrumarLimites, distanciaFirme, escalaDoDesenho, lerLeitura, naZonaCega, nivelDaDistancia, textoDaDistancia,
} from "../sensor/nivel";
import { ENDERECO_PADRAO, acompanharSensor, arrumarEndereco, buscarLimites, podeSerBloqueado } from "../sensor/servidor";
import { Tampa } from "../componentes/Tampa";
import { CabecalhoTela, Tela } from "../componentes/Tela";

const CHAVE = "sima.sensor";
const GUARDADAS = 40;
/** A tela pergunta ao servidor a cada tanto. */
const INTERVALO_MS = 1000;
/** Quantas perguntas seguidas sem resposta até a tela dizer que não achou o servidor. */
const FALHAS_PARA_AVISAR = 3;
/** Procurando o servidor há mais que isto, a tela já mostra o que conferir (sem parar de procurar). */
const DEMORA_MS = 8000;
/** Sem leitura nova por este tempo (cinco envios do firmware), a tela avisa que o sensor parou. */
const PARADO_MS = 10000;
/**
 * Leituras mais novas que isto (em relação à última) entram na mediana que a tela mostra.
 * O firmware do protótipo envia uma leitura a cada 2 s, então hoje a tela mostra a última leitura,
 * sem atraso. A mediana só entra em ação se o envio ficar mais rápido que isto.
 */
const JANELA_MS = 1500;
/** A simulação vai desta distância (quase encostando no sensor) até o fim do desenho. */
const SIMULADA_MINIMA = 5;

const DICA_DO_NIVEL = {
  1: "Bueiro com folga.",
  2: "A água está subindo.",
  3: "Água alta: é hora de acompanhar de perto.",
  4: "Quase na boca do bueiro: risco de transbordar.",
};

function lerAjustes() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CHAVE) || "{}") || {};
    return { endereco: arrumarEndereco(guardado.endereco) ?? ENDERECO_PADRAO, ligar: guardado.ligar === true };
  } catch {
    return { endereco: ENDERECO_PADRAO, ligar: false };
  }
}

const haQuanto = (quando, agora) => {
  const s = Math.max(0, Math.round((agora - quando) / 1000));
  if (s < 2) return "agora";
  return s < 60 ? `há ${s} s` : `há ${Math.round(s / 60)} min`;
};

export default function Sensor() {
  const [ajustes, setAjustes] = useState(lerAjustes);
  const [conexao, setConexao] = useState("fora"); // "fora" | "procurando" | "ligado" | "sem-servidor"
  const [leituras, setLeituras] = useState([]); // do servidor: { distancia, quando, marca, aparelho }
  const [limites, setLimites] = useState(LIMITES_PADRAO);
  const [limitesDoServidor, setLimitesDoServidor] = useState(false);
  const [resposta, setResposta] = useState(undefined); // a última resposta crua do servidor
  const [permissao, setPermissao] = useState("desconhecida"); // o que o navegador diz sobre acessar a rede local
  const [buscaDesde, setBuscaDesde] = useState(0); // quando a tela começou a procurar o servidor
  const [simulada, setSimulada] = useState(null); // null (desligada) ou a distância simulada, em cm
  const [enderecoDigitado, setEnderecoDigitado] = useState(ajustes.endereco);
  const [enderecoErrado, setEnderecoErrado] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());

  // Relógio da tela: faz o "há 3 s" andar e percebe quando o sensor para de mandar.
  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(relogio);
  }, []);

  const mudarAjustes = useCallback((parcial) => {
    setAjustes((anterior) => {
      const novo = { ...anterior, ...parcial };
      try {
        localStorage.setItem(CHAVE, JSON.stringify(novo));
      } catch {
        // Sem espaço ou aba anônima: vale só até fechar a tela.
      }
      return novo;
    });
  }, []);

  // Enquanto "ligar" estiver marcado, pergunta a leitura ao servidor. A escolha fica guardada: no
  // computador da bancada a tela volta a conectar sozinha; em qualquer outro aparelho ela só
  // procura o servidor depois que alguém toca em conectar.
  const falhas = useRef(0);
  useEffect(() => {
    if (!ajustes.ligar) {
      setConexao("fora");
      return undefined;
    }
    let vivo = true;
    let pedirLimites = true;
    falhas.current = 0;
    setConexao("procurando");
    setBuscaDesde(Date.now());
    setLeituras([]);
    setResposta(undefined);
    const parar = acompanharSensor({
      endereco: ajustes.endereco,
      intervalo: INTERVALO_MS,
      aoVerPermissao: setPermissao,
      aoReceber: (crua) => {
        falhas.current = 0;
        setConexao("ligado");
        setResposta(crua);
        if (pedirLimites) {
          // Uma vez por conexão (e de novo se o servidor cair e voltar, pois pode ter mudado).
          pedirLimites = false;
          buscarLimites(ajustes.endereco)
            .then((recebidos) => {
              if (!vivo) return;
              const arrumados = arrumarLimites(recebidos);
              setLimites(arrumados);
              setLimitesDoServidor(arrumados !== LIMITES_PADRAO);
            })
            .catch(() => { if (vivo) { setLimites(LIMITES_PADRAO); setLimitesDoServidor(false); } });
        }
        const lida = lerLeitura(crua);
        if (!lida) {
          // O servidor responde `null` quando não tem leitura: acabou de ligar (ou foi reiniciado).
          if (crua === null) setLeituras((anteriores) => (anteriores.length ? [] : anteriores));
          return;
        }
        setLeituras((anteriores) => {
          const ultima = anteriores[anteriores.length - 1];
          // O servidor carimba cada leitura com a hora (`em`): carimbo igual é a mesma leitura de antes.
          if (ultima && lida.marca && ultima.marca === lida.marca) return anteriores;
          // A primeira leitura pode ser antiga (o servidor guarda a última para sempre): vale a
          // hora em que o servidor a recebeu. As seguintes chegaram agora, diante da tela.
          const quando = anteriores.length === 0 && lida.em !== null ? Math.min(Date.now(), lida.em) : Date.now();
          return [...anteriores.slice(-(GUARDADAS - 1)), { ...lida, quando }];
        });
      },
      aoFalhar: () => {
        falhas.current += 1;
        if (falhas.current >= FALHAS_PARA_AVISAR) {
          setConexao("sem-servidor");
          pedirLimites = true;
        }
      },
    });
    return () => { vivo = false; parar(); };
  }, [ajustes.ligar, ajustes.endereco]);

  // Ao ligar a simulação, a tela sobe até o desenho: é lá que o controle aparece.
  const painel = useRef(null);
  const ligarSimulacao = () => {
    setSimulada((atual) => atual ?? Math.round(limites.atencao + 10));
    requestAnimationFrame(() => painel.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  };

  const usarEndereco = () => {
    const arrumado = arrumarEndereco(enderecoDigitado);
    setEnderecoErrado(arrumado === null);
    if (arrumado === null) return;
    setEnderecoDigitado(arrumado);
    if (arrumado !== ajustes.endereco) mudarAjustes({ endereco: arrumado });
  };

  // O que o sensor está dizendo agora.
  const ligado = conexao === "ligado";
  const ultima = leituras[leituras.length - 1] ?? null;
  const penultima = leituras[leituras.length - 2] ?? null;
  // O sensor "parou" quando passa bem mais tempo que o normal dele sem leitura nova.
  // (O ritmo só vale a partir da terceira leitura: a primeira pode ser antiga.)
  const ritmo = leituras.length >= 3 ? Math.min(ultima.quando - penultima.quando, 40000) : 0;
  const parado = ligado && ultima !== null && agora - ultima.quando > Math.max(PARADO_MS, 3 * ritmo);
  const recentes = ultima ? leituras.filter((l) => ultima.quando - l.quando <= JANELA_MS).slice(-3) : [];
  const doSensor = ligado && ultima && !parado ? distanciaFirme(recentes.map((l) => l.distancia)) : null;
  const invalida = ligado && ultima !== null && !parado && doSensor === null;

  // O que a tela mostra: a simulação, quando ligada, ou a medida do sensor.
  const simulando = simulada !== null;
  const distancia = simulando ? simulada : doSensor;
  const nivel = distancia === null ? null : nivelDaDistancia(distancia, limites);
  const escala = escalaDoDesenho(limites);

  // O que conferir quando o servidor não aparece. Com o navegador negando o acesso, o motivo é esse.
  const negado = ajustes.ligar && !ligado && permissao === "denied";
  const demorando = conexao === "procurando" && agora - buscaDesde > DEMORA_MS;
  const semServidor = conexao === "sem-servidor" || demorando || negado;

  let titulo = "Sem leitura";
  let frase = "Conecte ao sensor para começar.";
  if (nivel !== null) {
    titulo = `Nível ${rotuloNivel(nivel).toLowerCase()}`;
    frase = `Água a ${textoDaDistancia(distancia)} do sensor. ${DICA_DO_NIVEL[nivel]}`;
    if (naZonaCega(distancia, limites)) frase += ` A menos de ${textoDaDistancia(limites.zonaCega)}, o sensor já não mede com precisão.`;
  } else if (invalida) {
    titulo = "Leitura inválida";
    frase = `O sensor mandou ${String(ultima.distancia).replace(".", ",")} cm, que não é uma medida possível. Em geral é o sensor sem receber o eco de volta: confira se ele está apontado para a água.`;
  } else if (parado) {
    titulo = "Sensor parado";
    // O firmware só envia quando consegue medir: silêncio pode ser a placa desligada, o Wi-Fi ou o sensor sem eco.
    frase = `A última leitura chegou ${haQuanto(ultima.quando, agora)}. O ESP32 só envia quando consegue medir: confira se ele está ligado, no Wi-Fi e com o sensor apontado para a água.`;
  } else if (ligado) frase = "O servidor respondeu. Esperando a primeira medida do sensor…";
  else if (negado) frase = "O navegador não deixou a página falar com o servidor do sensor.";
  else if (conexao === "procurando") frase = "Procurando o servidor do sensor…";
  else if (conexao === "sem-servidor") frase = "O servidor do sensor não respondeu.";

  let origem = null;
  if (simulando) origem = "Simulação: esta medida não vem do sensor.";
  else if (nivel !== null) origem = `Leitura ${haQuanto(ultima.quando, agora)}${ultima.aparelho ? ` · ${ultima.aparelho}` : ""}`;

  const maximaSimulada = Math.round(escala);
  const posicaoSimulada = simulando ? maximaSimulada + SIMULADA_MINIMA - simulada : 0;

  return (
    <Tela titulo="Sensor ao vivo">
      <CabecalhoTela titulo="Sensor ao vivo" />
      <p className="sub se-intro">
        O protótipo do sensor do SIMA mede a distância até a água. Quanto mais perto a água chega, mais cheio está o bueiro.
      </p>

      <section className="plate se-painel" aria-label="Leitura do sensor" ref={painel}>
        <BueiroEmCorte distancia={distancia} nivel={nivel} limites={limites} escala={escala} />
        {simulando ? (
          // O controle da simulação fica colado no desenho, para a pessoa ver a água subir enquanto arrasta.
          <div className="se-faixa">
            <label className="ia-rotulo" htmlFor="se-simulada">Simulação: arraste para a água subir</label>
            <div className="ia-faixa-caixa">
              <input id="se-simulada" className="ia-faixa" type="range" min="0" max={maximaSimulada} step="1" value={posicaoSimulada}
                aria-valuetext={`Água a ${textoDaDistancia(simulada)} do sensor`}
                style={{ "--pct": `${(posicaoSimulada / maximaSimulada) * 100}%` }}
                onChange={(e) => setSimulada(maximaSimulada + SIMULADA_MINIMA - Number(e.target.value))} />
            </div>
          </div>
        ) : null}
        <div className="se-estado" role="status">
          <p className={`se-titulo ${nivel ? `se-n${nivel}` : ""}`}>{titulo}</p>
          <p className="small">{frase}</p>
          {origem ? <p className="micro se-origem">{origem}</p> : null}
        </div>
        <div className="se-no-app">
          <Tampa nivel={nivel} tamanho={34} />
          <p className="small">
            <b>No mapa do SIMA</b>
            {nivel !== null ? `A tampa deste bueiro apareceria assim: nível ${rotuloNivel(nivel).toLowerCase()}.` : "O bueiro aparece sem leitura até o sensor responder."}
          </p>
        </div>
      </section>

      <div className="se-acoes">
        {ajustes.ligar
          ? <button type="button" className="btn btn-iron ms-acao-neutra" onClick={() => mudarAjustes({ ligar: false })}>Desconectar do sensor</button>
          : <button type="button" className="btn btn-bone" onClick={() => { setSimulada(null); mudarAjustes({ ligar: true }); }}>Conectar ao sensor</button>}
        <p className="micro se-situacao" role="status">
          {conexao === "fora" ? `A tela procura o servidor do sensor em ${ajustes.endereco}. O endereço muda em Ajustes.` : null}
          {conexao === "procurando" ? `Procurando em ${ajustes.endereco}…${permissao === "prompt" ? " Se o navegador perguntar se esta página pode acessar a rede local ou outros apps deste dispositivo, permita." : ""}` : null}
          {ligado ? `Conectado a ${ajustes.endereco}.` : null}
        </p>
        {semServidor ? (
          <div className="small se-erro" role="alert">
            {negado ? (
              <>
                <p>O navegador está impedindo esta página de falar com o servidor do sensor.</p>
                <ul>
                  <li>Clique no ícone à esquerda do endereço da página e libere o acesso à rede local (ou a outros apps deste dispositivo).</li>
                  <li>Depois recarregue a página.</li>
                </ul>
              </>
            ) : (
              <>
                <p>Não achei o servidor do sensor em {ajustes.endereco}. A tela continua tentando.</p>
                <ul>
                  <li>O programa do servidor está rodando?</li>
                  <li>Se o navegador perguntou sobre a rede local, é preciso permitir.</li>
                  {podeSerBloqueado(ajustes.endereco)
                    ? <li>Este endereço é de outro computador, e o navegador pode bloquear esse pedido no app publicado. Rode o servidor neste computador ou abra o app com <code>npm run demo</code>.</li>
                    : <li>O endereço em Ajustes está certo?</li>}
                </ul>
              </>
            )}
          </div>
        ) : null}
      </div>

      {leituras.length ? (
        <>
          <h2 className="grp-t">Últimas leituras</h2>
          <div className="plate se-historico" role="img"
            aria-label={`Últimas ${leituras.length} leituras do sensor. A mais recente: ${nivelDaDistancia(ultima.distancia, limites) ? `${textoDaDistancia(ultima.distancia)}, nível ${rotuloNivel(nivelDaDistancia(ultima.distancia, limites)).toLowerCase()}` : "inválida"}.`}>
            {leituras.map((l) => <i key={`${l.quando}-${l.marca}`} className={`se-ponto se-ponto-n${nivelDaDistancia(l.distancia, limites) ?? 0}`} />)}
          </div>
          <p className="micro se-nota">Cada ponto é uma leitura, na cor do nível. A mais recente fica à direita.</p>
        </>
      ) : null}

      <h2 className="grp-t" id="se-rotulo-simular">Simular sem o sensor</h2>
      <div className="grp se-simular">
        <div className="seg mu-seg" role="group" aria-labelledby="se-rotulo-simular">
          <button type="button" className={simulando ? "" : "seg-on"} aria-pressed={!simulando} onClick={() => setSimulada(null)}>Desligada</button>
          <button type="button" className={simulando ? "seg-on" : ""} aria-pressed={simulando} onClick={ligarSimulacao}>Ligada</button>
        </div>
      </div>
      <p className="micro se-nota">Para mostrar a tela sem o protótipo por perto. Ligada, aparece um controle embaixo do desenho, e a leitura do sensor fica de lado.</p>

      <h2 className="grp-t">Como funcionaria no bueiro</h2>
      <ol className="grp se-passos">
        <li><span aria-hidden="true">1</span><p className="small">O sensor fica preso embaixo da tampa, apontado para baixo, e mede a distância até a água.</p></li>
        <li><span aria-hidden="true">2</span><p className="small">Quanto menor a distância, mais cheio o bueiro. O ESP32 envia a medida pelo Wi-Fi.</p></li>
        <li><span aria-hidden="true">3</span><p className="small">O app mostra o nível do bueiro no mapa, e a IA usa essa leitura para calcular a chance de alagar.</p></li>
      </ol>
      <p className="micro se-nota">Aqui é um protótipo: a medida chega a este computador e fica só nesta tela.</p>

      <details className="se-ajustes">
        <summary>Ajustes do sensor</summary>
        <div className="grp se-ajustes-grp">
          <div className="se-endereco">
            <label className="ia-rotulo" htmlFor="se-endereco">Endereço do servidor do sensor</label>
            <div className="se-endereco-linha">
              <input id="se-endereco" className="se-campo" type="text" inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck="false"
                value={enderecoDigitado} aria-invalid={enderecoErrado} aria-describedby="se-endereco-ajuda"
                onChange={(e) => { setEnderecoDigitado(e.target.value); setEnderecoErrado(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") usarEndereco(); }} />
              <button type="button" className="btn btn-iron ms-acao-neutra" onClick={usarEndereco}>Usar</button>
            </div>
            <p className="micro" id="se-endereco-ajuda">
              {enderecoErrado
                ? "Isso não parece um endereço. Exemplo: 192.168.0.10:3000"
                : `Com o servidor neste computador: ${ENDERECO_PADRAO}. Em outro computador da rede: o número dele, como 192.168.0.10. Sem a porta, vale 3000.`}
            </p>
          </div>
          <div className="row row-2 se-linha-parada">
            <span className="row-k">Limites de cada nível
              <span className="row-sub">
                Crítico até {textoDaDistancia(limites.critico)}, alto até {textoDaDistancia(limites.alerta)}, médio até {textoDaDistancia(limites.atencao)} do sensor.
                {" "}{limitesDoServidor ? "Vieram do servidor do sensor." : "São os do app: o servidor ainda não informou os dele."}
              </span>
            </span>
          </div>
        </div>
        <h3 className="se-sub">O que o servidor respondeu</h3>
        <pre className="se-cru" aria-live="off">{resposta === undefined ? "Nada ainda." : JSON.stringify(resposta, null, 1)}</pre>
      </details>
    </Tela>
  );
}

/**
 * Desenho do bueiro em corte: a rua em cima, a tampa, o poço, o sensor embaixo da tampa e a
 * água. A água sobe conforme a distância diminui; as três marcas na parede mostram onde começam
 * os níveis médio, alto e crítico. Sem medida, a água fica no fundo, apagada, e a régua some.
 */
function BueiroEmCorte({ distancia, nivel, limites, escala }) {
  const SENSOR = 62; // onde o sensor termina: dali para baixo ele mede
  const FUNDO = 190; // a água mais baixa que o desenho mostra
  const yDe = (cm) => SENSOR + (Math.min(Math.max(cm, 0), escala) / escala) * (FUNDO - SENSOR);
  const topo = distancia === null ? FUNDO : yDe(distancia);
  const meio = Math.max((SENSOR + topo) / 2, SENSOR + 12);
  const marcas = [[4, limites.critico, "crítico"], [3, limites.alerta, "alto"], [2, limites.atencao, "médio"]];
  const descricao = distancia === null
    ? "Desenho do bueiro em corte, com o sensor embaixo da tampa, sem medida"
    : `Desenho do bueiro em corte: a água está a ${textoDaDistancia(distancia)} do sensor, no nível ${rotuloNivel(nivel).toLowerCase()}`;
  return (
    <svg className={`se-desenho ${distancia === null ? "se-desenho-vazio" : ""}`} viewBox="0 0 320 212" role="img" aria-label={descricao}>
      <defs><clipPath id="se-poco"><rect x="108" y="50" width="104" height="146" /></clipPath></defs>
      {/* Terra dos dois lados e o poço no meio */}
      <rect x="0" y="50" width="108" height="162" className="se-terra" />
      <rect x="212" y="50" width="108" height="162" className="se-terra" />
      <rect x="108" y="196" width="104" height="16" className="se-terra" />
      <rect x="108" y="50" width="104" height="146" className="se-oco" />
      {/* Água */}
      <g clipPath="url(#se-poco)">
        <rect x="108" y="0" width="104" height="160" className="se-agua" style={{ transform: `translateY(${topo}px)` }} />
      </g>
      {/* Onde começa cada nível */}
      {marcas.map(([n, cm, nome], i) => (
        <g key={n} className={`se-lim se-lim-n${n}`}>
          <path d={`M108 ${yDe(cm)}h16`} />
          {i === 0 || yDe(cm) - yDe(marcas[i - 1][1]) >= 13 ? <text x="100" y={yDe(cm) + 4} textAnchor="end" className="se-letra">{nome}</text> : null}
        </g>
      ))}
      {/* Rua e tampa */}
      <rect x="0" y="40" width="320" height="10" className="se-rua" />
      <rect x="108" y="38" width="104" height="12" rx="2" className="se-tampa" />
      <path d="M122 40v8M136 40v8M150 40v8M164 40v8M178 40v8M192 40v8" className="se-frestas" />
      {/* Sensor embaixo da tampa, o fio e a placa */}
      <path d="M172 56h30V30h44" className="se-fio" />
      <rect x="246" y="18" width="52" height="24" rx="5" className="se-placa" />
      <text x="272" y="34" textAnchor="middle" className="se-letra">ESP32</text>
      <rect x="146" y="50" width="28" height="12" rx="3" className="se-sensor" />
      <text x="26" y="33" className="se-letra">rua</text>
      {/* A medida: do sensor até a água */}
      {distancia === null ? null : (
        <g className="se-regua">
          <rect x="0" y="0" width="1.5" height="1" className="se-regua-linha" style={{ transform: `translate(159.25px, ${SENSOR}px) scaleY(${Math.max(topo - SENSOR, 0)})` }} />
          <g className="se-regua-anda" style={{ transform: `translateY(${topo}px)` }}><path d="M153 0h14" /></g>
          <g className="se-regua-anda" style={{ transform: `translateY(${meio}px)` }}>
            <text x="222" y="4" className="se-letra se-letra-medida">{textoDaDistancia(distancia)}</text>
          </g>
        </g>
      )}
    </svg>
  );
}
