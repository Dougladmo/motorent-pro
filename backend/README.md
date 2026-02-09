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

Resposta:
```json
{
  "status": "ok",
  "timestamp": "2026-02-09T...",
  "service": "MotoRent Pro Backend"
}
```

---

### 🏍️ Motorcycles

```bash
GET    /api/motorcycles                # Listar todas as motos
GET    /api/motorcycles?status=Disponível  # Filtrar por status
GET    /api/motorcycles/:id            # Obter moto específica
POST   /api/motorcycles                # Criar nova moto
POST   /api/motorcycles/with-image     # Criar moto com imagem
PATCH  /api/motorcycles/:id            # Atualizar moto
DELETE /api/motorcycles/:id            # Deletar moto
```

**Exemplo - Criar moto:**
```bash
curl -X POST http://localhost:3001/api/motorcycles \
  -H "Content-Type: application/json" \
  -d '{
    "plate": "ABC-1234",
    "model": "Honda CG 160",
    "year": 2023,
    "status": "Disponível"
  }'
```

**Exemplo - Criar moto com imagem:**
```bash
curl -X POST http://localhost:3001/api/motorcycles/with-image \
  -F "image=@/path/to/image.jpg" \
  -F "plate=ABC-1234" \
  -F "model=Honda CG 160" \
  -F "year=2023" \
  -F "status=Disponível"
```

---

### 👥 Subscribers (Assinantes)

```bash
GET    /api/subscribers                # Listar todos os assinantes
GET    /api/subscribers/active         # Listar apenas ativos
GET    /api/subscribers/:id            # Obter assinante específico
POST   /api/subscribers                # Criar novo assinante
PATCH  /api/subscribers/:id            # Atualizar assinante
DELETE /api/subscribers/:id            # Deletar assinante
```

**Exemplo - Criar assinante:**
```bash
curl -X POST http://localhost:3001/api/subscribers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "phone": "11987654321",
    "document": "12345678900",
    "active": true,
    "notes": "Cliente preferencial"
  }'
```

---

### 📋 Rentals (Aluguéis)

```bash
GET    /api/rentals                    # Listar todos os aluguéis
GET    /api/rentals/active             # Listar apenas ativos
GET    /api/rentals/:id                # Obter aluguel específico
GET    /api/rentals/motorcycle/:motorcycleId  # Aluguéis por moto
GET    /api/rentals/subscriber/:subscriberId  # Aluguéis por assinante
POST   /api/rentals                    # Criar novo aluguel
POST   /api/rentals/:id/terminate      # Rescindir contrato
PATCH  /api/rentals/:id                # Atualizar aluguel
DELETE /api/rentals/:id                # Deletar aluguel
```

**Exemplo - Criar aluguel:**
```bash
curl -X POST http://localhost:3001/api/rentals \
  -H "Content-Type: application/json" \
  -d '{
    "motorcycle_id": "uuid-da-moto",
    "subscriber_id": "uuid-do-assinante",
    "start_date": "2026-02-09",
    "weekly_value": 150.00,
    "due_day_of_week": 0
  }'
```

**Exemplo - Rescindir contrato:**
```bash
curl -X POST http://localhost:3001/api/rentals/uuid-do-aluguel/terminate \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Cliente solicitou cancelamento"
  }'
```

**Comportamento ao rescindir:**
- Marca aluguel como inativo (`is_active = false`)
- Libera a moto (status → `Disponível`)
- Cancela todos os pagamentos futuros pendentes

---

### 💰 Payments (Pagamentos)

```bash
GET    /api/payments                   # Listar todos os pagamentos
GET    /api/payments?status=Pago       # Filtrar por status
GET    /api/payments/:id               # Obter pagamento específico
GET    /api/payments/validate          # Validar integridade
PATCH  /api/payments/:id/mark-paid     # Marcar como pago
PATCH  /api/payments/:id/mark-unpaid   # Reverter pagamento
POST   /api/payments/:id/send-reminder # Enviar lembrete
```

**Exemplo - Marcar como pago:**
```bash
curl -X PATCH http://localhost:3001/api/payments/uuid-do-pagamento/mark-paid \
  -H "Content-Type: application/json" \
  -d '{
    "verifiedAmount": 150.00
  }'
```

**Comportamento ao marcar como pago:**
- Atualiza status para `Pago`
- Registra data de pagamento
- Incrementa receita total da moto
- Adiciona registro no histórico de receita

**Exemplo - Enviar lembrete:**
```bash
curl -X POST http://localhost:3001/api/payments/uuid-do-pagamento/send-reminder
```

**Comportamento do lembrete:**
- Calcula dívida total do assinante (todos os aluguéis ativos)
- Simula envio de WhatsApp (logs no console)
- Incrementa contador de lembretes enviados

**Exemplo - Validar integridade:**
```bash
curl http://localhost:3001/api/payments/validate
```

Resposta:
```json
{
  "success": true,
  "data": {
    "totalPayments": 45,
    "inconsistencies": [
      {
        "type": "should_be_overdue",
        "message": "Pagamento abc-123 vencido mas com status Pendente",
        "paymentId": "abc-123"
      }
    ]
  }
}
```

---

### 📊 Status Disponíveis

**Motorcycle Status:**
- `Disponível` - Pronta para alugar
- `Alugada` - Em contrato ativo
- `Manutenção` - Indisponível temporariamente

**Payment Status:**
- `Pendente` - Aguardando pagamento (dentro do prazo)
- `Atrasado` - Vencido e não pago
- `Pago` - Pagamento confirmado
- `Cancelado` - Pagamento cancelado (ex: contrato rescindido)

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
