
import React, { useState, useRef, useMemo } from 'react';
import { ItineraryItem, ItineraryResponse, DealOption, WalkingRoute, WeatherData } from '../types';
import { 
  Map as MapIcon, 
  Calendar, 
  DollarSign, 
  Trash2, 
  MapPin, 
  List, 
  Eye, 
  FileUp, 
  X, 
  ClipboardPaste, 
  ImagePlus, 
  Check, 
  Layout, 
  Layers,
  GripVertical,
  Star,
  ExternalLink,
  Tag,
  Plane,
  RefreshCw,
  AlertCircle,
  Footprints,
  Timer,
  Navigation,
  BedDouble,
  Ticket,
  CloudRain,
  Sun,
  Umbrella
} from 'lucide-react';
import { findDeals, findAlternatives, parseExternalItinerary, planWalkingRoute } from '../services/geminiService';
import { getIndoorAlternatives, isWeatherSensitive } from '../services/weatherService';
import { buildBudgetItemFromDeal, isDuplicateItem } from '../services/budgetService';
import { useBudget } from '../contexts/BudgetContext'; // Context for Budget Actions
import MapView from './MapView';
import ThinkingChain from './ThinkingChain';

interface ItineraryViewProps {
  items: ItineraryItem[];
  setItems: React.Dispatch<React.SetStateAction<ItineraryItem[]>>;
  tripName: string;
  language: string;
  onImported: (plan: ItineraryResponse, mode: 'full' | 'day', targetDay: number) => void;
  currency: string;
  currencySymbol: string;
  convertPrice: (usd: number) => number;
  segmentId: string;
  weatherData: WeatherData[]; // NEW
}

