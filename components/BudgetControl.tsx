
import React, { useState, useEffect } from 'react';
import { BudgetItem, ItineraryItem, PaymentMethod } from '../types';
import { useBudget } from '../contexts/BudgetContext';
import { mockProcessPayment, mockConfirmItem } from '../services/paymentService';
import { downloadJSON, printVisaDraft } from '../services/exportService'; // Reusing existing export helpers logic
import { 
    X, CreditCard, ShoppingCart, Trash2, Edit2, CheckCircle, 
    AlertCircle, Loader2, DollarSign, Wallet, Receipt
} from 'lucide-react';

interface BudgetControlProps {
    segmentId: string;
    scheduleItems: ItineraryItem[]; // For read-only list
    isOpen: boolean;
    onClose: () => void;
    currencySymbol: string;
    convertPrice: (amount: number) => number;
}

const BudgetControl: React.FC<BudgetControlProps> = ({ 
    segmentId, scheduleItems, isOpen, onClose, currencySymbol, convertPrice 
}) => {
    const { 
        getBudgetItems, 
        deleteBudgetItem, 
        updateBudgetItem, 
        getAccounting, 
        paymentMethods, 
        selectedMethodId, 
        selectPaymentMethod,
        addPaymentMethod 
    } = useBudget();

    const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
    const [accounting, setAccounting] = useState<any>(null);
    const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
    const [paymentStep, setPaymentStep] = useState<'idle' | 'authorizing' | 'confirming' | 'complete'>('idle');
    const [confirmations, setConfirmations] = useState<Record<string, { status: string, reason?: string }>>({});
    
    // Receipt Data
    const [receiptData, setReceiptData] = useState<any>(null);

    useEffect(() => {
        if (isOpen) {
            setBudgetItems(getBudgetItems(segmentId));
            setAccounting(getAccounting(segmentId, scheduleItems));
        }
    }, [isOpen, segmentId, scheduleItems, getBudgetItems, getAccounting]);

    // Handle Payment Flow
    const handlePayAll = async () => {
        if (!selectedMethodId) return alert("Select a payment method!");
        
        const method = paymentMethods.find(p => p.id === selectedMethodId)!;
        const totalToPay = accounting?.budgetItemsSpent || 0;

        setPaymentStep('authorizing');
        setIsPaymentProcessing(true);

        // 1. Authorize
        const authResult = await mockProcessPayment(totalToPay, 'USD', method);
        
        if (!authResult.success) {
            setPaymentStep('idle');
            setIsPaymentProcessing(false);
            alert(`Payment Failed: ${authResult.error}`);
            return;
        }

        // 2. Confirm Items (Fulfillment)
        setPaymentStep('confirming');
        
        // Mark all items as 'paid' initially
        const itemsToConfirm = budgetItems.filter(i => i.status !== 'confirmed' && i.status !== 'failed');
        itemsToConfirm.forEach(item => updateBudgetItem(segmentId, item.id, { status: 'paid' }));

        // Process confirmations in parallel
        const results = await Promise.all(itemsToConfirm.map(async (item) => {
            const result = await mockConfirmItem(item);
            
            // Update Context
            updateBudgetItem(segmentId, item.id, { 
                status: result.status, 
                confirmationCode: result.confirmationCode, 
                failReason: result.reason 
            });
            
            return result;
        }));

        // Map results for UI
        const confMap: Record<string, any> = {};
        results.forEach(r => {
            confMap[r.itemId] = { status: r.status, reason: r.reason };
        });
        setConfirmations(confMap);

        // 3. Generate Receipt Data
        setReceiptData({
            orderId: authResult.transactionId,
            date: new Date().toISOString(),
            total: totalToPay,
            items: itemsToConfirm.map(i => ({...i, confirmation: confMap[i.id]}))
        });

        setPaymentStep('complete');
        setIsPaymentProcessing(false);
    };

    const handleExportReceipt = () => {
        if (receiptData) {
            // Adapt to the existing downloadJSON helper or generic
            const blob = new Blob([JSON.stringify(receiptData, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `receipt_${receiptData.orderId}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-omni-dark/40 backdrop-blur-sm flex justify-end">
            <div className="w-full max-w-md h-full bg-white shadow-cartoon-lg border-l-4 border-omni-dark flex flex-col animate-in slide-in-from-right duration-300">
                
                {/* Header */}
                <div className="bg-omni-pink p-6 border-b-4 border-omni-dark flex justify-between items-center">
                    <h2 className="text-2xl font-black flex items-center gap-2">
                        <Wallet className="text-omni-dark" /> BUDGET & CART
                    </h2>
                    <button onClick={onClose} className="w-10 h-10 bg-white rounded-full border-2 border-omni-dark flex items-center justify-center hover:bg-gray-100">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 custom-scrollbar space-y-6">
                    
                    {/* 1. Summary Card */}
                    <div className="bg-white p-4 rounded-3xl border-4 border-omni-dark shadow-cartoon-sm">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-xs font-black uppercase text-gray-400">Total Spent</span>
                            <span className="text-2xl font-black text-omni-dark">{currencySymbol}{convertPrice(accounting?.spentTotal || 0)}</span>
                        </div>
                        <div className="w-full h-4 bg-gray-200 rounded-full border-2 border-omni-dark overflow-hidden relative">
                            <div 
                                className="h-full bg-omni-green transition-all duration-500" 
                                style={{ width: `${Math.min(100, ((accounting?.spentTotal || 0) / (accounting?.totalBudget || 1)) * 100)}%` }} 
                            />
                        </div>
                        <div className="flex justify-between mt-2 text-[10px] font-bold text-gray-500">
                            <span>Remaining: {currencySymbol}{convertPrice(accounting?.remaining || 0)}</span>
                            <span>Limit: {currencySymbol}{convertPrice(accounting?.totalBudget || 0)}</span>
                        </div>
                    </div>

                    {/* 2. Schedule Confirmed (Read Only) */}
                    <div>
                        <h3 className="text-sm font-black uppercase text-gray-400 mb-3 flex items-center gap-2"><CheckCircle size={14}/> Schedule Confirmed</h3>
                        <div className="space-y-2">
                            {scheduleItems.filter(i => i.bookingStatus === 'booked').map(item => (
                                <div key={item.id} className="flex justify-between items-center p-3 bg-white border-2 border-gray-200 rounded-xl opacity-60">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs">📅</div>
                                        <span className="text-xs font-bold truncate max-w-[150px]">{item.activity}</span>
                                    </div>
                                    <span className="text-xs font-black">{currencySymbol}{convertPrice(item.costEstimate)}</span>
                                </div>
                            ))}
                            {scheduleItems.filter(i => i.bookingStatus === 'booked').length === 0 && (
                                <p className="text-center text-[10px] text-gray-400 italic">No confirmed schedule items yet.</p>
                            )}
                        </div>
                    </div>

                    {/* 3. Cart Items (Editable) */}
                    <div>
                        <h3 className="text-sm font-black uppercase text-gray-400 mb-3 flex items-center gap-2"><ShoppingCart size={14}/> Added to Budget</h3>
                        <div className="space-y-3">
                            {budgetItems.map(item => (
                                <div key={item.id} className="p-4 bg-white border-4 border-omni-dark rounded-2xl shadow-cartoon-sm relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                                            item.status === 'confirmed' ? 'bg-green-100 border-green-500 text-green-700' :
                                            item.status === 'failed' ? 'bg-red-100 border-red-500 text-red-700' :
                                            'bg-yellow-100 border-yellow-500 text-yellow-700'
                                        }`}>
                                            {item.status}
                                        </span>
                                        <button 
                                            onClick={() => deleteBudgetItem(segmentId, item.id)}
                                            className="text-gray-300 hover:text-red-500"
                                            disabled={isPaymentProcessing || item.status === 'confirmed'}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    
                                    <h4 className="font-black text-sm">{item.title}</h4>
                                    <p className="text-xs text-gray-500 font-bold mb-3">{item.providerName}</p>
                                    
                                    <div className="flex justify-between items-center border-t-2 border-dashed border-gray-100 pt-2">
                                        <span className="text-lg font-black">{currencySymbol}{convertPrice(item.amount)}</span>
                                        {/* Show Confirm Status / Reason */}
                                        {confirmations[item.id] && (
                                            <span className="text-[10px] font-bold">
                                                {confirmations[item.id].status === 'confirmed' ? '✅ Booked' : `❌ ${confirmations[item.id].reason}`}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {budgetItems.length === 0 && (
                                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-2xl">
                                    <p className="text-gray-400 font-bold text-xs">Cart is empty!</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Pay Actions */}
                <div className="p-6 bg-white border-t-4 border-omni-dark">
                    {paymentStep === 'complete' ? (
                        <div className="text-center space-y-3">
                            <div className="w-16 h-16 bg-omni-green rounded-full border-4 border-omni-dark flex items-center justify-center mx-auto mb-2 animate-bounce">
                                <CheckCircle size={32} className="text-omni-dark"/>
                            </div>
                            <h3 className="text-xl font-black">All Done!</h3>
                            <button 
                                onClick={handleExportReceipt}
                                className="w-full py-3 bg-gray-100 hover:bg-gray-200 border-2 border-omni-dark rounded-xl font-black text-xs flex items-center justify-center gap-2"
                            >
                                <Receipt size={16} /> Download Receipt
                            </button>
                            <button onClick={onClose} className="text-xs font-bold text-gray-400 hover:underline">Close</button>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <span className="font-black text-sm uppercase text-gray-400">Total Due</span>
                                <span className="text-2xl font-black text-omni-dark">{currencySymbol}{convertPrice(accounting?.budgetItemsSpent || 0)}</span>
                            </div>
                            
                            {/* Payment Method Selector */}
                            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                                {paymentMethods.map(pm => (
                                    <button
                                        key={pm.id}
                                        onClick={() => selectPaymentMethod(pm.id)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all whitespace-nowrap ${
                                            selectedMethodId === pm.id 
                                            ? 'bg-omni-blue border-omni-dark shadow-cartoon-sm' 
                                            : 'bg-gray-50 border-gray-200'
                                        }`}
                                    >
                                        <CreditCard size={16} />
                                        <span className="text-xs font-black">{pm.label}</span>
                                    </button>
                                ))}
                                <button className="px-3 py-2 rounded-xl border-2 border-gray-200 bg-gray-50 text-xs font-bold text-gray-400">+</button>
                            </div>

                            <button 
                                onClick={handlePayAll}
                                disabled={isPaymentProcessing || budgetItems.length === 0}
                                className="w-full py-4 bg-omni-green rounded-2xl border-4 border-omni-dark font-black text-lg shadow-cartoon hover:bg-emerald-300 active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isPaymentProcessing ? (
                                    <><Loader2 className="animate-spin" /> {paymentStep === 'authorizing' ? 'Authorizing...' : 'Confirming...'}</>
                                ) : (
                                    <>PAY NOW 🚀</>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// Reusable Add Button for Other Components
export const AddToBudgetButton: React.FC<{ 
    item: Partial<BudgetItem>, 
    segmentId: string,
    label?: string 
}> = ({ item, segmentId, label = "Add to Budget" }) => {
    const { addBudgetItem } = useBudget();
    const [added, setAdded] = useState(false);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        addBudgetItem({
            id: `item_${Date.now()}`,
            segmentId,
            source: item.source || 'manual',
            type: item.type || 'other',
            title: item.title || 'Unknown Item',
            amount: item.amount || 0,
            currency: item.currency || 'USD',
            status: 'planned',
            providerName: item.providerName || 'Generic',
            createdAt: new Date().toISOString()
        });
        setAdded(true);
        setTimeout(() => setAdded(false), 2000);
    };

    return (
        <button 
            onClick={handleClick}
            className={`px-3 py-2 rounded-xl border-2 font-black text-[10px] flex items-center gap-1 transition-all ${
                added 
                ? 'bg-green-100 border-green-500 text-green-700' 
                : 'bg-white border-omni-dark hover:bg-omni-yellow shadow-cartoon-sm'
            }`}
        >
            {added ? <CheckCircle size={12} /> : <DollarSign size={12} />}
            {added ? "Added!" : label}
        </button>
    );
};

export default BudgetControl;
