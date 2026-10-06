# Vegas OS — GitHub Pages + Google Apps Script
Vegas Vigilância e Segurança

O sistema tem duas partes:

- **Telas do sistema:** ficam no **GitHub Pages**, e o endereço é `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.
- **Servidor e banco de dados:** ficam no **Google Apps Script**. Os dados vão para uma Planilha Google, e as fotos e assinaturas para uma pasta no Google Drive.

O sistema começa vazio, só com o usuário `supervisora`.

## Supervisoras
| Usuário | Senha inicial | O que vê |
|---|---|---|
| `luzia` | `Vegas4747@` | Só as OS que a Luzia abriu |
| `talita` | `Vegas4747!` | Só as OS que a Talita abriu |
| `supervisora` | `Vegas4747@!` | Supervisão geral: todas as OS |
| `Supervisao Estoque` | `Vegas4747` | Todas as OS, para conferir materiais e estoque |

- **Cada supervisora vê só as OS dela** no Dashboard, na lista de OS, nos Relatórios e na atividade recente. Uma não consegue abrir nem alterar a OS da outra, nem pelo endereço.
- **Clientes e técnicos são compartilhados.** As duas usam o mesmo cadastro.
- **O técnico recebe as OS das duas**, na mesma lista por urgência.
- **Quem abriu a OS** aparece no detalhe: "Aberta em … por Luzia".
- **Importar backup e Apagar todos os dados** ficam só com a supervisão geral, porque mexem nas OS de todas.
- **OS abertas antes desta atualização** não têm dona. Por isso, continuam aparecendo para as duas.
- **Troca de senha:** cada uma troca a própria em **Configurações → Alterar minha senha**.
- **Supervisao Estoque:** vê as OS de todas, confere, marca como processada e reabre. Não importa backup nem apaga dados. É criado sozinho quando o `Code.gs` novo é publicado.

## Novidades desta versão
- **Aba Processadas:** na lista de OS, as abas agora são **A realizar**, **Realizadas** (assinadas pelo cliente, esperando a conferência, incluindo as reabertas) e **Processadas** (já conferidas). O filtro de status **Processada** leva direto para essa aba.
- **Reabrir para o técnico (antes de processar):** se o técnico esqueceu algo (material, foto, descrição), abra a OS e, no quadro **Conferência da OS**, toque em **Reabrir para o técnico**. Vale para OS **Aguardando cliente**, **Realizada** ou **Reaberta**.
  - Escreva o que ele precisa completar. O técnico vê o aviso no topo da OS e na lista dele ("Completar OS"), e o celular avisa em até 30 segundos.
  - A OS volta para **Em atendimento** com tudo o que ele já registrou. Ele completa, assina de novo e finaliza.
  - **Assinatura do cliente:** escolha **Manter** (padrão; ao finalizar, a OS volta direto para **Realizadas**) ou **O cliente assina de novo** (no celular do técnico ou pelo link). A assinatura antiga fica guardada.
  - Enquanto está com o técnico, a OS não pode ser cancelada. Tudo fica no histórico e na conferência.
  - OS já **Processada**: use **Reabrir OS** primeiro e depois **Reabrir para o técnico**.
- **Materiais e valores (menu Cadastros → Materiais):** cadastro com código, material, marca, unidade, valor e valor de venda.
  - **Importar / atualizar CSV:** o **código** é a chave. Código que já existe tem nome, marca, unidade e valores atualizados; código novo é incluído. Antes de confirmar, a tela mostra o que é novo, o que muda (valor antigo → novo) e as linhas com erro.
  - **Desativar os que não estão no arquivo:** opção desmarcada por padrão. Os materiais desativados saem da busca, mas não são apagados.
  - Material já usado em alguma OS não pode ser excluído; ele fica **inativo**.
  - **Exportar CSV** baixa a lista atual, pronta para editar no Excel e importar de novo.
  - Os valores ficam **só nesta tela**. A OS, a tela do técnico, o link do cliente e o PDF continuam mostrando apenas código, material e quantidade. O técnico recebe a lista sem valores.
- **Busca de material na OS:** nos campos **Código** e **Material**, a lista de materiais abre já na primeira letra digitada (sem diferenciar acentos e maiúsculas; aceita mais de uma palavra, ex.: `camera bul`). Ao tocar no item, código, material e unidade são preenchidos e o cursor vai para a quantidade. Vale em **Materiais para levar**, no atendimento do técnico e em **Lançar/Corrigir materiais utilizados**. Também dá para usar as setas e Enter no computador.
- **Para ativar:** cole o `Code.gs` novo e publique uma **nova versão** da implantação. A aba **Materiais** é criada sozinha na planilha.
- **Tipos de atendimento:** Manutenção, Instalação, Preventiva, Venda e Retirada. Instalação continua com aba própria; os outros ficam na aba **Manutenção**. OS antigas com tipos que saíram da lista (Suporte, Corretiva, Vistoria, Outro) continuam com o tipo delas e aparecem no filtro.
- **Descrição do problema:** tem uma setinha **Problema** com as opções em maiúsculas e em ordem alfabética. Ao escolher, o problema entra no início do texto e o campo de detalhes continua livre para completar.
- **Filtro por data:** escolha **De** e **Até** e toque em **Buscar**. No celular, o botão fica no fim do painel **Filtros**.
- **Fotos do técnico:** o botão **Tirar foto** abre direto a câmera do celular, não a galeria.
- **Materiais pela supervisão:** com a OS **Realizada** (ou **Reaberta**), o quadro **Conferência da OS** tem o botão **Lançar materiais utilizados** / **Corrigir materiais utilizados**. A supervisora inclui, altera ou remove itens do técnico antes de processar. Tudo fica no histórico.
- **E-mail "Cliente retirado":** numa OS do tipo **Retirada**, ao clicar em **Marcar como processada** o sistema envia um e-mail com a logo e os dados do cliente para financeiro2@vegasvigilancia.com.br, julianolopes47@gmail.com, controle.cftv@vegasvigilancia.com.br e gilduque@vegasvigilancia.com.br. Ele é enviado uma vez só, mesmo se a OS for reaberta e processada de novo. O envio (ou a falha) aparece na conferência e no histórico. Os endereços ficam em `EMAIL_RETIRADA`, no início do `Code.gs`.
- **Para ativar o e-mail:** depois de colar o `Code.gs` novo e salvar, escolha a função **autorizarEmail** e clique em **▶ Executar**. Autorize o envio de e-mails. Depois publique uma **nova versão** em **Implantar → Gerenciar implantações**. O e-mail sai da conta Google dona do Apps Script.

## Materiais e conferência da OS
- **Tipo de OS Venda:** aparece junto dos outros tipos, na aba **Manutenção**.
- **Materiais para levar:** ao criar ou editar a OS, a supervisora informa código, material e quantidade do que o técnico deve levar.
- **Utilizou algum material?:** para finalizar, o técnico responde **SIM** ou **NÃO**.
  - Com **SIM**, ele informa os materiais usados e a quantidade. Pode tocar num material separado pela supervisão e ajustar a quantidade.
  - Com **NÃO**, a OS registra "Não foi utilizado material".
- **Sem valores na OS:** a OS, a tela do técnico, o link do cliente e o PDF mostram só **código, material e quantidade**. Valores lançados antes desta versão continuam guardados na planilha e aparecem apenas na exportação CSV de **Relatórios**.
- **Conferência:** depois que o cliente assina, a OS fica em **Realizadas**. A supervisão abre a OS e confere, no quadro **Conferência da OS**, o que foi enviado e o que foi utilizado. Depois clica em **Marcar como processada**.
- **Reabrir OS:** numa OS processada, o botão **Reabrir OS** pede o motivo.
  - A OS fica **Reaberta** e permite **Corrigir materiais utilizados** e **Corrigir dados da OS**. (Os materiais também podem ser lançados/corrigidos antes de processar, com a OS Realizada.)
  - Depois é só processar de novo. Nada é apagado: cada passo fica no histórico.
- **Filtros na lista de OS:**
  - **Status:** Todas, Pendente, Realizada, Processada, Reaberta, mais os status de antes.
  - **Material:** Todas, Com material utilizado ou Sem material utilizado. Vale também para as OS antigas.
- **Realizadas:** cada linha mostra o **OS nº** e o **Cliente nº** (código do cadastro do cliente).

## Como funciona no dia a dia
1. **Tela inicial:** ao abrir o sistema, a pessoa escolhe **Técnico** ou **Supervisora**.
2. **Supervisora:**
   - Entra com usuário e senha, como antes.
   - Cria a OS, marca a urgência (Baixa, Normal, Alta ou Urgente) e escolhe o técnico. A escolha pode ser feita na criação ou depois, dentro da OS, no quadro **Técnico responsável**.
   - **Não precisa mandar link.**
3. **Técnico:**
   - Toca em **Técnico** e depois no próprio nome. Há uma busca para achar o nome mais rápido. Não precisa de senha.
   - Aparecem as OS dele, **ordenadas por urgência**: Urgente em vermelho, Alta em laranja, depois Normal e Baixa. As atrasadas ficam marcadas.
   - Toca na OS para abrir, **Iniciar atendimento**, registrar o serviço e as fotos (o botão **Tirar foto** abre a câmera), assinar e **Finalizar**.
   - Depois toca em **Coletar assinatura do cliente**, e o cliente assina no celular do técnico.
   - Quando chega uma OS nova, o celular do técnico mostra um aviso em até 30 segundos. O botão **Atualizar** busca na hora.
4. **Próximos acessos:** o celular lembra o técnico. Na próxima vez aparece **"Continuar como Fulano"**.

O link do cliente continua disponível, mas só é necessário quando o cliente não está no local na hora da assinatura.

---

## Parte 1 — Servidor no Google Apps Script (só 1 arquivo)

1. **Crie o projeto.** Acesse **script.google.com**, clique em **Novo projeto** e renomeie para **Vegas OS API**.
2. **Cole o servidor.** Abra o `Código.gs`, apague tudo e cole o conteúdo de **`apps-script/Code.gs`**.
3. **Ajuste o manifesto.** Vá em **⚙ Configurações do projeto** e marque **Mostrar arquivo de manifesto "appsscript.json"**. Volte ao editor e cole o conteúdo de **`apps-script/appsscript.json`**.
4. **Salve e instale.** Salve (Ctrl+S). Escolha a função **instalar** e clique em **▶ Executar**. Autorize: **Revisar permissões**, depois **Avançado**, **Acessar Vegas OS API** e **Permitir**.
5. **Publique.** Vá em **Implantar → Nova implantação**, escolha o tipo **App da Web** e configure:
   - **Executar como:** Eu
   - **Quem pode acessar:** **Qualquer pessoa**
   - Clique em **Implantar** e copie o URL que termina em `/exec`.

**Já tinha instalado antes?** Cole o `Code.gs` novo por cima do antigo e salve. Depois vá em **Implantar → Gerenciar implantações → ✏ → Versão: Nova versão → Implantar**. O endereço `/exec` continua o mesmo.

## Parte 2 — Telas no GitHub

1. **Crie o repositório.** Em **New repository**, dê um nome (ex.: `vegas-os`), marque **Public** e crie.
2. **Envie os arquivos.** Clique em **Add file → Upload files** e arraste as pastas `css`, `js` e `assets`, e os arquivos `index.html` e `.nojekyll`. Não envie a pasta `apps-script`. Depois clique em **Commit changes**.
3. **Configure o endereço do servidor.** Abra **`js/config.js`**, clique no ✏ e troque `COLE_AQUI_O_ENDERECO_DO_APPS_SCRIPT` pelo endereço `/exec`, mantendo as aspas. Clique em **Commit changes**.
4. **Ative o site.** Em **Settings → Pages**, escolha a branch **main** e a pasta **/(root)** e clique em **Save**.
5. **Primeiro acesso.**
   - Abra o site, toque em **Supervisora** e entre com `supervisora` e a senha `Vegas4747@!`.
   - Troque a senha em Configurações.
   - Cadastre ou importe os técnicos e os clientes (CSV).

**Já tinha enviado antes?** Substitua os arquivos das pastas `css` e `js` pelos novos, mas **mantenha o seu `js/config.js`**. Ele já tem o endereço do Apps Script.

## Listas CSV
- **Técnicos:** só a coluna `nome` é obrigatória. As colunas `usuario` e `senha` são opcionais, porque o técnico entra pelo nome.
- **Clientes:** as colunas são `codigo, nome, cpf_cnpj, telefone, email, endereco, numero, complemento, bairro, cidade, estado, cep`. O mesmo CPF/CNPJ é aceito em endereços diferentes (unidades), e o CPF/CNPJ pode ficar em branco para completar depois.
- **Ordens de serviço:** tela **Ordens de serviço** → **Importar OS CSV**. As colunas são `codigo_cliente, cpf_cnpj, cliente, tipo, prioridade, problema, equipamento, marca, modelo, serie, patrimonio, local, tecnico, data_prevista, hora_prevista`. Obrigatórios: o cliente, por uma das três primeiras colunas, e o `problema`. O cliente precisa estar cadastrado antes. O `tecnico` pode ser o nome ou o usuário. As datas podem vir como `30/09/2026`. Cada linha vira uma OS nova, com número automático, até 500 por arquivo.

- **Materiais e valores:** tela **Materiais** → **Importar / atualizar CSV**. Colunas aceitas: `codigo, material, marca, unidade, valor, valor_venda`, ou o cabeçalho da planilha de estoque (`CodProduto; Descriçao; CodMarca; Unidade; Valor; Valor venda`). Obrigatórios: código e material. Valores no padrão brasileiro (`14,98`) ou com ponto (`14.98`). Unidades como `UN`, `MT`, `RL`, `BB`, `CX` viram unidade(s), metro(s), rolo(s), bobina(s) e caixa(s). Até 5.000 materiais por arquivo.

## Problemas comuns
- **"Falta configurar o servidor":** o `js/config.js` está sem o endereço `/exec`.
- **"O servidor não respondeu corretamente":** a implantação não está como **Qualquer pessoa**, ou o endereço copiado é o `/dev`.
- **A lista de técnicos está vazia:** cadastre os técnicos na parte da Supervisora (tela **Técnicos**).
- **O técnico não aparece na lista:** confira se ele está marcado como **ativo** no cadastro.
- **Mudei o Code.gs e nada mudou:** publique uma nova versão em **Gerenciar implantações**.
- **Mudei o GitHub e nada mudou:** aguarde 1 a 2 minutos e recarregue com **Ctrl+F5**.

## Segurança
- **Entrada do técnico:** é feita pelo nome, como pedido, sem senha. Qualquer pessoa que abrir o site pode tocar no nome de um técnico, mas só vai ver as OS daquele técnico. Clientes, outros técnicos, relatórios e configurações continuam protegidos pelo login da supervisora.
- **Técnico desligado:** desmarque **Técnico ativo** no cadastro. Ele some da tela inicial e perde o acesso na hora.
