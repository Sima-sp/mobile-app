// Junta o painel do sensor num arquivo só: dist-painel/sima-sensor.html.
//
// Para que serve: o arquivo pode ser copiado para a pasta `public` do servidor do sensor (o
// programa em Node do grupo do IoT). Aberto de lá (http://localhost:3000/sima-sensor.html, ou
// http://ENDERECO-DO-COMPUTADOR:3000/sima-sensor.html de qualquer aparelho da mesma rede), ele
// conecta sozinho, sem internet e sem pedir permissão ao navegador, porque a página e as leituras
// vêm do mesmo endereço.
//
// Como usar: `npm run painel` (roda `vite build --mode painel` e depois este arquivo).
// O que faz: pega o dist-painel/sensor.html gerado pelo Vite e põe o JavaScript e o CSS para
// dentro dele (as fontes já vêm embutidas no CSS pelo modo "painel" do vite.config.js).

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const pasta = fileURLToPath(new URL("../dist-painel/", import.meta.url));
let html = await readFile(`${pasta}sensor.html`, "utf8");

const ler = (caminho) => readFile(pasta + caminho.replace(/^\.?\//, ""), "utf8");

// CSS: <link rel="stylesheet" href="./assets/x.css"> vira <style>...</style>
for (const [marca, caminho] of [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)].map((m) => [m[0], m[1]])) {
  const css = await ler(caminho);
  html = html.replace(marca, () => `<style>${css.replace(/<\/style/gi, "<\\/style")}</style>`);
}
// JavaScript: <script type="module" src="./assets/x.js"> vira <script type="module">...</script>
for (const [marca, caminho] of [...html.matchAll(/<script[^>]+type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g)].map((m) => [m[0], m[1]])) {
  const js = await ler(caminho);
  // "</script" e "<!--" dentro do código fechariam ou confundiriam a marcação.
  html = html.replace(marca, () => `<script type="module">${js.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--")}</script>`);
}
// O ícone ficava na pasta public/, que este arquivo não leva.
html = html.replace(/\s*<link[^>]+rel="icon"[^>]*>/g, "");

// Conferência: nada pode continuar apontando para um arquivo de fora. (url(#nome) é referência
// a um recorte do próprio desenho, não a um arquivo.)
const sobras = [...html.matchAll(/(?:src|href)="(\.?\/[^"]+)"/g)].map((m) => m[1]).concat(/url\((?!["']?(?:data:|#))/.test(html) ? ["url(...) que não é data: nem #"] : []);
if (sobras.length) {
  console.error("O arquivo único ainda depende de:", sobras);
  process.exit(1);
}

await writeFile(`${pasta}sima-sensor.html`, html);
console.log(`dist-painel/sima-sensor.html pronto (${Math.round(html.length / 1024)} KB).`);
console.log("Copie para a pasta public do servidor do sensor e abra http://localhost:3000/sima-sensor.html");
