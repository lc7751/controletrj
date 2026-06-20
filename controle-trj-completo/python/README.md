# Python — Enviar tarefas para a Planilha

Este script lê o arquivo de **tarefas** (`.xlsx`) exportado da plataforma e
envia as linhas para a sua Planilha Google (aba `TASKS`), via Apps Script.

## Passo a passo

1. Instale o Python 3.9+ (https://www.python.org/downloads/).
2. Abra o terminal nesta pasta e instale as dependências:
   ```
   pip install -r requirements.txt
   ```
3. Abra o arquivo `puxar_para_sheets.py` e preencha no topo:
   - `APPS_SCRIPT_URL` — a URL do seu Web App (termina em `/exec`).
   - `API_TOKEN` — o token (veja o LEIA-ME.md, seção do Apps Script).
   - `ARQUIVO_XLSX` — o caminho do arquivo exportado.
4. Se o seu arquivo tiver colunas em posições diferentes, ajuste o
   dicionário `COLUNAS` (número da coluna, começando em 1).
5. Rode:
   ```
   python puxar_para_sheets.py
   ```
6. Abra o site e clique em **Atualizar**.

> O envio **substitui** o conteúdo da aba TASKS pela última carga.
> Os incidentes (sites fora) são importados pelo próprio site, na
> página "Sites Fora", a partir do painel G.E.N.E.S.I.S em HTML.
