
import { BudgetItem, DealOption, ItineraryItem } from '../types';

/**
 * Creates a unique deterministic key for a potential budget item.
 * Used to prevent duplicates when auto-adding or clicking "Add" multiple times.
 */
export const computeFingerprint = (
    type: string, 
    provider: string, 
    title: string, 
    amount: number,
    segmentId: string
): string => {
    // Sanitize
    const safeTitle = title.toLowerCase().trim();
    const safeProvider = provider.toLowerCase().trim();
    return `${segmentId}_${type}_${safeProvider}_${safeTitle}_${amount}`;
};

/**
 * Checks if an item already exists in the current list based on fingerprint.
 */
export const isDuplicateItem = (
    newItem: Partial<BudgetItem>, 
    existingItems: BudgetItem[]
): boolean => {
    if (!newItem.segmentId || !newItem.amount || !newItem.title) return false;
    
    const newFP = computeFingerprint(
        newItem.type || 'other', 
        newItem.providerName || '', 
        newItem.title, 
        newItem.amount, 
        newItem.segmentId
    );

    return existingItems.some(existing => {
        const existingFP = computeFingerprint(
            existing.type, 
            existing.providerName || '', 
            existing.title, 
            existing.amount, 
            existing.segmentId
        );
        return newFP === existingFP;
    });
};

/**
 * Builder: Converts a Search Result (DealOption) into a BudgetItem.
 */
export const buildBudgetItemFromDeal = (
    deal: DealOption, 
    sourceItem: ItineraryItem, 
    segmentId: string,
    isAutoAdd: boolean = false
): BudgetItem => {
    // Map item type
    let budgetType: BudgetItem['type'] = 'other';
    if (sourceItem.type === 'hotel') budgetType = 'stay';
    else if (sourceItem.type === 'flight' || sourceItem.type.includes('transport')) budgetType = 'flight';
    else if (sourceItem.type === 'attraction') budgetType = 'attraction';

    return {
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        segmentId,
        source: isAutoAdd ? 'plan_auto' : 'schedule',
        type: budgetType,
        title: deal.title,
        amount: deal.price,
        currency: deal.currency,
        status: 'planned',
        providerName: deal.provider,
        start_date: sourceItem.date,
        notes: isAutoAdd ? "Auto-selected cheapest option" : undefined,
        createdAt: new Date().toISOString()
    };
};
