
import { DealOption } from '../types';

export interface BookingPayload {
    type: 'hotel' | 'flight' | 'attraction' | 'transport' | 'event' | 'stay';
    location: string; // City name or Airport code
    title?: string; // Specific Hotel Name or Airline
    startDate?: string; // YYYY-MM-DD
    endDate?: string; // YYYY-MM-DD
    travelers?: number;
    origin?: string; // For flights
    destination?: string; // For flights
}

export interface ProviderLinks {
    primaryUrl: string;
    fallbackUrl: string;
    displayName: string;
}

const formatDate = (date?: string): string => {
    if (!date) return '';
    return date; // Assuming ISO YYYY-MM-DD passed in
};

/**
 * Generates robust deep links for various providers.
 * Guarantees a valid URL (fallback) if the deep link parameters are ambiguous.
 */
export const buildProviderLinks = (providerRaw: string, payload: BookingPayload): ProviderLinks => {
    const safeProviderRaw = providerRaw || 'Generic';
    const provider = safeProviderRaw.toLowerCase().replace(/\s/g, '');
    const { location, title, startDate, endDate, travelers = 2 } = payload;
    
    // Default / Fallback Params
    const qCity = encodeURIComponent(location || '');
    const qTitle = encodeURIComponent(title || location || 'Trip');
    const checkIn = formatDate(startDate);
    
    // Default checkout: +1 day if missing
    let checkOut = endDate ? formatDate(endDate) : '';
    if (startDate && !checkOut) {
        // Simple fallback handled in UI logic, or let provider default
    }

    let primaryUrl = '';
    let fallbackUrl = '';
    let displayName = safeProviderRaw;

    // --- HOTEL PROVIDERS ---
    if (payload.type === 'hotel' || payload.type === 'stay') {
        
        switch (true) {
            case provider.includes('booking'):
                displayName = "Booking.com";
                // Booking.com Search Structure
                const bookingBase = `https://www.booking.com/searchresults.html?ss=${qTitle}`;
                const bookingFallback = `https://www.booking.com/searchresults.html?ss=${qCity}`;
                const bookingParams = `&checkin=${checkIn}&checkout=${checkOut}&group_adults=${travelers}&no_rooms=1`;
                
                primaryUrl = `${bookingBase}${bookingParams}`;
                fallbackUrl = `${bookingFallback}${bookingParams}`;
                break;

            case provider.includes('expedia'):
                displayName = "Expedia";
                // Expedia Search Structure
                const expBase = `https://www.expedia.com/Hotel-Search?destination=${qTitle}`;
                const expFallback = `https://www.expedia.com/Hotel-Search?destination=${qCity}`;
                const expParams = `&startDate=${checkIn}&endDate=${checkOut}&adults=${travelers}`;
                
                primaryUrl = `${expBase}${expParams}`;
                fallbackUrl = `${expFallback}${expParams}`;
                break;

            case provider.includes('hotels.com'):
                displayName = "Hotels.com";
                primaryUrl = `https://www.hotels.com/Hotel-Search?destination=${qTitle}&startDate=${checkIn}&endDate=${checkOut}&adults=${travelers}`;
                fallbackUrl = `https://www.hotels.com/Hotel-Search?destination=${qCity}&startDate=${checkIn}&endDate=${checkOut}&adults=${travelers}`;
                break;

            case provider.includes('agoda'):
                displayName = "Agoda";
                // Agoda text search
                primaryUrl = `https://www.agoda.com/search?text=${qTitle}&checkIn=${checkIn}&checkOut=${checkOut}&adults=${travelers}`;
                fallbackUrl = `https://www.agoda.com/search?text=${qCity}&checkIn=${checkIn}&checkOut=${checkOut}&adults=${travelers}`;
                break;

            case provider.includes('trip.com'):
                displayName = "Trip.com";
                primaryUrl = `https://www.trip.com/hotels/list?cityname=${qCity}&checkin=${checkIn}&checkout=${checkOut}&adult=${travelers}`; 
                fallbackUrl = primaryUrl; 
                break;

            case provider.includes('priceline'):
                displayName = "Priceline";
                primaryUrl = `https://www.priceline.com/relax/at/te/${qTitle}/from/${checkIn}/to/${checkOut}/rooms/1?adults=${travelers}`;
                fallbackUrl = `https://www.priceline.com/relax/in/${qCity}/from/${checkIn}/to/${checkOut}/rooms/1?adults=${travelers}`;
                break;

            case provider.includes('hostelworld'):
                displayName = "Hostelworld";
                primaryUrl = `https://www.hostelworld.com/s?q=${qTitle}&dateFrom=${checkIn}&dateTo=${checkOut}&number_of_guests=${travelers}`;
                fallbackUrl = `https://www.hostelworld.com/s?q=${qCity}&dateFrom=${checkIn}&dateTo=${checkOut}&number_of_guests=${travelers}`;
                break;
            
            case provider.includes('google'):
                displayName = "Google Hotels";
                primaryUrl = `https://www.google.com/travel/hotels?q=${qTitle}+${qCity}&checkin=${checkIn}&checkout=${checkOut}`;
                fallbackUrl = `https://www.google.com/travel/hotels?q=hotels+in+${qCity}&checkin=${checkIn}&checkout=${checkOut}`;
                break;

            case provider.includes('airbnb'):
                displayName = "Airbnb";
                primaryUrl = `https://www.airbnb.com/s/${qCity}/homes?checkin=${checkIn}&checkout=${checkOut}&adults=${travelers}`;
                fallbackUrl = primaryUrl;
                break;

            default:
                // Generic Google Search as absolute fallback
                displayName = safeProviderRaw;
                primaryUrl = `https://www.google.com/search?q=${safeProviderRaw}+${qTitle}+booking`;
                fallbackUrl = `https://www.google.com/search?q=hotels+in+${qCity}`;
                break;
        }
    } 
    
    // --- FLIGHT PROVIDERS ---
    else if (payload.type === 'flight' || payload.type === 'transport') {
        const origin = payload.origin || 'LAX'; // Default mock
        const dest = payload.destination || 'JFK'; 
        
        switch (true) {
            case provider.includes('skyscanner'):
                displayName = "Skyscanner";
                primaryUrl = `https://www.skyscanner.com/transport/flights/${origin}/${dest}/${checkIn.slice(2).replace(/-/g,'')}`;
                fallbackUrl = `https://www.skyscanner.com`;
                break;
            
            case provider.includes('kayak'):
                displayName = "Kayak";
                primaryUrl = `https://www.kayak.com/flights/${origin}-${dest}/${checkIn}`;
                fallbackUrl = `https://www.kayak.com/flights`;
                break;

            case provider.includes('google'):
                displayName = "Google Flights";
                primaryUrl = `https://www.google.com/flights?q=flights+from+${origin}+to+${dest}+on+${checkIn}`;
                fallbackUrl = primaryUrl;
                break;

            case provider.includes('expedia'):
                displayName = "Expedia Flights";
                primaryUrl = `https://www.expedia.com/Flights-Search?mode=search&trip=oneway&leg1=from:${origin},to:${dest},departure:${checkIn}TANYT`;
                fallbackUrl = primaryUrl;
                break;

            default:
                displayName = safeProviderRaw;
                primaryUrl = `https://www.google.com/search?q=flight+${title}+from+${origin}+to+${dest}`;
                fallbackUrl = `https://www.google.com/search?q=flights+to+${dest}`;
        }
    } 
    
    // --- EVENT / OTHER ---
    else {
        // Viator, GetYourGuide, Klook, etc.
        if (provider.includes('viator')) {
            displayName = "Viator";
            primaryUrl = `https://www.viator.com/searchResults/all?text=${qTitle}`;
            fallbackUrl = `https://www.viator.com/searchResults/all?text=${qCity}`;
        } else if (provider.includes('getyourguide')) {
            displayName = "GetYourGuide";
            primaryUrl = `https://www.getyourguide.com/s/?q=${qTitle}`;
            fallbackUrl = `https://www.getyourguide.com/s/?q=${qCity}`;
        } else {
            displayName = safeProviderRaw;
            primaryUrl = `https://www.google.com/search?q=${safeProviderRaw}+${qTitle}+tickets`;
            fallbackUrl = `https://www.google.com/search?q=things+to+do+in+${qCity}`;
        }
    }

    return { primaryUrl, fallbackUrl, displayName };
};

export const trackAndGetLink = (targetUrl: string, provider: string, segmentId: string): string => {
    return targetUrl;
};
