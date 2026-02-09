# MotoRent Pro

Sistema de gerenciamento de aluguel de motocicletas com React, TypeScript e Node.js.

## 🚀 Tecnologias

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: Supabase (PostgreSQL)
- **Deploy**: Vercel (Frontend) + Render/Railway (Backend)

## 📦 Instalação

```bash
# Instalar dependências
npm install

# Copiar variáveis de ambiente
cp .env.example .env.local
```

## 🏃 Executar Localmente

**Desenvolvimento (ambos os servidores):**
```bash
npm run dev
```

**Frontend apenas (porta 3000):**
```bash
npm run dev:frontend
```

**Backend apenas (porta 3001):**
```bash
npm run dev:backend
```

## 🏗️ Build

```bash
# Build completo (frontend + backend)
npm run build

# Build apenas frontend
npm run build:frontend

# Build apenas backend
npm run build:backend
```

## 📚 Documentação

- **[CLAUDE.md](CLAUDE.md)** - Arquitetura e guia técnico do projeto
- **[VERCEL_DEPLOY.md](VERCEL_DEPLOY.md)** - Guia completo de deploy na Vercel
- **[backend/SUPABASE_STORAGE_SETUP.md](backend/SUPABASE_STORAGE_SETUP.md)** - Configuração do Supabase Storage

## 🌐 Deploy na Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Importante:** Configure a variável `VITE_API_URL` na dashboard da Vercel apontando para sua API backend.

Veja o guia completo em [VERCEL_DEPLOY.md](VERCEL_DEPLOY.md).
