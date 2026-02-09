# 🧪 Teste de Criação de Aluguel

## Passo a Passo para Testar

### 1️⃣ Preparação

1. **Abrir DevTools** (F12) → **Console**
2. **Limpar console** (Ctrl+L ou botão 🚫)
3. **Ir na página "Assinantes"**

### 2️⃣ Criar Aluguel

1. **Clicar em "+ Novo Aluguel"**
2. **Preencher**:
   - Assinante: (escolher um)
   - Moto: (escolher uma disponível)
   - Valor Semanal: 250
   - Dia da Semana: Segunda-feira
3. **Clicar em "Criar Aluguel"**

### 3️⃣ Verificar Logs no Console

Você deve ver esta sequência:

```
👥 [SUBSCRIBERS PAGE] Renderizando com: { subscribers: X, motorcycles: Y, rentals: Z }

📝 [CREATE RENTAL] Enviando: {
  subscriber_id: "uuid-do-assinante",
  motorcycle_id: "uuid-da-moto",
  weekly_value: 250,
  due_day_of_week: 1,
  start_date: "2026-02-09",
  is_active: true
}

🚀 [API REQUEST] POST http://localhost:3001/api/rentals

➡️  POST /api/rentals (no terminal do backend)
⬅️  POST /api/rentals - 201 (no terminal do backend)

✅ [API RESPONSE] POST /rentals - 201
✅ [CREATE RENTAL] Recebido: { id: "...", motorcycle_id: "...", subscriber_id: "...", ... }
🔄 [CREATE RENTAL] Transformado: { id: "...", motorcycleId: "...", subscriberId: "...", ... }

✅ [RENTAL CREATED] Aluguel criado com sucesso

🔄 [REFRESH] Iniciando refresh de dados...
📊 [REFRESH] Dados recebidos: { motorcycles: Y, subscribers: X, rentals: Z+1, ... }
🔄 [REFRESH] Dados transformados: { motorcycles: Y, subscribers: X, rentals: Z+1, ... }
✅ [REFRESH] Dados carregados e atualizados com sucesso

👥 [SUBSCRIBERS PAGE] Renderizando com: { subscribers: X, rentals: Z+1 }

👤 [SUBSCRIBER Nome do Assinante] {
  subscriberId: "uuid",
  totalRentals: 1,
  activeRentals: 1,
  rentals: [{ id: "...", subscriberId: "uuid", motorcycleId: "...", ... }]
}
```

### 4️⃣ Verificar Visualmente

No card do assinante, deve aparecer:

```
┌─────────────────────────────┐
│  👤 Nome do Assinante       │
│  (11) 99999-9999            │
│                             │
│  MOTOS ALUGADAS             │
│  ┌─────────────────────┐   │
│  │ Honda CG | ABC-1234 │   │
│  └─────────────────────┘   │
└─────────────────────────────┘
```

## 🐛 Possíveis Problemas

### ❌ Problema 1: Logs mostram `rentals: 0` após criar

**Causa**: `refreshData()` não está sendo chamado ou falhou

**O que verificar**:
- Procure por `❌ [REFRESH]` nos logs
- Se houver erro, o problema está na API ou transformação

**Solução**:
```bash
# Verificar se backend respondeu corretamente
# No terminal do backend, procure por:
➡️  GET /api/rentals
⬅️  GET /api/rentals - 200 (Xms)

# Se não aparecer, o refresh não está fazendo GET
```

### ❌ Problema 2: Logs mostram `activeRentals: 0` mas `totalRentals: 1`

**Causa**: Campo `isActive` não está `true`

**O que verificar**:
```javascript
// No console, verificar os dados do rental:
rentals: [{ id: "...", isActive: false, ... }]  // ❌ ERRADO
rentals: [{ id: "...", isActive: true, ... }]   // ✅ CORRETO
```

**Solução**: O campo `is_active` do banco deve ser transformado para `isActive` no frontend

### ❌ Problema 3: `subscriberId` não corresponde

**Causa**: Transformação de `subscriber_id` para `subscriberId` falhou

**O que verificar**:
```javascript
// Procurar nos logs:
👤 [SUBSCRIBER Nome] {
  subscriberId: "uuid-1",
  rentals: [{ subscriberId: "uuid-2" }]  // ❌ IDs diferentes!
}
```

**Solução**: Verificar função `transformRental` no `AppContext.tsx`

### ❌ Problema 4: Aluguel criado mas não aparece

**Sintomas**:
- ✅ Logs mostram CREATE bem-sucedido
- ✅ Logs mostram REFRESH bem-sucedido
- ✅ `rentals: Z+1` (aumentou)
- ❌ Visualmente não aparece no card

**Causa**: Problema de renderização React

**Solução**: Forçar re-render
```javascript
// No console:
window.location.reload()
```

Se aparecer após reload, é problema de estado não atualizar.

## 📊 Verificar no Supabase

1. Acesse https://supabase.com → seu projeto
2. Vá em **Table Editor** → `rentals`
3. Procure pelo rental criado

Deve ter:
- `id`: UUID gerado
- `subscriber_id`: UUID do assinante
- `motorcycle_id`: UUID da moto
- `is_active`: `true`
- `weekly_value`: 250
- `start_date`: data de hoje
- `created_at`: timestamp

## 🎯 Se Tudo Funcionar

Você verá:
1. ✅ Logs de criação completos
2. ✅ Logs de refresh automático
3. ✅ Dados no Supabase
4. ✅ Aluguel aparece no card do assinante
5. ✅ Moto muda status para "Alugada"

## 🆘 Se Não Funcionar

**Me envie**:
1. Screenshot ou texto de TODOS os logs do console
2. Screenshot do card do assinante (mostrando que não apareceu)
3. Screenshot da tabela `rentals` no Supabase (mostrando que foi salvo)

Com essas 3 informações, vou identificar exatamente onde está o problema! 🚀
