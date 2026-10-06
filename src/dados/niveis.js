// Escala de risco única do SIMA: Baixo, Médio, Alto, Crítico.
// No app o nível é um número de 1 a 4 (ou null quando não há previsão). O backend manda o texto
// sem acento (BAIXO, MEDIO, ALTO, CRITICO), igual ao NivelRiscoEnum do Java.

export const ROTULO_NIVEL = { 1: "Baixo", 2: "Médio", 3: "Alto", 4: "Crítico" };

const NIVEL_POR_TEXTO = { BAIXO: 1, MEDIO: 2, ALTO: 3, CRITICO: 4 };

/** Tira acentos e deixa em maiúsculas: "Médio" → "MEDIO". */
export function semAcento(texto) {
  return String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Converte o texto do backend em número. Aceita com ou sem acento; devolve null se não reconhecer. */
export function nivelDeTexto(texto) {
  if (typeof texto === "number") return texto >= 1 && texto <= 4 ? texto : null;
  return NIVEL_POR_TEXTO[semAcento(texto).trim().toUpperCase()] ?? null;
}

/** Nome do nível para mostrar na tela. */
export function rotuloNivel(nivel) {
  return ROTULO_NIVEL[nivel] ?? "Sem previsão";
}

/** Cor do nível como variável CSS, para acompanhar o tema. Sem nível, usa a tinta apagada. */
export function corNivel(nivel) {
  return ROTULO_NIVEL[nivel] ? `var(--r${nivel})` : "var(--bone-500)";
}

/** Quanto a tampa "enche" em cada nível: o risco aparece na forma, não só na cor. */
export function fracaoTampa(nivel) {
  return { 1: 0.25, 2: 0.5, 3: 0.75, 4: 1 }[nivel] ?? 0;
}
