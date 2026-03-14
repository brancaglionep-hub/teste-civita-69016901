# 🚀 Guia de Deploy Externo - ReclamaBuraco

Este documento descreve como fazer o deploy do sistema **fora do Lovable**, usando seu próprio servidor e projeto Supabase.

---

## 📋 Pré-requisitos

- **Node.js** 18+ (recomendado 20 LTS)
- **npm** ou **pnpm**
- **Supabase CLI** (`npm install -g supabase`)
- **Conta no Supabase** (https://supabase.com)
- **Servidor/VPS** ou serviço de hosting estático (Vercel, Netlify, etc.)

---

## 1️⃣ Clonar o Repositório

```bash
git clone <SEU_REPO_GIT>
cd reclamaburaco
```

---

## 2️⃣ Criar Projeto no Supabase

1. Acesse https://supabase.com/dashboard
2. Clique em **New Project**
3. Anote:
   - **Project URL** (ex: `https://xyzabc.supabase.co`)
   - **Anon Key** (chave pública)
   - **Service Role Key** (chave privada - NUNCA exponha no frontend)

---

## 3️⃣ Configurar Banco de Dados

Execute o arquivo SQL completo no **SQL Editor** do Supabase Dashboard:

```bash
# O arquivo está em:
docs/database_schema.sql
```

Esse arquivo contém:
- Enums (tipos customizados)
- Todas as tabelas
- Políticas RLS (Row Level Security)
- Funções e triggers
- View pública `prefeituras_publico`

---

## 4️⃣ Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGci...sua_anon_key
VITE_SUPABASE_PROJECT_ID=seu_project_id
```

> ⚠️ **NUNCA** coloque a `SERVICE_ROLE_KEY` no frontend!

---

## 5️⃣ Instalar Dependências e Build

```bash
# Instalar dependências
npm install

# Remover dependência exclusiva do Lovable (opcional)
npm uninstall lovable-tagger

# Build de produção
npm run build
```

O build gera a pasta `dist/` com os arquivos estáticos.

---

## 6️⃣ Ajustar vite.config.ts (Remover Lovable Tagger)

Edite `vite.config.ts` para remover a referência ao `lovable-tagger`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

---

## 7️⃣ Deploy do Frontend

### Opção A: Servidor Estático (Nginx)

```nginx
server {
    listen 80;
    server_name seudominio.com;
    root /var/www/reclamaburaco/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache de assets estáticos
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Opção B: Vercel

```bash
npm i -g vercel
vercel --prod
```

### Opção C: Netlify

Crie `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## 8️⃣ Deploy das Edge Functions

### Vincular ao Supabase:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
```

### Configurar Secrets no Supabase:

```bash
# Obrigatórios
supabase secrets set SUPABASE_URL=https://SEU_PROJETO.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
supabase secrets set SUPABASE_ANON_KEY=sua_anon_key

# Opcionais (conforme integrações ativas)
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set RESEND_WEBHOOK_SECRET=whsec_xxx
supabase secrets set TWILIO_ACCOUNT_SID=ACxxx
supabase secrets set TWILIO_AUTH_TOKEN=xxx
supabase secrets set TWILIO_PHONE_NUMBER=+55xxx
supabase secrets set TWILIO_WHATSAPP_NUMBER=+55xxx
supabase secrets set VONAGE_API_KEY=xxx
supabase secrets set VONAGE_API_SECRET=xxx

# Para o agente IA do WhatsApp (se usar Lovable AI, substituir por OpenAI/Gemini)
# supabase secrets set OPENAI_API_KEY=sk-xxx
```

### Deploy das funções:

```bash
supabase functions deploy create-user
supabase functions deploy delete-user
supabase functions deploy update-user
supabase functions deploy send-status-notification
supabase functions deploy send-complaint-confirmation
supabase functions deploy send-alert
supabase functions deploy process-upload-queue
supabase functions deploy receive-whatsapp-complaint
supabase functions deploy receive-evolution-webhook
supabase functions deploy evolution-api-proxy
supabase functions deploy whatsapp-ai-agent
supabase functions deploy send-whatsapp-message
supabase functions deploy cidadao-find-or-create
supabase functions deploy prefeitura-by-instance
supabase functions deploy criar-reclamacao-n8n
supabase functions deploy interacao-log
supabase functions deploy webhooks-resend
supabase functions deploy test-sms
```

Ou deploy de todas de uma vez:

```bash
supabase functions deploy --all
```

---

## 9️⃣ Configurar Storage

No Supabase Dashboard → Storage:

1. Criar bucket `reclamacoes-media` como **público**
2. Adicionar políticas de acesso:

```sql
-- Qualquer pessoa pode fazer upload
CREATE POLICY "Uploads públicos" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'reclamacoes-media');

-- Qualquer pessoa pode ver
CREATE POLICY "Downloads públicos" ON storage.objects
FOR SELECT USING (bucket_id = 'reclamacoes-media');
```

---

## 🔟 Criar Usuário Super Admin

No SQL Editor do Supabase:

```sql
-- 1. Criar usuário via Auth (Dashboard → Authentication → Add User)
-- Email: admin@seudominio.com / Senha: suasenha

-- 2. Atribuir role de super_admin
INSERT INTO public.user_roles (user_id, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@seudominio.com'),
  'super_admin'
);
```

---

## ⚠️ Atenção: LOVABLE_API_KEY

O agente IA do WhatsApp (`whatsapp-ai-agent`) usa a `LOVABLE_API_KEY` para acessar modelos de IA. **Fora do Lovable, isso não funciona.**

Você precisará:
1. Substituir a chamada à API Lovable por OpenAI, Google Gemini, ou outro provedor
2. Configurar a respectiva API key como secret
3. Editar `supabase/functions/whatsapp-ai-agent/index.ts` para usar o novo endpoint

---

## 📁 Estrutura do Projeto

```
├── dist/                    # Build de produção (gerado)
├── docs/                    # Documentação
├── public/                  # Assets estáticos
├── src/
│   ├── assets/              # Imagens importadas
│   ├── components/          # Componentes React
│   │   ├── admin/           # Layout admin
│   │   ├── painel/          # Layout painel prefeitura
│   │   └── ui/              # shadcn/ui components
│   ├── hooks/               # Custom hooks
│   ├── integrations/        # Supabase client & types
│   ├── lib/                 # Utilitários
│   └── pages/               # Páginas (rotas)
│       ├── admin/           # Páginas super admin
│       └── painel/          # Páginas painel prefeitura
├── supabase/
│   ├── config.toml          # Config das edge functions
│   └── functions/           # Edge Functions (Deno)
└── package.json
```

---

## 🔄 Rotas da Aplicação

| Rota | Descrição |
|------|-----------|
| `/` | Landing page pública |
| `/auth` | Login/cadastro |
| `/:slug` | Página da cidade (ex: `/biguacu`) |
| `/avaliar` | Avaliação de reclamação |
| `/admin` | Dashboard super admin |
| `/admin/prefeituras` | Gestão de prefeituras |
| `/admin/usuarios` | Gestão de usuários |
| `/admin/categorias` | Categorias globais |
| `/admin/integracoes` | Config global Evolution API |
| `/admin/whatsapp-bot` | Visualizar estrutura do bot |
| `/painel/:id` | Dashboard da prefeitura |
| `/painel/:id/reclamacoes` | Lista de reclamações |
| `/painel/:id/reclamacoes/:recId` | Detalhe da reclamação |
| `/painel/:id/avaliacoes` | Avaliações recebidas |
| `/painel/:id/alertas` | Central de alertas |
| `/painel/:id/cidadaos` | Gestão de cidadãos |
| `/painel/:id/bairros` | Gestão de bairros |
| `/painel/:id/categorias` | Categorias da prefeitura |
| `/painel/:id/configuracoes` | Configurações |
| `/painel/:id/integracoes` | WhatsApp/Evolution |
| `/painel/:id/whatsapp` | Chat WhatsApp |

---

## 🛡️ Edge Functions - Referência

| Função | JWT | Descrição |
|--------|-----|-----------|
| `create-user` | ❌ | Criar usuário admin |
| `delete-user` | ❌ | Excluir usuário |
| `update-user` | ❌ | Atualizar usuário |
| `send-status-notification` | ❌ | Notificar mudança de status |
| `send-complaint-confirmation` | ❌ | Confirmar reclamação |
| `send-alert` | ❌ | Enviar alerta em massa |
| `process-upload-queue` | ❌ | Processar fila de uploads |
| `receive-whatsapp-complaint` | ❌ | Webhook reclamação WhatsApp |
| `receive-evolution-webhook` | ❌ | Webhook Evolution API |
| `evolution-api-proxy` | ❌ | Proxy para Evolution API |
| `whatsapp-ai-agent` | ❌ | Agente IA WhatsApp |
| `send-whatsapp-message` | ✅ | Enviar mensagem WhatsApp |
| `cidadao-find-or-create` | ❌ | Buscar/criar cidadão |
| `prefeitura-by-instance` | ❌ | Buscar prefeitura por instância |
| `criar-reclamacao-n8n` | ❌ | Criar reclamação via N8N |
| `interacao-log` | ❌ | Log de interação |
| `webhooks-resend` | ❌ | Reenviar webhooks |
| `test-sms` | ❌ | Testar SMS |
