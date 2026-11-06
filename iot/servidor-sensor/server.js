const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // painel web

// ==============================
// LIMITES (em cm, distância do sensor até a água)
// Quanto MENOR a distância, MAIS ALTA está a água.
// ==============================
const LIMITES = {
  zonaCega: 15,
  critico: 20,
  alerta: 30,
  atencao: 45,
};

function classificar(d) {
  if (d <= LIMITES.critico) {
    return {
      status: "critico",
      nivel: 3,
      titulo: "Crítico",
      mensagem:
        d < LIMITES.zonaCega
          ? "Água na zona cega do sensor. Risco imediato de transbordamento."
          : "Nível de água muito alto. Risco iminente de alagamento.",
    };
  }
  if (d <= LIMITES.alerta) {
    return { status: "alerta", nivel: 2, titulo: "Alerta", mensagem: "Nível de água elevado. Acompanhe de perto." };
  }
  if (d <= LIMITES.atencao) {
    return { status: "atencao", nivel: 1, titulo: "Atenção", mensagem: "Nível de água subindo." };
  }
  return { status: "normal", nivel: 0, titulo: "Normal", mensagem: "Nível de água dentro do esperado." };
}

let ultima = null;
const clientes = new Set();

// O ESP32 envia os dados para cá
app.post("/api/leitura", (req, res) => {
  const { device, distancia } = req.body;

  if (typeof distancia !== "number") {
    return res.sendStatus(400);
  }

  ultima = {
    device: device || "desconhecido",
    distancia,
    ...classificar(distancia),
    em: new Date().toISOString(),
  };

  console.log(`[${ultima.titulo.toUpperCase()}] ${ultima.distancia} cm`);

  clientes.forEach((c) => c.write(`data: ${JSON.stringify(ultima)}\n\n`));
  res.sendStatus(200);
});

// A página web consulta aqui
app.get("/api/leitura", (req, res) => res.json(ultima));
app.get("/api/limites", (req, res) => res.json(LIMITES));

// Tempo real (Server-Sent Events)
app.get("/api/stream", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();
  if (ultima) res.write(`data: ${JSON.stringify(ultima)}\n\n`);
  clientes.add(res);
  req.on("close", () => clientes.delete(res));
});

app.listen(3000, "0.0.0.0", () => console.log("SIMA rodando na porta 3000"));
