import React from 'react';
import { Calendar, CalendarRange, Search } from 'lucide-react';
import { PaymentStatus } from '../../shared';

type FilterType = PaymentStatus | 'ALL' | 'CURRENT_WEEK' | 'DATE_RANGE';

interface PaymentFiltersBarProps {
  filter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  dateRange: { start: string; end: string };
  onDateRangeChange: (range: { start: string; end: string }) => void;
  showDatePicker: boolean;
  onToggleDatePicker: () => void;
  onClearDateRange: () => void;
}

export const PaymentFiltersBar: React.FC<PaymentFiltersBarProps> = ({
  filter,
  onFilterChange,
  searchTerm,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  showDatePicker,
  onToggleDatePicker,
  onClearDateRange
}) => {
  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Buscar assinante..."
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {/* Filtro especial: Semana Atual */}
        <button
          onClick={() => {
            onFilterChange('CURRENT_WEEK');
            if (showDatePicker) onToggleDatePicker();
          }}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
            filter === 'CURRENT_WEEK'
              ? 'bg-green-600 text-white shadow-md'
              : 'bg-white text-slate-600 border border-green-200 hover:bg-green-50'
          }`}
        >
          <Calendar size={16} />
          Semana Atual
        </button>

        {/* Filtro de período personalizado */}
        <button
          onClick={() => {
            onFilterChange('DATE_RANGE');
            onToggleDatePicker();
          }}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
            filter === 'DATE_RANGE'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-white text-slate-600 border border-purple-200 hover:bg-purple-50'
          }`}
        >
          <CalendarRange size={16} />
          Período
        </button>

        {/* Filtros de status */}
        {([PaymentStatus.PENDING, PaymentStatus.OVERDUE, PaymentStatus.PAID, PaymentStatus.CANCELLED] as const).map((status) => (
          <button
            key={status}
            onClick={() => {
              onFilterChange(status);
              if (showDatePicker) onToggleDatePicker();
            }}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Date Range Picker */}
      {showDatePicker && filter === 'DATE_RANGE' && (
        <div className="bg-white border border-purple-200 rounded-lg p-4 flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">De:</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Até:</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <button
            onClick={onClearDateRange}
            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Limpar
          </button>
        </div>
      )}
    </div>
  );
};
