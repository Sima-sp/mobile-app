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
| Chuvisco | Maioria em baixo; os bueiros com muito lixo vão para médio | Nenhum |
| Chuva forte | De tudo um pouco, com alguns críticos; ruas pintadas em volta dos altos e críticos | 11 regiões em risco alto e 1 em atenção |
| Chuva extrema | Maioria em alto ou crítico; cerca de 15 bueiros transbordando | As 15 regiões com cobertura em risco alto |

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

## O sensor na previsão

No SIMA o sensor não é só um medidor: a leitura dele **entra na conta da chance**. Na
demonstração e no simulador (`src/dados/demo.js`):

1. A chuva e o lugar dão uma primeira chance de alagar nas próximas 3 horas (`previsaoPelaChuva`).
2. A leitura do bueiro multiplica essa chance (`chanceComSensor`):
   - **água:** até a metade não muda nada; 2 vezes em 65 %, 6 vezes em 80 %, 12 vezes quase cheio;
   - **lixo:** só pesa com chuva; a partir de 30 %, 3 vezes em 60 % e 5 vezes com o bueiro tomado.
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

**Diferença para o serviço de IA de hoje.** No `ml-service` v1 o modelo calcula a chance só com
a chuva e o lugar, e a leitura do sensor sobe o **nível** por regra (água ≥ 80 % ou lixo ≥ 60 %
com chuva), sem mexer na porcentagem. Com o app ligado ao backend, o que aparece é isso. Para o
sistema de verdade se comportar como a demonstração, a mesma conta precisa entrar no `ml-service`
(e o backend mandar a chance já com o sensor).

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
   vezes e o que mais alaga) e as leituras do sensor (água e lixo). A resposta fica presa no alto
   da tela e muda na hora: nível, chance e uma frase que mostra o quanto o sensor pesou ("só pela
   chuva e pelo lugar seria 0,3 %; com o que o sensor mede, fica 25 vezes maior"). Há atalhos
   prontos ("Dia seco", "Temporal", "Bueiro entupido"...).
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
  faixa com três números (água e lixo, medidos; chance de alagar, prevista) e os botões. O botão
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
| `nivelAgua`, `porcentagemLixo`, `dataLeitura` | O lado "medido" do bueiro | O app mostra "Sem leitura" em todos os pontos |
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
index.html                 aplica o tema antes do React (a tela não pisca)
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
    PontosContexto.jsx     guarda os pontos e atualiza sozinho (usePontos)
    modelo.test.js         testes das regras acima
    demo.test.js           testes da demonstração
    regioes.test.js        testes do aviso por região
    simulador.test.js      testes do simulador
  rotas/
    planejar.js            a regra: caminho mais rápido, bueiros no caminho, desvio e os textos
    geometria.js           contas de distância, traçado compactado e área a evitar
    servico.js             conversa com o serviço de rotas (Valhalla) e a busca de endereço (Photon)
    lugares.js             lugares conhecidos oferecidos como atalho
    RotaContexto.jsx       partida, chegada e resultado; refaz a rota quando o risco muda (useRotas)
    useEnderecos.js        busca de endereço enquanto a pessoa digita
    planejar.test.js       testes da regra, sem internet
  preferencias/
    PreferenciasContexto.jsx   tema e animações (usePreferencias)
  mapa/
    estiloMapa.js          estilo do MapLibre montado com os tokens do tema
    MapaBase.jsx           o mapa, as tampas (marcadores) e o desenho da rota
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
    Bueiro.jsx             detalhe: medido × previsto
    Bairros.jsx            situação por bairro
    Busca.jsx              busca do mapa: lugares para ir (rota), bueiros e bairros
    Avisos.jsx             avisos por região
    ComoFunciona.jsx       como a IA funciona, com o simulador
    Menu.jsx               atalhos, tema e ajustes
    EmConstrucao.jsx       telas das próximas etapas e a tela Sobre
  estilos/
    base.css               tokens dos dois temas e componentes (vidro, listas, botões)
    telas.css              estilos de cada tela
ferramentas/
  gerar-ruas.mjs           gera src/dados/ruasDosBueiros.js a partir do OpenStreetMap (npm run ruas)
  ruas-nucleo.mjs          a regra que escolhe o trecho de rua de cada ponto (e o teste)
```

Endereços: `/` mapa · `/?ponto=ID` mapa com o cartão aberto · `/bueiro/ID` · `/bairros?b=Nome`
· `/busca` · `/rotas` escolher partida e destino · `/rota` mapa com a rota desenhada · `/alertas` avisos por
região · `/ia` como a IA funciona (`/ia?ponto=ID` com um bueiro) · `/menu` · `/sobre`. O endereço usa `#` (HashRouter) para o app funcionar em qualquer
hospedagem estática sem configurar o servidor.

## Decisões que valem lembrar

- **Medido separado de previsto.** Água, lixo e hora da leitura vêm do sensor; nível de risco e
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
  ajudar a previsão, não só para medir. Na demonstração e no simulador, água e lixo multiplicam a
  chance, e o nível sai dela. Isso muda a recomendação R5 do serviço de IA (lá o sensor mexe só no
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
| Navegação passo a passo (voz, "vire à direita") | Decisão do grupo; o serviço de rotas já devolve as instruções em português |
| Rotas a pé ou de transporte | Fora do escopo: o grupo decidiu por rotas só de carro |
| Reportar problema | Domínio de Ocorrência no backend |
| Notificação dos avisos no celular | Alerta a partir de previsão no backend; notificações no aparelho |
| Perfil e conta | Login (JWT) no backend |
| Aviso por região vindo do servidor | Formato de `GET /previsoes/regioes` (hoje o app calcula com a mesma regra) |
| Trecho de rua para sensores fora dos pontos conhecidos | Rodar `npm run ruas` com a posição dos sensores |
| Chance com o sensor também nos dados reais | A conta de "O sensor na previsão" no `ml-service`, e o backend mandando a chance antes e depois do sensor |
| A IA aprender o peso do sensor | Meses de leituras de verdade, com registro de quando alagou |
| Leitura do sensor com dados reais | `nivelAgua`, `porcentagemLixo`, `dataLeitura` e `statusSensor` em `/previsoes` |
| Gráfico de 12 h com dados reais | Histórico de leituras por sensor (hoje só na demonstração) |
| App nas lojas (APK) | Capacitor |

O mapa completo de construção está no projeto: `claude/app-mapa-de-construcao.md`.
