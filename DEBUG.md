# 🐛 Guia de Debug - Problema: Dados não aparecem

## 🔍 Como Debugar

### 1. Verificar se o backend está recebendo e salvando

1. **Criar uma moto no frontend**
2. **No terminal do backend**, você deve ver:
   ```
   ➡️  POST /api/motorcycles
   ⬅️  POST /api/motorcycles - 201 (120ms)
   ```

3. **Verificar no Supabase**:
   - Acesse https://supabase.com → seu projeto
   - Vá em **Table Editor** → `motorcycles`
   - A moto deve estar lá

✅ **Se está no Supabase**: Backend funcionando OK

### 2. Verificar se o frontend está recebendo os dados

1. **Abrir DevTools** (F12) → **Console**
2. **Recarregar a página** (Ctrl+R)
3. Você deve ver:
   ```
   🔄 [REFRESH] Iniciando refresh de dados...
   🚀 [API REQUEST] GET http://localhost:3001/api/motorcycles
   ✅ [API RESPONSE] GET /motorcycles - 200
   📊 [REFRESH] Dados recebidos: { motorcycles: 3, ... }
   🔄 [REFRESH] Dados transformados: { motorcycles: 3, ... }
   ✅ [REFRESH] Dados carregados e atualizados com sucesso
   ```

4. **Criar uma nova moto**
5. Você deve ver:
   ```
   🏍️ [CREATE MOTO] Enviando: { plate: "ABC-1234", ... }
   🚀 [API REQUEST] POST /api/motorcycles
   ✅ [API RESPONSE] POST /motorcycles - 201
   ✅ [CREATE MOTO] Recebido do backend: { id: "...", plate: "ABC-1234", ... }
   🔄 [CREATE MOTO] Transformado para frontend: { id: "...", plate: "ABC-1234", ... }
   🔄 [REFRESH] Iniciando refresh de dados...
   ✅ [REFRESH] Dados carregados e atualizados com sucesso
   ```

### 3. Verificar no React DevTools

1. **Instalar React DevTools** (extensão do navegador)
2. **Abrir DevTools** → Aba **"⚛️ Components"**
3. **Selecionar** `AppProvider`
4. **Ver no painel direito** → `hooks`:
   ```
   State: motorcycles: Array(3)
     0: {id: "...", plate: "ABC-1234", ...}
     1: {id: "...", plate: "DEF-5678", ...}
     2: {id: "...", plate: "GHI-9012", ...}
   ```

✅ **Se os dados estão no hook**: Context funcionando OK

### 4. Verificar se a página está renderizando

1. **Ir até a página de Motos**
2. **Abrir DevTools** → **Console**
3. Digite:
   ```javascript
   // Ver quantas motos estão no estado
   React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
   ```

4. **Alternativa**: Adicionar log na página

## 🔧 Possíveis Problemas e Soluções

### Problema 1: Dados no Supabase mas não chegam no frontend

**Sintomas**:
- ✅ Backend mostra `200` ou `201`
- ✅ Dados estão no Supabase
- ❌ Não aparecem logs de REFRESH no console
- ❌ Página fica em branco

**Causa**: Frontend não está fazendo GET

**Solução**:
1. Verificar se `VITE_API_URL` está correto no `.env`
2. Reiniciar frontend: `Ctrl+C` → `npm run dev`
3. Limpar cache do navegador: `Ctrl+Shift+Delete`

### Problema 2: Dados chegam mas transformação falha

**Sintomas**:
- ✅ Logs mostram dados recebidos
- ❌ Logs mostram `Dados transformados: { motorcycles: 0 }`
- ❌ Erro no console sobre campos `undefined`

**Causa**: Transformação snake_case → camelCase falhando

**Solução**: Verificar estrutura dos dados

No console, digite:
```javascript
// Ver estrutura real dos dados
fetch('http://localhost:3001/api/motorcycles')
  .then(r => r.json())
  .then(d => console.log('Estrutura:', d.data[0]))
```

Compare com o esperado:
```json
{
  "id": "uuid",
  "plate": "ABC-1234",
  "model": "Honda CG",
  "year": 2020,
  "status": "Disponível",
  "image_url": null,
  "total_revenue": 0,
  "created_at": "2026-02-09T...",
  "updated_at": "2026-02-09T..."
}
```

### Problema 3: Dados transformados mas página não renderiza

**Sintomas**:
- ✅ Logs mostram dados recebidos e transformados
- ✅ React DevTools mostra dados no state
- ❌ Página não mostra nada

**Causa**: Problema de renderização no componente

**Solução**: Adicionar log na página de Motos

Edite `src/pages/Motorcycles.tsx` e adicione no início da função:
```typescript
console.log('🏍️ [MOTORCYCLES PAGE] Renderizando com:', motorcycles);
```

### Problema 4: Dados aparecem após refresh manual

**Sintomas**:
- ❌ Criar moto → não aparece
- ✅ Recarregar página (F5) → aparece

**Causa**: Estado não está sendo atualizado após criação

**Solução**: Já corrigido! Agora faz refresh automático após criar.

Mas se ainda ocorrer, pode ser race condition. Aumentar o timeout:

```typescript
// Em AppContext.tsx, mudar de 500 para 1000
setTimeout(() => refreshData(), 1000);
```

## 📝 Checklist de Debug

- [ ] Backend rodando na porta 3001?
- [ ] Migrations executadas no Supabase?
- [ ] Tabelas existem no Supabase?
- [ ] `.env` do frontend com `VITE_API_URL=http://localhost:3001`?
- [ ] Frontend reiniciado após criar `.env`?
- [ ] Cache do navegador limpo?
- [ ] Console do navegador sem erros vermelhos?
- [ ] Logs de REFRESH aparecem no console?
- [ ] Dados aparecem no React DevTools?

## 🎯 Teste Completo

Execute este teste do início ao fim:

1. **Reiniciar tudo**:
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm run dev

   # Terminal 2 - Frontend
   cd ..
   npm run dev
   ```

2. **Abrir navegador** em http://localhost:3000

3. **Abrir DevTools** (F12) → Console

4. **Ir na página de Motos**

5. **Você deve ver logs**:
   ```
   🔄 [REFRESH] Iniciando refresh de dados...
   📊 [REFRESH] Dados recebidos: { motorcycles: X, ... }
   ```

6. **Clicar em "+ Nova Moto"**

7. **Preencher e Adicionar**

8. **Deve aparecer**:
   - Logs de CREATE
   - Logs de REFRESH automático
   - Moto aparece na lista

Se chegou aqui e ainda não funciona, **copie TODOS os logs** do console e do terminal e me envie! 🚀
