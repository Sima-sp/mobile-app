// Tela "Sensor ao vivo": mostra o protótipo do sensor (ESP32) funcionando, em tempo real.
//
// É uma tela simples, para a bancada de uma apresentação: o ESP32 fica ligado por cabo USB ao
// computador, e a tela mostra se o sensor está SECO ou MOLHADO, num desenho do bueiro em corte.
// O sensor do SIMA detecta água; não mede lixo.
//
// De onde vem a leitura:
//   - do cabo (src/sensor/serial.js), no Chrome ou no Edge do computador; ou
//   - da simulação desta tela ("Simular sem o sensor"), sempre identificada como simulação. Serve
//     de reserva se o cabo falhar e para mostrar a tela num celular.
// Como o texto que o ESP32 escreve pode variar, quem entende a linha é src/sensor/interpretar.js;
// a mensagem crua aparece em "Ajustes", para conferir.
//
// Esta tela ainda NÃO liga o sensor ao mapa: a leitura não vira um bueiro do mapa nem vai para o
// servidor. Isso é o passo seguinte (o ESP32 enviar a leitura ao backend).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SEM_CALIBRAGEM, estadoDaLeitura, interpretarLinha, quantoMolhado } from "../sensor/interpretar";
import { abrirSensor, mensagemDoErro, portasAutorizadas, temSerial } from "../sensor/serial";
import { Tampa } from "../componentes/Tampa";
import { CabecalhoTela, Tela } from "../componentes/Tela";

const CHAVE = "sima.sensor";
const VELOCIDADES = [9600, 57600, 115200];
/** Sem mensagem do sensor por este tempo, a tela avisa que ele está calado. */
const SEM_SINAL_MS = 6000;
const GUARDADAS = 40;

function lerAjustes() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CHAVE) || "{}") || {};
    const numero = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    return {
      velocidade: VELOCIDADES.includes(guardado.velocidade) ? guardado.velocidade : 115200,
      calibragem: { seco: numero(guardado.calibragem?.seco), molhado: numero(guardado.calibragem?.molhado) },
    };
  } catch {
    return { velocidade: 115200, calibragem: SEM_CALIBRAGEM };
  }
}

const haSegundos = (quando, agora) => {
  const s = Math.max(0, Math.round((agora - quando) / 1000));
  if (s < 2) return "agora";
  return s < 60 ? `há ${s} s` : `há ${Math.round(s / 60)} min`;
};

