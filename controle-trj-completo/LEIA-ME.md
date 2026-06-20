# Controle TRJ — Versão GitHub Pages + Planilha Google

Esta é uma versão **independente** do painel Controle TRJ, feita para rodar
**de graça** usando apenas:

- **GitHub Pages** — hospeda o site (frente).
- **Planilha Google + Apps Script** — funciona como banco de dados (fundo).
- **Python** (opcional) — envia as tarefas exportadas da plataforma para a planilha.

> Tudo o que aparece na tela (região, SLA, backlog, massivas...) é calculado
> pelo próprio site. A planilha só guarda e devolve os dados.

---

## Visão geral das pastas

```
entrega-github/
  apps-script/   -> código do "servidor" (cole na sua Planilha Google)
  site/          -> o site em si (suba no GitHub Pages)
  python/        -> script para enviar as tarefas (.xlsx) para a planilha
  LEIA-ME.md     -> este guia
```

---

## PARTE 1 — Preparar a Planilha (o "servidor")

1. Abra a sua planilha no Google Sheets (a que contém a aba **VALID_CAD**).
2. No menu, clique em **Extensões → Apps Script**.
3. Apague qualquer código que estiver lá e **cole todo o conteúdo** do arquivo
   `apps-script/Code.gs`.
4. (Opcional) Em **Configurações do projeto**, confira o fuso/idioma.
5. No editor do Apps Script, selecione a função **`configurarTudo`** na lista
   de funções e clique em **Executar**. Autorize o acesso quando pedir.
   - Isso cria as abas **TASKS, INCIDENTES, USUARIOS, CONFIG** e o
     usuário inicial **admin@trj.com / trj2026**, além de gerar o **token**.
6. Para descobrir o token, selecione a função **`mostrarToken`** e execute —
   o token aparece no registro de execução (Logs). Guarde-o.
7. Agora publique o Web App: clique em **Implantar → Nova implantação** →
   tipo **App da Web**:
   - *Executar como*: **Eu (seu e-mail)**.
   - *Quem pode acessar*: **Qualquer pessoa**.
   - Clique **Implantar** e **copie a URL** que termina em **`/exec`**.

> Sempre que alterar o `Code.gs`, faça **Implantar → Gerenciar implantações →
> editar → Nova versão** para publicar a mudança.

### Abas que a planilha passa a ter
- **VALID_CAD** — sua base de cidades (já existente). Não é alterada.
- **TASKS** — tarefas (preenchida pelo script Python).
- **INCIDENTES** — sites fora (preenchida pelo site, ao importar o G.E.N.E.S.I.S).
- **USUARIOS** — e-mail / senha / papel. Edite aqui para criar logins.
- **CONFIG** — prazos de SLA (também editáveis pela tela Configurações).

---

## PARTE 2 — Configurar e publicar o site (GitHub Pages)

1. Abra o arquivo `site/js/config.js` e cole a URL do Apps Script:
   ```js
   APPS_SCRIPT_URL: "https://script.google.com/macros/s/SEU_ID/exec",
   ```
2. Crie um repositório no GitHub (recomendado: **privado**, pois as senhas
   ficam na planilha).
3. Envie **o conteúdo da pasta `site/`** para o repositório (o `index.html`
   precisa ficar na raiz do que será publicado).
4. No GitHub: **Settings → Pages → Build and deployment**:
   - *Source*: **Deploy from a branch**.
   - *Branch*: **main** / pasta **/ (root)** → **Save**.
5. Aguarde 1–2 minutos e acesse a URL que o GitHub mostrar.
6. Faça login com **admin@trj.com / trj2026** (troque a senha na aba USUARIOS).

> Teste local (opcional): dentro da pasta `site/`, rode
> `python -m http.server 8080` e abra `http://localhost:8080`.

---

## PARTE 3 — Enviar as tarefas (Python)

Veja o guia detalhado em `python/README.md`. Em resumo:

```
cd python
pip install -r requirements.txt
# edite o topo de puxar_para_sheets.py (URL, TOKEN, ARQUIVO)
python puxar_para_sheets.py
```

Depois, abra o site e clique em **Atualizar**.

---

## PARTE 4 — Importar os "sites fora" (incidentes)

1. No site, vá em **Sites Fora (Incidentes)**.
2. Clique em **Importar painel G.E.N.E.S.I.S** e selecione o arquivo HTML
   exportado do painel.
3. Os incidentes são lidos no próprio navegador, cruzados com a base de
   cidades e enviados para a planilha.
4. Você pode mudar o status de cada incidente (Ativo / Em Tratamento /
   Resolvido). Uma nova importação **preserva** os status já definidos.

---

## Páginas disponíveis nesta versão

- **Dashboard** — KPIs, gráficos (aging, prazos, SLA por região,
  atividades manuais, produtividade), top cidades, copiar resumo. Todos os
  cartões e gráficos abrem o detalhamento (drill) ao clicar.
- **SLA / Aderência** — aderência por prioridade e por região.
- **Visão Regional** — backlog e aderência por região.
- **Sites Fora (Incidentes)** — importar G.E.N.E.S.I.S, massivas, filtros e
  mudança de status.
- **Cadastro de Cidades** — consulta paginada da base VALID_CAD.
- **Configurações** — prazos de SLA por prioridade.

### Observações / limites desta versão
- As páginas **Comparativo, Relatórios, Senhas, Tarefas e Importar** do app
  original **não** foram incluídas aqui (podem ser adicionadas depois).
- A base VALID_CAD desta planilha tem 8 colunas (sem ANF nem coordenadas);
  o ANF dos incidentes vem do próprio painel G.E.N.E.S.I.S.
- Mantenha o repositório **privado**: as senhas ficam na aba USUARIOS.

---

## Problemas comuns

| Sintoma | Causa provável / solução |
|---|---|
| "URL do Apps Script não configurada" | Preencha `APPS_SCRIPT_URL` em `site/js/config.js`. |
| "Resposta inesperada do servidor" | Reimplante o Web App com acesso **Qualquer pessoa**. |
| Login falha | Confira o e-mail/senha na aba **USUARIOS**. |
| Nada aparece no dashboard | Rode o Python (tarefas) e/ou importe o G.E.N.E.S.I.S. |
| Mudei o Code.gs e não surtiu efeito | Publique **Nova versão** da implantação. |
