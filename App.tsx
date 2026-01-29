
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MessageCircle, Calendar, LayoutDashboard, Map, Plane, Compass, Ticket, FileText, Glasses } from 'lucide-react';
import ChatInterface from './components/ChatInterface';
import ItineraryView from './components/ItineraryView';
import Dashboard from './components/Dashboard';
import OfflineMode from './components/OfflineMode';
import ExploreView from './components/ExploreView';
import MemoriesView from './components/MemoriesView';
import LanguageSelector from './components/LanguageSelector';
import CurrencySelector from './components/CurrencySelector';
import ThinkingChain from './components/ThinkingChain';
import PlanningLoader from './components/PlanningLoader';
import MyDocuments from './components/MyDocuments'; 
import VirtualGuide from './components/VirtualGuide'; 
import CalendarSync from './components/CalendarSync'; // New Import
import { DocumentProvider } from './contexts/DocumentContext'; 
import { BudgetProvider, useBudget } from './contexts/BudgetContext'; 
import { ItineraryItem, TripBudget, SavedTicket, OfflineKnowledge, Language, ItineraryResponse, CalendarEvent, WeatherData, TripPacing, TripBudgetTier } from './types';
import { generateStructuredItinerary, startChat, refreshOfflineKnowledge, getExchangeRate, findDeals } from './services/geminiService';
import { buildBudgetItemFromDeal, isDuplicateItem } from './services/budgetService';
import { getForecastForTrip } from './services/weatherService';

enum AppView {
  CHAT = 'chat',
  ITINERARY = 'itinerary',
  DASHBOARD = 'dashboard',
  OFFLINE = 'offline',
  EXPLORE = 'explore',
  MEMORIES = 'memories'
}

