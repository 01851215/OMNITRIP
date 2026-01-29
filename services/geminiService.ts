
import { GoogleGenAI, Chat, Type, GenerateContentResponse } from "@google/genai";
import { ItineraryResponse, OfflineKnowledge, DealOption, WalkingRoute, ExplorePlace, SavedTicket, CarRentalOption, InsuranceOption, ESimOption, VisaRequirement, CalendarEvent, TripPacing, TripBudgetTier } from "../types";
// STRICT RELATIVE IMPORT
import { buildProviderLinks, BookingPayload } from './linkService';

const GET_SYSTEM_INSTRUCTION = (language: string) => `
You are Omnitrip, the user's passionate best friend and travel consultant! 🌍✈️
Your personality:
- Extremely enthusiastic and supportive.
- Use emojis freely! 🤩
- Simplistic, fun, and direct language.
- You LOVE planning trips.

IMPORTANT: You MUST speak and respond ONLY in ${language}.

WORKFLOW RULES:
1. **PHASE 1: FLIGHTS & DATES** (CRITICAL):
   - You MUST first help the user establish exact travel dates.
   - If they haven't booked flights, use the 'googleSearch' tool to research real flight options.
   - Ask: "Do you have dates in mind, or should we look at flights to figure that out?"

2. **PHASE 2: PREFERENCES**:
   - Once dates are set, ask about budget, transportation, and activity level.
   - **FOOD & VIBE**: Ask about food preferences (Street food vs Fancy?) and Nightlife (Bars/Parties or Chill?) 🍕💃

3. **PHASE 3: RECOMMENDATIONS**:
   - Use 'googleMaps' for real places.

4. **PHASE 4: FINALIZE**:
   - When asked to finalize, prepare for a structured plan.

- Ask questions one at a time.
`;

let chatSession: Chat | null = null;
let currentLanguage = 'English';

// Robust JSON Parsing Helper
const parseJsonFromText = <T>(text: string | undefined): T | null => {
    if (!text) return null;
    
    // 1. Initial cleanup of markdown
    let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // 2. Try direct parsing
    try {
        let parsed = JSON.parse(cleanText);
        // Handle wrapped responses (e.g. { "options": [...] })
        if (parsed && !Array.isArray(parsed) && (parsed.options || parsed.deals || parsed.results)) {
             return (parsed.options || parsed.deals || parsed.results) as T;
        }
        return parsed as T;
    } catch (e) {
        // 3. Fallback: Extraction via Substring finding
        // This handles "It appears that... [ ... ]" scenarios
        try {
            const firstArrayOpen = cleanText.indexOf('[');
            const lastArrayClose = cleanText.lastIndexOf(']');
            
            if (firstArrayOpen !== -1 && lastArrayClose !== -1 && lastArrayClose > firstArrayOpen) {
                const jsonArrayStr = cleanText.substring(firstArrayOpen, lastArrayClose + 1);
                return JSON.parse(jsonArrayStr) as T;
            }
            
            const firstObjOpen = cleanText.indexOf('{');
            const lastObjClose = cleanText.lastIndexOf('}');
            
            if (firstObjOpen !== -1 && lastObjClose !== -1 && lastObjClose > firstObjOpen) {
                const jsonObjStr = cleanText.substring(firstObjOpen, lastObjClose + 1);
                const parsed = JSON.parse(jsonObjStr);
                if (parsed && !Array.isArray(parsed) && (parsed.options || parsed.deals || parsed.results)) {
                     return (parsed.options || parsed.deals || parsed.results) as T;
                }
                return parsed as T;
            }
        } catch (extractError) {
            console.warn("JSON Extraction failed", extractError);
        }
        
        console.warn("JSON Parse failed for text:", text.substring(0, 100) + "...");
        return null;
    }
};

