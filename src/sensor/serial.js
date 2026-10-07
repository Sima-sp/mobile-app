// Conversa com o protótipo do sensor (ESP32) pelo cabo USB, usando a porta serial do navegador
// (Web Serial). É a mesma porta que o "Monitor Serial" do Arduino usa: o ESP32 escreve uma linha
// por leitura e a tela lê.
//
// O que é preciso saber:
// - Só funciona no Chrome, no Edge ou no Opera, no computador. Firefox e Safari não têm essa porta.
// - O navegador mostra uma janela para a pessoa escolher a porta; depois disso ele lembra dela.
// - Só um programa usa a porta de cada vez: com o Monitor Serial do Arduino aberto, não abre.
// - No Linux, o usuário precisa estar no grupo "dialout" (sudo usermod -aG dialout $USER e
//   entrar de novo na sessão), senão o navegador não consegue abrir a porta.
// - A página precisa estar em https ou em localhost (o app publicado e o npm run dev servem).

/** true se este navegador consegue falar com o sensor pelo cabo. */
export function temSerial() {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

/** As portas que a pessoa já autorizou antes (para reconectar sem perguntar de novo). */
export async function portasAutorizadas() {
  if (!temSerial()) return [];
  try {
    return await navigator.serial.getPorts();
  } catch {
    return [];
  }
}

/** Transforma o erro do navegador numa frase para a tela. null = a pessoa só fechou a janela. */
export function mensagemDoErro(erro) {
  const nome = erro?.name ?? "";
  if (nome === "NotFoundError") return null; // fechou a janela sem escolher a porta
  if (nome === "SecurityError") return "O navegador bloqueou o acesso ao sensor nesta página.";
  if (nome === "NetworkError" || nome === "InvalidStateError") {
    return "Não consegui abrir a porta do sensor. Feche o Monitor Serial do Arduino (ou outro programa usando o sensor) e tente de novo.";
  }
  return "Não consegui falar com o sensor. Tire e ponha o cabo e tente de novo.";
}

/**
 * Abre a porta e chama `aoReceberLinha` a cada linha que o sensor escrever.
 * @param {object} opcoes
 * @param {number} opcoes.velocidade            a mesma do Serial.begin(...) no código do ESP32
 * @param {SerialPort} [opcoes.porta]           porta já autorizada; sem ela, o navegador pergunta
 * @param {(linha: string) => void} opcoes.aoReceberLinha
 * @param {(erro: Error|null) => void} [opcoes.aoFechar]  a porta fechou sozinha (cabo solto, por exemplo)
 * @returns {Promise<() => Promise<void>>} função que fecha a porta
 */
export async function abrirSensor({ velocidade, porta, aoReceberLinha, aoFechar }) {
  const escolhida = porta ?? await navigator.serial.requestPort();
  await escolhida.open({ baudRate: velocidade });
  // Muitas placas ESP32 reiniciam ou travam conforme estes dois sinais; soltos, o programa roda.
  try {
    await escolhida.setSignals({ dataTerminalReady: false, requestToSend: false });
  } catch {
    // Nem toda placa aceita; não faz falta.
  }

  let aberto = true;
  let resto = "";
  let relogio = null;
  const leitor = escolhida.readable.getReader();
  const decodificador = new TextDecoder();
  const entregar = (linha) => { if (aberto && linha.trim()) aoReceberLinha(linha); };

  (async () => {
    let falha = null;
    try {
      while (aberto) {
        const { value, done } = await leitor.read();
        if (done) break;
        resto += decodificador.decode(value, { stream: true });
        const linhas = resto.split(/\r\n|\n|\r/);
        resto = linhas.pop() ?? "";
        linhas.forEach(entregar);
        // Código que escreve sem pular linha: o que sobrar parado por um instante vale como linha.
        clearTimeout(relogio);
        if (resto.length > 400) resto = "";
        else if (resto) relogio = setTimeout(() => { const pendente = resto; resto = ""; entregar(pendente); }, 700);
      }
    } catch (erro) {
      falha = erro;
    } finally {
      clearTimeout(relogio);
      try { leitor.releaseLock(); } catch { /* já solto */ }
      if (aberto) {
        // Fechou sem ninguém pedir: cabo solto ou placa desligada.
        aberto = false;
        try { await escolhida.close(); } catch { /* já fechada */ }
        aoFechar?.(falha);
      }
    }
  })();

  return async function fechar() {
    if (!aberto) return;
    aberto = false;
    clearTimeout(relogio);
    try { await leitor.cancel(); } catch { /* já parado */ }
    try { await escolhida.close(); } catch { /* já fechada */ }
  };
}
