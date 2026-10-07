# SIMA · App

App do **SIMA-SP** (Sistema Inteligente de Monitoramento de Alagamentos em São Paulo): o mapa de
risco por bueiro monitorado, com o que o sensor mediu e o que a IA prevê para as próximas 3 horas.

Feito em **React + Vite**, a partir do desenho "liquid glass" do canvas *SIMA · app e site* (o mesmo
sistema visual da landing). Funciona no navegador do celular e do computador; o plano é empacotar
com Capacitor para gerar o APK.

## Rodar

```bash
npm install
npm run dev       # http://localhost:5173
npm run dev:rede  # igual, mas acessível pelo celular na mesma rede
npm run demo      # força a demonstração, mesmo com backend configurado no .env.local
npm run demo:rede # demonstração acessível pelo celular na mesma rede
npm test          # testes das regras de dados
npm run build     # gera a pasta dist/ (HTML/CSS/JS puro)
npm run build:demo  # o mesmo, já em modo demonstração (para publicar a versão da feira)
npm run preview   # serve a dist/ para conferir o build
npm run ruas      # gera de novo o trecho de rua de cada ponto (precisa de internet; ver "Ruas afetadas")
npm run painel    # gera o painel do sensor num arquivo só: dist-painel/sima-sensor.html (ver "Sensor ao vivo")
```

Requer Node 20.19+ ou 22.12+. Sem configuração nenhuma o app abre com **dados de demonstração**.

## Demonstração (para apresentar o projeto)

```bash
npm run demo
```

Mostra **136 bueiros espalhados pela capital**, todos com sensor funcionando, e um controle de
**clima** no topo do mapa: sol, chuvisco, chuva forte e chuva extrema. No computador, as teclas
**1, 2, 3 e 4** fazem o mesmo que os botões. Ao trocar, a chuva "entra" pela cidade de oeste para
leste e os bueiros vão mudando em cerca de 12 segundos.

O aviso "Demonstração" fica sempre na tela. O que é real e o que é inventado:

- **Reais:** os lugares. São os pontos de alagamento recorrente que o modelo de IA conhece
  (`src/dados/pontosCapital.js`), com a frequência histórica de cada um.
- **Inventados:** as leituras, a chuva e as previsões. Mas seguem uma lógica só
  (`src/dados/demo.js`): quem alaga mais e está perto de córrego reage mais; a leitura do sensor
  entra na chance (ver "O sensor na previsão"); a chance vira nível pelos limiares reais do
  modelo; água em 100 % é "transbordando agora".

| Clima | O que aparece | Aviso por região |
|---|---|---|
| Sol | Tudo em nível baixo | Nenhum |
| Chuvisco | Tudo em baixo; a água sobe um pouco nos bueiros | Nenhum |
| Chuva forte | De tudo um pouco, com alguns críticos; ruas pintadas em volta dos altos e críticos | 7 regiões em risco alto e 5 em atenção |
| Chuva extrema | Maioria em alto ou crítico; cerca de 17 bueiros transbordando | As 15 regiões com cobertura em risco alto |

Na primeira abertura o app mostra uma **apresentação de quatro passos** (ver "Primeiro uso"). Para
quem apresenta: ela pode ser revista em Menu → "Rever a apresentação".

No mapa afastado, bueiros próximos viram um **anel com a quantidade no meio**: cada cor do anel é
a parte do grupo naquele nível. Tocar no anel aproxima.

Para a feira: o mapa de fundo (ruas) vem da internet. No app publicado, o que já foi visto fica
guardado no aparelho (ver "Sem internet", abaixo); em área nunca aberta, os bueiros aparecem sobre
um fundo liso. As rotas sempre precisam de internet.

## Publicar e instalar no celular

O arquivo `.github/workflows/publicar.yml` publica a demonstração no **GitHub Pages** a cada envio
para a branch `main`: roda os testes, gera o app com `npm run build:demo` e publica a pasta `dist/`.
O endereço fica `https://<organização>.github.io/<repositório>/`, em `https`.

Uma vez só, no repositório: **Settings → Pages → Source: GitHub Actions**. Em organização no plano
gratuito o Pages só funciona em repositório público.

Com o endereço `https` o app pode ser instalado:

- **iPhone:** abrir no Safari → botão Compartilhar → **Adicionar à Tela de Início**.
- **Android:** abrir no Chrome → menu → **Instalar app** (ou "Adicionar à tela inicial").

Instalado, ele abre em tela cheia, com o ícone do SIMA (`public/manifest.webmanifest` e os
`public/icone-*.png`), e o botão "onde estou" passa a funcionar, porque o celular só libera a
localização em endereços `https`.

### Sem internet

No app publicado, um service worker (`public/sw.js`) guarda no aparelho o próprio app e os pedaços
do mapa **já vistos**. Com isso:

- o app abre e funciona sem internet (a demonstração inteira roda no aparelho);
- o mapa aparece nas áreas e nos zooms por onde a pessoa já passou com internet; o resto fica vazio;
- as rotas e a busca de endereço **não** funcionam sem internet (o cartão da rota avisa).

Antes de uma apresentação: abra o app com internet, passeie pelo mapa nas áreas que vai mostrar
(de longe e de perto) e abra o app mais uma vez. A página é sempre buscada na internet primeiro,
então uma versão nova publicada chega na abertura seguinte. Em `npm run dev` o service worker não
é ligado.

**Se o app não abrir.** Na primeira visita ainda não há nada guardado: se a internet falhar no
meio do carregamento, a pessoa vê o aviso "O SIMA não abriu", com o botão "Tentar de novo", em
vez de uma tela vazia. O aviso está no próprio `index.html` (não depende do código do app):
aparece na hora se o arquivo do app falhar e depois de 15 segundos se ele só estiver demorando;
quando o app chega, toma o lugar do aviso. Evite publicar uma versão nova durante uma
apresentação: por cerca de um minuto, quem abrir o app pode pegar a página nova sem o arquivo novo.