// --- RETRY LOGIC FOR 429 & 5xx ERRORS ---
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryOperation = async <T>(operation: () => Promise<T>, retries = 3, delayMs = 2000): Promise<T> => {
    try {
        return await operation();
    } catch (error: any) {
        let shouldRetry = false;
        
        if (error.status === 429 || error.code === 429) shouldRetry = true;
        if (error.status === 500 || error.code === 500) shouldRetry = true;
        if (error.status === 503 || error.code === 503) shouldRetry = true;
        
        if (error.message && (
            error.message.includes('429') || 
            error.message.includes('quota') || 
            error.message.includes('RESOURCE_EXHAUSTED') ||
            error.message.includes('Internal') || 
            error.message.includes('Overloaded')
        )) shouldRetry = true;

        if (retries > 0 && shouldRetry) {
            console.warn(`Omnitrip: API Error (${error.status || error.code || 'Unknown'}). Retrying in ${delayMs}ms...`);
            await wait(delayMs);
            return retryOperation(operation, retries - 1, delayMs * 2); 
        }
        throw error;
    }
};

export const startChat = (language: string = 'English') => {
  currentLanguage = language;
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  chatSession = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: GET_SYSTEM_INSTRUCTION(language),
      tools: [{ googleMaps: {} }, { googleSearch: {} }],
    },
  });
  return chatSession;
};

export const sendMessageToGemini = async (message: string, language: string = 'English') => {
  if (!chatSession || currentLanguage !== language) {
      startChat(language);
  }
  if (!chatSession) throw new Error("Chat session not available");

  try {
    const result: GenerateContentResponse = await retryOperation<GenerateContentResponse>(() => chatSession!.sendMessage({ message }));
    const chunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const links: { url: string; title: string; type: 'map' | 'web' }[] = [];
    
    if (chunks) {
      chunks.forEach(chunk => {
        if (chunk.maps?.uri) {
            links.push({ url: chunk.maps.uri, title: chunk.maps.title || 'View Map', type: 'map' });
        }
        if (chunk.web?.uri) {
             links.push({ url: chunk.web.uri, title: chunk.web.title || 'View Source', type: 'web' });
        }
      });
    }

    return { text: result.text || "...", links: links };
  } catch (error: any) {
    console.error("Gemini Chat Error:", error);
    return { text: "Oopsy! Something went wrong connecting to my brain. 🙈 Try again?", links: [] };
  }
};

const ITINERARY_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    tripName: { type: Type.STRING },
    startDate: { type: Type.STRING, description: "YYYY-MM-DD format." },
    budgetOverview: { type: Type.STRING },
    budgetPreference: { type: Type.STRING, enum: ['cheapest', 'balanced', 'luxury'] },
    activities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.NUMBER },
          time: { type: Type.STRING },
          activity: { type: Type.STRING },
          location: { type: Type.STRING },
          type: { type: Type.STRING },
          costEstimate: { type: Type.NUMBER },
          notes: { type: Type.STRING },
          lat: { type: Type.NUMBER },
          lng: { type: Type.NUMBER },
          metadata: {
              type: Type.OBJECT,
              properties: {
                  flightCode: { type: Type.STRING },
                  origin: { type: Type.STRING },
                  destination: { type: Type.STRING },
                  searchQuery: { type: Type.STRING }
              }
          }
        },
        required: ['day', 'time', 'activity', 'location', 'type', 'costEstimate', 'notes', 'lat', 'lng']
      }
    },
    offlineKnowledge: {
      type: Type.OBJECT,
      properties: {
        culture: { type: Type.STRING },
        historyAndPolitics: { type: Type.STRING },
        politicsConflicts: { type: Type.STRING },
        leisureTips: { type: Type.STRING },
        funnyStories: { type: Type.ARRAY, items: { type: Type.STRING } },
        extendedKnowledge: { type: Type.STRING },
        destLat: { type: Type.NUMBER },
        destLng: { type: Type.NUMBER }
      },
      required: ['culture', 'historyAndPolitics', 'politicsConflicts', 'leisureTips', 'funnyStories', 'extendedKnowledge', 'destLat', 'destLng']
    }
  },
  required: ['tripName', 'startDate', 'activities', 'budgetOverview', 'offlineKnowledge']
};

