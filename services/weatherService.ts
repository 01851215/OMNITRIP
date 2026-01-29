
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { WeatherData, ItineraryItem, DealOption } from "../types";
// STRICT RELATIVE IMPORT
import { buildProviderLinks, BookingPayload } from './linkService';

// Fallback logic helpers
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getForecastForTrip = async (
    city: string, 
    startDate: string, 
    days: number = 3
): Promise<WeatherData[]> => {
    if (!city || city === "Unknown Destination") return [];

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
    Check the weather forecast for ${city} starting from ${startDate} for ${days} days.
    
    If the date is far in the future, provide historical average weather for that time of year.
    If the date is near (within 10 days), provide real forecast if possible using search tools.
    
    Return a JSON array:
    [
      {
        "date": "YYYY-MM-DD",
        "condition": "Sunny" | "Cloudy" | "Rain" | "Snow" | "Storm",
        "temp": 25,
        "unit": "C",
        "precipitationChance": 10,
        "summary": "Short description"
      }
    ]
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                // responseMimeType: "application/json" // Removed to avoid "Tool use with a response mime type: 'application/json' is unsupported"
            }
        });

        if (response.text) {
            const cleanText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
            const rawData = JSON.parse(cleanText);
            
            if (Array.isArray(rawData)) {
                return rawData.map((item: any) => {
                    let safeTemp = 25;
                    
                    // Handle { high, low } object which causes React Error #31
                    if (typeof item.temp === 'object' && item.temp !== null) {
                        if (item.temp.high !== undefined && item.temp.low !== undefined) {
                            safeTemp = Math.round((Number(item.temp.high) + Number(item.temp.low)) / 2);
                        } else if (item.temp.high !== undefined) {
                            safeTemp = Number(item.temp.high);
                        } else if (item.temp.day !== undefined) {
                            safeTemp = Number(item.temp.day);
                        }
                    } else if (typeof item.temp === 'number') {
                        safeTemp = item.temp;
                    } else if (typeof item.temp === 'string') {
                        safeTemp = parseFloat(item.temp) || 25;
                    }

                    return {
                        date: item.date,
                        condition: item.condition || 'Sunny',
                        temp: safeTemp,
                        unit: item.unit || 'C',
                        precipitationChance: typeof item.precipitationChance === 'number' ? item.precipitationChance : 0,
                        summary: item.summary || ''
                    };
                }) as WeatherData[];
            }
            return [];
        }
        return [];
    } catch (e) {
        console.warn("Weather fetch failed, falling back to mock", e);
        // Fallback Mock Data
        const mock: WeatherData[] = [];
        for (let i = 0; i < days; i++) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            mock.push({
                date: d.toISOString().split('T')[0],
                condition: i === 1 ? 'Rain' : 'Sunny', // Make 2nd day rainy for demo fun
                temp: 22 - i,
                unit: 'C',
                precipitationChance: i === 1 ? 80 : 10,
                summary: i === 1 ? "Heavy showers expected" : "Clear skies"
            });
        }
        return mock;
    }
};

/**
 * Analyzes if an activity is impacted by specific weather.
 */
export const isWeatherSensitive = (item: ItineraryItem, weather: WeatherData): boolean => {
    const badWeather = ['Rain', 'Snow', 'Storm'];
    if (!badWeather.includes(weather.condition)) return false;

    const lowerActivity = (item.activity || '').toLowerCase();
    const lowerType = (item.type || '').toLowerCase();
    const lowerLocation = (item.location || '').toLowerCase();

    // Keywords that suggest OUTDOOR activity
    const outdoorKeywords = [
        'park', 'hike', 'walk', 'beach', 'garden', 'tour', 'zoo', 'outdoor', 
        'picnic', 'cycling', 'boat', 'kayak', 'explore', 'sightseeing', 'street'
    ];

    // Explicit Indoor keywords to safe-list
    const indoorKeywords = ['museum', 'mall', 'gallery', 'indoor', 'cinema', 'theater', 'aquarium'];

    if (indoorKeywords.some(k => lowerActivity.includes(k) || lowerLocation.includes(k))) return false;
    
    return outdoorKeywords.some(k => lowerActivity.includes(k) || lowerType.includes(k) || lowerLocation.includes(k));
};

/**
 * Finds INDOOR alternatives for a ruined outdoor plan.
 */
export const getIndoorAlternatives = async (
    originalItem: ItineraryItem, 
    city: string,
    language: string
): Promise<DealOption[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
    Context: The user planned "${originalItem.activity}" in ${city}, but it is Raining/Snowing.
    Task: Suggest 3 specific INDOOR alternatives nearby.
    Language: ${language}
    
    Output JSON:
    [
      { "title": "National Museum", "provider": "Viator", "price": 20, "currency": "USD", "rating": 4.5, "description": "Great for rainy days", "url": "" }
    ]
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });
        
        const raw = JSON.parse(response.text || "[]");
        
        // Post-process links
        return raw.map((opt: any) => {
             const payload: BookingPayload = {
                type: 'attraction',
                location: city,
                title: opt.title,
                startDate: originalItem.date
            };
            const links = buildProviderLinks(opt.provider || 'Generic', payload);
            return { ...opt, provider: links.displayName, url: links.primaryUrl };
        });

    } catch (e) {
        return [
            { title: "Local Mall", provider: "Map", price: 0, currency: "USD", rating: 4, description: "Shopping is always dry!", url: "#" },
            { title: "City Library", provider: "Map", price: 0, currency: "USD", rating: 5, description: "Read a book.", url: "#" }
        ];
    }
};
