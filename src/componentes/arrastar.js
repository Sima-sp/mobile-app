// Arrastar com o dedo (ou o mouse) uma folha que sobe de baixo da tela, como nos apps do iPhone.
//
// Enquanto o dedo se move, a folha acompanha. Ao soltar, quem usa o gancho decide o que fazer com
// o gesto (fechar, abrir mais, voltar ao lugar) a partir da distância e da velocidade.
// O movimento é aplicado direto no elemento, sem passar pelo React, para acompanhar o dedo sem atraso.

import { useEffect, useRef } from "react";

/** Distância mínima, em pixels, para o toque ser tratado como arrasto e não como clique. */
const FOLGA = 8;

/**
 * @param {React.RefObject<HTMLElement>} ref  elemento que será arrastado
 * @param {object} opcoes
 * @param {boolean} [opcoes.ativo]            false desliga o gesto
 * @param {number} [opcoes.resistenciaCima]   0 a 1: quanto a folha cede quando puxada para cima
 * @param {number} [opcoes.resistenciaBaixo]  0 a 1: idem para baixo
 * @param {(gesto: { dy: number, velocidade: number }) => void} opcoes.aoSoltar
 *        dy = pixels arrastados (positivo = para baixo); velocidade em pixels por milissegundo
 */
export function useArrastarVertical(ref, { ativo = true, resistenciaCima = 0.35, resistenciaBaixo = 1, aoSoltar }) {
  const ultimo = useRef(aoSoltar);
  ultimo.current = aoSoltar;

  useEffect(() => {
    const no = ref.current;
    if (!no || !ativo) return undefined;

    let inicio = null; // posição Y onde o toque começou
    let ponteiro = null;
    let arrastando = false;
    let ultimoY = 0;
    let ultimoT = 0;
    let velocidade = 0;
    let ignorarClique = false;

    const aoDescer = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      inicio = e.clientY;
      ponteiro = e.pointerId;
      arrastando = false;
      ultimoY = e.clientY;
      ultimoT = e.timeStamp;
      velocidade = 0;
    };

    const aoMover = (e) => {
      if (inicio === null || e.pointerId !== ponteiro) return;
      const dy = e.clientY - inicio;
      if (!arrastando) {
        if (Math.abs(dy) < FOLGA) return;
        arrastando = true;
        no.setPointerCapture?.(ponteiro);
        no.classList.add("arrastando");
      }
      // Velocidade suavizada: a primeira medida vale inteira, as seguintes entram aos poucos.
      const dt = e.timeStamp - ultimoT;
      if (dt > 0) {
        const instantanea = (e.clientY - ultimoY) / dt;
        velocidade = velocidade === 0 ? instantanea : 0.6 * velocidade + 0.4 * instantanea;
      }
      ultimoY = e.clientY;
      ultimoT = e.timeStamp;
      no.style.transform = `translateY(${dy * (dy < 0 ? resistenciaCima : resistenciaBaixo)}px)`;
    };

    const terminar = (e, cancelado) => {
      if (inicio === null || e.pointerId !== ponteiro) return;
      const dy = e.clientY - inicio;
      inicio = null;
      if (!arrastando) return;
      arrastando = false;
      no.classList.remove("arrastando");
      no.style.transform = "";
      // O toque que arrastou não pode virar clique num botão de dentro da folha.
      ignorarClique = true;
      setTimeout(() => { ignorarClique = false; }, 0);
      // Se o dedo parou antes de soltar, não foi um "peteleco": a velocidade antiga não vale mais.
      if (e.timeStamp - ultimoT > 90) velocidade = 0;
      if (!cancelado) ultimo.current({ dy, velocidade });
    };
    const aoSubir = (e) => terminar(e, false);
    const aoCancelar = (e) => terminar(e, true);

    const aoClicar = (e) => {
      if (!ignorarClique) return;
      e.preventDefault();
      e.stopPropagation();
    };

    no.addEventListener("pointerdown", aoDescer);
    no.addEventListener("pointermove", aoMover);
    no.addEventListener("pointerup", aoSubir);
    no.addEventListener("pointercancel", aoCancelar);
    no.addEventListener("click", aoClicar, true);
    return () => {
      no.removeEventListener("pointerdown", aoDescer);
      no.removeEventListener("pointermove", aoMover);
      no.removeEventListener("pointerup", aoSubir);
      no.removeEventListener("pointercancel", aoCancelar);
      no.removeEventListener("click", aoClicar, true);
      no.classList.remove("arrastando");
      no.style.transform = "";
    };
  }, [ref, ativo, resistenciaCima, resistenciaBaixo]);
}