export default function Sensor() {
  const [ajustes, setAjustes] = useState(lerAjustes);
  const [conexao, setConexao] = useState("fora"); // "fora" | "abrindo" | "ligado"
  const [erro, setErro] = useState(null);
  const [linhas, setLinhas] = useState([]); // o que chegou do cabo: { quando, bruto, tipo, palavra, valor, campo }
  const [manual, setManual] = useState(null); // null | "seco" | "molhado" (simulação)
  const [agora, setAgora] = useState(() => Date.now());
  const fechar = useRef(null);
  const suportado = temSerial();

  // Relógio da tela: faz o "há 3 s" andar e percebe quando o sensor fica calado.
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

  const desconectar = useCallback(async () => {
    const funcao = fechar.current;
    fechar.current = null;
    setConexao("fora");
    if (funcao) await funcao();
  }, []);

  const conectar = useCallback(async (porta) => {
    if (fechar.current) await desconectar();
    setErro(null);
    setConexao("abrindo");
    try {
      fechar.current = await abrirSensor({
        velocidade: ajustes.velocidade,
        porta,
        aoReceberLinha: (texto) => {
          const lida = interpretarLinha(texto);
          if (lida) setLinhas((anteriores) => [...anteriores.slice(-(GUARDADAS - 1)), { ...lida, quando: Date.now() }]);
        },
        aoFechar: () => {
          fechar.current = null;
          setConexao("fora");
          setErro("O sensor desconectou. Confira o cabo e conecte de novo.");
        },
      });
      setManual(null);
      setConexao("ligado");
    } catch (falha) {
      fechar.current = null;
      setConexao("fora");
      setErro(mensagemDoErro(falha));
    }
  }, [ajustes.velocidade, desconectar]);

  // Ao abrir a tela: se a pessoa já autorizou uma porta antes, conecta sozinho.
  const jaTentou = useRef(false);
  useEffect(() => {
    if (jaTentou.current) return;
    jaTentou.current = true;
    portasAutorizadas().then((portas) => { if (portas.length === 1) conectar(portas[0]); });
  }, [conectar]);
  // Ao sair da tela, solta a porta (outro programa pode precisar dela).
  useEffect(() => () => { fechar.current?.(); fechar.current = null; }, []);

  const leituras = useMemo(() => linhas.filter((l) => l.tipo === "leitura"), [linhas]);
  const ultima = leituras[leituras.length - 1] ?? null;
  const ultimaLinha = linhas[linhas.length - 1] ?? null;
  const calado = conexao === "ligado" && (!ultimaLinha || agora - ultimaLinha.quando > SEM_SINAL_MS);

  // O estado que a tela mostra: a simulação, quando ligada, ou a última leitura do cabo.
  const doCabo = conexao === "ligado" && ultima ? estadoDaLeitura(ultima, ajustes.calibragem) : null;
  const estado = manual ?? doCabo;
  const fracao = manual ? (manual === "molhado" ? 1 : 0) : (conexao === "ligado" && ultima ? quantoMolhado(ultima, ajustes.calibragem) : null);
  // Chegou um número que o app ainda não sabe ler (não é 0/1 e falta calibrar).
  const precisaCalibrar = !manual && conexao === "ligado" && ultima && ultima.valor !== null && doCabo === null;
  const valorAtual = conexao === "ligado" ? ultima?.valor ?? null : null;

  const marcar = (qual) => {
    if (valorAtual === null) return;
    mudarAjustes({ calibragem: { ...ajustes.calibragem, [qual]: valorAtual } });
  };

  let titulo = "Sem leitura";
  let frase = suportado ? "Conecte o sensor para começar." : "Use a simulação abaixo para ver como a tela reage.";
  if (estado === "molhado") { titulo = "Molhado"; frase = "A água chegou ao sensor."; }
  else if (estado === "seco") { titulo = "Seco"; frase = "A água não chegou ao sensor."; }
  else if (precisaCalibrar) { titulo = `Valor ${ultima.valor}`; frase = "O sensor está mandando um número. Diga ao app o que é seco e o que é molhado, logo abaixo."; }
  else if (conexao === "ligado") frase = calado ? "Conectado, mas o sensor não mandou nada ainda." : "Recebendo mensagens do sensor…";

  let origem = null;
  if (manual) origem = "Simulação: este estado não vem do sensor.";
  else if (conexao === "ligado" && ultima) origem = `Leitura ${haSegundos(ultima.quando, agora)}${ultima.valor !== null ? ` · valor ${ultima.valor}` : ""}`;

  return (
    <Tela titulo="Sensor ao vivo">
      <CabecalhoTela titulo="Sensor ao vivo" />
      <p className="sub se-intro">
        O protótipo do sensor do SIMA, ligado por cabo a este computador. Ele avisa quando a água chega até ele.
      </p>

      <section className="plate se-painel" aria-label="Leitura do sensor">
        <BueiroEmCorte estado={estado} fracao={fracao} />
        <div className="se-estado" role="status">
          <p className={`se-titulo ${estado ? `se-${estado}` : ""}`}>{titulo}</p>
          <p className="small">{frase}</p>
          {origem ? <p className="micro se-origem">{origem}</p> : null}
        </div>
        {precisaCalibrar ? (
          <div className="se-calibrar">
            <button type="button" className="btn btn-iron" onClick={() => marcar("seco")}>Agora está seco</button>
            <button type="button" className="btn btn-iron" onClick={() => marcar("molhado")}>Agora está molhado</button>
          </div>
        ) : null}
        <div className="se-no-app">
          <Tampa nivel={estado === "molhado" ? 4 : estado === "seco" ? 1 : null} tamanho={34} />
          <p className="small">
            <b>No mapa do SIMA</b>
            {estado === "molhado" ? "Bueiro cheio: nível crítico, medido pelo sensor." : null}
            {estado === "seco" ? "Sem água no sensor: vale a previsão pela chuva." : null}
            {estado === null ? "O bueiro aparece sem leitura até o sensor responder." : null}
          </p>
        </div>
      </section>

      <div className="se-acoes">
        {suportado ? (
          conexao === "ligado"
            ? <button type="button" className="btn btn-iron ms-acao-neutra" onClick={desconectar}>Desconectar o sensor</button>
            : <button type="button" className="btn btn-bone" onClick={() => conectar()} disabled={conexao === "abrindo"}>
                {conexao === "abrindo" ? "Abrindo a porta…" : "Conectar o sensor"}
              </button>
        ) : null}
        <p className="micro se-situacao" role="status">
          {!suportado ? "Este navegador não conversa com o sensor pelo cabo. Abra esta tela no Chrome ou no Edge, no computador." : null}
          {suportado && conexao === "fora" && !erro ? "Ligue o ESP32 no cabo USB, toque em conectar e escolha a porta na janela do navegador." : null}
          {suportado && conexao === "ligado" ? (calado ? "Conectado, sem mensagens. Se não chegar nada, confira a velocidade em Ajustes." : "Conectado: recebendo do sensor.") : null}
        </p>
        {erro ? <p className="small se-erro" role="alert">{erro}</p> : null}
      </div>

      {leituras.length ? (
        <>
          <h2 className="grp-t">Últimas leituras</h2>
          <div className="plate se-historico" role="img"
            aria-label={`Últimas ${leituras.length} leituras: ${leituras.filter((l) => estadoDaLeitura(l, ajustes.calibragem) === "molhado").length} com o sensor molhado`}>
            {leituras.map((l) => {
              const e = estadoDaLeitura(l, ajustes.calibragem);
              return <i key={l.quando + l.bruto} className={e ? `se-ponto se-ponto-${e}` : "se-ponto"} />;
            })}
          </div>
          <p className="micro se-legenda"><i className="se-ponto se-ponto-seco" />seco<i className="se-ponto se-ponto-molhado" />molhado<span>mais recente à direita</span></p>
        </>
      ) : null}

      <h2 className="grp-t" id="se-rotulo-simular">Simular sem o sensor</h2>
      <div className="grp" style={{ padding: 10 }}>
        <div className="seg mu-seg" role="group" aria-labelledby="se-rotulo-simular">
          {[[null, "Desligada"], ["seco", "Seco"], ["molhado", "Molhado"]].map(([valor, rotulo]) => (
            <button key={rotulo} type="button" className={manual === valor ? "seg-on" : ""} aria-pressed={manual === valor} onClick={() => setManual(valor)}>{rotulo}</button>
          ))}
        </div>
      </div>
      <p className="micro se-nota">Para mostrar a tela sem o protótipo por perto. Com a simulação ligada, a leitura do cabo fica de lado.</p>

      <h2 className="grp-t">Como funcionaria no bueiro</h2>
      <ol className="grp se-passos">
        <li><span aria-hidden="true">1</span><p className="small">O sensor fica preso dentro do bueiro, perto da boca.</p></li>
        <li><span aria-hidden="true">2</span><p className="small">Quando a água sobe até ele, o ESP32 avisa o servidor do SIMA, sem fio.</p></li>
        <li><span aria-hidden="true">3</span><p className="small">O app mostra o bueiro cheio no mapa, e a IA usa essa leitura para calcular a chance de alagar.</p></li>
      </ol>
      <p className="micro se-nota">Aqui é um protótipo: está no cabo e a leitura fica só nesta tela.</p>

      <details className="se-ajustes">
        <summary>Ajustes do sensor</summary>
        <div className="grp" style={{ margin: "10px 0 0" }}>
          <label className="row" htmlFor="se-velocidade">
            <span className="row-k">Velocidade<span className="row-sub">A mesma do Serial.begin(...) no código do ESP32. Vale na próxima conexão.</span></span>
            <select id="se-velocidade" className="se-select" value={ajustes.velocidade} onChange={(e) => mudarAjustes({ velocidade: Number(e.target.value) })}>
              {VELOCIDADES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <div className="row row-2 se-linha-cal">
            <span className="row-k">Calibragem
              <span className="row-sub">
                Seco = {ajustes.calibragem.seco ?? "não marcado"} · molhado = {ajustes.calibragem.molhado ?? "não marcado"}.
                Só é preciso quando o sensor manda um número diferente de 0 e 1, ou quando 0 quer dizer molhado.
              </span>
            </span>
          </div>
          <div className="se-calibrar se-calibrar-ajustes">
            <button type="button" className="btn btn-iron" disabled={valorAtual === null} onClick={() => marcar("seco")}>Agora está seco</button>
            <button type="button" className="btn btn-iron" disabled={valorAtual === null} onClick={() => marcar("molhado")}>Agora está molhado</button>
            <button type="button" className="btn btn-line" onClick={() => mudarAjustes({ calibragem: SEM_CALIBRAGEM })}>Limpar</button>
          </div>
        </div>
        <h3 className="se-sub">O que o sensor escreveu</h3>
        <pre className="se-cru" aria-live="off">{linhas.length ? linhas.slice(-8).map((l) => l.bruto).join("\n") : "Nada ainda."}</pre>
      </details>
    </Tela>
  );
}

/**
 * Desenho do bueiro em corte: a rua em cima, a tampa, o poço e o sensor preso na parede.
 * A água sobe até cobrir o sensor quando ele está molhado; `fracao` (0 a 1) permite subir aos
 * poucos quando o sensor manda um valor que varia. Sem leitura, a água fica baixa e apagada.
 */
function BueiroEmCorte({ estado, fracao }) {
  const BASE = 196; // fundo do poço
  const SECO = 172; // altura da água com o sensor seco
  const COBERTO = 84; // altura da água cobrindo o sensor
  const topo = SECO - (SECO - COBERTO) * (fracao ?? 0);
  const descricao = estado === "molhado" ? "Desenho do bueiro: a água subiu e cobriu o sensor"
    : estado === "seco" ? "Desenho do bueiro: a água está abaixo do sensor" : "Desenho do bueiro com o sensor preso na parede, sem leitura";
  return (
    <svg className={`se-desenho ${estado ? `se-desenho-${estado}` : "se-desenho-vazio"}`} viewBox="0 0 320 212" role="img" aria-label={descricao}>
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
      {/* Rua e tampa */}
      <rect x="0" y="40" width="320" height="10" className="se-rua" />
      <rect x="108" y="38" width="104" height="12" rx="2" className="se-tampa" />
      <path d="M122 40v8M136 40v8M150 40v8M164 40v8M178 40v8M192 40v8" className="se-frestas" />
      {/* Altura do sensor */}
      <path d="M108 100h70" className="se-marca" />
      {/* Sensor, o fio e a placa */}
      <path d="M200 92V30h46" className="se-fio" />
      <rect x="246" y="18" width="52" height="24" rx="5" className="se-placa" />
      <text x="272" y="34" textAnchor="middle" className="se-letra">ESP32</text>
      <rect x="188" y="88" width="22" height="14" rx="3" className="se-sensor" />
      <path d="M194 102v14M204 102v14" className="se-hastes" />
      <text x="54" y="96" textAnchor="middle" className="se-letra">sensor</text>
      <path d="M78 93h24" className="se-seta" />
      <text x="54" y={estado === "molhado" ? 150 : 186} textAnchor="middle" className="se-letra se-letra-agua">água</text>
      <text x="26" y="33" className="se-letra">rua</text>
    </svg>
  );
}