## Gestos e animações

- O **cartão do bueiro** acompanha o dedo: puxar para baixo fecha, puxar para cima abre a tela
  completa do bueiro, um arrasto curto volta ao lugar (`src/componentes/arrastar.js`).
- A **barra de busca** tem um pegador: puxá-la para cima abre a busca.
- As telas **sobem de baixo** quando a pessoa vem do mapa e **descem** ao fechar. Entre uma tela e
  outra (Menu → Bairros) é só um esmaecer rápido (`src/componentes/Tela.jsx`).
- **Menu → Animações**: "Do aparelho" segue a configuração de acessibilidade do celular ou
  computador (quem pede menos movimento não vê nada deslizando); "Ligadas" e "Reduzidas" valem
  sempre. Se nada estiver animando no seu computador, é provável que o sistema esteja pedindo
  movimento reduzido: escolha "Ligadas".

## Rotas de carro

A rota começa na **busca do mapa** (a barra de baixo). O mesmo campo acha bueiros, bairros e
lugares para ir: tocar num lugar (endereço digitado ou lugar conhecido) traça a rota até lá. A
partida é a posição do aparelho; se ele não informar, a pessoa escolhe um lugar. "Desviar", no
cartão de um bueiro em risco, e Menu → Rotas levam à mesma escolha. O caminho aparece no mapa,
com um cartão que diz:

- **Caminho livre**: o caminho mais rápido não passa por bueiro em risco.
- **Rota segura**: há um desvio que evita todos; o cartão diz quantos minutos ele custa a mais e
  deixa comparar com o caminho mais rápido.
- **Rota com menos risco**: o melhor desvio achado ainda passa por algum ponto.
- **Sem desvio possível**: não há outro trajeto; o app mostra por quais bueiros o caminho passa.

"Em risco" é nível alto, crítico ou transbordando. A rota se refaz sozinha quando essa lista muda;
na demonstração, basta trocar o clima com a rota aberta.

Como funciona (`src/rotas/planejar.js`): o app pede o caminho mais rápido, confere quais bueiros
em risco ficam a até 35 m dele e, se houver, pede outro caminho mandando um quadrado em volta de
cada um como área a evitar. Depois confere o caminho novo e, se preciso, tenta de novo (até três
vezes).

Serviços usados, os dois abertos, sem chave e com dados do OpenStreetMap:

| Para quê | Serviço | Observação |
|---|---|---|
| Traçar a rota | [Valhalla](https://valhalla.github.io/valhalla/), no servidor público da FOSSGIS | Uso justo: um pedido por segundo. Aceita no máximo 100 vértices de áreas a evitar por pedido (cerca de 20 bueiros), medido em 06/10/2026. Sem garantia de disponibilidade. |
| Buscar endereço | [Photon](https://photon.komoot.io/), da komoot | Limitado à Grande São Paulo. Se estiver fora do ar, os lugares conhecidos continuam funcionando. |

Para trocar de servidor: `VITE_ROTAS_URL` e `VITE_ENDERECOS_URL` no `.env.local`. Só a partida e o
destino da rota (e o texto digitado na busca) são enviados a esses serviços. Para um app de
produção, o certo é ter um servidor de rotas próprio: o público é emprestado e tem esses limites.

## Viagem (navegação passo a passo)

Com a rota no mapa, o cartão tem o botão **Começar viagem**. Ele abre a tela de viagem (endereço
`#/viagem`), no padrão dos apps de trânsito:

- **No alto**, a próxima manobra: a seta, a distância até ela ("350 m") e a rua em que se entra.
  Uma linha menor adianta a manobra seguinte ("Depois").
- **No mapa**, o carro (uma seta azul) anda sobre o caminho, com a câmera atrás dele, inclinada e
  girando nas curvas. Tocar no mapa solta a câmera, e aparece o botão **Centralizar**.
- **Embaixo**, quanto falta (tempo e distância), a hora de chegada e o botão **Sair**, que volta ao
  cartão da rota. Ao chegar, a faixa diz "Você chegou" e o botão vira **Concluir**.

**A viagem é simulada.** O carro anda sozinho, na velocidade média que o serviço de rotas calculou,
e a tela diz isso ("Viagem simulada"). Os botões 1×, 5× e 15× mudam a velocidade: 1× é o tempo
real; 5× é o padrão, bom para mostrar; 15× percorre a cidade em cerca de um minuto. O app ainda
não acompanha o GPS do aparelho (ver "O que ainda não existe").

**O que é do SIMA:** se, no meio da viagem, um bueiro do caminho que falta entra em risco, a tela
avisa ("Bueiro MO-06 em risco à frente"), o carro para um instante e o app pede um caminho novo a
partir de onde ele está, desviando desse bueiro ("Nova rota: desvia de 1 bueiro em risco"). Sem
desvio possível, o aviso continua na tela. Na demonstração, é só trocar o clima durante a viagem
(o controle do clima fica na tela, e as teclas 1 a 4 continuam valendo); o app espera a chuva
terminar de atravessar a cidade antes de refazer o caminho. O risco que já existia quando a
viagem começou não refaz nada: a pessoa escolheu aquele caminho vendo o aviso no cartão.

Como é feito:

- `src/rotas/viagem.js` faz as contas, sem tela: dado o caminho e quantos metros já foram
  percorridos, devolve onde o carro está, para onde aponta, a próxima manobra e quanto falta.
  É testado em `viagem.test.js`.
- `src/rotas/servico.js` devolve, junto com a rota, as manobras do Valhalla (tipo, frase em
  português, rua, tempo e o ponto do caminho onde cada uma acontece).
- `src/telas/Viagem.jsx` é a tela: faz o carro andar a cada quadro, desenha a faixa e o painel, e
  cuida do desvio no meio da viagem.
- `src/mapa/MapaBase.jsx` ganhou os comandos de câmera da viagem. Fora dela o mapa continua com o
  norte para cima e visto de cima; os gestos de girar e inclinar seguem desligados.
- Com "menos movimento" ligado (no aparelho ou no Menu), a câmera não inclina nem gira: o mapa
  fica de cima, com o norte para cima, e só acompanha o carro.
- A tela não apaga durante a viagem, nos aparelhos que deixam (Wake Lock).

Conferido em 07/10/2026 com um serviço de rotas de mentira (o caminho e as manobras no formato do
Valhalla): começar, manobras mudando, arrastar e centralizar, trocar o clima e receber a nova rota,
chegar, concluir, sair e Esc, em celular (390 e 360 px) e notebook, nos dois temas e com menos
movimento. **Não conferido:** uma viagem com o serviço de rotas de verdade e num celular de verdade.

## O sensor na previsão

No SIMA o sensor não é só um medidor: a leitura dele **entra na conta da chance**. Na
demonstração e no simulador (`src/dados/demo.js`):

1. A chuva e o lugar dão uma primeira chance de alagar nas próximas 3 horas (`previsaoPelaChuva`).
2. A leitura do bueiro, que é o **nível da água**, multiplica essa chance (`chanceComSensor`):
   até a metade não muda nada; 2,5 vezes em 65 %, 7 vezes em 80 %, 12 vezes quase cheio. A conta
   é feita em "chances contra e a favor" (odds): com chance pequena o resultado é esse mesmo
   múltiplo; perto de 100 % o efeito é menor, e as telas dizem o crescimento real.
3. O nível sai da chance final, pelos limiares do modelo. Água em 100 % é "transbordando agora":
   crítico, e aí é medição, não previsão.

A leitura nunca diminui a chance, e sem leitura (sensor fora do ar) vale a chance da chuva e do
lugar. O app guarda as duas (`probabilidade` e `probabilidadeSemSensor`) para mostrar o quanto o
sensor pesou: na tela do bueiro e no simulador.

**O que isto é e o que não é.** Os pesos acima são uma **regra escolhida pelo grupo**, não algo
que a IA aprendeu: não existe histórico de leituras de sensor para treinar. A tela "Como a IA
funciona" diz isso ("O que ainda é regra"). Treinar com as leituras da demonstração não
resolveria: elas são geradas por esta mesma regra, então o modelo só aprenderia de volta o que
foi inventado. O caminho é acumular leituras de verdade e, com elas, trocar a regra por
aprendizado; é o ponto de `chanceComSensor`.

**O sensor mede só a água.** Até 06/10/2026 o app também mostrava "lixo acumulado" e usava o
lixo na conta. Saiu: o sensor do projeto detecta água, não lixo. O backend e o `ml-service` ainda
têm o campo `porcentagemLixo`; se ele vier em `/previsoes`, o app ignora.

**O protótipo mede a distância até a água.** O ESP32 que o grupo tem hoje mede, em centímetros,
a distância do sensor até a água (ver "Sensor ao vivo"); o servidor do sensor classifica essa
distância em quatro níveis. Ele ainda não informa "71 % cheio": para isso falta dizer a
profundidade do bueiro (cheio = distância mínima, vazio = distância até o fundo). A demonstração
e o simulador continuam com o nível em %, que é o que o sistema completo prevê mostrar.

**Diferença para o serviço de IA de hoje.** No `ml-service` v1 o modelo calcula a chance só com
a chuva e o lugar, e a leitura do sensor sobe o **nível** por regra (água ≥ 80 %, e lixo ≥ 60 %
com chuva), sem mexer na porcentagem. Com o app ligado ao backend, o que aparece é isso. Para o
sistema de verdade se comportar como a demonstração, a mesma conta precisa entrar no `ml-service`
(e o backend mandar a chance já com o sensor), e a regra do lixo precisa sair de lá.

## Sensor ao vivo

O **painel do sensor** mostra o protótipo do sensor funcionando, em tempo real: o nível da água
num desenho do bueiro em corte, a distância medida e como aquele bueiro apareceria no mapa.

**É uma página separada do app** (`sensor.html`, código em `src/sensor/`): não tem mapa nem
previsão, só o IoT. No computador ocupa a tela inteira (o desenho de um lado, a leitura do
outro, e um botão "Tela cheia"); no celular vira uma coluna. No Menu do app, "Sensor ao vivo"
abre essa página; o endereço antigo (`#/sensor`) também leva a ela.

Há três jeitos de abrir, do mais garantido na bancada ao mais prático:

| Jeito | Endereço | Precisa de |
|---|---|---|
| **Arquivo único dentro do servidor do sensor** | `http://localhost:3000/sima-sensor.html` (ou `http://ENDEREÇO-DO-COMPUTADOR:3000/sima-sensor.html` de qualquer aparelho da mesma rede) | Copiar `dist-painel/sima-sensor.html` (gerado por `npm run painel`) para a pasta `public` do servidor do sensor. Conecta sozinho, sem internet e sem permissão do navegador |
| Página publicada | `https://sima-sp.github.io/mobile-app/sensor.html` | Internet, o servidor do sensor no mesmo computador e permitir o acesso à rede local quando o Chrome perguntar |
| Na pasta do app | `npm run demo` e `http://localhost:5173/sensor.html` | Node instalado; aceita o servidor do sensor em outro computador (endereço em "Ajustes do sensor") |

**O caminho da leitura.** O protótipo mede a distância do sensor até a água (em cm) e envia pelo
Wi-Fi ao **servidor do sensor**, um programa em Node do grupo do IoT (porta 3000). A página
pergunta a última leitura a esse servidor uma vez por segundo:

```
ESP32 ──Wi-Fi──▶ POST /api/leitura   { "device": "...", "distancia": 32.4 }
painel ────────▶ GET  /api/leitura   a última leitura (ou null, se ainda não chegou nenhuma)
                 GET  /api/limites   { "zonaCega": 15, "critico": 20, "alerta": 30, "atencao": 45 }
```

**Da distância ao nível** (`src/sensor/nivel.js`, com testes). Quanto menor a distância, mais
cheio o bueiro. A regra e os limites são os do servidor do sensor; os nomes são os do mapa:

| Distância até a água | Servidor do sensor | App |
|---|---|---|
| até 20 cm | Crítico | Crítico |
| até 30 cm | Alerta | Alto |
| até 45 cm | Atenção | Médio |
| acima de 45 cm | Normal | Baixo |

Os limites vêm de `GET /api/limites`; sem resposta, valem os da tabela. Três cuidados da tela:

- **Medida impossível não vira bueiro cheio.** Zero, negativo ou acima de 6 m é o que um sensor
  de distância devolve quando não recebe o eco. A tela mostra "Leitura inválida" em vez de um
  nível. (O servidor do sensor, em 06/10/2026, classifica `0` como Crítico.)
- **Mediana, quando há leituras de sobra.** A tela mostra a mediana das leituras válidas do
  último 1,5 s. Com o firmware de hoje, que envia a cada 2 s, isso é simplesmente a última
  leitura (sem atraso); a mediana só entra se o envio ficar mais rápido.
- **Sensor parado.** Sem leitura nova por 10 s (cinco envios), a tela avisa e deixa de mostrar
  nível. O servidor guarda a última leitura para sempre; quem percebe que ela ficou velha é a
  tela, pelo carimbo `em`. O firmware só envia quando consegue medir, então "parado" pode ser a
  placa desligada, o Wi-Fi ou o sensor sem eco.

**O que o firmware do protótipo faz** (código visto em 06/10/2026; não está neste repositório):

- Sensor de distância por ultrassom (pinos de disparo e de eco). Mede cerca de 20 vezes por
  segundo e **envia uma leitura a cada 2 s**, com `device: "bueiro_01"`.
- **Só envia leitura válida**: sem eco, ou fora de 2 a 450 cm, ele não envia nada. Por isso o `0`
  que viraria Crítico no servidor não sai deste firmware.
- O nome e a senha do Wi-Fi e o **endereço do servidor ficam escritos no código**. Em outra rede,
  ou se o computador do servidor receber outro endereço, a placa precisa ser gravada de novo.
- Um LED na placa pisca mais rápido conforme a água chega perto (limites próprios: 25 e 45 cm,
  diferentes dos do servidor).

**Para usar na bancada:**

1. Ponha o computador do servidor na rede que está no código do ESP32 (o roteador do celular)
   **antes de ligar a placa**, e confira que ele recebeu o endereço que está em `SERVER_URL`.
   Se recebeu outro, troque o `SERVER_URL` e grave a placa de novo. Ligue o servidor do sensor
   (`node server.js`) **nesse mesmo computador, que é o que vai mostrar a tela**, e só então a
   placa. No monitor serial (115200) deve aparecer `Envio -> codigo HTTP: 200`.
2. Abra o painel nesse computador. Com o arquivo único na pasta `public` do servidor, é só abrir
   `http://localhost:3000/sima-sensor.html`: ele conecta sozinho.
3. Pela página publicada: abra no **Chrome**, toque em "Conectar ao sensor" (a página procura o
   servidor em `http://localhost:3000`) e, quando o Chrome perguntar se a página pode **acessar
   a rede local** (ou outros apps do dispositivo), **permita**. Sem isso o pedido nem sai. Só
   pergunta uma vez, e nas próximas vezes a página conecta sozinha naquele computador.
4. "Tela cheia" (ou F11) tira as barras do navegador.

**Servidor em outro computador.** A página publicada é https e o servidor do sensor é http: fora
do próprio computador, o navegador tende a bloquear o pedido. O arquivo único resolve (a página
e as leituras vêm do mesmo endereço); a outra saída é `npm run demo` com o endereço do servidor
em "Ajustes do sensor" (`192.168.0.10` vira `http://192.168.0.10:3000`).

**O arquivo único** (`npm run painel`). O Vite gera só o painel, com as fontes e os estilos
embutidos (modo `painel` do `vite.config.js`), e `ferramentas/painel-unico.mjs` põe o JavaScript
e o CSS para dentro do HTML. O resultado (`dist-painel/sima-sensor.html`, cerca de 430 KB) não
depende de mais nenhum arquivo. A página descobre sozinha que está dentro do servidor do sensor:
ao abrir, pergunta `GET /api/limites` ao próprio endereço; se a resposta for a dos limites, usa
esse endereço e conecta sem botão.

**Simulação.** "Simular sem o sensor" põe um controle embaixo do desenho: arrastando, a água
sobe e o nível muda. A página avisa que é simulação. É a reserva se o Wi-Fi ou o protótipo
falharem.

**Ajustes do sensor** (botão no pé da página) mostra o endereço do servidor e o botão de
desconectar, os limites em uso (e se vieram do servidor) e a última resposta crua do servidor.

**O que foi conferido e o que não foi.** Conferido com uma cópia do servidor do grupo e leituras
enviadas como o ESP32 enviaria: os quatro níveis, a leitura inválida, o sensor parado, o servidor
caindo e voltando, o painel em https falando com `http://localhost:3000` depois de permitir o
acesso (Chromium 141), e o arquivo único aberto do próprio servidor, sem nenhum pedido para fora.
Tamanhos conferidos: 1366×768, 1920×1080 e celular, nos dois temas. **Não conferido:** o ESP32 de verdade e o app publicado lendo de outro
computador.

**O que a tela não faz.** A leitura não vai para o backend do SIMA nem vira um bueiro do mapa:
fica só nesta tela. O passo seguinte é o ESP32 (ou o servidor do sensor) enviar a leitura ao
backend em Java, e o backend guardar a profundidade do bueiro para transformar distância em %.

**Histórico.** Uma primeira versão (06/10/2026, commit `47cb659`) lia o ESP32 pelo cabo USB e
mostrava só "seco" ou "molhado", porque era o que se sabia do protótipo. Com o código do servidor
em mãos, passou a ler a distância pelo servidor, ainda como uma tela dentro do app (uma coluna
de 420 px). Na mesma noite virou esta página separada, de tela inteira.

## Ruas afetadas

Quando um bueiro está em nível **alto ou crítico** (ou transbordando), o trecho de rua em volta
dele é pintado no mapa com a cor do nível, por cerca de 300 m para cada lado. É a resposta a
"quais ruas estão em risco agora?" num relance, e substitui o antigo mapa de calor.

- **De onde vem o traçado.** De `src/dados/ruasDosBueiros.js`, um arquivo **gerado** a partir do
  OpenStreetMap. Nada é buscado na rede na hora de desenhar: funciona sem internet.
- **A regra** (`ferramentas/ruas-nucleo.mjs`): a rua do bueiro é a via com o nome do endereço
  cadastrado, se houver uma a até 80 m; senão, a via mais próxima. Entram a continuação da rua e,
  nas avenidas, a pista do outro sentido. De cada via fica só o que está a até 300 m do ponto.
- **Gerar de novo** (se a lista de pontos mudar): `npm run ruas`. Precisa de internet; consulta o
  serviço público Overpass em lotes pequenos e mostra no fim quais pontos ficaram sem trecho e
  quais foram escolhidos pela via mais próxima em vez do nome (vale conferir esses no mapa).
- **O que isto não é:** a mancha de um alagamento. O SIMA monitora o bueiro, não a rua inteira. O
  trecho tem tamanho fixo e diz "o risco é aqui, nesta rua"; não mede até onde a água chegaria. A
  tela Sobre diz isso para quem usa.
- **Rota e rua pintada.** A rota desvia do **bueiro** (uma área de 38 m em volta dele), não do
  trecho pintado inteiro. Por isso um caminho seguro pode cruzar a ponta de um trecho pintado.
- **Sensor novo.** Um bueiro que não esteja na lista de pontos conhecidos herda o trecho do ponto
  conhecido a até 40 m dele; mais longe que isso fica sem trecho (a tampa aparece normalmente) até
  o arquivo ser gerado de novo com a posição dele.

Só pinta rua o que vale agora: previsão vencida não pinta. O desenho fica em
`src/mapa/ruasAfetadas.js` (quais ruas) e `src/mapa/estiloMapa.js` (camadas `ruas-afetadas`).

## Aviso por região

O aviso de um bueiro sozinho erra muito: nos testes do modelo, de cada 100 horas com aviso de
nível alto num ponto, menos de 2 tiveram alagamento registrado. Juntando os pontos da mesma
subprefeitura, foram 8 em cada 100. Por isso o app mostra os dois: o nível de cada bueiro (onde) e
o aviso da região (quando se preparar).

- **A regra** (`src/dados/regioes.js`) é a do serviço de IA (ADR 0005 do `ml-service`): só recebe
  aviso a região com **pelo menos 3 pontos**; vale a **maior chance** entre os pontos; os limiares
  são próprios, mais altos que os de um ponto (atenção a partir de 1,02 %, risco alto a partir de
  2,10 %). Não existe "crítico" por região. O app acrescenta uma medição: bueiro transbordando põe
  a região em risco alto, e o aviso diz que foi medido.
- **Onde aparece:** uma faixa sobre o mapa ("Risco alto em 7 regiões"), que leva à tela **Avisos
  por região** (`/alertas`), e uma linha no cartão de cada bairro (tela Bairros).
- **De onde vêm os dados:** o app calcula a partir das previsões de cada ponto. O backend tem
  `GET /previsoes/regioes` com a mesma conta, mas o formato da resposta ainda não foi conferido;
  quando for, troca-se a origem em `regioes.js` e as telas não mudam.
- **O que falta:** notificação no celular. Depende do servidor e do app instalado.

## Como a IA funciona (a tela)

`/ia` mostra a IA em funcionamento, sem termos técnicos:

1. **Simulador.** A pessoa muda a chuva, o lugar (três lugares reais: um que alaga pouco, um às
   vezes e o que mais alaga) e a leitura do sensor (o nível da água). A resposta fica presa no alto
   da tela e muda na hora: nível, chance e uma frase que mostra o quanto o sensor pesou ("só pela
   chuva e pelo lugar seria 0,3 %; com o que o sensor mede, fica 8,6 vezes maior"). Há atalhos
   prontos ("Dia seco", "Temporal", "Bueiro enchendo"...).
2. **O caminho de uma previsão**, em cinco passos.
3. **Quanto ela acerta**, com os números dos testes do modelo v1, o que ainda é regra (o peso do
   sensor) e o que ela não vê.

O simulador usa a mesma conta da demonstração do mapa (`src/dados/simulador.js` e `demo.js`): é
uma versão simplificada para explicar, **não** o modelo rodando no aparelho, e a tela diz isso.
Vindo de um bueiro ("Como a IA chega a esse nível"), o simulador abre com o lugar e as leituras
dele (`/ia?ponto=ID`) e dá a mesma resposta que a tela do bueiro.

Os números da tela (12.621 alagamentos, 31 % avisados com 2,4 h de antecedência, 5 vezes mais
acerto por região) vêm de `claude/ai-service-estado-e-decisoes.md`. Se o modelo for treinado de
novo, é ali e em `src/telas/ComoFunciona.jsx` que eles mudam.

## Primeiro uso

Na primeira vez que o app abre no mapa aparece uma apresentação curta, por cima dele
(`src/componentes/PrimeiroUso.jsx`): a tampa e os níveis; medido × previsto; o clima (só na
demonstração); e a busca com rota. O último passo oferece **usar a localização**: o navegador só
pergunta se a pessoa tocar no botão.

- Aparece **uma vez por aparelho** (fica anotado em `sima.apresentacao`, no próprio aparelho).
- Quem chega por um link direto para um bueiro vê o bueiro, não a apresentação.
- Pode ser revista em Menu → "Rever a apresentação". Esc ou "Pular" fecham.

## Modo vitrine

Para feiras: com o **modo vitrine** ligado (Menu → "Modo vitrine", só na demonstração), o app
passeia sozinho quando ninguém está mexendo, e para no primeiro toque. Vem desligado.

- **Quando começa:** depois de 45 segundos sem toque, tecla ou rolagem, em qualquer tela (ele
  fecha o que estiver aberto e volta ao mapa). O botão "Começar agora", no Menu, começa na hora.
  Não começa com a apresentação de primeiro uso aberta nem com o app em segundo plano.
- **O que mostra** (uma volta dura 74 s e recomeça): sol → a chuva forte chegando, com a cidade
  inteira e o aviso por região → um bueiro em risco de perto, com a rua pintada e o cartão
  aberto → chuva extrema → um bueiro crítico de perto → o sol de volta. É a mesma história do
  roteiro de quem apresenta.
- **Quando para:** no primeiro toque, tecla ou rolagem. Nada é desfeito: o clima e o mapa ficam
  como estavam e a pessoa continua dali. No mapa, o aviso "Modo vitrine · toque para usar o app"
  fica à vista enquanto o passeio roda.
- **Tela acesa:** ligado, o app pede ao aparelho para não apagar a tela (Wake Lock). Nem todo
  navegador atende; deixe o aparelho na tomada e, se precisar, aumente o tempo de tela nas
  configurações dele.
- **Bueiros visitados:** sempre os mesmos para a mesma chuva (o de maior nível, entre os que têm
  rua desenhada), então os pedaços do mapa desses lugares ficam guardados no aparelho depois da
  primeira volta e o passeio não depende da internet.

- **Dentro da página do projeto:** a landing mostra o app num telefone abrindo-o com
  `?vitrine=1` no endereço. Assim o modo vale só para aquela visita (não muda a preferência
  guardada), o passeio começa logo depois de o app abrir e a apresentação de primeiro uso não
  aparece. A página de fora troca de tela pelo endereço (`#/ia`, `#/rotas`...) e manda o passeio
  parar com `postMessage("sima:usar", "*")`.

O roteiro e a escolha do bueiro estão em `src/dados/vitrine.js` (com testes); o relógio, a
detecção do toque e os comandos do mapa, em `src/telas/useVitrine.js`. A escolha fica guardada
com as outras preferências do aparelho (`sima.preferencias`).

## Cores e desenho

A regra é a dos grandes apps de mapa (Google Maps, Apple Maps, Waze): **o fundo é neutro e a cor
fica para o que significa algo**. No SIMA: cinza é a rua, azul é a água e a ação.

| Cor | Onde aparece | Onde não aparece |
|---|---|---|
| Cinza (grafite no noturno, concreto no claro) | Fundo das telas, cartões, vidro, terreno e ruas do mapa | — |
| Azul do projeto (`--route`, `--route-deep`) | Botão principal, item selecionado, foco, links, "onde estou", rota, chuva; no mapa, só a água | Fundos, ícones decorativos |
| As quatro cores de risco (`--r1` a `--r4`) | Tampas, anéis dos grupos, selos e textos de nível | Qualquer coisa que não seja risco |
| Verde suave | Parques e matas do mapa | Interface |

- Os tokens ficam em `src/estilos/base.css`. Para mudar a paleta, mexa só lá: as telas e o mapa
  leem dali (o mapa pelas cores `--map-*`, em `src/mapa/estiloMapa.js`).
- No mapa, a importância da via aparece pela largura, pela claridade e pelo zoom em que ela
  entra: de longe só expressas e avenidas; as ruas de bairro surgem ao aproximar. Córregos e rios
  ficam bem visíveis de propósito.
- O **cartão do bueiro** segue o padrão dos cartões de lugar desses apps: nome e situação, uma
  faixa com dois números (água no bueiro, medida; chance de alagar, prevista) e os botões. O botão
  azul é a ação principal: "Desviar" quando o bueiro está em risco (alto, crítico ou transbordando)
  e "Ver detalhes" nos demais.
- A landing (`landing/`) continua com a paleta azulada anterior. Os nomes dos tokens são os mesmos,
  então dá para levar a nova paleta para lá copiando os blocos `.thm-dark` e `.thm-light`.

## Ligar no backend

Com o ml-service e o backend Java no ar:

```bash
cp .env.example .env.local
# no .env.local:
# VITE_API_URL=/api
npm run dev
```

O app passa a ler `GET /previsoes` (módulo `previsao` do backend) a cada 90 s.

**Por que `/api` e não `http://localhost:8080`:** em desenvolvimento o servidor do Vite repassa
`/api/...` para o backend (configurado em `vite.config.js`; o destino muda com `SIMA_BACKEND`).
Para o navegador é o mesmo endereço do app, então **não depende de CORS** liberado no backend.
Também serve para testar no celular: `npm run dev:rede` e abra, no celular na mesma rede Wi-Fi,
o endereço "Network" que o Vite mostra.

Fora do desenvolvimento (app publicado), aponte `VITE_API_URL` para o endereço do backend; aí sim
ele precisa de CORS liberado para a origem do app, ou de servir a pasta `dist/` ele mesmo.

### O contrato com o backend

Formato de cada item de `/previsoes`, conferido em 06/10/2026 (ver `normalizarPrevisao` em
`src/dados/modelo.js`):

`sensorId`, `latitude`, `longitude`, `vizinhanca`, `status`, `probabilidadeAlagamento`,
`nivelRisco`, `nivelRiscoModelo`, `janelaHoras`, `geradaEm`, `validaAte`, `horaReferencia`,
`medicaoTransbordando`, `ajusteSensorAplicado`, `semLeituraSensor`, `motivosAjuste`,
`chuvaRecente3hMm`, `chuvaPrevista3hMm`, `origem`, `modeloVersao`, `simulada`.

O que **falta no backend** para o app mostrar tudo:

| Campo (nome sugerido) | Para quê | Sem ele |
|---|---|---|
| `nivelAgua`, `dataLeitura` | O lado "medido" do bueiro | O app mostra "Sem leitura" em todos os pontos |
| `statusSensor` (`ATIVO`, `INATIVO`, `MANUTENCAO`) | Dizer por que não há leitura | O app não distingue sensor inativo de sensor em manutenção |
| Fuso nas datas (ex.: `2026-10-06T13:18:18-03:00`) | Aparelhos fora do horário de São Paulo | O app assume São Paulo quando a data vem sem fuso |

A rota já responde sem login. A vizinhança dos sensores de exemplo é "Local de teste 0X"; rodando
o `docs/demo-sensores.sql` do backend ela vira `"R. Chico Pontes — Vila Maria / Vila Guilherme"`
e o app passa a mostrar endereço e bairro (e as previsões reagem à chuva, porque os sensores
ficam sobre pontos que o modelo conhece).

Para ver o app reagindo sem chuva de verdade, use o modo de demonstração do backend
(`POST /admin/demonstracao/iniciar`, ver `backend-core/docs/previsao-ia.md`). As previsões vêm com
`simulada: true` e o app mostra o aviso **"Simulação · chuva de teste ligada"**.

### O que acontece quando o backend não responde

O app **não** troca para os dados de demonstração: num app de risco, mostrar dados inventados
seria pior do que avisar. Ele mantém a última resposta boa (guardada no aparelho), mostra
"Sem conexão · dados das HH:MM" e tenta de novo sozinho. Como cada previsão tem validade
(`validaAte`), o que ficou velho aparece como **previsão desatualizada**, sem número.

## Estrutura

```
index.html                 o app; aplica o tema antes do React (a tela não pisca)
sensor.html                o painel do sensor, página separada do app (ver "Sensor ao vivo")
public/
  sw.js                    service worker: o app e o mapa já visto continuam abrindo sem internet
  manifest.webmanifest     nome, ícones e cores do app instalado
src/
  main.jsx                 entrada: fontes, estilos, App; liga o service worker no app publicado
  App.jsx                  provedores e rotas (o mapa fica sempre montado por baixo)
  config.js                o que muda por ambiente (API, tiles, intervalo, serviços de rota)
  dados/
    niveis.js              escala de risco: Baixo, Médio, Alto, Crítico
    modelo.js              formato do "ponto", conversão do backend e textos da tela
    api.js                 GET /previsoes
    demo.js                demonstração: clima, sensibilidade de cada ponto, troca gradual
    pontosCapital.js       os 136 pontos da capital usados na demonstração
    ruasDosBueiros.js      GERADO: o trecho de rua em volta de cada ponto (npm run ruas)
    bairros.js             resumo por bairro
    regioes.js             aviso por região: cobertura mínima, limiares e as frases
    simulador.js           simulador da tela da IA: lugares, cenários e explicações
    vitrine.js             modo vitrine: as cenas do passeio e a escolha do bueiro visitado (e o teste)
    PontosContexto.jsx     guarda os pontos e atualiza sozinho (usePontos)
    modelo.test.js         testes das regras acima
    demo.test.js           testes da demonstração
    regioes.test.js        testes do aviso por região
    simulador.test.js      testes do simulador
  sensor/                  o painel do sensor (página separada: sensor.html)
    pagina.jsx             entrada da página: fontes, estilos e o Painel
    Painel.jsx             a página: desenho do bueiro, nível, medida, simulação e ajustes
    nivel.js               a distância medida (cm) vira nível: limites, leitura inválida, mediana (e o teste)
    servidor.js            pergunta a leitura ao servidor do sensor (o Node do grupo do IoT) e trata a permissão do navegador
  rotas/
    planejar.js            a regra: caminho mais rápido, bueiros no caminho, desvio e os textos
    geometria.js           contas de distância, traçado compactado e área a evitar
    servico.js             conversa com o serviço de rotas (Valhalla) e a busca de endereço (Photon)
    lugares.js             lugares conhecidos oferecidos como atalho
    RotaContexto.jsx       partida, chegada e resultado; refaz a rota quando o risco muda; guarda a viagem em curso (useRotas)
    useEnderecos.js        busca de endereço enquanto a pessoa digita
    planejar.test.js       testes da regra, sem internet
    viagem.js              a regra da tela de viagem: onde o carro está, a próxima manobra e quanto falta (e o teste)
  preferencias/
    PreferenciasContexto.jsx   tema, animações e modo vitrine (usePreferencias)
  mapa/
    estiloMapa.js          estilo do MapLibre montado com os tokens do tema
    MapaBase.jsx           o mapa, as tampas (marcadores), o desenho da rota e a câmera da viagem
    ruasAfetadas.js        quais ruas pintar: as dos bueiros em nível alto ou crítico (e o teste)
    agrupar.js             junta bueiros próximos conforme o zoom (e agrupar.test.js)
  componentes/
    Tampa.jsx              a tampa que enche conforme o risco, e o selo de nível
    Icones.jsx             ícones de traço
    Tela.jsx               moldura das telas (animação de entrada e saída, título, foco, voltar, Esc)
    PrimeiroUso.jsx        apresentação de primeiro uso (e o pedido de localização)
    arrastar.js            folhas que acompanham o dedo (cartão do bueiro, barra de busca)
    ganchos.js             useVoltar, useTelaLarga, de onde a pessoa veio
  telas/
    Mapa.jsx               mapa, avisos (dados e região), clima da demonstração, barra de busca, cartão do bueiro e modo rota
    Rotas.jsx              partida e destino: resolve a partida e troca os dois
    Viagem.jsx             navegação passo a passo: próxima manobra, carro no caminho e desvio no meio da viagem
    Bueiro.jsx             detalhe: medido × previsto
    Bairros.jsx            situação por bairro
    Busca.jsx              busca do mapa: lugares para ir (rota), bueiros e bairros
    Avisos.jsx             avisos por região
    ComoFunciona.jsx       como a IA funciona, com o simulador
    Menu.jsx               atalhos, tema, ajustes e a chave do modo vitrine
    useVitrine.js          modo vitrine: espera a falta de toque, toca as cenas e para ao primeiro toque
    EmConstrucao.jsx       telas das próximas etapas e a tela Sobre
  estilos/
    base.css               tokens dos dois temas e componentes (vidro, listas, botões)
    telas.css              estilos de cada tela
    sensor.css             estilos do painel do sensor (tela inteira no computador, coluna no celular)
ferramentas/
  gerar-ruas.mjs           gera src/dados/ruasDosBueiros.js a partir do OpenStreetMap (npm run ruas)
  ruas-nucleo.mjs          a regra que escolhe o trecho de rua de cada ponto (e o teste)
  painel-unico.mjs         junta o painel do sensor num arquivo só (npm run painel)
```

Endereços: `/` mapa · `/?ponto=ID` mapa com o cartão aberto · `/bueiro/ID` · `/bairros?b=Nome`
· `/busca` · `/rotas` escolher partida e destino · `/rota` mapa com a rota desenhada · `/alertas` avisos por
região · `/ia` como a IA funciona (`/ia?ponto=ID` com um bueiro) · `/sensor` sensor ao vivo · `/menu` · `/sobre`. O endereço usa `#` (HashRouter) para o app funcionar em qualquer
hospedagem estática sem configurar o servidor.

## Decisões que valem lembrar

- **Medido separado de previsto.** O nível da água e a hora da leitura vêm do sensor; nível de risco e
  chance vêm da IA. Quando o sensor mede o bueiro cheio (`medicaoTransbordando`), a tela diz
  "Transbordando agora (medido)" e **não** mostra porcentagem.
- **O nível é a informação principal; a porcentagem é secundária.** As probabilidades do modelo
  são pequenas (ALTO começa perto de 1,2 %), então "3,4 % · Alto" precisa de contexto. Toda a
  exibição passa por `textoProbabilidade` em `modelo.js`. Como mostrar esse número é decisão em
  aberto do grupo (recomendação R3 do serviço de IA).
- **Risco por forma, cor e texto.** A tampa enche conforme o nível; nunca é só cor.
- **"Sem previsão" não é "sem risco".** Ponto sem estimativa aparece com a tampa tracejada.
- **Tema.** `.thm-dark` / `.thm-light` no `<html>`. O mapa lê as cores `--map-*` do CSS, então não
  existe uma segunda paleta para manter. A regra das cores está em "Cores e desenho", acima.
- **Sem mapa de calor; ruas afetadas no lugar.** O modo calor (manchas coloridas em volta dos
  bueiros) foi retirado em 06/10/2026: ele sugeria uma área afetada que o app não conhece. No
  lugar entrou o trecho de rua em volta dos bueiros em risco (ver "Ruas afetadas"), que diz onde
  está o risco sem inventar uma mancha.
- **Aviso por região calculado no app.** A regra é a do serviço de IA; a origem dos dados troca
  quando o formato de `/previsoes/regioes` for conferido (ver "Aviso por região").
- **O sensor entra na chance.** Decisão do Guilherme em 06/10/2026: o sensor foi escolhido para
  ajudar a previsão, não só para medir. Na demonstração e no simulador, o nível da água multiplica
  a chance, e o nível de risco sai dela. Isso muda a recomendação R5 do serviço de IA (lá o sensor mexe só no
  nível); ver "O sensor na previsão".
- **Tela larga.** A partir de 900 px as telas viram uma coluna à esquerda e o mapa continua
  visível — é o que permite usar o mesmo app como "mapa web" da landing.
- **Código do bueiro.** O banco só tem id, posição e vizinhança. O app monta o código com a sigla
  do bairro + id (`VG-05`). Se a vizinhança vier como `"Rua — Bairro"` (com travessão, como no
  `docs/demo-sensores.sql`), a primeira parte vira o endereço.

## Mapa

- Biblioteca: [MapLibre GL JS](https://maplibre.org/) 6.
- Tiles: [OpenFreeMap](https://openfreemap.org/) (gratuito, sem chave), esquema OpenMapTiles. Para
  trocar de servidor, use `VITE_MAPA_TILES` e `VITE_MAPA_GLIFOS`.
- Os créditos (OpenStreetMap, OpenMapTiles, OpenFreeMap) aparecem no canto do mapa e são
  obrigatórios.

## O que ainda não existe

| Tela | Depende de |
|---|---|
| Viagem acompanhando o GPS do aparelho (hoje a viagem é simulada) | Ler a posição do aparelho durante a viagem e encaixá-la no caminho; testar na rua |
| Instruções por voz na viagem | Decisão do grupo; o serviço de rotas já devolve as frases em português |
| Rotas a pé ou de transporte | Fora do escopo: o grupo decidiu por rotas só de carro |
| Reportar problema | Domínio de Ocorrência no backend |
| Notificação dos avisos no celular | Alerta a partir de previsão no backend; notificações no aparelho |
| Perfil e conta | Login (JWT) no backend |
| Aviso por região vindo do servidor | Formato de `GET /previsoes/regioes` (hoje o app calcula com a mesma regra) |
| Trecho de rua para sensores fora dos pontos conhecidos | Rodar `npm run ruas` com a posição dos sensores |
| Chance com o sensor também nos dados reais | A conta de "O sensor na previsão" no `ml-service`, e o backend mandando a chance antes e depois do sensor |
| A IA aprender o peso do sensor | Meses de leituras de verdade, com registro de quando alagou |
| Leitura do sensor com dados reais | `nivelAgua`, `dataLeitura` e `statusSensor` em `/previsoes` |
| Protótipo do sensor no mapa (hoje só na tela "Sensor ao vivo") | O ESP32 enviar a leitura ao backend, e o backend devolvê-la em `/previsoes` |
| Gráfico de 12 h com dados reais | Histórico de leituras por sensor (hoje só na demonstração) |
| App nas lojas (APK) | Capacitor |

O mapa completo de construção está no projeto: `claude/app-mapa-de-construcao.md`.
