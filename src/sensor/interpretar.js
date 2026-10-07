// Entende o que o protótipo do sensor (ESP32) escreve pelo cabo USB.
//
// O sensor do SIMA detecta ÁGUA: seco ou molhado. Ele não mede lixo nem calcula sozinho quando o
// bueiro está cheio. Como o texto exato que o ESP32 escreve pode mudar de uma versão do código
// para outra, este arquivo aceita os formatos mais comuns em vez de exigir um só:
//
//   molhado            seco               AGUA DETECTADA      sem agua
//   1                  0                  1830                (um número por linha)
//   agua: 1            umidade=1830       Sensor: 1830 | Estado: MOLHADO
//   {"molhado": true}  {"agua": 1830}     {"sensor": "seco", "valor": 412}
//
// A leitura sai em duas partes:
//   palavra  "molhado" | "seco" | null   quando o próprio texto diz o estado
//   valor    número | null               quando vem um número (0/1 ou o valor bruto do sensor)
// Quem decide o estado final é estadoDaLeitura, que usa a palavra, ou o número com a calibragem
// feita na tela ("agora está seco" / "agora está molhado").
//
// Só faz contas: não acessa o cabo (isso é do serial.js) nem a tela.

/** Linhas que o ESP32 escreve sozinho ao ligar ou ao conectar no Wi-Fi: não são leituras. */
const RUIDO = /^(ets\s|rst:|configsip|clk_drv|mode:|load:|ho\s\d|entry\s0x|[EIWDV]\s\(\d+\)|brownout|waiting for download|wifi|ip\s*:|ip address|conect|connect|mac\s*:|\.+$)/i;

// "Seco" é testado antes de "molhado": "não molhado" e "sem água" contêm as palavras do outro lado.
const DIZ_SECO = /(\bsec[oa]s?\b|\bdry\b|sem\s+[aá]gua|n[aã]o\s+(est[aá]\s+)?molhad|n[aã]o\s+detect|nenhuma\s+[aá]gua|no\s+water)/i;
const DIZ_MOLHADO = /(molhad[oa]|\bwet\b|[aá]gua\s+detectad|com\s+[aá]gua|alagad|alagamento|\bcheio\b|transbord|water\s+detected)/i;
// Palavras genéricas só valem como a linha inteira ou como o valor de um campo ("estado: ON").
const GENERICO_SECO = /^(off|false|low|desligado|nao|não|no)$/i;
const GENERICO_MOLHADO = /^(on|true|high|ligado|sim|yes)$/i;

/** Campos que costumam trazer a leitura, do mais provável para o menos. */
const CAMPOS = ["molhado", "wet", "agua", "água", "water", "umidade", "moisture", "nivel", "nível", "level", "sensor", "estado", "status",
  "valor", "value", "leitura", "reading", "analog", "analogico", "adc", "digital", "raw"];
const semAcento = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const ordemDoCampo = (nome) => { const i = CAMPOS.findIndex((c) => semAcento(nome).includes(semAcento(c))); return i === -1 ? CAMPOS.length : i; };

function palavraDe(texto, { aceitaGenerico = false } = {}) {
  const t = String(texto).trim();
  if (DIZ_SECO.test(t)) return "seco";
  if (DIZ_MOLHADO.test(t)) return "molhado";
  if (aceitaGenerico) {
    if (GENERICO_SECO.test(t)) return "seco";
    if (GENERICO_MOLHADO.test(t)) return "molhado";
  }
  return null;
}

const numeroDe = (texto) => {
  const achado = String(texto).trim().match(/^-?\d+(?:[.,]\d+)?$/);
  return achado ? Number(achado[0].replace(",", ".")) : null;
};

/** Lê um valor qualquer (de JSON ou de "campo: valor") e devolve o que ele diz. */
function lerValor(valor) {
  if (typeof valor === "boolean") return { palavra: valor ? "molhado" : "seco", valor: valor ? 1 : 0 };
  if (typeof valor === "number") return Number.isFinite(valor) ? { palavra: null, valor } : null;
  if (typeof valor !== "string") return null;
  const numero = numeroDe(valor);
  if (numero !== null) return { palavra: null, valor: numero };
  const palavra = palavraDe(valor, { aceitaGenerico: true });
  return palavra ? { palavra, valor: null } : null;
}

/**
 * Interpreta uma linha recebida do sensor.
 * @returns {{ bruto: string, tipo: "leitura"|"ruido"|"texto", palavra: "molhado"|"seco"|null, valor: number|null, campo: string|null }|null}
 *   null para linha vazia; tipo "ruido" para mensagens de inicialização; "texto" quando a linha
 *   não traz nada que pareça leitura (ela ainda aparece no registro da tela).
 */