// Inner Component to access Context
const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.CHAT);
  const [language, setLanguage] = useState<string>(() => localStorage.getItem('omnitrip_lang') || 'English');
  const [currency, setCurrency] = useState<string>(() => localStorage.getItem('omnitrip_curr') || 'USD');
  const [currencySymbol, setCurrencySymbol] = useState<string>(() => localStorage.getItem('omnitrip_sym') || '$');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [loadingRate, setLoadingRate] = useState(false);
  
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false);
  const [isVirtualGuideOpen, setIsVirtualGuideOpen] = useState(false); 
  const [isCalendarSyncOpen, setIsCalendarSyncOpen] = useState(false); // Calendar Modal

  const [tripName, setTripName] = useState("My Awesome Trip");
  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
  const [offlineKnowledge, setOfflineKnowledge] = useState<OfflineKnowledge | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [startDate, setStartDate] = useState<string | undefined>();
  
  // Calendar Events State
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  
  // Weather State
  const [weatherData, setWeatherData] = useState<WeatherData[]>([]);

  // Trip Segment ID
  const currentSegmentId = "trip_1"; 

  // Budget Context Actions
  const { addBudgetItem, getBudgetItems } = useBudget();

  // Calculate End Date based on items
  const tripEndDate = useMemo(() => {
      if (!startDate || itineraryItems.length === 0) return undefined;
      const maxDay = Math.max(...itineraryItems.map(i => i.day));
      if (maxDay <= 1) return startDate;
      try {
          const [y, m, d] = startDate.split('-').map(Number);
          const date = new Date(Date.UTC(y, m - 1, d));
          date.setUTCDate(date.getUTCDate() + (maxDay - 1));
          return date.toISOString().split('T')[0];
      } catch (e) {
          return startDate;
      }
  }, [startDate, itineraryItems]);

  // Fetch Weather when Trip details change
  useEffect(() => {
      const city = tripName === "My Awesome Trip" ? "Paris" : tripName.split(" ")[0]; // Very naive extraction, handled better in services
      const start = startDate || new Date().toISOString().split('T')[0];
      
      const fetchW = async () => {
          if (tripName) {
              // Extract a sensible city name from trip name or context
              // In production, we'd use the explicit destinationCity from context logic
              const forecast = await getForecastForTrip(city, start, 5);
              setWeatherData(forecast);
          }
      };
      fetchW();
  }, [tripName, startDate]);

  const [savedTickets, setSavedTickets] = useState<SavedTicket[]>([
      { 
          id: '1', 
          name: 'Flight to Paris', 
          type: 'flight', 
          price: 350, 
          currency: 'USD',
          date: '2023-10-15', 
          provider: 'SkyWings',
          status: 'approved',
          details: { referenceNumber: 'SK-999' }
      }
  ]);

  const t = useMemo(() => {
    const dict: Record<string, Record<string, string>> = {
      'English': { plan: 'Plan', schedule: 'Schedule', journey: 'Journey', flight: 'In-Flight', explore: 'Explore', memories: 'Tickets', guide: 'Guide' },
      'Spanish': { plan: 'Plan', schedule: 'Agenda', journey: 'Viaje', flight: 'Vuelo', explore: 'Explorar', memories: 'Boletos', guide: 'Guía' },
      'French': { plan: 'Plan', schedule: 'Calendrier', journey: 'Voyage', flight: 'En Vol', explore: 'Explorer', memories: 'Billets', guide: 'Guide' },
      'Chinese': { plan: '计划', schedule: '日程', journey: '旅程', flight: '飞行中', explore: '探索', memories: '票据', guide: '导游' },
      'Japanese': { plan: 'プラン', schedule: 'スケジュール', journey: 'ジャーニー', flight: '機内', explore: '探索', memories: 'チケット', guide: 'ガイド' },
    };
    return (key: string) => dict[language]?.[key] || dict['English'][key];
  }, [language]);

  useEffect(() => {
    const savedPlan = localStorage.getItem('omnitrip_latest_plan');
    if (savedPlan) {
      try {
        const parsed = JSON.parse(savedPlan);
        setTripName(parsed.tripName);
        setItineraryItems(parsed.activities);
        setOfflineKnowledge(parsed.offlineKnowledge);
        setStartDate(parsed.startDate);
      } catch (e) {
        console.error("Failed to load saved plan", e);
      }
    }
  }, []);

  useEffect(() => {
    if (currency !== 'USD') {
        fetchRate(currency);
    }
  }, []);

  const fetchRate = async (targetCurr: string) => {
    setLoadingRate(true);
    const rate = await getExchangeRate(targetCurr);
    setExchangeRate(rate);
    setLoadingRate(false);
  }

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang.name);
    localStorage.setItem('omnitrip_lang', lang.name);
    startChat(lang.name);
  };

  const handleCurrencyChange = (code: string, symbol: string) => {
    setCurrency(code);
    setCurrencySymbol(symbol);
    localStorage.setItem('omnitrip_curr', code);
    localStorage.setItem('omnitrip_sym', symbol);
    fetchRate(code);
  };

  const convertPrice = useCallback((usdPrice: number): number => {
    return Math.round(usdPrice * exchangeRate);
  }, [exchangeRate]);

  const calculateDateForDay = (start: string, dayNum: number): string => {
    if (!start) return '';
    try {
        const [year, month, day] = start.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        date.setUTCDate(date.getUTCDate() + (dayNum - 1));
        return date.toISOString().split('T')[0];
    } catch (e) {
        return start;
    }
  };

  const handleAutoBudgeting = async (plan: ItineraryResponse, items: ItineraryItem[]) => {
      // 1. Check Preference
      if (plan.budgetPreference !== 'cheapest') return;

      console.log("Auto-budgeting cheapest options...");

      // 2. Identify Key Items (1 Flight, 1 Hotel)
      const flightItem = items.find(i => i.type.includes('flight') || i.type === 'transport');
      const hotelItem = items.find(i => i.type === 'hotel');

      const existingBudget = getBudgetItems(currentSegmentId);
      let addedCount = 0;

      // 3. Process Flight
      if (flightItem) {
          const query = flightItem.metadata?.searchQuery || `cheap flight ${flightItem.activity}`;
          const deals = await findDeals(query, language, { date: flightItem.date }, 'USD');
          if (deals.length > 0) {
              const cheapest = deals.sort((a, b) => a.price - b.price)[0];
              const budgetItem = buildBudgetItemFromDeal(cheapest, flightItem, currentSegmentId, true);
              if (!isDuplicateItem(budgetItem, existingBudget)) {
                  addBudgetItem(budgetItem);
                  addedCount++;
              }
          }
      }

      // 4. Process Hotel
      if (hotelItem && hotelItem.date) {
          const query = `cheap hotel ${hotelItem.location} checkin ${hotelItem.date}`;
          const [y, m, d] = hotelItem.date.split('-').map(Number);
          const dateObj = new Date(Date.UTC(y, m - 1, d));
          dateObj.setUTCDate(dateObj.getUTCDate() + 1);
          const endDate = dateObj.toISOString().split('T')[0];

          const deals = await findDeals(query, language, { date: hotelItem.date, endDate: endDate }, 'USD');
          if (deals.length > 0) {
              const cheapest = deals.sort((a, b) => a.price - b.price)[0];
              const budgetItem = buildBudgetItemFromDeal(cheapest, hotelItem, currentSegmentId, true);
              if (!isDuplicateItem(budgetItem, existingBudget)) {
                  addBudgetItem(budgetItem);
                  addedCount++;
              }
          }
      }
  };

  const onNewPlanLoaded = (plan: ItineraryResponse, mode: 'full' | 'day' = 'full', targetDay: number = 1) => {
    let updatedActivities: ItineraryItem[] = [];
    let updatedKnowledge = offlineKnowledge;
    const tripStart = plan.startDate || new Date().toISOString().split('T')[0];

    if (mode === 'full') {
      setTripName(plan.tripName || "New Adventure");
      setStartDate(tripStart);
      updatedActivities = plan.activities.map((act, index) => ({
        id: `item-${Date.now()}-${index}`,
        ...act,
        date: calculateDateForDay(tripStart, act.day),
        type: act.type as any
      }));
      updatedKnowledge = plan.offlineKnowledge;
    } else {
      const otherDays = itineraryItems.filter(item => item.day !== targetDay);
      const importedActivities = plan.activities.map((act, index) => ({
        id: `imported-${Date.now()}-${index}`,
        ...act,
        day: targetDay, 
        date: calculateDateForDay(startDate || tripStart, targetDay),
        type: act.type as any
      }));
      updatedActivities = [...otherDays, ...importedActivities];
      if (!updatedKnowledge) updatedKnowledge = plan.offlineKnowledge;
    }
    
    setItineraryItems(updatedActivities);
    setOfflineKnowledge(updatedKnowledge);
    
    localStorage.setItem('omnitrip_latest_plan', JSON.stringify({
      tripName: mode === 'full' ? (plan.tripName || tripName) : tripName,
      startDate: mode === 'full' ? tripStart : startDate,
      activities: updatedActivities,
      offlineKnowledge: updatedKnowledge
    }));

    if (mode === 'full') {
        handleAutoBudgeting(plan, updatedActivities);
    }
  };

  const handlePlanReady = async (historyContext: string, pacing: TripPacing, budgetTier: TripBudgetTier) => {
    setIsGenerating(true);
    try {
        // Pass calendar constraints, pacing, and budget to the generator
        const plan = await generateStructuredItinerary(historyContext, language, calendarEvents, pacing, budgetTier);
        onNewPlanLoaded(plan, 'full');
        setCurrentView(AppView.ITINERARY);
    } catch (error) {
        alert("Oops! Failed to generate the plan. Please try again.");
    } finally {
        setIsGenerating(false);
    }
  };

  const handleRefreshOffline = async () => {
    if (!tripName) return;
    try {
        const newKnowledge = await refreshOfflineKnowledge(tripName, language);
        setOfflineKnowledge(newKnowledge);
        const savedPlan = localStorage.getItem('omnitrip_latest_plan');
        if (savedPlan) {
            const parsed = JSON.parse(savedPlan);
            parsed.offlineKnowledge = newKnowledge;
            localStorage.setItem('omnitrip_latest_plan', JSON.stringify(parsed));
        }
    } catch (e) {
        alert("Failed to refresh the guide! Check connection.");
    }
  };

  const handleWeatherSimulate = (date: string, condition: WeatherData['condition']) => {
      setWeatherData(prev => prev.map(w => w.date === date ? { ...w, condition: condition, isSimulated: true } : w));
  };

  return (
    <div className="min-h-screen bg-sky-50 font-sans text-omni-dark p-4 md:p-6 lg:p-8 flex flex-col gap-4 relative">
          <header className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-omni-yellow rounded-full border-4 border-omni-dark flex items-center justify-center shadow-cartoon-sm">
                    <Map className="text-omni-dark" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-omni-dark tracking-tight">Omnitrip</h1>
                    <p className="text-xs font-bold text-gray-500 -mt-1">Your Travel Bestie</p>
                </div>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-4">
                <nav className="flex bg-white rounded-2xl border-2 border-omni-dark shadow-cartoon-sm p-1">
                    <button 
                        onClick={() => setCurrentView(AppView.CHAT)}
                        className={`p-2 px-3 md:px-4 rounded-xl font-black text-xs flex items-center gap-2 transition-all ${currentView === AppView.CHAT ? 'bg-omni-blue border-2 border-omni-dark' : 'hover:bg-gray-100'}`}
                    >
                        <MessageCircle size={16}/> <span className="hidden sm:inline">{t('plan')}</span>
                    </button>
                    <button 
                        onClick={() => setCurrentView(AppView.ITINERARY)}
                        className={`p-2 px-3 md:px-4 rounded-xl font-black text-xs flex items-center gap-2 transition-all ${currentView === AppView.ITINERARY ? 'bg-omni-green border-2 border-omni-dark' : 'hover:bg-gray-100'}`}
                    >
                        <Calendar size={16}/> <span className="hidden sm:inline">{t('schedule')}</span>
                    </button>
                    <button 
                        onClick={() => setCurrentView(AppView.DASHBOARD)}
                        className={`p-2 px-3 md:px-4 rounded-xl font-black text-xs flex items-center gap-2 transition-all ${currentView === AppView.DASHBOARD ? 'bg-omni-pink border-2 border-omni-dark' : 'hover:bg-gray-100'}`}
                    >
                        <LayoutDashboard size={16}/> <span className="hidden sm:inline">{t('journey')}</span>
                    </button>
                    <button 
                        onClick={() => setCurrentView(AppView.MEMORIES)}
                        className={`p-2 px-3 md:px-4 rounded-xl font-black text-xs flex items-center gap-2 transition-all ${currentView === AppView.MEMORIES ? 'bg-orange-200 border-2 border-omni-dark' : 'hover:bg-gray-100'}`}
                    >
                        <Ticket size={16}/> <span className="hidden sm:inline">{t('memories')}</span>
                    </button>
                    <button 
                        onClick={() => setCurrentView(AppView.EXPLORE)}
                        className={`p-2 px-3 md:px-4 rounded-xl font-black text-xs flex items-center gap-2 transition-all ${currentView === AppView.EXPLORE ? 'bg-purple-200 border-2 border-omni-dark' : 'hover:bg-gray-100'}`}
                    >
                        <Compass size={16}/> <span className="hidden sm:inline">{t('explore')}</span>
                    </button>
                    <button 
                        onClick={() => setCurrentView(AppView.OFFLINE)}
                        className={`p-2 px-3 md:px-4 rounded-xl font-black text-xs flex items-center gap-2 transition-all ${currentView === AppView.OFFLINE ? 'bg-omni-yellow border-2 border-omni-dark' : 'hover:bg-gray-100'}`}
                    >
                        <Plane size={16}/> <span className="hidden sm:inline">{t('flight')}</span>
                    </button>
                </nav>
                <div className="flex items-center gap-2">
                    {/* Calendar Sync Button */}
                    <button
                        onClick={() => setIsCalendarSyncOpen(true)}
                        className="flex items-center gap-2 bg-white text-omni-dark px-3 py-2 rounded-2xl border-2 border-omni-dark shadow-cartoon-sm hover:translate-y-0.5 transition-all"
                        title="Sync Calendar"
                    >
                        <Calendar size={18} className="text-omni-pink" />
                        <span className="font-black text-sm hidden lg:inline">Sync</span>
                    </button>

                    <button
                        onClick={() => setIsVirtualGuideOpen(true)}
                        className="flex items-center gap-2 bg-omni-dark text-white px-3 py-2 rounded-2xl border-2 border-transparent shadow-cartoon-sm hover:translate-y-0.5 transition-all"
                        title="AI Tour Guide"
                    >
                        <Glasses size={18} />
                        <span className="font-black text-sm hidden lg:inline">Guide</span>
                    </button>

                    <button 
                        onClick={() => setIsDocumentsOpen(true)}
                        className="flex items-center gap-2 bg-white px-3 py-2 rounded-2xl border-2 border-omni-dark shadow-cartoon-sm hover:translate-y-0.5 transition-all"
                        title="My Documents"
                    >
                        <FileText size={18} className="text-omni-dark" />
                        <span className="font-black text-sm hidden lg:inline">Docs</span>
                    </button>
                    <CurrencySelector 
                      currentCurrency={currency} 
                      onCurrencyChange={handleCurrencyChange} 
                      isLoading={loadingRate}
                    />
                    <LanguageSelector currentLanguage={language} onLanguageChange={handleLanguageChange} />
                </div>
            </div>
          </header>

          <main className="flex-1 relative min-h-0">
              {isGenerating && (
                  <PlanningLoader 
                    destination={tripName} 
                    onCancel={() => setIsGenerating(false)}
                  />
              )}

              {currentView === AppView.CHAT && (
                  <div className="h-[calc(100vh-160px)]">
                    <ChatInterface 
                        onPlanReady={handlePlanReady} 
                        language={language} 
                        calendarEvents={calendarEvents} // Pass Events
                    />
                  </div>
              )}

              {currentView === AppView.ITINERARY && (
                  <div className="h-[calc(100vh-160px)]">
                    <ItineraryView 
                        items={itineraryItems} 
                        setItems={setItineraryItems} 
                        tripName={tripName}
                        language={language}
                        onImported={onNewPlanLoaded}
                        currency={currency}
                        currencySymbol={currencySymbol}
                        convertPrice={convertPrice}
                        segmentId={currentSegmentId}
                        weatherData={weatherData} // NEW
                    />
                  </div>
              )}

              {currentView === AppView.EXPLORE && (
                  <div className="h-[calc(100vh-160px)]">
                    <ExploreView location={tripName} language={language} />
                  </div>
              )}
              
              {currentView === AppView.MEMORIES && (
                  <div className="h-[calc(100vh-160px)]">
                    <MemoriesView 
                        tickets={savedTickets} 
                        setTickets={setSavedTickets}
                        currencySymbol={currencySymbol}
                    />
                  </div>
              )}

              {currentView === AppView.DASHBOARD && (
                  <div className="h-[calc(100vh-160px)]">
                    <Dashboard 
                        segmentId={currentSegmentId} 
                        scheduleItems={itineraryItems} 
                        tickets={savedTickets}
                        language={language} 
                        convertPrice={convertPrice}
                        currencySymbol={currencySymbol}
                        tripName={tripName}
                        startDate={startDate}
                        endDate={tripEndDate}
                        weatherData={weatherData} // NEW
                        onWeatherSimulate={handleWeatherSimulate} // NEW
                    />
                  </div>
              )}

              {currentView === AppView.OFFLINE && (
                  <div className="h-[calc(100vh-160px)]">
                    <OfflineMode 
                        knowledge={offlineKnowledge} 
                        destination={tripName} 
                        language={language} 
                        onRefresh={handleRefreshOffline}
                    />
                  </div>
              )}
          </main>

          <MyDocuments isOpen={isDocumentsOpen} onClose={() => setIsDocumentsOpen(false)} />
          <CalendarSync 
            isOpen={isCalendarSyncOpen} 
            onClose={() => setIsCalendarSyncOpen(false)} 
            events={calendarEvents} 
            setEvents={setCalendarEvents} 
          />
          {isVirtualGuideOpen && (
              <VirtualGuide 
                  language={language} 
                  onClose={() => setIsVirtualGuideOpen(false)} 
              />
          )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <DocumentProvider>
      <BudgetProvider>
        <AppContent />
      </BudgetProvider>
    </DocumentProvider>
  );
}

export default App;
