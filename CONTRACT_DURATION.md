# 📅 Sistema de Duração de Contratos

## 🎯 Como Funciona

### **1. Duração do Contrato**
- Ao criar um aluguel, você escolhe a duração: **6, 12, 18, 24 ou 36 meses**
- O sistema calcula automaticamente a **data de término** (data início + duração)
- Pagamentos semanais são gerados apenas **até a data de término**

### **2. Resumo Automático**
O formulário mostra um resumo com:
- ✅ Valor semanal
- ✅ Valor mensal aproximado (valor semanal × 4.33)
- ✅ Duração em meses
- ✅ **Total estimado do contrato** (valor mensal × duração)

### **3. Visualização nos Cards**
Cada aluguel mostra:
- 🏍️ Modelo e placa da moto
- 💰 Valor semanal
- ⏱️ Tempo restante do contrato

Exemplos:
- `12 meses restantes` - contrato longo
- `3 meses restantes` - finalizando em breve
- `15 dias restantes` - quase terminando
- `Contrato vencido` - já passou da data de término

## 📊 Exemplo Completo

### **Criando Contrato de 1 Ano**

**Formulário**:
- Assinante: João Silva
- Moto: Honda CG - ABC-1234
- Valor semanal: R$ 250,00
- Duração: **1 ano (12 meses)**

**Resumo gerado**:
```
📊 Resumo do Contrato
├─ Valor semanal: R$ 250,00
├─ Valor mensal (aprox.): R$ 1.082,50  (250 × 4.33)
├─ Duração: 12 meses
└─ Total estimado: R$ 12.990,00  (1.082,50 × 12)
```

**Datas calculadas**:
- Data início: 2026-02-09 (hoje)
- Data término: 2027-02-09 (hoje + 12 meses)

**Pagamentos gerados**:
- Pagamento 1: 2026-02-09 (hoje)
- Pagamento 2: 2026-02-16 (+ 7 dias)
- Pagamento 3: 2026-02-23 (+ 7 dias)
- ...
- Último pagamento: 2027-02-08 (antes da data término)

**Não gera**:
- ❌ 2027-02-15 (depois da data término)
- ❌ 2027-02-22 (depois da data término)

## 🔄 Backend - CRON de Pagamentos

O backend já tem lógica para **parar de gerar pagamentos** após a data de término:

```typescript
// No paymentCron do backend
while (checkDate <= rental.end_date) {  // ← Para na data de término
  // Gera pagamento
  checkDate.setDate(checkDate.getDate() + 7);
}
```

## 📝 O que Acontece Após o Término?

### **Opção 1: Encerramento Automático** (não implementado ainda)
- CRON verifica contratos vencidos
- Marca `is_active = false` automaticamente
- Libera a moto (status = 'Disponível')

### **Opção 2: Encerramento Manual** (atual)
- Você precisa **encerrar manualmente** o aluguel
- Na página de Assinantes ou Motos
- Sistema já mostra "Contrato vencido" como aviso

### **Opção 3: Renovação Automática** (futuro)
- Ao vencer, gera novo contrato automaticamente
- Cliente pode escolher renovar ou não

## 🎨 Interface Melhorada

### **Antes** (sem duração):
```
┌─────────────────────────┐
│ Honda CG | ABC-1234     │
└─────────────────────────┘
```

### **Agora** (com duração):
```
┌──────────────────────────────────┐
│ Honda CG | ABC-1234              │
│ R$ 250,00/semana • 11 meses rest.│
└──────────────────────────────────┘
```

## ⚠️ Avisos Importantes

### **Contratos perto do vencimento**
Se faltarem menos de 30 dias, o card muda:
- Texto em amarelo: `⚠️ 15 dias restantes`
- Facilita identificar contratos terminando

### **Contratos vencidos**
Se já passou da data de término:
- Texto em vermelho: `❌ Contrato vencido`
- Ainda aparece como "ativo" até você encerrar manualmente

## 🚀 Como Testar

### **1. Criar Contrato Curto**
```
Duração: 6 meses
Valor: R$ 100,00/semana
```

Resumo:
- Mensal: R$ 433,00
- Total: R$ 2.598,00

### **2. Criar Contrato Longo**
```
Duração: 3 anos (36 meses)
Valor: R$ 300,00/semana
```

Resumo:
- Mensal: R$ 1.299,00
- Total: R$ 46.764,00

### **3. Verificar no Card**
- Deve mostrar: `36 meses restantes`
- Conforme o tempo passa: `35 meses restantes`, `34 meses restantes`, etc.

## 📊 Cálculos

### **Valor Mensal Aproximado**
```
Valor semanal × 4.33 = Valor mensal
```

**Por que 4.33?**
- 1 mês = ~30 dias
- 30 dias ÷ 7 dias = 4.28 semanas
- Arredondado para 4.33 (padrão de mercado)

### **Total Estimado**
```
Valor mensal × Duração em meses = Total
```

Exemplo:
```
R$ 250/semana × 4.33 = R$ 1.082,50/mês
R$ 1.082,50 × 12 meses = R$ 12.990,00 total
```

## 🎯 Melhorias Futuras

1. **Dashboard de Contratos Vencendo**
   - Lista de contratos com < 30 dias
   - Permite renovação rápida

2. **Notificação de Vencimento**
   - WhatsApp automático 30 dias antes
   - "Seu contrato vence em 1 mês. Deseja renovar?"

3. **Relatório de Contratos**
   - Quantos contratos por duração
   - Média de renovação
   - Receita projetada

4. **Encerramento Automático**
   - CRON diário verifica contratos vencidos
   - Encerra automaticamente após data término
   - Envia notificação de encerramento
