# Guia Completo: Setup do Supabase

Este guia mostra **passo a passo** como configurar o Supabase para o MotoRent Pro Backend.

## 📋 O que é o Supabase?

Supabase é uma alternativa open-source ao Firebase que fornece:
- **PostgreSQL**: Banco de dados relacional completo
- **Row Level Security (RLS)**: Segurança nativa no banco
- **APIs automáticas**: REST e Realtime geradas automaticamente
- **Plano gratuito**: 500MB de storage, suficiente para desenvolvimento

## 🚀 Passo 1: Criar conta e projeto

### 1.1. Criar conta

1. Acesse https://supabase.com
2. Clique em **"Start your project"**
3. Faça login com GitHub, Google ou email

### 1.2. Criar projeto

1. Clique em **"New Project"**
2. Preencha:
   - **Name**: `motorent-pro`
   - **Database Password**: Anote em local seguro (ex: gerenciador de senhas)
   - **Region**: `South America (São Paulo)` para menor latência
   - **Pricing Plan**: `Free` (suficiente para desenvolvimento)

3. Clique em **"Create new project"**
4. Aguarde ~2 minutos para o projeto ser provisionado

## 🔑 Passo 2: Obter credenciais

### 2.1. Copiar Project URL e Keys

1. No dashboard do projeto, vá em **Settings** (ícone de engrenagem) → **API**
2. Você verá 3 informações importantes:

   - **Project URL**: `https://xyzabc123.supabase.co`
   - **anon public key**: Começa com `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **service_role key** (⚠️ SECRETA): Também começa com `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 2.2. Atualizar arquivo .env

No arquivo `backend/.env`, substitua:

```bash
SUPABASE_URL=https://xyzabc123.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sua-chave-service-role-COMPLETA
```

⚠️ **IMPORTANTE**: Use a **service_role key**, NÃO a anon key. A service_role bypassa o RLS para o backend.

## 📊 Passo 3: Criar tabelas (Migrations)

### Método 1: SQL Editor (Recomendado para iniciantes)

#### 3.1. Abrir SQL Editor

1. No menu lateral, clique em **SQL Editor**
2. Clique em **"+ New query"**

#### 3.2. Executar migration 1 (Schema inicial)

1. Abra o arquivo `backend/supabase/migrations/20260209000000_initial_schema.sql`
2. Copie **todo o conteúdo**
3. Cole no SQL Editor
4. Clique em **"Run"** (ou `Ctrl + Enter`)
5. Verifique se aparece **"Success. No rows returned"**

#### 3.3. Executar migration 2 (RLS Policies)

1. Crie **nova query** (botão `+ New query`)
2. Abra o arquivo `backend/supabase/migrations/20260209000001_rls_policies.sql`
3. Copie e cole todo o conteúdo
4. Clique em **"Run"**
5. Verifique sucesso

#### 3.4. (Opcional) Inserir dados de teste

1. Crie nova query
2. Abra o arquivo `backend/supabase/seed.sql`
3. Copie e cole
4. Execute

### Método 2: Supabase CLI (Avançado)

```bash
# Instalar CLI
npm install -g supabase

# Login
supabase login

# Linkar projeto
supabase link --project-ref SEU_PROJECT_REF

# Aplicar migrations
supabase db push

# Seed (opcional)
supabase db seed
```

## ✅ Passo 4: Verificar instalação

### 4.1. Verificar tabelas criadas

1. No dashboard, vá em **Table Editor** (menu lateral)
2. Você deve ver 6 tabelas:
   - `motorcycles`
   - `subscribers`
   - `rentals`
   - `payments`
   - `payment_status_changes`
   - `motorcycle_revenue`

### 4.2. Verificar RLS habilitado

1. Clique em qualquer tabela (ex: `motorcycles`)
2. Vá na aba **"RLS"** (Row Level Security)
3. Deve mostrar: **"RLS enabled"** ✅
4. Deve ter uma policy: **"Service role full access motorcycles"**

### 4.3. Verificar dados de teste (se executou seed)

1. No **Table Editor**, clique em `motorcycles`
2. Deve mostrar 5 motos
3. Clique em `subscribers`
4. Deve mostrar 4 assinantes

## 🧪 Passo 5: Testar conexão do backend

### 5.1. Iniciar backend

```bash
cd backend
npm run dev
```

### 5.2. Verificar logs

Você deve ver:

```
[SERVER] Backend rodando na porta 3001
[SERVER] Ambiente: development
[CRON] Job agendado com expressão: 0 */6 * * *
[CRON] Executando primeira rodada ao iniciar...
[CRON] Iniciando geração de pagamentos...
```

### 5.3. Testar endpoint

```bash
curl http://localhost:3001/api/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "timestamp": "2026-02-09T...",
  "service": "MotoRent Pro Backend"
}
```

## 🔧 Troubleshooting

### Erro: "Failed to fetch payments: ..."

**Causa**: Credenciais incorretas ou tabelas não criadas

**Solução**:
1. Verifique se `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` estão corretos no `.env`
2. Verifique se as migrations foram executadas (Step 3)
3. Reinicie o backend: `Ctrl+C` → `npm run dev`

### Erro: "relation 'public.motorcycles' does not exist"

**Causa**: Migrations não foram aplicadas

**Solução**: Execute as migrations novamente via SQL Editor (Passo 3.2)

### Erro: "Invalid API key"

**Causa**: Usando anon key em vez de service_role key

**Solução**: Copie a **service_role key** (não a anon key) e atualize o `.env`

### Backend inicia mas não há logs do CRON

**Causa**: Erro silencioso na conexão Supabase

**Solução**:
1. Verifique se o `.env` está no diretório `backend/`
2. Verifique se não há espaços extras nas variáveis de ambiente
3. Teste a conexão manualmente:

```bash
curl -X GET 'https://seu-projeto.supabase.co/rest/v1/motorcycles' \
  -H "apikey: SUA_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY"
```

## 📚 Recursos Adicionais

### Documentação Supabase
- [Getting Started](https://supabase.com/docs/guides/getting-started)
- [Database](https://supabase.com/docs/guides/database)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

### Ferramentas úteis

- **Supabase Studio**: Interface web para gerenciar banco de dados
- **Supabase CLI**: Ferramenta de linha de comando para migrations e deploy
- **PostgreSQL GUI**: [TablePlus](https://tableplus.com), [DBeaver](https://dbeaver.io)

## 🎯 Próximos Passos

Após configurar o Supabase com sucesso:

1. ✅ Backend está rodando e CRON funcionando
2. ➡️ Atualizar frontend para usar API do backend (próximo passo)
3. ➡️ Testar integração completa
4. ➡️ Deploy para produção

## 💡 Dicas de Produção

### Backups automáticos

O Supabase faz backup automático diário no plano gratuito. Para mais controle:

1. Vá em **Settings** → **Database**
2. Configure **Point-in-time Recovery** (plano Pro)

### Monitoramento

1. **Settings** → **Database** → **Usage**: Ver queries lentas
2. **Reports**: Métricas de uso e performance

### Segurança

- ✅ Nunca commite `.env` com credenciais reais
- ✅ Use variáveis de ambiente no deploy (Railway, Render, Heroku)
- ✅ Rotacione keys regularmente (Settings → API → "Rotate keys")