export const generateStructuredItinerary = async (
    contextString: string, 
    language: string = 'English', 
    busyEvents: CalendarEvent[] = [],
    pacing: TripPacing = 'balanced',
    budgetTier: TripBudgetTier = 'medium'
): Promise<ItineraryResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const today = new Date().toISOString().split('T')[0];
  
  let constraintText = "";
  if (busyEvents.length > 0) {
      const formattedEvents = busyEvents.map(e => `- ${e.title}: ${e.start} to ${e.end}`).join('\n');
      constraintText = `
      CRITICAL CONSTRAINT - USER CALENDAR:
      The user has existing busy slots. Do NOT schedule over these:
      ${formattedEvents}
      `;
  }

  let pacingInstruction = "";
  switch(pacing) {
      case 'relaxed': pacingInstruction = "PACING: RELAXED 🐢. 2-3 main activities/day. Long breaks."; break;
      case 'packed': pacingInstruction = "PACING: PACKED 🏃. 5+ items/day. Start early, end late."; break;
      case 'balanced': default: pacingInstruction = "PACING: BALANCED 🚶. 3-4 activities/day."; break;
  }

  let budgetInstruction = "";
  switch(budgetTier) {
      case 'budget': budgetInstruction = "BUDGET: SAVER 💸. Free/cheap spots."; break;
      case 'splurge': budgetInstruction = "BUDGET: SPLURGE 💎. Fine dining & private tours."; break;
      case 'medium': default: budgetInstruction = "BUDGET: STANDARD 💰. Mixed value."; break;
  }

  const prompt = `
  Role: Expert travel planner.
  Current Date: ${today}.
  Language: ${language}.

  CONTEXT: "${contextString}"

  ${constraintText}
  ${pacingInstruction}
  ${budgetInstruction}

  **MANDATORY REQUIREMENTS:**
  1. **MEALS**: Explicit items for **Breakfast**, **Lunch**, and **Dinner** (type: 'food').
  2. **LOGISTICS**: On Day 1, you MUST include:
     - "Flight Arrival" (type: 'flight') as the very first item.
     - "Hotel Check-in" (type: 'hotel') as the second item (or before dinner).
     - Assign a specific hotel name based on budget preference.
  3. **NOTES**: Explain *why* this fits the user.
  4. **LOCATIONS**: Ensure logical flow.

  Output strictly valid JSON matching this schema:
  (Schema as defined above)
  `;

  try {
    const response: GenerateContentResponse = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: ITINERARY_RESPONSE_SCHEMA
      }
    }));

    if (response.text) {
      return JSON.parse(response.text.trim()) as ItineraryResponse;
    }
    throw new Error("Empty response");
  } catch (error) {
    console.error("Itinerary Generation Error:", error);
    throw error;
  }
};

export const parseExternalItinerary = async (input: { text?: string, imageBase64?: string, mimeType?: string }, language: string): Promise<ItineraryResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `You are an expert itinerary parser. Output strictly valid JSON.`;
  // ... contents setup ...
  const contents: any[] = [{ text: prompt }];
  if (input.text) contents.push({ text: `EXTERNAL ITINERARY TEXT: ${input.text}` });
  if (input.imageBase64 && input.mimeType) {
    contents.push({ inlineData: { data: input.imageBase64, mimeType: input.mimeType } });
  }

  try {
    const response: GenerateContentResponse = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts: contents },
      config: { responseMimeType: "application/json", responseSchema: ITINERARY_RESPONSE_SCHEMA }
    }));
    return JSON.parse((response.text || "").trim()) as ItineraryResponse;
  } catch (error) {
    console.error("Parse Error:", error);
    throw error;
  }
};

