
import { BudgetItem, PaymentMethod, ItemConfirmationResult } from '../types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Simulates a Payment Gateway Authorization.
 * Success Rate: 90%
 */
export const mockProcessPayment = async (
    amount: number, 
    currency: string, 
    method: PaymentMethod
): Promise<{ success: boolean; error?: string; transactionId?: string }> => {
    
    await delay(2000); // Simulate network processing

    // Mock Failure scenarios
    if (amount > 5000) {
        return { success: false, error: "Bank Declined: Amount too high for prototype limits." };
    }
    
    const isSuccess = Math.random() > 0.1; // 10% fail rate

    if (isSuccess) {
        return { success: true, transactionId: `txn_${Date.now()}_${Math.floor(Math.random()*1000)}` };
    } else {
        return { success: false, error: "Gateway Timeout or Card Declined." };
    }
};

/**
 * Simulates calling a Supplier API to book a specific item.
 * e.g. Booking.com API, Skyscanner API (Mocked)
 */
export const mockConfirmItem = async (item: BudgetItem): Promise<ItemConfirmationResult> => {
    // Variable delay per item type to feel realistic
    const processingTime = item.type === 'flight' ? 4000 : item.type === 'insurance' ? 1000 : 2500;
    await delay(processingTime);

    // Mock logic
    const isSuccess = Math.random() > 0.15; // 85% success rate

    if (isSuccess) {
        return {
            itemId: item.id,
            status: 'confirmed',
            confirmationCode: `${item.providerName?.substring(0,3).toUpperCase() || 'OMNI'}-${Math.floor(Math.random()*100000)}`
        };
    } else {
        const reasons = ["Sold out", "Price changed", "Supplier timeout"];
        return {
            itemId: item.id,
            status: 'failed',
            reason: reasons[Math.floor(Math.random() * reasons.length)]
        };
    }
};
