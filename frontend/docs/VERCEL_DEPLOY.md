# Deploy na Vercel - MotoRent Pro

## Configuração Rápida

### 1. Variáveis de Ambiente Necessárias

Na dashboard da Vercel, configure as seguintes variáveis de ambiente:

**Production & Preview:**
```
VITE_API_URL=https://seu-backend-url.com
```

**Development:**
```
VITE_API_URL=http://localhost:3001
```

### 2. Configurações do Projeto

- **Framework Preset**: Other (Vite é detectado automaticamente)
- **Root Directory**: Deixe em branco (usa a raiz do projeto)
- **Build Command**: `cd frontend && npm install && npm run build`
- **Output Directory**: `frontend/dist`
- **Install Command**: `npm install --prefix frontend`

### 3. Build & Deploy

O arquivo `vercel.json` na raiz do projeto já está configurado corretamente.

Para fazer deploy:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

## Estrutura do Projeto

```
motorent-pro/
├── frontend/          # React + Vite (deploy na Vercel)
│   ├── src/
│   ├── dist/         # Build output
│   └── package.json
├── backend/          # Node.js + Express (deploy separado)
│   ├── src/
│   └── package.json
└── vercel.json       # Configuração da Vercel
```

## Notas Importantes

1. **Backend Separado**: O backend deve ser deployado em outro serviço (Railway, Render, etc.)
2. **CORS**: Configure o backend para aceitar requisições do domínio da Vercel
3. **Variáveis de Ambiente**: Atualize `VITE_API_URL` após deploy do backend
4. **Build Cache**: A Vercel cacheia builds automaticamente para deploys mais rápidos

## Troubleshooting

### Build falha com "Command not found"
- Verifique se `vercel.json` existe na raiz do projeto
- Confirme que `frontend/package.json` tem o script `build`

### "VITE_API_URL is undefined"
- Configure a variável na dashboard da Vercel: Settings > Environment Variables
- Faça redeploy após adicionar variáveis

### Página em branco após deploy
- Verifique os logs de build na Vercel
- Confirme que `outputDirectory` está apontando para `frontend/dist`
- Verifique o console do browser para erros de API

## Deploy Automático

Após conectar o repositório GitHub à Vercel:

- **Push para `main`**: Deploy automático em production
- **Pull Request**: Deploy de preview automático
- **Outras branches**: Configure nas settings para deploy automático

## Monitoramento

A Vercel fornece automaticamente:

- ✅ Analytics de performance
- ✅ Logs de build e runtime
- ✅ Preview deployments para PRs
- ✅ Rollback instantâneo
