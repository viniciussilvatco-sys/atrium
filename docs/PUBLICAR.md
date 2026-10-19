# Publicar o Atrium na internet (GitHub Pages) e instalar nos aparelhos

Publicando no GitHub Pages, o Atrium ganha um endereço fixo (ex.: `https://seu-usuario.github.io/atrium/`)
que você abre no PC, no notebook e no celular. É **gratuito**.

> Os seus dados **não** ficam no GitHub — lá fica só o programa. As anotações ficam no seu aparelho e no seu Google Drive.

---

## Passo 1 — Criar uma conta no GitHub

1. Acesse <https://github.com/signup> e crie uma conta (anote o **nome de usuário**, ele vai no endereço do app).

## Passo 2 — Criar o repositório

1. Entre em <https://github.com/new>.
2. **Repository name:** `atrium` (o endereço será `https://SEU-USUARIO.github.io/atrium/`).
3. Deixe **Public** marcado (o GitHub Pages gratuito exige repositório público; seus dados não vão para lá).
4. **Não** marque "Add a README". Clique em **Create repository**.

## Passo 3 — Enviar o código

Abra o terminal (PowerShell) na pasta do projeto (`C:\Users\vinic\Projetos Claude\PNotion`) e rode,
trocando `SEU-USUARIO`:

```powershell
git init
git add .
git commit -m "Primeira versão do Atrium"
git branch -M main
git remote add origin https://github.com/viniciussilvatco-sys/atrium.git
git push -u origin main
```

Na primeira vez, o Git abre uma janela pedindo login no GitHub — é só entrar.

## Passo 4 — Configurar o ID do Google no GitHub

(Se ainda não criou o ID, siga antes o [CONFIGURAR-GOOGLE.md](CONFIGURAR-GOOGLE.md).)

1. No repositório no GitHub: **Settings** → **Secrets and variables** → **Actions**.
2. Aba **Variables** → **New repository variable**.
3. **Name:** `VITE_GOOGLE_CLIENT_ID`
4. **Value:** o ID do cliente (ex.: `123456789012-abc123def456.apps.googleusercontent.com`).
5. **Add variable**.

## Passo 5 — Ativar o GitHub Pages

1. No repositório: **Settings** → **Pages**.
2. Em **Build and deployment → Source**, escolha **GitHub Actions**.
3. Vá na aba **Actions** do repositório. Se nada estiver rodando, abra o workflow
   **"Publicar no GitHub Pages"** → **Run workflow**.
4. Espere ficar verde ✅ (1–3 minutos). O endereço aparece no resumo do workflow e em Settings → Pages.

Pronto! A partir de agora, **todo `git push` publica a versão nova automaticamente**.

> Lembre-se de que `https://SEU-USUARIO.github.io` precisa estar nas **Origens JavaScript autorizadas**
> do Google (Passo 4 do CONFIGURAR-GOOGLE.md).

---

## Instalar como aplicativo

### PC Windows (Chrome ou Edge)
1. Abra o endereço do Atrium.
2. Clique no ícone **Instalar** (⊕) no fim da barra de endereço — ou menu ⋮ → **Instalar Atrium**
   (Edge: menu ··· → **Aplicativos** → **Instalar este site como um aplicativo**).
3. O Atrium ganha ícone no Menu Iniciar e abre em janela própria.

### Celular Android (Chrome)
1. Abra o endereço do Atrium no Chrome.
2. Menu ⋮ → **Instalar app** (ou **Adicionar à tela inicial**).

### Mac
- **Chrome:** igual ao Windows.
- **Safari (macOS Sonoma ou mais novo):** menu **Arquivo → Adicionar ao Dock**.

### Linux
- **Chrome/Chromium/Edge:** igual ao Windows.

Depois de instalado, o Atrium **funciona offline**: você pode escrever sem internet e ele sincroniza quando a conexão voltar.

---

## Usar no PC sem publicar (modo desenvolvimento)

Com o [Node.js](https://nodejs.org) instalado, na pasta do projeto:

```powershell
npm install      # só na primeira vez
npm run dev      # abre em http://localhost:5173
```

Outros comandos úteis:

```powershell
npm test         # roda os testes automáticos
npm run build    # gera a versão final na pasta dist/
npm run preview  # testa a versão final em http://localhost:4173
```

> Para testar o login do Google em `npm run preview`, adicione também `http://localhost:4173`
> nas Origens JavaScript autorizadas.
