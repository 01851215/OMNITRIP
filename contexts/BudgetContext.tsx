
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { BudgetItem, BudgetAccounting, PaymentMethod, ItineraryItem } from '../types';

interface BudgetContextType {
  // Data
  getBudgetItems: (segmentId: string) => BudgetItem[];
  getAccounting: (segmentId: string, scheduleItems: ItineraryItem[]) => BudgetAccounting;
  paymentMethods: PaymentMethod[];
  
  // Actions
  addBudgetItem: (item: BudgetItem) => void;
  updateBudgetItem: (segmentId: string, itemId: string, updates: Partial<BudgetItem>) => void;
  deleteBudgetItem: (segmentId: string, itemId: string) => void;
  setTotalBudget: (segmentId: string, amount: number) => void;
  
  // Payment Config
  selectedMethodId: string | null;
  selectPaymentMethod: (id: string) => void;
  addPaymentMethod: (method: PaymentMethod) => void;
}

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

const STORAGE_KEY_BUDGET = 'omnitrip_budget_store';
const STORAGE_KEY_PAYMENT = 'omnitrip_payment_methods';

export const BudgetProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // State: items mapped by segmentId
  const [itemsBySegment, setItemsBySegment] = useState<Record<string, BudgetItem[]>>({});
  const [totalsBySegment, setTotalsBySegment] = useState<Record<string, number>>({});
  
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
      { id: 'pm_1', type: 'card', label: 'Visa •••• 4242', brand: 'visa', last4: '4242' },
      { id: 'pm_2', type: 'apple_pay', label: 'Apple Pay' }
  ]);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>('pm_1');

  // Load Persistence
  useEffect(() => {
    try {
      const budgetData = localStorage.getItem(STORAGE_KEY_BUDGET);
      const payData = localStorage.getItem(STORAGE_KEY_PAYMENT);
      if (budgetData) {
          const parsed = JSON.parse(budgetData);
          setItemsBySegment(parsed.items || {});
          setTotalsBySegment(parsed.totals || {});
      }
      if (payData) {
          const parsed = JSON.parse(payData);
          setPaymentMethods(parsed.methods || []);
          setSelectedMethodId(parsed.selected || null);
      }
    } catch (e) {
      console.error("Budget load failed", e);
    }
  }, []);

  // Save Persistence
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_BUDGET, JSON.stringify({ items: itemsBySegment, totals: totalsBySegment }));
  }, [itemsBySegment, totalsBySegment]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PAYMENT, JSON.stringify({ methods: paymentMethods, selected: selectedMethodId }));
  }, [paymentMethods, selectedMethodId]);

  // Actions
  const addBudgetItem = (item: BudgetItem) => {
    setItemsBySegment(prev => ({
        ...prev,
        [item.segmentId]: [...(prev[item.segmentId] || []), item]
    }));
  };

  const updateBudgetItem = (segmentId: string, itemId: string, updates: Partial<BudgetItem>) => {
    setItemsBySegment(prev => ({
        ...prev,
        [segmentId]: (prev[segmentId] || []).map(i => i.id === itemId ? { ...i, ...updates } : i)
    }));
  };

  const deleteBudgetItem = (segmentId: string, itemId: string) => {
    setItemsBySegment(prev => ({
        ...prev,
        [segmentId]: (prev[segmentId] || []).filter(i => i.id !== itemId)
    }));
  };

  const setTotalBudget = (segmentId: string, amount: number) => {
    setTotalsBySegment(prev => ({ ...prev, [segmentId]: amount }));
  };

  // Accounting Logic
  const getAccounting = useCallback((segmentId: string, scheduleItems: ItineraryItem[]): BudgetAccounting => {
      // 1. Sum confirmed schedule costs
      const scheduleConfirmedSpent = scheduleItems
        .filter(i => i.bookingStatus === 'booked')
        .reduce((sum, i) => sum + i.costEstimate, 0);

      // 2. Sum budget cart items (exclude failed)
      const cartItems = itemsBySegment[segmentId] || [];
      const budgetItemsSpent = cartItems
        .filter(i => i.status !== 'failed')
        .reduce((sum, i) => sum + i.amount, 0);

      const spentTotal = scheduleConfirmedSpent + budgetItemsSpent;
      const totalBudget = totalsBySegment[segmentId] || 2000; // Default budget

      return {
          totalBudget,
          scheduleConfirmedSpent,
          budgetItemsSpent,
          spentTotal,
          remaining: totalBudget - spentTotal,
          currency: 'USD' // Simplified for prototype
      };
  }, [itemsBySegment, totalsBySegment]);

  const selectPaymentMethod = (id: string) => setSelectedMethodId(id);
  
  const addPaymentMethod = (method: PaymentMethod) => {
      setPaymentMethods(prev => [...prev, method]);
      setSelectedMethodId(method.id);
  };

  return (
    <BudgetContext.Provider value={{
        getBudgetItems: (segId) => itemsBySegment[segId] || [],
        getAccounting,
        addBudgetItem,
        updateBudgetItem,
        deleteBudgetItem,
        setTotalBudget,
        paymentMethods,
        selectedMethodId,
        selectPaymentMethod,
        addPaymentMethod
    }}>
      {children}
    </BudgetContext.Provider>
  );
};

export const useBudget = () => {
  const context = useContext(BudgetContext);
  if (!context) throw new Error("useBudget must be used within BudgetProvider");
  return context;
};