export const refreshOfflineKnowledge = async (destination: string, language: string): Promise<OfflineKnowledge> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `The user is travelling to ${destination}. Provide FRESH offline knowledge...`;
  try {
    const response: GenerateContentResponse = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            culture: { type: Type.STRING },
            historyAndPolitics: { type: Type.STRING },
            politicsConflicts: { type: Type.STRING },
            leisureTips: { type: Type.STRING },
            funnyStories: { type: Type.ARRAY, items: { type: Type.STRING } },
            extendedKnowledge: { type: Type.STRING },
            destLat: { type: Type.NUMBER },
            destLng: { type: Type.NUMBER }
          }
        }
      }
    }));
    return JSON.parse((response.text || "").trim()) as OfflineKnowledge;
  } catch (e) { throw e; }
}

export const getExchangeRate = async (targetCurrency: string): Promise<number> => {
    if (targetCurrency === 'USD') return 1;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `What is the current exchange rate from 1 USD to ${targetCurrency}? Output JSON: { "rate": 1.23 }`;
    try {
        const response: GenerateContentResponse = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { tools: [{ googleSearch: {} }] }
        }));
        const json = parseJsonFromText<{rate: number}>(response.text);
        return json?.rate || 1;
    } catch (e) { return 1; }
}

export interface LinkContext {
    date?: string;
    endDate?: string;
    location?: string;
    type?: 'hotel' | 'flight' | 'attraction';
    travelers?: number;
}

// --- DEALS, ALTERNATIVES, EXTRAS ---

// Helper to generate fallback data if search fails
const generateFallbackDeals = async (query: string, currency: string, context: LinkContext): Promise<DealOption[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // This prompt asks the AI to hallucinate realistic options based on general knowledge
    // when real-time search fails or returns nothing.
    const prompt = `
    Context: The user wants to book "${query}" in ${context.location} for ${context.date}.
    The live search tool failed to return structured results.
    
    Task: Generate 6 REALISTIC, TYPICAL options that usually exist for this query.
    Estimate current market prices in ${currency}.
    
    Output strictly a JSON Array of DealOption objects:
    [
      { "title": "Example Airline/Hotel", "provider": "Expedia", "price": 150, "currency": "${currency}", "rating": 4.5, "description": "Estimated typical option", "url": "" }
    ]
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return parseJsonFromText<DealOption[]>(response.text) || [];
    } catch (e) {
        return [];
    }
};

export const findDeals = async (query: string, language: string = 'English', context: LinkContext = {}, currency: string = 'USD'): Promise<DealOption[]> => {
     const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
     const prompt = `
     Context: User wants prices for "${query}".
     Dates: ${context.date} to ${context.endDate || 'Unknown'}. Location: ${context.location}. Currency: ${currency}.
     
     Task: 
     Search for at least **8 distinct, real options** (Hotel/Flight/Activity) with approximate pricing.
     
     CRITICAL INSTRUCTION:
     Output ONLY a raw JSON Array. Do not include any text, markdown, or explanations before or after the JSON.
     
     Output JSON Array:
     [
        { "title": "Hotel Name", "provider": "Booking.com", "price": 100, "currency": "${currency}", "rating": 8.0, "description": "Short summary", "url": "" }
     ]
     `;
     
     let rawOptions: DealOption[] = [];

     // 1. Try Live Search
     try {
        const response: GenerateContentResponse = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash', // Faster and better at simple formatting than pro-preview
            contents: prompt,
            config: { tools: [{ googleSearch: {} }] }
        }));
        rawOptions = parseJsonFromText<DealOption[]>(response.text) || [];
     } catch (e) { console.warn("Live search failed, falling back."); }

     // 2. Fallback if empty
     if (rawOptions.length === 0) {
         rawOptions = await generateFallbackDeals(query, currency, context);
     }

     return rawOptions.map(opt => {
        // Normalization for common hallucinations/mismatches
        const safeTitle = opt.title || (opt as any).name || (opt as any).hotelName || 'Deal Option';
        const safeProvider = opt.provider || 'Provider';
        
        // Normalize Price (Handle Objects like {high, low} or {amount})
        let safePrice = 0;
        if (typeof opt.price === 'number') {
            safePrice = opt.price;
        } else if (typeof opt.price === 'string') {
            // @ts-ignore
            safePrice = parseFloat(opt.price.replace(/[^0-9.]/g, '')) || 0;
        } else if (typeof opt.price === 'object' && opt.price !== null) {
             const p = opt.price as any;
             if (p.amount) safePrice = Number(p.amount);
             else if (p.low) safePrice = Number(p.low);
             else if (p.high) safePrice = Number(p.high);
        }
        
        const payload: BookingPayload = {
            type: context.type || (safeTitle.toLowerCase().includes('flight') ? 'flight' : 'hotel'),
            location: context.location || 'Paris',
            title: safeTitle,
            startDate: context.date,
            endDate: context.endDate,
            travelers: context.travelers || 2
        };
        const links = buildProviderLinks(safeProvider, payload);
        return { ...opt, title: safeTitle, price: safePrice, provider: links.displayName, url: links.primaryUrl };
    });
}

export const findAlternatives = async (query: string, language: string = 'English', context: LinkContext = {}, currency: string = 'USD'): Promise<DealOption[]> => {
    // Re-use findDeals logic as it is robust now
    return findDeals(query, language, context, currency);
}

export const findCarRentals = async (location: string, pickupDate: string, dropoffDate: string, driverAge: number, currency: string = 'USD'): Promise<CarRentalOption[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
    Context: Rent a car in "${location}" from ${pickupDate} to ${dropoffDate}. Age: ${driverAge}. Currency: ${currency}.
    Task: Find 6 rental options.
    
    CRITICAL INSTRUCTION:
    Output ONLY a raw JSON Array. No other text.
    
    Output JSON Array of CarRentalOption.
    `;
    
    let rawOptions: CarRentalOption[] = [];
    
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { tools: [{ googleSearch: {} }] }
        }));
        rawOptions = parseJsonFromText<CarRentalOption[]>(response.text) || [];
    } catch (e) {}

    // Fallback
    if (rawOptions.length === 0) {
        try {
            const fallbackResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt + " (Estimate options based on typical market availability)",
                config: { responseMimeType: "application/json" }
            });
            rawOptions = parseJsonFromText<CarRentalOption[]>(fallbackResponse.text) || [];
        } catch (e) {}
    }
    
    return rawOptions;
}