const ItineraryView: React.FC<ItineraryViewProps> = ({ 
    items, setItems, tripName, language, onImported, currency, currencySymbol, convertPrice, segmentId, weatherData 
}) => {
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  
  // Budget Context
  const { addBudgetItem, getBudgetItems } = useBudget();

  // Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importImage, setImportImage] = useState<{ base64: string, mime: string } | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [importMode, setImportMode] = useState<'full' | 'day'>('full');
  
  // Drag State
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  
  // Deals Modal State
  const [isDealsModalOpen, setIsDealsModalOpen] = useState(false);
  const [currentDealItem, setCurrentDealItem] = useState<ItineraryItem | null>(null);
  const [dealOptions, setDealOptions] = useState<DealOption[]>([]);
  const [isLoadingDeals, setIsLoadingDeals] = useState(false);
  const [dealMode, setDealMode] = useState<'deals' | 'alternatives' | 'weather_swap'>('deals');
  const [dealSort, setDealSort] = useState<'price_asc' | 'price_desc' | 'rating'>('price_asc');
  const [addedDealIds, setAddedDealIds] = useState<Set<string>>(new Set());

  // Route Planning State
  const [currentRoute, setCurrentRoute] = useState<WalkingRoute | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const days: number[] = Array.from<number>(new Set(items.map(i => i.day))).sort((a: number, b: number) => a - b);
  
  // Helper to find the date string for a specific day
  const getDateForDay = (dayNum: number): string | undefined => {
      const item = items.find(i => i.day === dayNum);
      return item?.date;
  }
  
  // Get weather for currently selected day
  const currentWeather = useMemo(() => {
      const dateStr = getDateForDay(selectedDay);
      if (!dateStr) return null;
      return weatherData.find(w => w.date === dateStr);
  }, [selectedDay, weatherData, items]);

  const currentItems = items.filter(i => i.day === selectedDay);

  const handleDelete = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleDesignRoute = async (item: ItineraryItem) => {
    setIsLoadingRoute(true);
    setCurrentRoute(null);
    try {
        const query = item.location && item.location.length > 2 ? `${item.activity} at ${item.location}` : item.activity;
        const route = await planWalkingRoute(query, language);
        if (route) {
            setCurrentRoute(route);
            setViewMode('map');
        } else {
            alert("Couldn't find a good path here! 🛑");
        }
    } catch (e) {
        alert("Route planning failed! 🤯");
    } finally {
        setIsLoadingRoute(false);
    }
  };

  const clearRoute = () => {
    setCurrentRoute(null);
  }

  const handleFindDeals = async (item: ItineraryItem) => {
    setCurrentDealItem(item);
    setIsDealsModalOpen(true);
    setDealMode('deals');
    setIsLoadingDeals(true);
    setDealOptions([]); 
    setAddedDealIds(new Set());
    
    try {
        let query = item.metadata?.searchQuery || `${item.activity} in ${item.location}`;
        const activitySafe = (item.activity || '').toLowerCase();
        
        // Smart Query Construction for Flights
        if (item.type === 'flight' || (item.type === 'transport' && activitySafe.includes('flight'))) {
             // If generic title like "Flight Arrival", fallback to "Flights to [Location]"
             const isGenericFlight = activitySafe.includes('arrival') || activitySafe.includes('departure');
             if (isGenericFlight && !item.metadata?.flightCode) {
                 query = `cheap flights to ${item.location}`;
             } else {
                 query = `book flight ${item.metadata?.flightCode || item.activity} ${item.metadata?.origin || ''} to ${item.metadata?.destination || ''}`;
             }
        }
        
        // Smart Query for Hotels
        let endDate: string | undefined = undefined;
        if (item.type === 'hotel') {
            if (activitySafe.includes('check-in')) {
                 query = `hotels in ${item.location}`;
            } else {
                 query = `${item.activity} hotel in ${item.location}`;
            }
            
            // Calculate End Date
            if (item.date) {
                const maxDay = Math.max(...items.map(i => i.day));
                const lastItem = items.find(i => i.day === maxDay);
                
                if (lastItem && lastItem.date && maxDay > item.day) {
                     endDate = lastItem.date;
                } else {
                     const [y, m, d] = item.date.split('-').map(Number);
                     const dateObj = new Date(Date.UTC(y, m - 1, d));
                     dateObj.setUTCDate(dateObj.getUTCDate() + 1);
                     endDate = dateObj.toISOString().split('T')[0];
                }
            }
        }

        const options = await findDeals(query, language, { date: item.date, endDate: endDate, location: item.location }, currency);
        setDealOptions(options);
    } catch (e) {
        console.error(e);
    } finally {
        setIsLoadingDeals(false);
    }
  };

  const handleChangeFlight = async (item: ItineraryItem) => {
    setCurrentDealItem(item);
    setIsDealsModalOpen(true);
    setDealMode('alternatives');
    setIsLoadingDeals(true);
    setDealOptions([]);
    
    try {
        const query = item.metadata?.searchQuery || `${item.activity}`;
        const options = await findAlternatives(query, language, { date: item.date }, currency);
        setDealOptions(options);
    } catch (e) {
        console.error(e);
    } finally {
        setIsLoadingDeals(false);
    }
  }

  // --- WEATHER SWAP HANDLER ---
  const handleWeatherSwap = async (item: ItineraryItem) => {
      setCurrentDealItem(item);
      setIsDealsModalOpen(true);
      setDealMode('weather_swap');
      setIsLoadingDeals(true);
      setDealOptions([]);

      try {
          const alternatives = await getIndoorAlternatives(item, item.location, language);
          setDealOptions(alternatives);
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoadingDeals(false);
      }
  };

  // Replaces the original item with the new selected indoor option
  const handleConfirmSwap = (deal: DealOption) => {
      if (!currentDealItem) return;
      
      const newItem: ItineraryItem = {
          ...currentDealItem,
          id: `swapped-${Date.now()}`,
          activity: deal.title,
          location: `${deal.title}, ${currentDealItem.location}`,
          notes: `Swapped due to weather. Originally: ${currentDealItem.activity}`,
          costEstimate: deal.price,
          type: 'attraction', // Usually indoor attraction
          metadata: { ...currentDealItem.metadata, searchQuery: deal.title }
      };

      setItems(prev => prev.map(i => i.id === currentDealItem.id ? newItem : i));
      setIsDealsModalOpen(false);
  };

  const handleAddToBudget = (deal: DealOption) => {
      if (!currentDealItem) return;

      const budgetItem = buildBudgetItemFromDeal(deal, currentDealItem, segmentId);
      const currentBudget = getBudgetItems(segmentId);

      if (isDuplicateItem(budgetItem, currentBudget)) {
          alert("Already in your budget! ✅");
          return;
      }

      addBudgetItem(budgetItem);
      
      // Update local state to show 'Added' UI state
      setAddedDealIds(prev => new Set(prev).add(deal.title + deal.provider));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        setImportImage({ base64, mime: file.type });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImport = async () => {
    if (!importText.trim() && !importImage) return;
    setIsParsing(true);
    try {
      const parsed = await parseExternalItinerary({
        text: importText,
        imageBase64: importImage?.base64,
        mimeType: importImage?.mime
      }, language);
      
      onImported(parsed, importMode, selectedDay);
      setIsImportModalOpen(false);
      setImportText('');
      setImportImage(null);
    } catch (e) {
      alert("Uh oh! Gemini couldn't read that itinerary. Try better text or a clearer image! 🧐");
    } finally {
      setIsParsing(false);
    }
  };

  // Drag and Drop Logic
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItemId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    // Auto-scroll logic
    const container = listContainerRef.current;
    if (container) {
        const { top, bottom } = container.getBoundingClientRect();
        const mouseY = e.clientY;
        const triggerZone = 100; // px
        
        if (mouseY < top + triggerZone) {
            container.scrollTop -= 15;
        } else if (mouseY > bottom - triggerZone) {
            container.scrollTop += 15;
        }
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItemId || draggedItemId === targetId) return;

    const newItems = [...items];
    const draggedIdx = newItems.findIndex(i => i.id === draggedItemId);
    const targetIdx = newItems.findIndex(i => i.id === targetId);

    if (draggedIdx !== -1 && targetIdx !== -1) {
      const [removed] = newItems.splice(draggedIdx, 1);
      newItems.splice(targetIdx, 0, removed);
      setItems(newItems);
    }
    setDraggedItemId(null);
  };

  // Sorting Logic for Deals
  const sortedDeals = useMemo(() => {
    const sorted = [...dealOptions];
    if (dealSort === 'price_asc') {
        sorted.sort((a, b) => a.price - b.price);
    } else if (dealSort === 'price_desc') {
        sorted.sort((a, b) => b.price - a.price);
    } else if (dealSort === 'rating') {
        sorted.sort((a, b) => b.rating - a.rating);
    }
    return sorted;
  }, [dealOptions, dealSort]);

  const customScrollbarStyle = `
    .custom-scrollbar::-webkit-scrollbar {
      width: 16px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: #f1f5f9;
      border-left: 4px solid #334155;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #fde047;
      border: 4px solid #334155;
      border-radius: 99px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #fbcfe8;
    }
  `;

  return (
    <div className="h-full flex flex-col gap-4 relative">
      <style>{customScrollbarStyle}</style>

      {/* Global Loading Overlay for Route */}
      {isLoadingRoute && (
          <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center rounded-[2.5rem] border-4 border-omni-dark animate-in fade-in">
              <ThinkingChain 
                steps={[
                    "Scanning local streets... 🏘️",
                    "Finding best coffee stops... ☕",
                    "Calculating scenic shortcuts... 🌳",
                    "Avoiding boring roads... 🙅‍♂️",
                    "Finalizing your walk! 👟"
                ]} 
              />
          </div>
      )}

      {/* Top Bar / Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-3xl border-4 border-omni-dark shadow-cartoon-sm gap-4">
        <div className="flex items-center gap-4">
            <div className="bg-omni-yellow p-2 rounded-xl border-2 border-omni-dark -rotate-2">
                <Calendar size={20} className="text-omni-dark" />
            </div>
            <h2 className="text-xl md:text-2xl font-black text-omni-dark truncate max-w-[200px] md:max-w-none">{tripName}</h2>
            <div className="bg-omni-pink px-3 py-1 rounded-full border-2 border-omni-dark font-black text-xs whitespace-nowrap">Day {selectedDay}</div>
            {/* Day Weather Indicator */}
            {currentWeather && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border-2 border-omni-dark ${currentWeather.condition === 'Rain' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-50 text-omni-dark'}`}>
                    {currentWeather.condition === 'Rain' ? <CloudRain size={16}/> : <Sun size={16}/>}
                    <span className="text-xs font-black">{currentWeather.temp}°</span>
                </div>
            )}
        </div>
        
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setIsImportModalOpen(true)}
                className="bg-white border-2 border-omni-dark p-2 rounded-xl hover:bg-omni-pink transition-all shadow-cartoon-sm flex items-center gap-2 font-black text-xs"
            >
                <FileUp size={16} /> IMPORT
            </button>
            <div className="flex bg-gray-100 p-1 rounded-2xl border-2 border-omni-dark ml-2">
                <button 
                    onClick={() => {
                        setViewMode('list');
                        clearRoute();
                    }}
                    className={`px-4 md:px-6 py-2 rounded-xl font-black text-xs flex items-center gap-2 transition-all ${viewMode === 'list' ? 'bg-white shadow-cartoon-sm border-2 border-omni-dark translate-y-[-2px]' : 'hover:bg-white/50'}`}
                >
                    <List size={16} /> LIST
                </button>
                <button 
                    onClick={() => setViewMode('map')}
                    className={`px-4 md:px-6 py-2 rounded-xl font-black text-xs flex items-center gap-2 transition-all ${viewMode === 'map' ? 'bg-omni-blue shadow-cartoon-sm border-2 border-omni-dark translate-y-[-2px]' : 'hover:bg-white/50'}`}
                >
                    <MapIcon size={16} /> MAP
                </button>
            </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
        {/* Day Selector Sidebar */}
        <div className="w-full md:w-64 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-y-auto md:pb-0 scrollbar-hide">
          {days.length > 0 ? days.map((day: number) => {
            const dateStr = getDateForDay(day);
            // Format nice date if available, parsing YYYY-MM-DD manually to avoid UTC conversion shifts
            let displayDate = '';
            let dayWeather: WeatherData | undefined;
            
            if (dateStr) {
                const parts: number[] = dateStr.split('-').map((n: string) => parseInt(n, 10));
                if (parts.length === 3) {
                    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]); // Construct local date
                    displayDate = dateObj.toLocaleDateString(language === 'English' ? 'en-US' : undefined, {month: 'short', day: 'numeric'});
                }
                dayWeather = weatherData.find(w => w.date === dateStr);
            }
                
            return (
                <button
                key={day}
                onClick={() => {
                    setSelectedDay(day);
                    clearRoute();
                }}
                className={`flex-shrink-0 min-w-[80px] px-4 py-3 rounded-2xl border-4 border-omni-dark font-black text-center md:text-left transition-all relative overflow-hidden group ${
                    selectedDay === day 
                    ? 'bg-omni-yellow shadow-cartoon translate-x-1' 
                    : 'bg-white hover:bg-sky-50 translate-x-0'
                }`}
                >
                <div className="relative z-10 flex flex-col">
                    <span className="text-[10px] uppercase tracking-widest opacity-40">Day {day}</span>
                    <span className="text-sm md:text-base">{displayDate || `Day ${day}`}</span>
                    {dayWeather && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-gray-400">
                            {dayWeather.condition === 'Rain' && <CloudRain size={10} className="text-blue-400"/>}
                            {dayWeather.condition}
                        </div>
                    )}
                </div>
                </button>
            );
          }) : (
              <div className="p-4 text-center font-bold text-gray-400">...</div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 relative min-h-0 bg-white rounded-[2.5rem] border-4 border-omni-dark shadow-cartoon overflow-hidden">
            {viewMode === 'list' ? (
                <div 
                    ref={listContainerRef}
                    onDragOver={handleDragOver}
                    className="h-full overflow-y-auto p-6 md:p-10 custom-scrollbar scroll-smooth"
                >
                    <div className="space-y-6">
                        {currentItems.map((item, idx) => {
                            // CHECK FOR WEATHER IMPACT
                            const isImpacted = currentWeather && isWeatherSensitive(item, currentWeather);
                            const activitySafe = (item.activity || '').toLowerCase();

                            return (
                            <div 
                              key={item.id} 
                              className={`group relative transition-all ${draggedItemId === item.id ? 'opacity-30 scale-95' : 'opacity-100'}`}
                              draggable="true"
                              onDragStart={(e) => handleDragStart(e, item.id)}
                              onDragOver={handleDragOver} // Allow dropping on items
                              onDrop={(e) => handleDrop(e, item.id)}
                            >
                                <div className="absolute inset-0 bg-omni-dark rounded-3xl translate-x-1 translate-y-1 -z-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                
                                {/* WEATHER ALERT BADGE */}
                                {isImpacted && (
                                    <div className="absolute -top-3 left-10 z-20 bg-blue-500 text-white px-3 py-1 rounded-full border-2 border-omni-dark shadow-sm text-xs font-black flex items-center gap-1 animate-bounce">
                                        <CloudRain size={14} /> Rain Alert!
                                    </div>
                                )}

                                <div className={`bg-white border-4 border-omni-dark rounded-3xl p-6 transition-all hover:-translate-x-1 hover:-translate-y-1 flex gap-4 cursor-grab active:cursor-grabbing ${isImpacted ? 'border-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.3)]' : ''}`}>
                                    {/* Drag Handle Indicator */}
                                    <div className="flex items-center text-gray-300 group-hover:text-omni-dark transition-colors">
                                        <GripVertical size={24} />
                                    </div>

                                    <div className="flex-1 flex flex-col md:flex-row gap-6">
                                        <div className="flex-shrink-0">
                                            <div className="w-12 h-12 bg-omni-yellow rounded-2xl border-4 border-omni-dark flex flex-col items-center justify-center shadow-cartoon-sm rotate-3 group-hover:rotate-0 transition-transform">
                                                <span className="text-xl font-black">{idx + 1}</span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="bg-omni-blue px-3 py-1 rounded-xl border-2 border-omni-dark font-black text-xs">
                                                    {item.time}
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                                    {item.type}
                                                </span>
                                            </div>
                                            
                                            <h4 className="text-xl font-black text-omni-dark mb-1 flex items-center gap-2">
                                                {item.activity}
                                                {(item.type === 'transport' || item.type === 'flight') && item.metadata?.flightCode && (
                                                    <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-normal border border-gray-300">
                                                        {item.metadata.flightCode}
                                                    </span>
                                                )}
                                            </h4>
                                            
                                            <div className="flex items-center gap-1 text-gray-500 font-bold text-sm mb-3">
                                                <MapPin size={16} className="text-omni-pink" />
                                                {item.location}
                                            </div>

                                            {item.notes && (
                                                <div className="bg-gray-50 p-3 rounded-2xl border-2 border-dashed border-gray-300 text-xs italic text-gray-600 mb-4 font-bold">
                                                    "{item.notes}"
                                                </div>
                                            )}

                                            <div className="flex flex-wrap gap-2">
                                                {/* WEATHER ACTION */}
                                                {isImpacted && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleWeatherSwap(item); }}
                                                        className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-4 py-2 rounded-xl border-2 border-blue-300 font-black text-xs flex items-center gap-2 shadow-cartoon-sm transition-all animate-pulse"
                                                    >
                                                        <Umbrella size={16}/> SEE INDOOR OPTIONS
                                                    </button>
                                                )}

                                                {/* DYNAMIC ACTION BUTTON BASED ON TYPE */}
                                                {(item.type === 'transport' || item.type === 'flight') ? (
                                                    <>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleFindDeals(item); }}
                                                            className="bg-white hover:bg-omni-blue px-4 py-2 rounded-xl border-2 border-omni-dark font-black text-xs flex items-center gap-2 shadow-cartoon-sm transition-all"
                                                        >
                                                            <Plane size={16}/> COMPARE FLIGHTS
                                                        </button>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleChangeFlight(item); }}
                                                            className="bg-white hover:bg-omni-pink px-4 py-2 rounded-xl border-2 border-omni-dark font-black text-xs flex items-center gap-2 shadow-cartoon-sm transition-all opacity-70"
                                                        >
                                                            <RefreshCw size={14}/> SWAP
                                                        </button>
                                                    </>
                                                ) : item.type === 'hotel' ? (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleFindDeals(item); }}
                                                        className="bg-white hover:bg-omni-yellow px-4 py-2 rounded-xl border-2 border-omni-dark font-black text-xs flex items-center gap-2 shadow-cartoon-sm transition-all"
                                                    >
                                                        <BedDouble size={16}/> COMPARE HOTELS
                                                    </button>
                                                ) : item.type === 'attraction' || item.type === 'event' ? (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleFindDeals(item); }}
                                                        className="bg-white hover:bg-omni-pink px-4 py-2 rounded-xl border-2 border-omni-dark font-black text-xs flex items-center gap-2 shadow-cartoon-sm transition-all"
                                                    >
                                                        <Ticket size={16}/> FIND TICKETS
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleFindDeals(item); }}
                                                        className="bg-white hover:bg-gray-100 px-4 py-2 rounded-xl border-2 border-omni-dark font-black text-xs flex items-center gap-2 shadow-cartoon-sm transition-all"
                                                    >
                                                        <DollarSign size={16}/> FIND DEALS
                                                    </button>
                                                )}

                                                {/* Route Planner Button for Attractions/Walks */}
                                                {(item.type === 'attraction' || activitySafe.includes('walk') || activitySafe.includes('tour') || activitySafe.includes('hike')) && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleDesignRoute(item); }}
                                                        className="bg-white hover:bg-omni-green px-4 py-2 rounded-xl border-2 border-omni-dark font-black text-xs flex items-center gap-2 shadow-cartoon-sm transition-all"
                                                    >
                                                        <Footprints size={16}/> DESIGN ROUTE
                                                    </button>
                                                )}

                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedDay(item.day);
                                                        setViewMode('map');
                                                    }}
                                                    className="bg-white hover:bg-omni-yellow px-4 py-2 rounded-xl border-2 border-omni-dark font-black text-xs flex items-center gap-2 shadow-cartoon-sm transition-all"
                                                >
                                                    <Eye size={16}/> MAP
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex flex-row md:flex-col justify-between items-end gap-4">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                                className="w-10 h-10 bg-red-50 hover:bg-red-500 hover:text-white text-red-500 rounded-xl border-2 border-red-200 transition-all flex items-center justify-center"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                            <div className="text-right">
                                                <div className="text-xl font-black">{currencySymbol}{convertPrice(item.costEstimate)}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )})}
                    </div>
                </div>
            ) : (
                <div className="h-full relative flex flex-col">
                    {currentRoute && (
                        <div className="absolute top-4 left-4 z-[500] bg-white/90 backdrop-blur-md p-4 rounded-2xl border-4 border-omni-dark shadow-cartoon-lg max-w-sm animate-in slide-in-from-top-4">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="text-lg font-black leading-tight text-omni-dark flex items-center gap-2">
                                    <Navigation className="text-omni-green" size={20} />
                                    {currentRoute.name}
                                </h3>
                                <button onClick={clearRoute} className="bg-gray-100 hover:bg-red-100 p-1 rounded-lg border-2 border-transparent hover:border-red-300 transition-all">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="flex gap-4 text-xs font-bold text-gray-500 mb-2">
                                <span className="flex items-center gap-1"><Footprints size={12}/> {currentRoute.totalDistance}</span>
                                <span className="flex items-center gap-1"><Timer size={12}/> {currentRoute.estimatedTime}</span>
                            </div>
                            <div className="space-y-2 mt-2 max-h-[150px] overflow-y-auto custom-scrollbar">
                                {currentRoute.waypoints.map((wp, i) => (
                                    <div key={i} className="flex gap-2 items-start text-xs">
                                        <span className="bg-omni-yellow w-5 h-5 rounded-full border border-omni-dark flex items-center justify-center shrink-0 font-black text-[10px]">
                                            {i + 1}
                                        </span>
                                        <div>
                                            <div className="font-bold">{wp.name}</div>
                                            <div className="text-gray-400 leading-tight text-[10px]">{wp.description}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex-1 w-full relative">
                        <MapView items={currentItems} isFullView={true} route={currentRoute} />
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* Deals / Weather Swap Modal */}
      {isDealsModalOpen && (
        <div className="fixed inset-0 z-[100] bg-omni-dark/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl max-h-[85vh] rounded-[2.5rem] border-4 border-omni-dark shadow-cartoon-lg flex flex-col overflow-hidden animate-in zoom-in-95">
             <div className={`p-6 border-b-4 border-omni-dark flex items-center justify-between shrink-0 ${
                 dealMode === 'weather_swap' ? 'bg-blue-100' :
                 dealMode === 'deals' ? 'bg-omni-yellow' : 'bg-omni-blue'
             }`}>
               <div>
                  <h3 className="text-xl md:text-2xl font-black flex items-center gap-2">
                     {dealMode === 'weather_swap' ? <Umbrella className="text-blue-600"/> : dealMode === 'deals' ? <Tag className="text-omni-dark"/> : <Plane className="text-omni-dark"/>}
                     {dealMode === 'deals' ? 'BEST DEALS FOUND' : dealMode === 'weather_swap' ? 'RAINY DAY ALTERNATIVES' : 'ALTERNATIVE OPTIONS'}
                  </h3>
                  <div className="flex flex-col gap-1">
                      <p className="text-xs font-bold opacity-60 uppercase">{currentDealItem?.activity}</p>
                      {currentDealItem?.date && (
                          <div className="inline-flex items-center gap-1 bg-white/40 px-2 py-0.5 rounded-lg border border-omni-dark/10 w-fit">
                              <Calendar size={12} />
                              <span className="text-[10px] font-black">{currentDealItem.date}</span>
                          </div>
                      )}
                  </div>
               </div>
               <button onClick={() => setIsDealsModalOpen(false)} className="w-10 h-10 bg-white border-2 border-omni-dark rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
                  <X size={20}/>
               </button>
             </div>

             {/* Sort Bar */}
             <div className="p-3 bg-white border-b-4 border-omni-dark flex gap-2 overflow-x-auto shrink-0">
                <span className="flex items-center px-3 font-black text-xs text-gray-400 uppercase">Sort by:</span>
                <button 
                  onClick={() => setDealSort('price_asc')}
                  className={`px-3 py-2 rounded-xl border-2 font-black text-xs flex items-center gap-1 transition-all ${dealSort === 'price_asc' ? 'bg-omni-green border-omni-dark shadow-cartoon-sm' : 'border-transparent bg-gray-100'}`}
                >
                  Cheapest First 📉
                </button>
                <button 
                  onClick={() => setDealSort('price_desc')}
                  className={`px-3 py-2 rounded-xl border-2 font-black text-xs flex items-center gap-1 transition-all ${dealSort === 'price_desc' ? 'bg-omni-pink border-omni-dark shadow-cartoon-sm' : 'border-transparent bg-gray-100'}`}
                >
                  Highest First 💎
                </button>
                <button 
                  onClick={() => setDealSort('rating')}
                  className={`px-3 py-2 rounded-xl border-2 font-black text-xs flex items-center gap-1 transition-all ${dealSort === 'rating' ? 'bg-omni-blue border-omni-dark shadow-cartoon-sm' : 'border-transparent bg-gray-100'}`}
                >
                   Best Rated ⭐️
                </button>
             </div>

             <div className="flex-1 overflow-y-auto p-6 bg-gray-50 custom-scrollbar">
                {isLoadingDeals ? (
                    <div className="flex flex-col items-center justify-center py-8">
                        <ThinkingChain 
                            className="bg-transparent border-0 shadow-none scale-90"
                            steps={dealMode === 'weather_swap' ? [
                                "Checking the clouds... 🌧️",
                                "Scanning nearby museums... 🏛️",
                                "Locating cozy cafes... ☕",
                                "Saving your day! 🛡️"
                            ] : [
                                "Checking databases... 📡",
                                "Comparing prices... 🕵️‍♀️",
                                "Verifying details... ✅",
                                "Sorting options... 💎"
                            ]}
                        />
                    </div>
                ) : dealOptions.length > 0 ? (
                    <div className="space-y-4">
                        {sortedDeals.map((deal, idx) => {
                           const isAdded = addedDealIds.has(deal.title + deal.provider);
                           return (
                           <div key={idx} className="bg-white p-4 rounded-2xl border-4 border-omni-dark shadow-cartoon-sm flex flex-col md:flex-row gap-4 hover:translate-x-1 hover:-translate-y-1 transition-transform relative">
                              <div className="flex-1">
                                 <div className="flex justify-between items-start mb-2">
                                    <span className="bg-gray-100 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase text-gray-500 tracking-wider border border-gray-200">
                                        {deal.provider}
                                    </span>
                                    <div className="flex items-center gap-1 bg-omni-yellow/20 px-2 py-0.5 rounded-lg border border-omni-yellow">
                                        <Star size={12} className="fill-omni-dark text-omni-dark"/>
                                        <span className="text-xs font-black">
                                            {/* Adaptive Rating Display */}
                                            {deal.rating > 5 ? `${deal.rating}/10` : `${deal.rating}/5`}
                                        </span>
                                    </div>
                                 </div>
                                 <h4 className="text-lg font-black leading-tight mb-2">{deal.title}</h4>
                                 <p className="text-xs font-bold text-gray-500 mb-3 leading-relaxed">{deal.description}</p>
                              </div>
                              <div className="flex flex-row md:flex-col justify-between items-center md:items-end gap-3 border-t md:border-t-0 md:border-l-2 border-gray-100 pt-3 md:pt-0 md:pl-4">
                                 <div className="text-xl font-black text-omni-dark">
                                    {deal.currency}{deal.price}
                                 </div>
                                 
                                 {/* RESULT ACTION BUTTONS */}
                                 <div className="flex flex-col gap-2 w-full md:w-auto">
                                     
                                     {dealMode === 'weather_swap' ? (
                                         <button 
                                            onClick={() => handleConfirmSwap(deal)}
                                            className="bg-omni-green hover:bg-emerald-300 px-6 py-2 rounded-xl border-2 border-omni-dark font-black text-xs shadow-cartoon-sm active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2 group w-full md:w-32"
                                         >
                                            SWAP IT! <RefreshCw size={14} className="group-hover:rotate-180 transition-transform" />
                                         </button>
                                     ) : (
                                         <button 
                                             onClick={() => handleAddToBudget(deal)}
                                             disabled={isAdded}
                                             className={`px-4 py-2 rounded-xl border-2 font-black text-xs flex items-center justify-center gap-1 shadow-cartoon-sm transition-all w-full md:w-32 ${
                                                 isAdded 
                                                 ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-default' 
                                                 : 'bg-white border-omni-dark hover:bg-omni-yellow active:translate-y-0.5 active:shadow-none'
                                             }`}
                                         >
                                             {isAdded ? <><Check size={12}/> ADDED</> : <><DollarSign size={12}/> ADD TO BUDGET</>}
                                         </button>
                                     )}

                                     <a 
                                        href={deal.url || '#'} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="bg-white hover:bg-gray-50 px-6 py-2 rounded-xl border-2 border-omni-dark font-black text-xs shadow-cartoon-sm active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2 group w-full md:w-32"
                                     >
                                        BOOK/VIEW <ExternalLink size={14} className="group-hover:rotate-45 transition-transform" />
                                     </a>
                                 </div>

                                 {(!deal.url || !deal.url.startsWith('http')) && (
                                     <div className="flex items-center gap-1 text-[10px] text-red-500 font-bold">
                                         <AlertCircle size={10} /> Link might vary
                                     </div>
                                 )}
                              </div>
                           </div>
                        );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <p className="font-black text-gray-400 text-lg">
                           {dealMode === 'deals' ? 'No comparisons found! 😭' : 'No options found! 🛑'}
                        </p>
                        <p className="text-xs font-bold text-gray-400 mt-2">Maybe the schedule is tight?</p>
                    </div>
                )}
             </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[100] bg-omni-dark/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] border-4 border-omni-dark shadow-cartoon-lg flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="p-6 bg-omni-pink border-b-4 border-omni-dark flex items-center justify-between">
              <h3 className="text-2xl font-black flex items-center gap-3"><FileUp /> IMPORT PLAN</h3>
              <button onClick={() => setIsImportModalOpen(false)} className="w-10 h-10 bg-white border-2 border-omni-dark rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"><X size={20}/></button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Strategy Choice */}
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setImportMode('full')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-4 transition-all ${importMode === 'full' ? 'bg-omni-yellow border-omni-dark shadow-cartoon-sm' : 'bg-gray-50 border-gray-200 text-gray-400 opacity-60'}`}
                >
                  <Layout size={24} />
                  <span className="font-black text-xs">REPLACE TRIP</span>
                </button>
                <button 
                  onClick={() => setImportMode('day')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-4 transition-all ${importMode === 'day' ? 'bg-omni-green border-omni-dark shadow-cartoon-sm' : 'bg-gray-50 border-gray-200 text-gray-400 opacity-60'}`}
                >
                  <Layers size={24} />
                  <span className="font-black text-xs text-center">REPLACE DAY {selectedDay}</span>
                </button>
              </div>

              <div className="border-t-2 border-dashed border-gray-200 pt-4">
                <p className="font-black text-sm uppercase text-gray-400 mb-2">Paste text or upload an image 👯‍♀️</p>
                
                <div className="relative mb-4">
                  <textarea 
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="Paste itinerary text here..."
                    className="w-full h-32 p-4 bg-gray-50 border-2 border-omni-dark rounded-2xl font-bold focus:outline-none focus:ring-4 focus:ring-omni-pink transition-all text-sm"
                  />
                  <ClipboardPaste className="absolute right-4 bottom-4 text-gray-300" />
                </div>

                <div className="flex items-center gap-4">
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex-1 py-4 border-2 border-omni-dark rounded-2xl font-black flex items-center justify-center gap-2 transition-all text-xs ${importImage ? 'bg-omni-green' : 'bg-white hover:bg-gray-100'}`}
                  >
                    {importImage ? <><Check size={20} /> IMAGE LOADED</> : <><ImagePlus size={20} /> CHOOSE IMAGE</>}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t-4 border-omni-dark flex gap-4">
              <button 
                onClick={handleImport}
                disabled={isParsing || (!importText.trim() && !importImage)}
                className="flex-1 bg-omni-yellow py-4 rounded-2xl border-4 border-omni-dark font-black text-xl shadow-cartoon active:translate-y-1 transition-all disabled:opacity-50"
              >
                {isParsing ? "READING... 🕵️‍♂️" : `IMPORT & ${importMode === 'full' ? 'START FRESH' : 'PATCH DAY'} ✨`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItineraryView;
