
import { SavedTicket, TicketStatus } from '../types';

/**
 * ==========================================
 * UX FLOW & STATE MACHINE DOCUMENTATION
 * ==========================================
 * 
 * 1. UX FLOW
 *    - User opens Memories & Tickets.
 *    - Clicks "Add Ticket".
 *    - Selects "Import" (File/Text) or "Manual".
 *    - If Import: 
 *      - Simulates OCR/Parsing delay.
 *      - Shows "Draft" with extracted fields.
 *      - User clicks "Submit for Review".
 *    - State becomes `under_review` (Orange Badge).
 *    - System simulates review (3-5s delay).
 *    - Outcome: `approved` (Green) or `rejected` (Red).
 *    - If Rejected: User opens item, sees Reason, Edits, Resubmits.
 * 
 * 2. STATE MACHINE
 *    [draft] --(submit)--> [under_review]
 *    [under_review] --(system_check)--> [approved] OR [rejected]
 *    [rejected] --(edit)--> [draft] --(submit)--> [under_review]
 */

// Mock delay helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Simulates parsing a file or text into a Ticket Object.
 */
export const simulateTicketImport = async (
    file: File | null, 
    text: string
): Promise<Partial<SavedTicket>> => {
    await delay(1500); // Fake processing time

    // Mock extraction logic based on simple keywords (Prototype only)
    const combinedInput = (text + (file?.name || '')).toLowerCase();
    
    let type: SavedTicket['type'] = 'attraction';
    if (combinedInput.includes('flight') || combinedInput.includes('airline')) type = 'flight';
    else if (combinedInput.includes('hotel') || combinedInput.includes('airbnb')) type = 'hotel';
    else if (combinedInput.includes('event') || combinedInput.includes('concert')) type = 'event';

    return {
        id: `ticket-${Date.now()}`,
        name: file ? `Imported: ${file.name}` : 'Parsed Ticket',
        type: type,
        price: Math.floor(Math.random() * 200) + 50,
        currency: 'USD',
        date: new Date().toISOString().split('T')[0],
        provider: 'Detected Provider',
        status: 'draft',
        details: {
            location: 'Unknown Location',
            referenceNumber: `REF-${Math.floor(Math.random() * 10000)}`
        },
        attachment: file ? {
            fileName: file.name,
            fileType: 'image',
            // In real app, create ObjectURL. Here we use a placeholder or the reader result handled in UI.
            previewUrl: undefined 
        } : undefined
    };
};

/**
 * Simulates the backend review process.
 * In a real app, this would be a server polling mechanism or websocket.
 */
export const submitForReview = async (
    ticket: SavedTicket, 
    forceOutcome?: 'approve' | 'reject'
): Promise<SavedTicket> => {
    // 1. Set to Under Review immediately
    const underReviewTicket: SavedTicket = {
        ...ticket,
        status: 'under_review',
        submittedAt: new Date().toISOString()
    };

    // Return strictly the state change so UI updates immediately
    return underReviewTicket;
};

/**
 * Called by the UI to finalize the mock review after a delay.
 */
export const finalizeMockReview = (ticket: SavedTicket, forceOutcome?: 'approve' | 'reject'): SavedTicket => {
    const passed = forceOutcome ? forceOutcome === 'approve' : Math.random() > 0.3; // 70% success rate by default

    if (passed) {
        return {
            ...ticket,
            status: 'approved',
            verificationNotes: 'Verified automatically via OCR match.'
        };
    } else {
        return {
            ...ticket,
            status: 'rejected',
            verificationNotes: 'Price mismatch with provider or blurrry image. Please double check details.'
        };
    }
};
