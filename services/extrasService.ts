
import { ItineraryItem } from '../types';

export interface ExtrasContext {
  destinationCity: string;
  travelers: number;
  startDate: string;
  endDate: string;
  isCityEstimated: boolean;
}

/**
 * Robust helper to extract a valid city string from schedule or trip details.
 * Strictly avoids numbers, short strings, or generic trip names.
 */
export const getDestinationCity = (
    items: ItineraryItem[], 
    tripName: string
): string => {
    // 1. Gather all potential location strings from itinerary items
    const candidates: string[] = [];

    items.forEach(item => {
        if (item.location && typeof item.location === 'string') {
            // Split by comma to handle "Place, City" format
            const parts = item.location.split(',');
            // Take the last part as it's usually the city/region
            const lastPart = parts[parts.length - 1].trim();
            candidates.push(lastPart);
        }
    });

    // 2. Filter out numbers and short strings (CRITICAL FIX for "2" bug)
    const validCandidates = candidates.filter(c => 
        c.length > 2 &&           // Must be at least 3 chars (excludes "1", "2", "NY")
        isNaN(Number(c)) &&       // Must NOT be a valid number
        !/^\d+$/.test(c)          // Regex double check against digits
    );

    // 3. Frequency Analysis to find the "Main" city
    if (validCandidates.length > 0) {
        const counts: Record<string, number> = {};
        let maxCount = 0;
        let bestCity = validCandidates[0];

        validCandidates.forEach(city => {
            counts[city] = (counts[city] || 0) + 1;
            if (counts[city] > maxCount) {
                maxCount = counts[city];
                bestCity = city;
            }
        });
        return bestCity;
    }

    // 4. Fallback: Check tripName
    const genericTerms = ['trip', 'vacation', 'holiday', 'adventure', 'journey', 'travel', 'my', 'awesome', 'plan'];
    const lowerTrip = tripName.toLowerCase();
    const isGeneric = genericTerms.some(term => lowerTrip.includes(term));
    
    // Only use tripName if it doesn't look like a generic title and isn't a number
    if (!isGeneric && tripName.length > 2 && isNaN(Number(tripName))) {
        return tripName;
    }

    return "Unknown Destination";
};

/**
 * Single source of truth for Extras context.
 */
export const getTripContextForExtras = (
    segmentId: string, 
    items: ItineraryItem[], 
    tripName: string, 
    startDate?: string, 
    endDate?: string,
    overrides?: Partial<ExtrasContext> // Allow manual overrides from UI
): ExtrasContext => {
    
    // Use the robust helper
    const calculatedCity = getDestinationCity(items, tripName);
    
    // If we fell back to "Unknown" or just the Trip Name, mark as estimated so UI can prompt user
    const isEstimated = calculatedCity === "Unknown Destination" || calculatedCity === tripName;
    
    // Default Travelers to 1 if unknown
    const defaultTravelers = 1;

    return {
        destinationCity: overrides?.destinationCity || calculatedCity,
        travelers: overrides?.travelers || defaultTravelers,
        startDate: overrides?.startDate || startDate || new Date().toISOString().split('T')[0],
        endDate: overrides?.endDate || endDate || '',
        isCityEstimated: !overrides?.destinationCity && isEstimated
    };
};
