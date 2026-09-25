# Vegas OS — GitHub Pages + Google Apps Script
Vegas Vigilância e Segurança

O sistema tem duas partes:

- **Telas do sistema:** ficam no **GitHub Pages**, e o endereço é `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.
- **Servidor e banco de dados:** ficam no **Google Apps Script**. Os dados vão para uma Planilha Google, e as fotos e assinaturas para uma pasta no Google Drive.

O sistema começa vazio, só com o usuário `supervisora`.

## Como funciona no dia a dia
1. **Tela inicial:** ao abrir o sistema, a pessoa escolhe **Técnico** ou **Supervisora**.
2. **Supervisora:**
   - Entra com usuário e senha, como antes.
   - Cria a OS, marca a urgência (Baixa, Normal, Alta ou Urgente) e escolhe o técnico. A escolha pode ser feita na criação ou depois, dentro da OS, no quadro **Técnico responsável**.
   - **Não precisa mandar link.**
3. **Técnico:**
   - Toca em **Técnico** e depois no próprio nome. Há uma busca para achar o nome mais rápido. Não precisa de senha.
   - Aparecem as OS dele, **ordenadas por urgência**: Urgente em vermelho, Alta em laranja, depois Normal e Baixa. As atrasadas ficam marcadas.
   - Toca na OS para abrir, **Iniciar atendimento**, registrar o serviço e as fotos, assinar e **Finalizar**.
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
