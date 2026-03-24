import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Payment } from '../../../shared';
import { FormInput } from '../../../shared/ui/atoms/FormInput';

interface PaymentEditFormProps {
  payment: Payment;
  onSubmit: (updates: { amount: number; dueDate: string }) => Promise<void>;
  onCancel: () => void;
}

export const PaymentEditForm: React.FC<PaymentEditFormProps> = ({
  payment,
  onSubmit,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    amount: payment.amount,
    dueDate: payment.dueDate
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormInput
        id="subscriberName"
        label="Assinante"
        value={payment.subscriberName}
        onChange={() => {}}
        disabled
        className="bg-slate-50 text-slate-500 cursor-not-allowed"
      />

      <div className="grid grid-cols-2 gap-4">
        <FormInput
          id="amount"
          label="Valor (R$)"
          type="number"
          step={0.01}
          min={0}
          required
          value={formData.amount}
          onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
        />

        <FormInput
          id="dueDate"
          label="Vencimento"
          type="date"
          required
          value={formData.dueDate}
          onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
        />
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex gap-2 text-sm text-yellow-800">
        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
        <p>
          Editar valores e datas pode afetar relatórios. Use com cautela e apenas quando necessário.
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-red-700 text-white rounded-lg font-medium hover:bg-red-800"
        >
          Atualizar
        </button>
      </div>
    </form>
  );
};
