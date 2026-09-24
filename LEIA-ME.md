# Vegas OS — GitHub Pages + Google Apps Script
Vegas Vigilância e Segurança

O sistema tem duas partes:

- **Telas do sistema:** ficam no **GitHub Pages**, e o endereço é `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.
- **Servidor e banco de dados:** ficam no **Google Apps Script**. Os dados vão para uma Planilha Google, e as fotos e assinaturas para uma pasta no Google Drive.

O sistema começa vazio, só com o usuário `supervisora`.

---

## Parte 1 — Servidor no Google Apps Script (só 1 arquivo)

1. **Crie o projeto.** Acesse **script.google.com**, clique em **Novo projeto** e renomeie para **Vegas OS API**.
2. **Cole o servidor.** Abra o `Código.gs`, apague tudo e cole o conteúdo de **`apps-script/Code.gs`**.
   - Nesta versão **não** crie os arquivos Index, Estilos, Scripts e Logo. As telas ficam no GitHub.
3. **Ajuste o manifesto.** Vá em **⚙ Configurações do projeto** e marque **Mostrar arquivo de manifesto "appsscript.json"**. Volte ao editor, abra `appsscript.json` e cole o conteúdo de **`apps-script/appsscript.json`**.
4. **Salve e instale.** Salve (Ctrl+S). Na barra superior, escolha a função **instalar** e clique em **▶ Executar**. Autorize: **Revisar permissões**, depois **Avançado**, **Acessar Vegas OS API** e **Permitir**.
5. **Publique.** Vá em **Implantar → Nova implantação**, escolha o tipo **App da Web** e configure:
   - **Executar como:** Eu
   - **Quem pode acessar:** **Qualquer pessoa**
   - Clique em **Implantar** e **copie o URL**. Ele termina em `/exec`.

## Parte 2 — Telas no GitHub

1. **Crie o repositório.** No GitHub, clique em **New repository**. Dê um nome (ex.: `vegas-os`), marque **Public** e crie.
2. **Envie os arquivos.** Clique em **Add file → Upload files** e arraste **todo o conteúdo desta pasta**, menos a pasta `apps-script`.
   - Arraste as pastas `css`, `js` e `assets`, e os arquivos `index.html` e `.nojekyll`.
   - Mantenha as pastas como estão, porque o sistema procura `css/style.css`, `js/app.js` etc.
   - O arquivo principal tem que se chamar **`index.html`, tudo minúsculo**.
   - Clique em **Commit changes**.
3. **Configure o endereço do servidor.** No repositório, abra **`js/config.js`** e clique no lápis ✏ para editar. Troque `COLE_AQUI_O_ENDERECO_DO_APPS_SCRIPT` pelo URL `/exec` que você copiou, mantendo as aspas:
   ```js
   window.VG_CONFIG = {
     API_URL: 'https://script.google.com/macros/s/AKfycb..../exec',
   };
   ```
   Clique em **Commit changes**.
4. **Ative o site.** Vá em **Settings → Pages**. Em **Branch**, escolha **main** e a pasta **/(root)** e clique em **Save**. Em 1 a 2 minutos, aparece o endereço do site: `https://SEU-USUARIO.github.io/vegas-os/`.
5. **Primeiro acesso.**
   - Abra o endereço e entre com o usuário `supervisora` e a senha `Vegas4747@!`.
   - Troque a senha em **Configurações**.
   - Cadastre os técnicos e os clientes, um a um ou por **Importar CSV**.

Os links de OS enviados aos técnicos e clientes usam o endereço do GitHub (ex.: `https://SEU-USUARIO.github.io/vegas-os/?os=1001&t=CODIGO`).

---

## Problemas comuns

- **A tela diz "Falta configurar o servidor".** O `js/config.js` ainda está com o texto de exemplo, ou o endereço não termina em `/exec`.
- **Aparece "O servidor não respondeu corretamente".** A implantação não está como **Qualquer pessoa**, ou você copiou o endereço de teste (`/dev`). Use o de **Implantar → Gerenciar implantações**, que termina em `/exec`.
- **A página aparece sem estilo, toda branca.** As pastas `css` e `js` não subiram, ou subiram com outro nome. Confira no repositório se existem `css/style.css` e `js/app.js`.
- **Aparece erro 404.** O arquivo não está como `index.html` minúsculo, ou o GitHub Pages ainda não terminou de publicar.
- **Mudei o Code.gs e nada mudou.** Vá em **Implantar → Gerenciar implantações → ✏ → Versão: Nova versão → Implantar**. O endereço `/exec` continua o mesmo, então não precisa mexer no `config.js`.
- **Mudei arquivos no GitHub e nada mudou.** Aguarde 1 a 2 minutos e recarregue com **Ctrl+F5**.

## Listas CSV
- **Técnicos:** as colunas são `nome, usuario, telefone, email, especialidade, senha`. Só o nome é obrigatório. Se a senha ficar em branco, vale a senha inicial `Vegas4747@!`.
- **Clientes:** as colunas são `codigo, nome, cpf_cnpj, telefone, email, endereco, numero, complemento, bairro, cidade, estado, cep`.
- **Modelo e formato:** cada tela tem o botão **Baixar modelo CSV**. É aceito CSV do Excel, separado por vírgula ou por ponto e vírgula.

## Segurança
- **Público x privado:** o repositório do GitHub pode ser público, porque ele só tem as telas. Os dados ficam na planilha, na sua conta Google, e só são entregues pelo servidor a quem tem login ou o link da OS.
- **Senhas:** são conferidas no servidor e nunca chegam ao navegador.
- **Técnico:** só altera as OS dele.
- **Cliente:** só consegue assinar.
- **Proteção do endereço:** não publique o endereço `/exec` fora do `config.js`. Mesmo assim, ele sozinho não dá acesso a nada sem usuário e senha.
