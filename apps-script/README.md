# Backend (Apps Script) — Controle Operacional TRJ

Este é o **backend** do painel. Ele transforma a sua planilha Google na base de
dados e expoe uma API JSON que o site (GitHub Pages) consome.

## Arquivos

- **Code.gs** — todo o código do backend.
- **appsscript.json** — manifesto (fuso, escopos de permissão, configuração do App da Web).

## Passo a passo

1. Abra a sua planilha do Google (a que tem a aba **VALID_CAD** com as cidades).
2. Menu **Extensões → Apps Script**.
3. No arquivo `Code.gs` que abrir, apague tudo e **cole o conteúdo de `Code.gs`** deste pacote.
4. Clique na engrenagem **Configurações do projeto** → marque *“Mostrar arquivo de manifesto `appsscript.json`”*.
   Abra o `appsscript.json` que aparecer no editor e **cole o conteúdo de `appsscript.json`** deste pacote.
5. Volte ao `Code.gs`. No topo do editor, selecione a função **`configurarTudo`** e clique em **Executar**.
   - O Google vai pedir autorização → autorize com a sua conta.
   - Isso cria as abas `TASKS`, `INCIDENTES`, `USUARIOS`, `CONFIG`, um usuário
     `admin@trj.com / trj2026` e os prazos de SLA padrão.
6. **Implantar → Nova implantação**:
   - Tipo: **App da Web**
   - *Executar como*: **Eu**
   - *Quem pode acessar*: **Qualquer pessoa**
   - Clique em **Implantar** e **copie a URL** que termina em `/exec`.
7. Cole essa URL em **`site/config.js`** (campo `APPS_SCRIPT_URL`).

## Login do painel

Os usuários ficam na aba **USUARIOS** (colunas: `email`, `senha`, `nome`, `papel`).
Adicione/edite linhas à vontade. O `papel` pode ser `admin` ou `operador`.

> Senhas ficam em texto na planilha — por isso, **mantenha o repositório do GitHub PRIVADO**
> e a planilha compartilhada apenas com quem deve ter acesso.

## Abas criadas

| Aba | Origem dos dados | Conteúdo |
|-----|------------------|----------|
| **VALID_CAD** | você (já existe) | cadastro de cidades/sites — a base real |
| **TASKS** | script Python | atividades / tickets WFM |
| **INCIDENTES** | uploads de HTML no painel | sites fora (G.E.N.E.S.I.S) |
| **USUARIOS** | você | login do painel |
| **CONFIG** | painel (tela Configurações) | prazos de SLA por prioridade |

## Reimplantar após mudanças no código

Se editar o `Code.gs`, use **Implantar → Gerenciar implantações → ✏️ (editar) → Versão: Nova versão → Implantar**.
A URL `/exec` continua a mesma.

## Token de API

O script gera um token automático (guardado em *Propriedades do Script*). O painel o
recebe ao fazer login e o reutiliza nas chamadas. Para revogá-lo (forcar novo login
de todos), apague a propriedade `API_TOKEN` em **Configurações do projeto → Propriedades do script**.
