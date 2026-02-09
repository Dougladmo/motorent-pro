# ✅ Checklist de Configuração - MotoRent Pro Backend

Use este checklist para configurar o backend passo a passo.

## 📋 Pré-requisitos

- [ ] Node.js 18+ instalado
- [ ] npm funcionando
- [ ] Conta no Supabase criada (https://supabase.com)

---

## 🎯 Passo 1: Configurar Supabase

### 1.1 Criar Projeto

- [ ] Acessar https://supabase.com
- [ ] Fazer login
- [ ] Clicar em "New Project"
- [ ] Preencher:
  - Nome: `motorent-pro`
  - Senha do banco: (anotar em local seguro)
  - Região: `South America (São Paulo)`
  - Plan: `Free`
- [ ] Aguardar ~2 minutos (provisioning)

### 1.2 Obter Credenciais

- [ ] No dashboard, ir em **Settings** → **API**
- [ ] Copiar **Project URL**
- [ ] Copiar **service_role key** (⚠️ NÃO a anon key!)

### 1.3 Atualizar .env

- [ ] Abrir arquivo `backend/.env`
- [ ] Substituir `SUPABASE_URL` com Project URL real
- [ ] Substituir `SUPABASE_SERVICE_ROLE_KEY` com service_role key real
- [ ] Salvar arquivo

**Exemplo:**
```bash
SUPABASE_URL=https://xyzabc123.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sua-chave-service-role-COMPLETA
```

---

## 📊 Passo 2: Criar Tabelas (Migrations)

### 2.1 Abrir SQL Editor

- [ ] No menu lateral do Supabase, clicar em **SQL Editor**
- [ ] Clicar em **"+ New query"**

### 2.2 Executar Migration 1 (Schema)

- [ ] Abrir arquivo `backend/supabase/migrations/20260209000000_initial_schema.sql`
- [ ] Copiar **todo o conteúdo** (Ctrl+A, Ctrl+C)
- [ ] Colar no SQL Editor
- [ ] Clicar em **"Run"** (ou Ctrl+Enter)
- [ ] Verificar mensagem: **"Success. No rows returned"** ✅

### 2.3 Executar Migration 2 (RLS)

- [ ] Clicar em **"+ New query"** (nova query)
- [ ] Abrir arquivo `backend/supabase/migrations/20260209000001_rls_policies.sql`
- [ ] Copiar e colar no SQL Editor
- [ ] Clicar em **"Run"**
- [ ] Verificar sucesso ✅

### 2.4 (Opcional) Seed Data

- [ ] Criar nova query
- [ ] Abrir arquivo `backend/supabase/seed.sql`
- [ ] Copiar e colar
- [ ] Executar

### 2.5 Verificar Tabelas

- [ ] No menu lateral, clicar em **Table Editor**
- [ ] Verificar que existem 6 tabelas:
  - [ ] `motorcycles`
  - [ ] `subscribers`
  - [ ] `rentals`
  - [ ] `payments`
  - [ ] `payment_status_changes`
  - [ ] `motorcycle_revenue`

---

## 🚀 Passo 3: Iniciar Backend

### 3.1 Instalar Dependências (se ainda não fez)

```bash
cd backend
npm install
```

- [ ] Executado sem erros

### 3.2 Iniciar Servidor de Desenvolvimento

```bash
npm run dev
```

- [ ] Servidor iniciou
- [ ] Logs mostram:
  - [ ] `[SERVER] Backend rodando na porta 3001`
  - [ ] `[CRON] Job agendado com expressão: 0 */6 * * *`
  - [ ] `[CRON] Executando primeira rodada ao iniciar...`
  - [ ] `[CRON] Iniciando geração de pagamentos...`

---

## 🧪 Passo 4: Testar Endpoints

### 4.1 Health Check

Em outro terminal:
```bash
curl http://localhost:3001/api/health
```

- [ ] Retorna JSON com `"status": "ok"`

**Resultado esperado:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-09T...",
  "service": "MotoRent Pro Backend"
}
```

### 4.2 Listar Pagamentos

```bash
curl http://localhost:3001/api/payments
```

- [ ] Retorna JSON com `"success": true`
- [ ] Retorna array (vazio ou com dados se executou seed)

**Resultado esperado:**
```json
{
  "success": true,
  "data": []
}
```

### 4.3 (Se executou seed) Criar um aluguel de teste

No SQL Editor do Supabase:

```sql
INSERT INTO rentals (motorcycle_id, subscriber_id, start_date, weekly_value, due_day_of_week)
VALUES (
  (SELECT id FROM motorcycles WHERE plate = 'ABC-1234'),
  (SELECT id FROM subscribers WHERE document = '12345678900'),
  '2026-02-09',
  150.00,
  0
);
```

- [ ] Executado com sucesso

### 4.4 Verificar CRON Gerou Pagamentos

Reiniciar o backend (Ctrl+C e `npm run dev` novamente) para forçar CRON a executar:

```bash
curl http://localhost:3001/api/payments
```

- [ ] Agora deve retornar pagamentos gerados automaticamente

---

## ✅ Validação Final

### Backend funcionando?

- [ ] Servidor inicia sem erros
- [ ] CRON executa na inicialização
- [ ] `/api/health` responde
- [ ] `/api/payments` retorna dados
- [ ] Logs aparecem no console

### Supabase configurado?

- [ ] Tabelas criadas
- [ ] RLS habilitado
- [ ] Conexão backend ↔ Supabase funcionando

### Pronto para próximo passo?

- [ ] Backend 100% funcional
- [ ] Credenciais salvas com segurança
- [ ] Entendi como funciona o CRON

---

## 🐛 Troubleshooting

### ❌ Erro: "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar definidos"

**Solução:**
1. Verificar se `.env` está na pasta `backend/`
2. Verificar se as credenciais estão corretas
3. Verificar se não há espaços extras nas linhas

### ❌ Erro: "relation 'public.motorcycles' does not exist"

**Solução:**
1. As migrations não foram executadas
2. Voltar ao Passo 2 e executar migrations novamente

### ❌ Servidor inicia mas CRON não gera pagamentos

**Solução:**
1. Verificar se há aluguéis ativos no banco
2. Criar um aluguel de teste (Passo 4.3)
3. Reiniciar backend

### ❌ Erro de CORS no frontend

**Solução:**
1. Verificar se `FRONTEND_URL` no `.env` está correto
2. Deve ser exatamente: `http://localhost:3000` (sem barra no final)

---

## 🎉 Parabéns!

Se todos os itens acima estão marcados ✅, seu backend está 100% funcional!

## 📋 Próximos Passos

- [ ] Ler `README.md` para entender todos os endpoints
- [ ] Ler `IMPLEMENTACAO_COMPLETA.md` para visão geral
- [ ] Começar a atualizar o frontend para usar a API
- [ ] (Opcional) Adicionar mais endpoints para motos, assinantes, aluguéis

---

## 📚 Documentação Completa

- **README.md** - Guia completo de uso e API
- **SUPABASE_SETUP.md** - Tutorial detalhado do Supabase
- **IMPLEMENTACAO_COMPLETA.md** - Visão geral da implementação
- **CHECKLIST.md** - Este arquivo

## 💬 Suporte

Se encontrar problemas:
1. Consultar seção de Troubleshooting acima
2. Verificar logs do console
3. Verificar documentação do Supabase