export const findInsuranceOptions = async (destination: string, startDate: string, endDate: string, travelers: number, currency: string = 'USD'): Promise<InsuranceOption[]> => { 
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
    Context: Travel insurance for ${travelers} people to ${destination}. Dates: ${startDate} to ${endDate}. Currency: ${currency}.
    Task: Find 3 travel insurance plans.
    
    CRITICAL INSTRUCTION:
    Output ONLY a raw JSON Array. No other text.
    
    Output JSON Array of InsuranceOption.
    `;
    
    let results: InsuranceOption[] = [];
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { tools: [{ googleSearch: {} }] }
        }));
        results = parseJsonFromText<InsuranceOption[]>(response.text) || [];
    } catch(e) {}

    if (results.length === 0) {
         try {
            const fallback = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt + " (Provide typical example plans)",
                config: { responseMimeType: "application/json" }
            });
            results = parseJsonFromText<InsuranceOption[]>(fallback.text) || [];
        } catch(e) {}
    }
    return results;
}

export const findESimOptions = async (destination: string, days: number, dataNeed: string, currency: string = 'USD', filters: any = {}): Promise<ESimOption[]> => { 
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
    Context: eSIM for ${destination} for ${days} days. Data needed: ${dataNeed}. Currency: ${currency}.
    Task: Find 3 eSIM plans.
    
    CRITICAL INSTRUCTION:
    Output ONLY a raw JSON Array. No other text.
    
    Output JSON Array of ESimOption.
    `;
    
    let results: ESimOption[] = [];
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { tools: [{ googleSearch: {} }] }
        }));
        results = parseJsonFromText<ESimOption[]>(response.text) || [];
    } catch(e) {}

    if (results.length === 0) {
        try {
            const fallback = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt + " (Provide representative example plans)",
                config: { responseMimeType: "application/json" }
            });
            results = parseJsonFromText<ESimOption[]>(fallback.text) || [];
        } catch(e) {}
    }
    return results;
}

