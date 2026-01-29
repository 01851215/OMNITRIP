import React, { useState } from 'react';
import { DollarSign, Check, ChevronDown } from 'lucide-react';

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
];

interface CurrencySelectorProps {
  currentCurrency: string;
  onCurrencyChange: (code: string, symbol: string) => void;
  isLoading?: boolean;
}

const CurrencySelector: React.FC<CurrencySelectorProps> = ({ currentCurrency, onCurrencyChange, isLoading }) => {
  const [isOpen, setIsOpen] = useState(false);

  const activeCurrency = CURRENCIES.find(c => c.code === currentCurrency) || CURRENCIES[0];

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={`flex items-center gap-2 bg-white px-3 py-2 rounded-2xl border-2 border-omni-dark shadow-cartoon-sm hover:translate-y-0.5 transition-all ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
      >
        <div className="w-6 h-6 bg-omni-green rounded-full border border-omni-dark flex items-center justify-center font-black text-xs">
            {activeCurrency.symbol}
        </div>
        <span className="font-black text-sm hidden sm:block">{activeCurrency.code}</span>
        <ChevronDown size={14} className="text-omni-dark" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 z-50 w-48 bg-white rounded-2xl border-4 border-omni-dark shadow-cartoon-lg overflow-hidden animate-in fade-in zoom-in-95 origin-top-right">
            <div className="bg-omni-green p-3 border-b-2 border-omni-dark">
                <p className="text-[10px] font-black uppercase text-center">Select Currency</p>
            </div>
            <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
                {CURRENCIES.map(curr => (
                    <button
                        key={curr.code}
                        onClick={() => {
                            onCurrencyChange(curr.code, curr.symbol);
                            setIsOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all ${currentCurrency === curr.code ? 'bg-omni-yellow' : 'hover:bg-gray-100'}`}
                    >
                        <div className="flex items-center gap-2">
                             <span className="w-5 text-center">{curr.symbol}</span>
                             <span>{curr.code}</span>
                        </div>
                        {currentCurrency === curr.code && <Check size={12} />}
                    </button>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};

export default CurrencySelector;
