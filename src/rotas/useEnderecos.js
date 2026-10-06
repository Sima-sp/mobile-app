// Busca de endereço enquanto a pessoa digita, usada pela busca do mapa e pela tela de rotas.
// Espera a pessoa parar de digitar, cancela o pedido anterior e só procura a partir de 3 letras.

import { useEffect, useState } from "react";
import { buscarEnderecos } from "./servico";

const PARADA = { fase: "parada", lugares: [] };

/**
 * @param {string} texto  o que foi digitado
 * @returns {{ fase: "parada"|"procurando"|"pronta"|"erro", lugares: Array<{ id, nome, detalhe, lon, lat }> }}
 */
export function useEnderecos(texto) {
  const termo = texto.trim();
  const [busca, setBusca] = useState(PARADA);

  useEffect(() => {
    if (termo.length < 3) {
      setBusca(PARADA);
      return undefined;
    }
    const controle = new AbortController();
    // Enquanto procura, os resultados anteriores continuam na tela (a lista não pisca).
    setBusca((anterior) => ({ ...anterior, fase: "procurando" }));
    const relogio = setTimeout(async () => {
      try {
        const lugares = await buscarEnderecos(termo, { sinal: controle.signal });
        if (!controle.signal.aborted) setBusca({ fase: "pronta", lugares });
      } catch {
        if (!controle.signal.aborted) setBusca({ fase: "erro", lugares: [] });
      }
    }, 380);
    return () => {
      clearTimeout(relogio);
      controle.abort();
    };
  }, [termo]);

  return busca;
}
