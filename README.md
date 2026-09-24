# Vegas OS — Controle de Ordens de Serviço
Vegas Vigilância e Segurança

Sistema web em HTML5, CSS3 e JavaScript puro (sem instalação, sem banco de dados).

## Como abrir
**Recomendado (servidor local):** na pasta do projeto, execute

    python -m http.server 8080

e acesse http://localhost:8080. Assim a logo sai no PDF a partir de `assets/logo.png`, e copiar link e compartilhar funcionam normalmente.

**Rápido:** dar dois cliques em `index.html` também funciona.

Precisa de internet apenas para as fontes e a biblioteca de PDF (jsPDF). Sem internet, o botão Gerar PDF abre a impressão do navegador, onde é possível escolher "Salvar como PDF".

## Acesso de demonstração
Senha inicial de todos os usuários: `Vegas4747@!`

| Usuário | Perfil |
|---|---|
| supervisora | Supervisora (acesso total) |
| joao, marcos, rafael, bruno | Técnicos |

O cliente não tem login: ele acessa pelo link exclusivo da OS.

Para trocar a senha, use **Configurações → Alterar minha senha**. As senhas dos técnicos são definidas em **Técnicos**.

## Fluxo
1. **Supervisora:** cria a OS e envia o link do técnico (copiar, compartilhar ou WhatsApp).
2. **Técnico:** abre o link, clica em Iniciar atendimento e registra diagnóstico, serviço, materiais, fotos e observações. Depois assina e clica em Finalizar atendimento.
3. **Cliente:** abre o link do cliente, confere o serviço, informa o nome e assina.
4. **OS concluída:** o PDF fica disponível com o nome `OS_1045_NomeDoCliente.pdf`.

## Importação de clientes
Use **Clientes → Importar clientes CSV** e baixe o **Modelo CSV**. Colunas aceitas:

`codigo, nome, cpf_cnpj, telefone, email, endereco, numero, complemento, bairro, cidade, estado, cep`

Na importação:
- CPF/CNPJ inválidos são apontados.
- Clientes duplicados são ignorados.
- São aceitos arquivos do Excel separados por `,` ou `;`.

## Limitações do protótipo (importante)
- **Os dados ficam no navegador (localStorage).** Um link aberto em outro celular ou computador não encontra a OS. Para uso real com técnicos e clientes em aparelhos diferentes, é necessário publicar com um servidor e banco de dados.
- **O limite de armazenamento é de cerca de 5 MB.** As fotos são comprimidas, mas ocupam a maior parte desse espaço. Faça backups em **Configurações → Dados e backup**.
- **Senhas e sessão no navegador não são seguras para produção.** As camadas `js/storage.js` (dados) e `js/auth.js` (login, sessão, validação de links) foram isoladas para serem trocadas por uma API.

## Estrutura
    index.html            aplicação (rotas por #hash)
    css/                  themes.css (cores claro/escuro), style.css, responsive.css
    js/                   utils, storage, auth, assinatura, csv, pdf, dashboard,
                          clientes, tecnicos, os, portal (link técnico/cliente),
                          relatorios, configuracoes, app (login, menu, rotas)
    assets/logo.png       logo usada em todo o sistema
    assets/logo-embed.js  cópia da logo para o PDF quando aberto via arquivo
    pages/                atalhos para as telas (redirecionam para index.html)

**Trocar a logo:** substitua `assets/logo.png`, de preferência PNG branco com fundo transparente. No modo claro, a logo é escurecida automaticamente.
