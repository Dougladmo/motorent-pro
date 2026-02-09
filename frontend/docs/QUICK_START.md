# 🚀 Quick Start - MotoRent Pro

## 📋 Pré-requisitos
- ✅ Node.js 18+
- ✅ Conta no Supabase (gratuita)
- ✅ 2 terminais abertos

## ⚡ Setup Rápido (5 minutos)

### 1️⃣ Criar Banco de Dados no Supabase

1. Acesse https://supabase.com e crie um projeto
2. Aguarde 2 minutos para provisionar
3. Vá em **SQL Editor** e crie uma nova query
4. Copie e execute o conteúdo de:
   ```
   backend/supabase/migrations/20260209000000_initial_schema.sql
   ```
5. Crie outra query e execute:
   ```
   backend/supabase/migrations/20260209000001_rls_policies.sql
   ```

### 2️⃣ Configurar Backend

```bash
# Terminal 1
cd backend

# Copiar arquivo de exemplo
cp .env.example .env

# Editar .env e adicionar suas credenciais do Supabase
# (encontre em Project Settings → API no Supabase)
nano .env  # ou use seu editor favorito

# Instalar dependências
npm install

# Iniciar backend
npm run dev
```

✅ **Verificar**: Deve aparecer `[SERVER] Backend rodando na porta 3001`

### 3️⃣ Configurar Frontend

```bash
# Terminal 2 (na raiz do projeto)

# Criar arquivo .env (já existe, apenas verificar)
cat .env
# Deve conter: VITE_API_URL=http://localhost:3001

# Instalar dependências
npm install

# Iniciar frontend
npm run dev
```

✅ **Verificar**: Deve abrir http://localhost:3000 no navegador

### 4️⃣ Testar Conexão

1. Abra o DevTools do navegador (F12)
2. Vá na aba **Console**
3. Recarregue a página (Ctrl+R ou F5)
4. Você deve ver:
   ```
   🔧 [API CONFIG] { VITE_API_URL: "http://localhost:3001", ... }
   🚀 [API REQUEST] GET http://localhost:3001/api/motorcycles
   ✅ [API RESPONSE] GET /motorcycles - 200
   ```

5. No terminal do backend, você deve ver:
   ```
   ➡️  GET /api/motorcycles
   ⬅️  GET /api/motorcycles - 200 (45ms)
   ```

## 🐛 Troubleshooting

### ❌ Frontend mostra "Network Error"

**Problema**: Backend não está rodando

**Solução**:
```bash
cd backend
npm run dev
```

### ❌ Backend mostra erro de conexão com Supabase

**Problema**: Credenciais incorretas no `.env`

**Solução**:
1. Vá em https://supabase.com → seu projeto
2. Settings → API
3. Copie `Project URL` e `service_role key`
4. Cole no `backend/.env`
5. Reinicie o backend

### ❌ Erro "relation 'motorcycles' does not exist"

**Problema**: Migrations não foram executadas

**Solução**: Execute os arquivos SQL no Supabase (Passo 1)

### ❌ Não aparecem logs no backend quando uso o frontend

**Problema**: URL da API incorreta ou CORS

**Solução**:
1. Verifique se `VITE_API_URL` no `.env` do frontend está correto
2. Verifique se backend está em `http://localhost:3001`
3. Reinicie AMBOS frontend e backend
4. Abra DevTools (F12) e veja se há erros de CORS

## 📊 Verificar se está tudo funcionando

### Teste 1: Health Check

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

### Teste 2: Listar Motos

No navegador com DevTools aberto (F12), vá para:
```
http://localhost:3000
```

No Console, deve aparecer:
```
🚀 [API REQUEST] GET /api/motorcycles
✅ [API RESPONSE] GET /motorcycles - 200
```

No terminal do backend:
```
➡️  GET /api/motorcycles
⬅️  GET /api/motorcycles - 200 (45ms)
```

### Teste 3: Criar uma Moto

1. No frontend, vá em "Motos"
2. Clique em "+ Nova Moto"
3. Preencha os dados
4. Clique em "Adicionar"
5. Verifique os logs:

**Frontend Console**:
```
🚀 [API REQUEST] POST /api/motorcycles
✅ [API RESPONSE] POST /motorcycles - 201
```

**Backend Terminal**:
```
➡️  POST /api/motorcycles
⬅️  POST /api/motorcycles - 201 (120ms)
```

**Supabase Dashboard**:
- Vá em Table Editor → motorcycles
- Deve aparecer a moto criada

## 🎯 Próximos Passos

Se tudo funcionou:
- ✅ Backend rodando e logando requisições
- ✅ Frontend conectando e mostrando dados
- ✅ Dados sendo salvos no Supabase

Você está pronto para usar o sistema! 🎉

## 📚 Documentação Completa

- **Setup Detalhado**: Ver `INTEGRATION_GUIDE.md`
- **Configuração Supabase**: Ver `backend/docs/SUPABASE_SETUP.md`
- **Arquitetura Backend**: Ver `backend/README.md`
- **Arquitetura Frontend**: Ver `CLAUDE.md`

## 🆘 Precisa de Ajuda?

Se algo não funcionou:
1. Verifique se seguiu TODOS os passos acima
2. Leia o troubleshooting específico
3. Verifique os logs de erro no terminal e no DevTools
4. Consulte a documentação completa nos arquivos .md
