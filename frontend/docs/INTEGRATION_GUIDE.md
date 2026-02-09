# Guia de Integração - MotoRent Pro

## 📦 Arquitetura da Integração

### Backend (Express + TypeScript + Supabase)
- **Localização**: `/backend`
- **Porta padrão**: 3333 ou 3001 (configurável via `.env`)
- **Database**: Supabase (PostgreSQL)
- **Features**:
  - CRUD completo para Motorcycles, Subscribers, Rentals e Payments
  - CRON job automático para geração de pagamentos recorrentes
  - Sistema de auditoria e rastreamento de mudanças
  - Validação de integridade de pagamentos

### Frontend (React + TypeScript + Vite)
- **Localização**: `/` (raiz)
- **Porta padrão**: 3000
- **Features**:
  - Interface completa de gerenciamento
  - Integração via Axios com backend
  - Context API para gerenciamento de estado
  - Transformação automática de dados (snake_case ↔ camelCase)

## 🚀 Setup Inicial

### 1. Backend

```bash
cd backend

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais do Supabase

# Rodar servidor de desenvolvimento
npm run dev

# Backend estará rodando em http://localhost:3333
```

**Variáveis de Ambiente Necessárias (backend/.env)**:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key
PORT=3333
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
CRON_PAYMENT_GENERATION="0 */6 * * *"
```

### 2. Frontend

```bash
# Na raiz do projeto
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com a URL do backend

# Rodar servidor de desenvolvimento
npm run dev

# Frontend estará rodando em http://localhost:3000
```

**Variáveis de Ambiente Necessárias (.env)**:
```env
VITE_API_URL=http://localhost:3333
```

## 🔌 Endpoints da API

### Motorcycles
- `GET /api/motorcycles` - Listar todas as motos
- `GET /api/motorcycles/:id` - Obter moto por ID
- `GET /api/motorcycles?status=Disponível` - Filtrar por status
- `POST /api/motorcycles` - Criar nova moto
- `PATCH /api/motorcycles/:id` - Atualizar moto
- `DELETE /api/motorcycles/:id` - Deletar moto

### Subscribers
- `GET /api/subscribers` - Listar todos os assinantes
- `GET /api/subscribers/active` - Listar apenas ativos
- `GET /api/subscribers/:id` - Obter assinante por ID
- `POST /api/subscribers` - Criar novo assinante
- `PATCH /api/subscribers/:id` - Atualizar assinante
- `DELETE /api/subscribers/:id` - Deletar assinante

### Rentals
- `GET /api/rentals` - Listar todos os aluguéis
- `GET /api/rentals/active` - Listar apenas ativos
- `GET /api/rentals/:id` - Obter aluguel por ID
- `GET /api/rentals/motorcycle/:motorcycleId` - Aluguéis de uma moto
- `GET /api/rentals/subscriber/:subscriberId` - Aluguéis de um assinante
- `POST /api/rentals` - Criar novo aluguel
- `PATCH /api/rentals/:id` - Atualizar aluguel
- `DELETE /api/rentals/:id` - Deletar aluguel

### Payments
- `GET /api/payments` - Listar todos os pagamentos
- `GET /api/payments/:id` - Obter pagamento por ID
- `GET /api/payments?status=Pendente` - Filtrar por status
- `PATCH /api/payments/:id/mark-paid` - Marcar como pago
- `PATCH /api/payments/:id/mark-unpaid` - Reverter pagamento
- `POST /api/payments/:id/send-reminder` - Enviar lembrete
- `GET /api/payments/validate` - Validar integridade

### Health Check
- `GET /api/health` - Verificar status do servidor

## 📝 Formato de Dados

### Backend (snake_case)
```json
{
  "id": "uuid",
  "motorcycle_id": "uuid",
  "subscriber_id": "uuid",
  "weekly_value": 100,
  "is_active": true
}
```

### Frontend (camelCase)
```json
{
  "id": "uuid",
  "motorcycleId": "uuid",
  "subscriberId": "uuid",
  "weeklyValue": 100,
  "isActive": true
}
```

**Transformação Automática**: O `AppContext.tsx` faz a conversão automática entre os formatos.

## 🎯 Principais Mudanças

### O que mudou?

1. **Remoção do LocalStorage**: Dados agora vêm do Supabase via API
2. **CRON movido para Backend**: Geração de pagamentos é feita no servidor
3. **Métodos Async**: Todas as operações CRUD agora são assíncronas
4. **Estado de Loading**: `loading` e `error` disponíveis no contexto
5. **Refresh Manual**: Método `refreshData()` para atualizar dados

### O que NÃO mudou?

- Interface dos métodos do contexto (compatibilidade com componentes existentes)
- Tipos do frontend (Motorcycle, Subscriber, Rental, Payment)
- Estrutura de pastas do frontend
- Lógica de negócio dos componentes

## 🔄 Fluxo de Dados

```
┌─────────────┐          ┌──────────────┐          ┌──────────────┐
│   React     │  Axios   │   Express    │ Supabase │  PostgreSQL  │
│ Components  │ ────────>│   Backend    │ ────────>│   Database   │
│ (Frontend)  │ <────────│   (API)      │ <────────│              │
└─────────────┘          └──────────────┘          └──────────────┘
      │                         │
      │                         │
      └─── AppContext ──────────┘
           (State Management)
```

## 🐛 Debugging

### Logs do Backend
```bash
cd backend
npm run dev

# Logs aparecem no terminal:
[SERVER] Backend rodando na porta 3333
[API] GET /api/motorcycles - 200
[CRON] Verificando cobranças recorrentes...
```

### Logs do Frontend
```javascript
// Abra o DevTools do navegador (F12)
// Verifique o Console:
[API] GET /api/motorcycles - 200
[API] Dados carregados com sucesso
```

### Verificar Conexão
1. Backend rodando? → `http://localhost:3333`
2. Frontend conectando? → Console do navegador
3. CORS configurado? → Verificar `backend/src/app.ts`

## 🔧 Troubleshooting

### Erro: "Network Error"
- **Causa**: Backend não está rodando
- **Solução**: Iniciar backend com `npm run dev` em `/backend`

### Erro: "CORS Policy"
- **Causa**: FRONTEND_URL no `.env` do backend não corresponde à URL do frontend
- **Solução**: Verificar `.env` e garantir que `FRONTEND_URL=http://localhost:3000`

### Erro: "Missing environment variables"
- **Causa**: Variáveis de ambiente não configuradas
- **Solução**: Copiar `.env.example` para `.env` e preencher valores

### Dados não aparecem
- **Causa**: Banco de dados vazio
- **Solução**: Popular banco via Supabase ou criar dados pela interface

## 📚 Próximos Passos

1. **Configurar Supabase**:
   - Criar projeto no https://supabase.com
   - Executar migrations/schema
   - Obter credenciais (URL + Service Key)

2. **Popular Dados Iniciais**:
   - Via Supabase Dashboard
   - Ou via interface do frontend (criar motos, assinantes, etc.)

3. **Testar CRON**:
   - Criar um aluguel
   - Aguardar execução do CRON (a cada 6 horas)
   - Ou forçar execução manual via código

4. **Deploy**:
   - Backend: Railway, Render, Fly.io
   - Frontend: Vercel, Netlify
   - Database: Supabase (cloud)

## 🎉 Pronto!

Sua aplicação agora está totalmente integrada com backend e banco de dados real. Aproveite! 🚀