export function interpretarLinha(texto) {
  // eslint-disable-next-line no-control-regex
  const bruto = String(texto ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim();
  if (!bruto) return null;
  const nada = { bruto, tipo: "texto", palavra: null, valor: null, campo: null };
  if (RUIDO.test(bruto)) return { ...nada, tipo: "ruido" };

  // 1. JSON: {"agua": 1830, "estado": "molhado"}
  if (bruto.startsWith("{")) {
    try {
      const objeto = JSON.parse(bruto);
      const campos = Object.entries(objeto).map(([nome, v]) => ({ nome, lido: lerValor(v) })).filter((c) => c.lido)
        .sort((a, b) => ordemDoCampo(a.nome) - ordemDoCampo(b.nome));
      if (campos.length === 0) return nada;
      const comPalavra = campos.find((c) => c.lido.palavra);
      const comNumero = campos.find((c) => c.lido.valor !== null);
      return { bruto, tipo: "leitura", palavra: comPalavra?.lido.palavra ?? null, valor: comNumero?.lido.valor ?? null, campo: (comNumero ?? comPalavra).nome };
    } catch {
      // não era JSON de verdade: segue como texto
    }
  }

  // 2. O texto diz o estado ("AGUA DETECTADA", "Estado: seco")?
  let palavra = palavraDe(bruto, { aceitaGenerico: true });

  // 3. Campos "nome: valor" ou "nome=valor"
  const pares = [...bruto.matchAll(/([A-Za-zÀ-ú_][A-Za-zÀ-ú0-9_ ]*?)\s*[:=]\s*([^\s|,;]+)/g)]
    .map(([, nome, v]) => ({ nome: nome.trim(), lido: lerValor(v) })).filter((c) => c.lido)
    .sort((a, b) => ordemDoCampo(a.nome) - ordemDoCampo(b.nome));
  if (pares.length) {
    palavra = palavra ?? pares.find((c) => c.lido.palavra)?.lido.palavra ?? null;
    const comNumero = pares.find((c) => c.lido.valor !== null);
    return { bruto, tipo: "leitura", palavra, valor: comNumero?.lido.valor ?? null, campo: (comNumero ?? pares[0]).nome };
  }

  // 4. Só números na linha ("1830" ou "1830,1"): vale o primeiro
  const numeros = bruto.split(/[\s,;|\t]+/).map(numeroDe);
  if (numeros.length && numeros.every((n) => n !== null)) return { bruto, tipo: "leitura", palavra, valor: numeros[0], campo: null };

  // 5. Um número solto no meio do texto ("Leitura do sensor 1830")
  if (palavra) return { bruto, tipo: "leitura", palavra, valor: null, campo: null };
  const solto = bruto.match(/-?\d+(?:[.,]\d+)?/);
  if (solto && /sensor|leitura|valor|agua|água|umidade|nivel|nível|adc|analog/i.test(bruto)) {
    return { bruto, tipo: "leitura", palavra: null, valor: Number(solto[0].replace(",", ".")), campo: null };
  }
  return nada;
}

/** Calibragem vazia: o app ainda não sabe que número é "seco" e que número é "molhado". */
export const SEM_CALIBRAGEM = { seco: null, molhado: null };

/**
 * Estado final de uma leitura: "molhado", "seco" ou null (ainda não dá para saber).
 * - Se o texto do sensor já diz o estado, vale o texto.
 * - Número com as duas referências calibradas: vale a referência mais próxima.
 * - Número 0 ou 1: 1 é molhado, a menos que a calibragem diga o contrário (há sensores em que
 *   0 é molhado; basta marcar "agora está molhado" com a água no sensor).
 * - Outro número sem calibragem: null. A tela pede para calibrar.
 */
export function estadoDaLeitura(leitura, calibragem = SEM_CALIBRAGEM) {
  if (!leitura || leitura.tipo !== "leitura") return null;
  if (leitura.palavra) return leitura.palavra;
  const v = leitura.valor;
  if (v === null || v === undefined) return null;
  const { seco, molhado } = calibragem ?? SEM_CALIBRAGEM;
  if (seco !== null && molhado !== null && seco !== molhado) return Math.abs(v - molhado) <= Math.abs(v - seco) ? "molhado" : "seco";
  if (v === 0 || v === 1) {
    if (molhado === 0 || seco === 1) return v === 0 ? "molhado" : "seco";
    return v === 1 ? "molhado" : "seco";
  }
  return null;
}

/**
 * Quanto do caminho entre "seco" e "molhado" o valor já andou, de 0 a 1. Serve para o desenho da
 * água subir aos poucos quando o sensor manda um valor que varia (e não só 0 ou 1).
 * Sem número ou sem calibragem completa, devolve 0 (seco), 1 (molhado) ou null.
 */
export function quantoMolhado(leitura, calibragem = SEM_CALIBRAGEM) {
  const estado = estadoDaLeitura(leitura, calibragem);
  if (estado === null) return null;
  const { seco, molhado } = calibragem ?? SEM_CALIBRAGEM;
  if (leitura.valor !== null && seco !== null && molhado !== null && seco !== molhado) {
    return Math.min(1, Math.max(0, (leitura.valor - seco) / (molhado - seco)));
  }
  return estado === "molhado" ? 1 : 0;
}