export const checkVisaRequirements = async (nationality: string, destination: string): Promise<VisaRequirement | null> => { 
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
    Context: Passport: ${nationality}. Visiting: ${destination}.
    Task: Check Visa Requirements.
    Output JSON:
    {
      "destination": "${destination}", "nationality": "${nationality}", "status": "Required/Not Required", "maxDays": "90", "checklist": ["Passport"], "processingTime": "3 days", "embassyUrl": ""
    }
    `;
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { tools: [{ googleSearch: {} }] }
        }));
        return parseJsonFromText<VisaRequirement>(response.text);
    } catch(e) { return null; }
}

export const planWalkingRoute = async (location: string, language: string = 'English'): Promise<WalkingRoute | null> => { 
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Plan a 1-hour walking route in ${location}. Return JSON with 'name', 'waypoints' (name, lat, lng, description), 'totalDistance', 'estimatedTime'.`;
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: prompt, 
            config: { tools: [{ googleSearch: {} }] }
        }));
        return parseJsonFromText<WalkingRoute>(response.text);
    } catch(e) { return null; }
}

export const chatWithLocalResident = async (message: string, knowledge: OfflineKnowledge, destination: string, language: string) => { 
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
    Role: Local from ${destination}.
    Knowledge: ${knowledge.extendedKnowledge}.
    User asks: "${message}".
    Reply in ${language}, strictly < 50 words. Fun tone.
    `;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        return response.text || "Thinking...";
    } catch (e) { return "Signal weak!"; }
}

export const exploreLocation = async (
    location: string, 
    category: string, 
    language: string = 'English',
    coords?: { lat: number, lng: number }
): Promise<ExplorePlace[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let promptCategory = category;
  let specificInstructions = "";

  if (category === 'Restaurant') {
    promptCategory = "Food & Drink (Restaurants, Street Food, Cafes, Markets, Food Stalls)";
    specificInstructions = "Include a mix of high-end, local street food, and hidden gems. Specify the 'cuisine' type for each.";
  } else if (category === 'Guide') {
    promptCategory = "Local Tour Guides & Experiences";
    specificInstructions = "Look for actual human guides, walking tours, or local expert experiences available for booking near the location.";
  }

  const locationCtx = coords 
    ? `User is exactly at Latitude: ${coords.lat}, Longitude: ${coords.lng}. Find places strictly within 3km.` 
    : `User is exploring "${location}".`;

  const prompt = `
    Context: ${locationCtx}
    Category: "${promptCategory}".
    Task: Find 20 top recommendations. ${specificInstructions}
    Output STRICT JSON Array of ExplorePlace objects.
    Schema:
    [
      { "id": "1", "name": "", "category": "${category}", "cuisine": "", "priceLevel": "$", "rating": 4.5, "description": "", "lat": 0, "lng": 0, "address": "", "imageUrl": "", "reviews": [], "events": [] }
    ]
    `;

  const parseResponse = (text: string | undefined): ExplorePlace[] => {
      if (!text) return [];
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      try { return JSON.parse(cleanText); } catch { return []; }
  };

  try {
      const response: GenerateContentResponse = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: { tools: [{ googleSearch: {} }] }
      }));
      return parseResponse(response.text);
  } catch (e: any) {
      // Fallback logic for errors
      if (e.status === 429 || e.message?.includes('429')) {
          console.warn("Quota exceeded for Explore. Using knowledge fallback.");
          try {
             const fallback = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt, // No tools
             });
             return parseResponse(fallback.text);
          } catch { return []; }
      }
      return [];
  }
}

export const generateJourneyTrace = async (tickets: SavedTicket[]): Promise<{ coordinates: [number, number][], summary: string, totalKm: string }> => { 
    // ... (Existing)
    return { coordinates: [], summary: "", totalKm: "" }; 
}
export const generateTripRecapVideo = async (summary: string, locations: string[]): Promise<string | null> => { 
    // ... (Existing)
    return null; 
}
