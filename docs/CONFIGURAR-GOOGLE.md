# Configurar a sincronização com o Google Drive

Para o Atrium salvar suas anotações no **seu** Google Drive, o Google exige que o app tenha um
"ID do cliente" (uma espécie de crachá). Você cria isso **uma única vez**, de graça, em uns 10 minutos.

> 🔒 O Atrium pede só a permissão `drive.appdata`: ele enxerga **apenas a própria pasta oculta**
> dentro do seu Drive. Ele não consegue ver nem mexer nos seus outros arquivos.

---

## Passo 1 — Criar um projeto no Google Cloud

1. Acesse <https://console.cloud.google.com/> e entre com a sua conta Google (a mesma que vai usar no Atrium).
2. Se for a primeira vez, aceite os termos de serviço.
3. No topo da página, clique no seletor de projetos (ao lado do logo "Google Cloud") → **Novo projeto**.
4. Nome do projeto: `Atrium` → **Criar**.
5. Aguarde alguns segundos e confirme que o projeto **Atrium** está selecionado no topo.

## Passo 2 — Ativar a API do Google Drive

1. No menu ☰ (canto superior esquerdo) → **APIs e serviços** → **Biblioteca**.
2. Pesquise por **Google Drive API** e clique nela.
3. Clique em **Ativar**.

## Passo 3 — Configurar a tela de consentimento

É a tela que aparece quando você clica em "Conectar Google Drive".

1. Menu ☰ → **APIs e serviços** → **Tela de permissão OAuth** (pode aparecer como "Google Auth Platform").
2. Clique em **Começar** (ou **Configurar**).
3. Preencha:
   - **Nome do app:** `Atrium`
   - **E-mail para suporte do usuário:** seu e-mail
   - **Público-alvo / Tipo de usuário:** **Externo**
   - **Informações de contato:** seu e-mail
4. Conclua e clique em **Criar**.
5. Vá em **Público-alvo** (ou "Usuários de teste") → **Adicionar usuários** → digite **o seu próprio e-mail** → **Salvar**.

   > O app fica em modo **"Teste"**, o que é perfeito para uso pessoal: só os e-mails da lista conseguem entrar.

6. (Opcional) Em **Acesso a dados** → **Adicionar ou remover escopos**, adicione
   `https://www.googleapis.com/auth/drive.appdata`. Se pular este item, o Google pergunta mesmo assim na hora de conectar.

## Passo 4 — Criar o ID do cliente

1. Menu ☰ → **APIs e serviços** → **Credenciais** (ou "Clientes" no Google Auth Platform).
2. **Criar credenciais** → **ID do cliente OAuth**.
3. **Tipo de aplicativo:** **Aplicativo da Web**.
4. **Nome:** `Atrium Web`.
5. Em **Origens JavaScript autorizadas**, clique em **Adicionar URI** e coloque:
   - `http://localhost:5173` (para usar no seu PC enquanto testa)
   - `https://SEU-USUARIO.github.io` (o endereço do GitHub Pages — veja [PUBLICAR.md](PUBLICAR.md); **sem** barra nem nome do repositório no final)
6. **URIs de redirecionamento autorizados:** deixe em branco.
7. Clique em **Criar**.
8. Vai aparecer o **ID do cliente**, algo como:

   ```
   123456789012-abc123def456.apps.googleusercontent.com
   ```

   Copie esse valor. (O "Chave secreta do cliente" **não** é necessária — não use.)

## Passo 5 — Colocar o ID no Atrium

Você tem duas opções (pode usar as duas):

- **No app publicado (GitHub):** coloque o ID como variável do repositório, como explicado em
  [PUBLICAR.md](PUBLICAR.md#passo-4--configurar-o-id-do-google-no-github). Assim todo aparelho já abre configurado.
- **No seu PC (desenvolvimento):** na pasta do projeto, copie o arquivo `.env.example` para `.env` e preencha:

  ```
  VITE_GOOGLE_CLIENT_ID=123456789012-abc123def456.apps.googleusercontent.com
  ```

- **Direto no app:** em **Configurações → Avançado: ID do cliente Google**, cole o ID e clique em **Salvar**
  (vale só para aquele aparelho/navegador).

## Passo 6 — Conectar

1. Abra o Atrium → **Configurações** → **Conectar Google Drive**.
2. Escolha sua conta.
3. Como o app está em modo de teste, o Google mostra **"O Google não verificou este app"**.
   Clique em **Avançado** → **Acessar Atrium (não seguro)**. Isso é normal para apps pessoais — o app é seu.
4. Autorize o acesso. Pronto: o indicador no rodapé da barra lateral fica verde ("Sincronizado").

Nos outros aparelhos, na tela de boas-vindas escolha **"Já uso em outro aparelho — trazer do Google Drive"**.

---

## Dúvidas comuns

**"Erro 400: redirect_uri_mismatch" ou "origin_mismatch"**
O endereço em que você abriu o Atrium não está em "Origens JavaScript autorizadas" (Passo 4.5).
Confira se escreveu exatamente igual, com `https://` e sem barra no final.

**"Erro 403: access_denied"**
Seu e-mail não está na lista de usuários de teste (Passo 3.5).

**A janela do Google não abre**
O navegador bloqueou o pop-up. Permita pop-ups para o endereço do Atrium e tente de novo.

**"A sessão do Google expirou"**
Por segurança, o acesso dura cerca de 1 hora. O Atrium renova sozinho no próximo toque/clique em qualquer
lugar do app; se não conseguir, use **Configurações → Reconectar**. Suas edições ficam salvas no aparelho
enquanto isso e sobem assim que reconectar.

**Onde ficam os arquivos no meu Drive?**
Numa pasta oculta do app (não aparece na lista de arquivos). Você pode ver quanto espaço ela usa em
<https://drive.google.com/drive/settings> → **Gerenciar apps**. Lá também é possível apagar os dados do Atrium.
