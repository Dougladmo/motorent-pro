# MotoRent Pro - Backend

Backend Express + Supabase para o sistema de gerenciamento de aluguel de motos.

## 🎯 Funcionalidades

- ✅ **CRON Job 24/7**: Geração automática de pagamentos semanais recorrentes
- ✅ **Persistência PostgreSQL**: Dados salvos no Supabase com backup automático
- ✅ **Row Level Security (RLS)**: Segurança nativa do Supabase
- ✅ **Clean Architecture**: Repository → Service → Controller pattern
- ✅ **TypeScript**: Type safety completo com tipos gerados do schema
- ✅ **Migrations**: Controle de versão do schema do banco de dados

## 📋 Pré-requisitos

- Node.js 18+
- npm ou yarn
- Conta no [Supabase](https://supabase.com) (gratuita)

## 🚀 Setup Inicial

### 1. Instalar dependências

```bash
npm install
```

### 2. Criar projeto no Supabase

1. Acesse https://supabase.com e crie uma conta
2. Crie um novo projeto
3. Aguarde a inicialização (leva ~2 minutos)

### 3. Configurar variáveis de ambiente

1. Vá em **Project Settings → API** no Supabase Dashboard
2. Copie as credenciais:
   - `Project URL` → `SUPABASE_URL`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY`

3. Edite o arquivo `.env`:

```bash
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sua-chave-service-role
FRONTEND_URL=http://localhost:3000
```

### 4. Aplicar migrations (criar tabelas)

#### Opção A: Supabase Dashboard (recomendado para iniciantes)

1. Acesse o **SQL Editor** no Supabase Dashboard
2. Copie o conteúdo de `supabase/migrations/20260209000000_initial_schema.sql`
3. Cole no editor e execute
4. Repita para `20260209000001_rls_policies.sql`
5. (Opcional) Execute `supabase/seed.sql` para dados de teste

#### Opção B: Supabase CLI (recomendado para produção)

```bash
# Instalar CLI
npm install -g supabase

# Fazer login
supabase login

# Linkar projeto
supabase link --project-ref seu-project-id

# Aplicar migrations
supabase db push
```

### 5. Gerar tipos TypeScript (opcional mas recomendado)

```bash
npm run update-types
```

Isso gera o arquivo `src/models/database.types.ts` automaticamente do schema do Supabase.

## 🏃 Executar

### Desenvolvimento (com hot reload)

```bash
npm run dev
```

O servidor iniciará em `http://localhost:3001` e o CRON job será executado imediatamente.

### Produção

```bash
npm run build
npm start
```

## 📡 Endpoints da API

### Health Check

```bash
GET /api/health
```

### Payments

```bash
GET    /api/payments              # Listar todos os pagamentos
GET    /api/payments/:id          # Obter pagamento específico
GET    /api/payments?status=Pago  # Filtrar por status
PATCH  /api/payments/:id/mark-paid    # Marcar como pago
PATCH  /api/payments/:id/mark-unpaid  # Reverter pagamento
POST   /api/payments/:id/send-reminder # Enviar lembrete
GET    /api/payments/validate     # Validar integridade dos dados
```

## 🔄 Como funciona o CRON

O CRON job roda automaticamente **a cada 6 horas** (00:00, 06:00, 12:00, 18:00):

1. **Atualiza status**: Pagamentos `Pendente` com vencimento passado → `Atrasado`
2. **Gera novos pagamentos**: Cria pagamentos semanais para aluguéis ativos
3. **Lookahead de 7 dias**: Garante que sempre há pagamentos gerados com antecedência

**Importante**: O CRON roda mesmo com o app fechado, ao contrário da versão frontend.

### Testar CRON manualmente

Para forçar execução do CRON (útil para testes):

```typescript
// Adicionar rota temporária em src/routes/index.ts
router.post('/trigger-cron', async (req, res) => {
  const cronService = new PaymentCronService(/*...*/);
  await cronService.runPaymentGeneration();
  res.json({ success: true });
});
```

## 🏗️ Estrutura do Projeto

```
backend/
├── src/
│   ├── config/          # Configurações (Supabase, env)
│   ├── models/          # Tipos TypeScript gerados
│   ├── repositories/    # Acesso a dados (queries)
│   ├── services/        # Lógica de negócio
│   ├── controllers/     # HTTP handlers
│   ├── routes/          # Definição de rotas
│   ├── middleware/      # Middlewares Express
│   ├── jobs/            # CRON jobs
│   ├── utils/           # Utilitários
│   ├── app.ts           # Configuração Express
│   └── server.ts        # Entry point
├── supabase/
│   ├── migrations/      # SQL migrations
│   └── seed.sql         # Dados de teste
├── .env                 # Variáveis de ambiente
└── tsconfig.json        # Configuração TypeScript
```

## 🧪 Testando a integração

### 1. Verificar se o backend está rodando

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

### 2. Criar um aluguel de teste (via Supabase Dashboard)

```sql
-- No SQL Editor do Supabase
INSERT INTO rentals (motorcycle_id, subscriber_id, start_date, weekly_value, due_day_of_week)
VALUES (
  (SELECT id FROM motorcycles WHERE plate = 'ABC-1234'),
  (SELECT id FROM subscribers WHERE document = '12345678900'),
  '2026-02-09',
  150.00,
  0
);
```

### 3. Aguardar CRON ou forçar execução

O CRON executará automaticamente na próxima janela de 6 horas, ou você pode reiniciar o servidor para forçar execução imediata:

```bash
# Ctrl+C para parar
npm run dev  # Executará CRON ao iniciar
```

### 4. Verificar pagamentos gerados

```bash
curl http://localhost:3001/api/payments
```

## 🔐 Segurança

- ✅ **RLS habilitado**: Todas as tabelas protegidas por Row Level Security
- ✅ **Service Role Key**: Nunca exposta no frontend
- ✅ **CORS**: Apenas frontend autorizado pode acessar
- ✅ **Rate Limiting**: Máximo 100 requisições por 15 minutos por IP
- ✅ **Helmet**: Headers de segurança HTTP configurados

## 🚀 Deploy

### Supabase (Database)

Já está em produção assim que criar o projeto. Migrations podem ser aplicadas via CLI:

```bash
supabase db push
```

### Backend (Railway/Render/Heroku)

1. Conectar repositório GitHub
2. Configurar variáveis de ambiente:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NODE_ENV=production`
   - `FRONTEND_URL=https://seu-frontend.vercel.app`
3. Deploy automático via Git push

### Variáveis de ambiente obrigatórias em produção

```
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role
NODE_ENV=production
FRONTEND_URL=https://seu-frontend.vercel.app
CRON_PAYMENT_GENERATION="0 */6 * * *"
```

## 📝 Próximos Passos

Após o backend funcionar:

1. **Atualizar frontend**: Remover AppContext, adicionar API calls
2. **Testar integração**: Frontend → Backend → Supabase
3. **Deploy**: Railway (backend) + Vercel (frontend)

## 🐛 Troubleshooting

### Erro: "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar definidos"

**Solução**: Verifique se o arquivo `.env` está preenchido corretamente e no diretório `backend/`.

### Erro: "relation 'public.motorcycles' does not exist"

**Solução**: As migrations não foram aplicadas. Execute via SQL Editor ou CLI.

### CRON não está gerando pagamentos

**Solução**: Verifique os logs do console. O CRON só gera pagamentos se houver aluguéis ativos (`is_active = true`).

### Erro de CORS

**Solução**: Verifique se `FRONTEND_URL` no `.env` corresponde exatamente ao URL do frontend (incluindo porta).

## 📚 Documentação adicional

- [Supabase Documentation](https://supabase.com/docs)
- [Express.js Guide](https://expressjs.com)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
