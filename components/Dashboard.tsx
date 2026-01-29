
import React, { useState, useEffect, useMemo } from 'react';
import { TripBudget, SavedTicket, CarRentalOption, InsuranceOption, VisaRequirement, VisaFormData, ESimOption, FriendMember, IntercomState, ItineraryItem, WeatherData } from '../types';
import { 
    Wallet, ShieldCheck, Car, Smartphone, Users, Share2, MapPin, Radio, Search, 
    Star, Calendar, CheckCircle, Fuel, Users as UsersIcon, Gauge,
    ExternalLink, X, Globe, HeartPulse, Stamp, Download, Lock, Loader2, Wifi, Zap, ChevronDown, ChevronUp, Mic, UserPlus, Settings, PieChart, Volume2, VolumeX, Copy, Link, List, Trash2, Edit3, ClipboardCheck, Sparkles, Printer, FileText, FileJson
} from 'lucide-react';
import { findCarRentals, findInsuranceOptions, checkVisaRequirements, findESimOptions } from '../services/geminiService';
import { getTripContextForExtras, ExtrasContext } from '../services/extrasService'; 
import { useDocuments } from '../contexts/DocumentContext'; 
import { useBudget } from '../contexts/BudgetContext'; 
import { prepareExportData, downloadJSON, copyToClipboard, printVisaDraft } from '../services/exportService'; 
import ThinkingChain from './ThinkingChain';
import MapView from './MapView';
import BudgetControl, { AddToBudgetButton } from './BudgetControl'; 
import WeatherWidget from './WeatherWidget'; // NEW IMPORT

interface DashboardProps {
    segmentId: string; 
    scheduleItems: ItineraryItem[]; 
    tickets: SavedTicket[];
    language: string;
    convertPrice: (usd: number) => number;
    currencySymbol: string;
    tripName?: string;
    startDate?: string;
    endDate?: string;
    weatherData: WeatherData[]; // NEW PROP
    onWeatherSimulate: (date: string, condition: WeatherData['condition']) => void; // NEW PROP
}

// --- REUSABLE UI COMPONENTS ---

const KeyValueRow = ({ label, value, onEdit }: { label: string, value: string | number, onEdit?: () => void }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
        <span className="text-[10px] font-black uppercase text-gray-400">{label}</span>
        <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-omni-dark truncate max-w-[150px]">{value}</span>
            {onEdit && (
                <button onClick={onEdit} className="text-gray-300 hover:text-omni-blue transition-colors">
                    <Edit3 size={12} />
                </button>
            )}
        </div>
    </div>
);

const TripSummaryBar = ({ 
    title, 
    details, 
    icon: Icon, 
    isEditing, 
    onToggleEdit,
    onClose
}: { 
    title: string, 
    details: string, 
    icon: any, 
    isEditing: boolean, 
    onToggleEdit: () => void,
    onClose: () => void
}) => (
    <div className="bg-omni-yellow p-4 border-b-4 border-omni-dark flex flex-col gap-2 transition-all">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-10 h-10 bg-white rounded-full border-2 border-omni-dark flex items-center justify-center shrink-0">
                     <Icon size={20} className="text-omni-dark" />
                </div>
                <div className="flex flex-col">
                    <h3 className="text-lg font-black text-omni-dark leading-none uppercase">{title}</h3>
                    {!isEditing && (
                        <p className="text-xs font-bold text-omni-dark/60 truncate mt-1">
                            {details || "Select details..."}
                        </p>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button 
                    onClick={onToggleEdit}
                    className="bg-white/50 hover:bg-white p-2 rounded-xl border-2 border-omni-dark transition-all text-xs font-black flex items-center gap-1"
                >
                    {isEditing ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                    {isEditing ? "HIDE" : "EDIT"}
                </button>
                <button onClick={onClose} className="w-8 h-8 bg-white border-2 border-omni-dark rounded-full flex items-center justify-center hover:bg-gray-100">
                    <X size={16} />
                </button>
            </div>
        </div>
    </div>
);

const Dashboard: React.FC<DashboardProps> = ({ segmentId, scheduleItems, tickets, language, convertPrice, currencySymbol, tripName, startDate, endDate, weatherData, onWeatherSimulate }) => {
    // --- LAYOUT & SQUAD TRACK STATE ---
    const [userLocation, setUserLocation] = useState<{ lat: number, lng: number, accuracy?: number } | null>(null);
    const [geoPermission, setGeoPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
    const [friends, setFriends] = useState<FriendMember[]>([
        { id: 'f1', name: 'Sarah', status: 'active', avatarColor: '#fbcfe8', lastUpdated: '1m ago', lat: 34.0522, lng: -118.2437 },
        { id: 'f2', name: 'Mike', status: 'offline', avatarColor: '#bae6fd', lastUpdated: '1h ago', lat: 34.0622, lng: -118.2537 },
    ]);
    const [intercom, setIntercom] = useState<IntercomState>({ isEnabled: false, isTalking: false, currentSpeakerId: null, volume: 80 });
    const [isSquadExpanded, setIsSquadExpanded] = useState(false);
    const [isSquadListOpen, setIsSquadListOpen] = useState(false);
    const [inviteLink, setInviteLink] = useState<string | null>(null);

    // --- BUDGET STATE ---
    const { getAccounting } = useBudget(); // Use global store
    // Compute accounting on render or effect
    const accounting = useMemo(() => getAccounting(segmentId, scheduleItems), [segmentId, scheduleItems, getAccounting]);
    const [isBudgetDrawerOpen, setIsBudgetDrawerOpen] = useState(false);
    
    // Percent for progress bar
    const spentPercentage = Math.min((accounting.spentTotal / accounting.totalBudget) * 100, 100);

    // --- EXTRAS STATE ---
    const [activeModule, setActiveModule] = useState<'car' | 'insurance' | 'esim' | 'visa' | 'invite' | null>(null);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    
    // Trip Context Overrides (Persisted)
    const [extrasOverrides, setExtrasOverrides] = useState<Partial<ExtrasContext>>({});

    useEffect(() => {
        const saved = localStorage.getItem(`omnitrip_extras_${segmentId}`);
        if (saved) setExtrasOverrides(JSON.parse(saved));
    }, [segmentId]);

    const saveOverride = (updates: Partial<ExtrasContext>) => {
        const newer = { ...extrasOverrides, ...updates };
        setExtrasOverrides(newer);
        localStorage.setItem(`omnitrip_extras_${segmentId}`, JSON.stringify(newer));
    };

    // Calculate Context
    const tripContext = useMemo(() => 
        getTripContextForExtras(segmentId, scheduleItems, tripName || "Trip", startDate, endDate, extrasOverrides),
    [segmentId, scheduleItems, tripName, startDate, endDate, extrasOverrides]);

    // Feature Data States
    const [carOptions, setCarOptions] = useState<CarRentalOption[]>([]);
    const [insuranceOptions, setInsuranceOptions] = useState<InsuranceOption[]>([]);
    const [esimOptions, setEsimOptions] = useState<ESimOption[]>([]);
    const [visaRequirement, setVisaRequirement] = useState<VisaRequirement | null>(null);
    
    // Loaders
    const [loadingState, setLoadingState] = useState({ car: false, insurance: false, esim: false, visa: false });

    // Search Params & Forms
    const [carParams, setCarParams] = useState({ loc: "", start: "", end: "", age: 25 });
    const [insParams, setInsParams] = useState({ dest: "", start: "", end: "", travelers: 1 });
    const [esimParams, setEsimParams] = useState({ dest: "", days: 7, data: "5GB", type: "Data Only", hotspot: false });
    const [visaParams, setVisaParams] = useState({ from: "United States", to: "" });
    
    // Visa Autofill Form
    const [isDraftingVisa, setIsDraftingVisa] = useState(false);
    const [visaForm, setVisaForm] = useState<VisaFormData | null>(null);
    const [exportConfirmType, setExportConfirmType] = useState<'json' | 'pdf' | 'copy' | null>(null);

    // Context Hooks
    const { getAutofillProfile } = useDocuments();

    // --- GEOLOCATION EFFECT ---
    useEffect(() => {
        let watchId: number;
        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
                    setGeoPermission('granted');
                    // Mock: Move "Active" friends
                    setFriends(prev => prev.map(f => f.status === 'active' ? {
                        ...f,
                        lat: pos.coords.latitude + (Math.random() - 0.5) * 0.01,
                        lng: pos.coords.longitude + (Math.random() - 0.5) * 0.01
                    } : f));
                },
                (err) => { console.warn("Geo error", err); setGeoPermission('denied'); },
                { enableHighAccuracy: true }
            );
        }
        return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
    }, []);

    // --- INTERCOM LOOP ---
    useEffect(() => {
        if (!intercom.isEnabled) return;
        const interval = setInterval(() => {
            if (!intercom.isTalking && !intercom.currentSpeakerId && Math.random() > 0.8) {
                const speaker = friends.find(f => f.status === 'active');
                if (speaker) {
                    setIntercom(prev => ({ ...prev, currentSpeakerId: speaker.id }));
                    setTimeout(() => setIntercom(prev => ({ ...prev, currentSpeakerId: null })), 3000);
                }
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [intercom.isEnabled, intercom.isTalking, friends]);

    // --- MODULE HANDLERS ---

    const handleCarClick = () => {
        setActiveModule('car');
        setCarParams({ 
            loc: tripContext.destinationCity, 
            start: tripContext.startDate || "", 
            end: tripContext.endDate || "", 
            age: 25 
        });
        
        if (tripContext.destinationCity && tripContext.destinationCity !== 'Unknown Destination') {
            setIsSearchExpanded(false);
            runCarSearch({ 
                loc: tripContext.destinationCity, 
                start: tripContext.startDate, 
                end: tripContext.endDate || tripContext.startDate, 
                age: 25 
            });
        } else {
            setIsSearchExpanded(true);
        }
    };

    const handleInsuranceClick = () => {
        setActiveModule('insurance');
        setInsParams({ 
            dest: tripContext.destinationCity, 
            start: tripContext.startDate, 
            end: tripContext.endDate || "", 
            travelers: tripContext.travelers 
        });

        if (tripContext.destinationCity && tripContext.destinationCity !== 'Unknown Destination') {
            setIsSearchExpanded(false);
            runInsuranceSearch({ 
                dest: tripContext.destinationCity, 
                start: tripContext.startDate, 
                end: tripContext.endDate || tripContext.startDate, 
                travelers: tripContext.travelers 
            });
        } else {
            setIsSearchExpanded(true);
        }
    };

    const handleEsimClick = () => {
        setActiveModule('esim');
        // Calc days
        let d = 7;
        if (tripContext.startDate && tripContext.endDate) {
            const s = new Date(tripContext.startDate);
            const e = new Date(tripContext.endDate);
            d = Math.ceil((e.getTime() - s.getTime()) / (1000 * 3600 * 24));
        }
        setEsimParams(p => ({ ...p, dest: tripContext.destinationCity, days: d > 0 ? d : 7 }));
        
        if (tripContext.destinationCity && tripContext.destinationCity !== 'Unknown Destination') {
            setIsSearchExpanded(false);
            runEsimSearch({ ...esimParams, dest: tripContext.destinationCity, days: d > 0 ? d : 7 });
        } else {
            setIsSearchExpanded(true);
        }
    };

    const handleVisaClick = () => {
        setActiveModule('visa');
        setVisaParams(p => ({ ...p, to: tripContext.destinationCity }));
        if (tripContext.destinationCity && tripContext.destinationCity !== 'Unknown Destination') {
            setIsSearchExpanded(false);
            runVisaCheck(visaParams.from, tripContext.destinationCity);
        } else {
            setIsSearchExpanded(true);
        }
    };

    // --- SEARCH FUNCTIONS ---

    const runCarSearch = async (params = carParams) => {
        setLoadingState(p => ({...p, car: true}));
        setCarOptions([]);
        try { 
            const results = await findCarRentals(params.loc, params.start, params.end, params.age, accounting.currency); 
            setCarOptions(results);
        } 
        finally { setLoadingState(p => ({...p, car: false})); }
    };

    const runInsuranceSearch = async (params = insParams) => {
        setLoadingState(p => ({...p, insurance: true}));
        setInsuranceOptions([]);
        try {
            const results = await findInsuranceOptions(params.dest, params.start, params.end, params.travelers, accounting.currency);
            setInsuranceOptions(results);
        }
        finally { setLoadingState(p => ({...p, insurance: false})); }
    };

    const runEsimSearch = async (params = esimParams) => {
        setLoadingState(p => ({...p, esim: true}));
        setEsimOptions([]);
        try {
            const results = await findESimOptions(params.dest, params.days, params.data, accounting.currency, {
                planType: params.type,
                hotspot: params.hotspot,
                activation: 'Any'
            });
            setEsimOptions(results);
        }
        finally { setLoadingState(p => ({...p, esim: false})); }
    };

    const runVisaCheck = async (from: string, to: string) => {
        setLoadingState(p => ({...p, visa: true}));
        setVisaRequirement(null);
        try {
            const result = await checkVisaRequirements(from, to);
            setVisaRequirement(result);
        }
        finally { setLoadingState(p => ({...p, visa: false})); }
    };

    const handleDraftVisa = () => {
        setIsDraftingVisa(true);
        const sharedProfile = getAutofillProfile();
        
        setTimeout(() => {
            setVisaForm({
                fullName: sharedProfile?.fullName || "Alex Traveler (Demo)",
                passportNumber: sharedProfile?.passportNumber || "A12345678",
                nationality: sharedProfile?.nationality || visaParams.from,
                dateOfBirth: sharedProfile?.dateOfBirth || "1995-06-15",
                tripStartDate: tripContext.startDate,
                tripEndDate: tripContext.endDate || "",
                accommodationAddress: "Grand Hotel, " + visaParams.to,
                purpose: "Tourism",
                sources: {
                    fullName: sharedProfile?.fullName ? 'passport_doc' : 'manual',
                    passportNumber: sharedProfile?.passportNumber ? 'passport_doc' : 'manual',
                    nationality: sharedProfile?.nationality ? 'passport_doc' : 'manual',
                    dateOfBirth: sharedProfile?.dateOfBirth ? 'passport_doc' : 'manual'
                }
            });
            setIsDraftingVisa(false);
        }, 1500);
    };

    // --- EXPORT HANDLERS ---
    
    const triggerExport = (type: 'json' | 'pdf' | 'copy') => {
        if (!visaForm) return;
        setExportConfirmType(type);
    };

    const executeExport = async () => {
        if (!visaForm || !exportConfirmType) return;
        const data = prepareExportData(visaForm);
        const filename = `omni-visa-draft_${visaParams.to.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`;

        switch (exportConfirmType) {
            case 'json':
                downloadJSON(data, `${filename}.json`);
                break;
            case 'pdf':
                printVisaDraft(data);
                break;
            case 'copy':
                const success = await copyToClipboard(data);
                if (success) alert("Copied to clipboard!");
                break;
        }
        setExportConfirmType(null);
    };

    const SourceChip = ({ source }: { source?: string }) => {
        if (source === 'passport_doc') {
            return <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded border border-green-300 font-bold ml-2">Verified Passport ✅</span>;
        }
        return null;
    };

    // --- SQUAD ACTIONS ---
    const generateInvite = () => { setInviteLink(`omnitrip.app/join/${Math.random().toString(36).substring(7)}`); setActiveModule('invite'); };
    const simulateAcceptInvite = () => {
        setFriends(prev => [...prev, { id: `f-${Date.now()}`, name: "New Guest", status: "active", avatarColor: "#bbf7d0", lastUpdated: "Just now", lat: userLocation ? userLocation.lat + 0.002 : 34.05, lng: userLocation ? userLocation.lng + 0.002 : -118.24 }]);
        setActiveModule(null);
    };
    const removeFriend = (id: string) => { if (window.confirm("Remove friend?")) setFriends(prev => prev.filter(f => f.id !== id)); };
    const toggleIntercom = () => setIntercom(prev => ({ ...prev, isEnabled: !prev.isEnabled, currentSpeakerId: null }));
    const startTalking = () => intercom.isEnabled && setIntercom(prev => ({ ...prev, isTalking: true, currentSpeakerId: 'me' }));
    const stopTalking = () => setIntercom(prev => ({ ...prev, isTalking: false, currentSpeakerId: null }));

    return (
        <div className="h-full flex flex-col gap-4 overflow-hidden relative">
            
            {/* --- TOP ROW: SQUAD TRACK (65% Width) & WEATHER (35% Width) --- */}
            <div className="flex-[1.2] min-h-0 flex gap-4">
                {/* Squad Map */}
                <div className={`flex-[2] bg-white rounded-3xl border-4 border-omni-dark shadow-cartoon relative overflow-hidden flex flex-col transition-all ${isSquadExpanded ? 'absolute inset-0 z-50 w-full h-full' : ''}`}>
                    <div className="absolute top-4 left-4 right-4 z-[400] flex justify-between items-start pointer-events-none">
                        <div onClick={() => setIsSquadListOpen(true)} className="bg-white/90 backdrop-blur px-4 py-2 rounded-2xl border-2 border-omni-dark shadow-cartoon-sm pointer-events-auto flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform">
                            <Users className="text-omni-blue" size={20} />
                            <div><h2 className="text-sm font-black text-omni-dark leading-none">SQUAD TRACK</h2><p className="text-[10px] font-bold text-gray-500">{friends.length} Active • {geoPermission === 'granted' ? 'GPS On' : 'GPS Off'}</p></div>
                        </div>
                        <div className="flex gap-2 pointer-events-auto">
                            <button onClick={() => setIsSquadListOpen(!isSquadListOpen)} className={`p-2 rounded-xl border-2 border-omni-dark shadow-cartoon-sm transition-all ${isSquadListOpen ? 'bg-omni-yellow' : 'bg-white hover:bg-gray-100'}`}><List size={20} /></button>
                            <button onClick={() => setIsSquadExpanded(!isSquadExpanded)} className="bg-white p-2 rounded-xl border-2 border-omni-dark shadow-cartoon-sm hover:bg-gray-100">{isSquadExpanded ? <ChevronDown size={20}/> : <ExternalLink size={20}/>}</button>
                        </div>
                    </div>

                    {isSquadListOpen && (
                        <div className="absolute top-20 left-4 z-[400] w-64 bg-white/95 backdrop-blur rounded-2xl border-4 border-omni-dark shadow-cartoon-lg p-4 animate-in slide-in-from-left-4 pointer-events-auto">
                            <div className="flex justify-between items-center mb-3 border-b-2 border-gray-100 pb-2"><h3 className="font-black text-xs uppercase text-gray-400">Team Members</h3><button onClick={() => setIsSquadListOpen(false)}><X size={16} /></button></div>
                            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">{friends.map(f => (<div key={f.id} className="flex items-center justify-between bg-gray-50 p-2 rounded-xl border border-gray-200"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full border border-omni-dark flex items-center justify-center font-bold text-[10px]" style={{backgroundColor: f.avatarColor}}>{f.name.charAt(0)}</div><div><p className="text-xs font-black leading-none">{f.name}</p><p className="text-[8px] font-bold text-gray-400">{f.status}</p></div></div><button onClick={() => removeFriend(f.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button></div>))}</div>
                            <button onClick={() => { setIsSquadListOpen(false); generateInvite(); }} className="w-full mt-3 bg-omni-green border-2 border-omni-dark rounded-xl py-2 font-black text-xs flex items-center justify-center gap-2 hover:bg-emerald-300 shadow-sm active:translate-y-0.5"><UserPlus size={14} /> INVITE NEW</button>
                        </div>
                    )}

                    <div className="flex-1 relative bg-gray-100"><MapView squadMembers={friends} userLocation={userLocation} />
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[400] flex flex-col items-center gap-2 pointer-events-auto w-full max-w-xs px-4">
                            {intercom.currentSpeakerId && (<div className="bg-black/80 backdrop-blur text-white px-4 py-2 rounded-full text-xs font-bold animate-in slide-in-from-bottom-2 mb-2 flex items-center gap-2"><div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"/>{intercom.currentSpeakerId === 'me' ? 'You are speaking...' : `${friends.find(f => f.id === intercom.currentSpeakerId)?.name} is speaking...`}</div>)}
                            <div className="flex items-center gap-4 w-full justify-center">
                                <button onClick={toggleIntercom} className={`w-12 h-12 rounded-full border-4 border-omni-dark flex items-center justify-center transition-all shadow-cartoon-sm ${intercom.isEnabled ? 'bg-white' : 'bg-gray-200'}`}>{intercom.isEnabled ? <Volume2 size={20} className="text-green-600"/> : <VolumeX size={20} className="text-gray-500"/>}</button>
                                <button onMouseDown={startTalking} onMouseUp={stopTalking} onMouseLeave={stopTalking} onTouchStart={startTalking} onTouchEnd={stopTalking} disabled={!intercom.isEnabled} className={`flex-1 h-16 rounded-full border-4 border-omni-dark font-black text-sm flex items-center justify-center gap-2 shadow-cartoon active:translate-y-1 active:shadow-none transition-all ${intercom.isEnabled ? 'bg-omni-yellow hover:bg-yellow-300 text-omni-dark cursor-pointer' : 'bg-gray-300 text-gray-500 cursor-not-allowed border-gray-400'}`}><Mic size={24} className={intercom.isTalking ? "animate-ping" : ""} />{intercom.isEnabled ? (intercom.isTalking ? "RELEASE" : "HOLD TO TALK") : "OFFLINE"}</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Weather Widget */}
                <div className="flex-1 hidden md:block">
                    <WeatherWidget 
                        weatherData={weatherData} 
                        onSimulateChange={onWeatherSimulate} 
                        locationName={tripContext.destinationCity || 'Unknown'} 
                    />
                </div>
            </div>

            {/* --- BOTTOM ROW: BUDGET & EXTRAS (45% Height) --- */}
            <div className="flex-1 min-h-0 flex gap-4">
                <div className="flex-1 bg-white rounded-3xl border-4 border-omni-dark shadow-cartoon overflow-hidden flex flex-col relative group cursor-pointer hover:scale-[1.01] transition-transform" onClick={() => setIsBudgetDrawerOpen(true)}>
                    <div className="p-4 bg-gray-50 border-b-2 border-omni-dark flex justify-between items-center"><h3 className="font-black text-omni-dark flex items-center gap-2"><Wallet size={18} className="text-omni-green"/> BUDGET CONTROL</h3><span className="text-[10px] font-bold bg-white px-2 py-1 rounded border border-gray-300">OPEN</span></div>
                    <div className="p-4 flex-1 flex flex-col justify-center">
                        <div className="text-3xl font-black text-omni-dark mb-1">{currencySymbol}{convertPrice(accounting.remaining)}</div>
                        <p className="text-xs font-bold text-gray-400 uppercase mb-4">Remaining</p>
                        <div className="w-full h-4 bg-gray-200 rounded-full border-2 border-omni-dark overflow-hidden relative">
                            <div className={`h-full transition-all duration-1000 ${spentPercentage > 90 ? 'bg-red-400' : 'bg-omni-green'}`} style={{ width: `${spentPercentage}%` }} />
                        </div>
                        <div className="flex justify-between mt-2 text-[10px] font-black text-gray-400">
                            <span>Spent: {currencySymbol}{convertPrice(accounting.spentTotal)}</span>
                            <span>Limit: {currencySymbol}{convertPrice(accounting.totalBudget)}</span>
                        </div>
                    </div>
                </div>
                <div className="flex-1 bg-omni-yellow rounded-3xl border-4 border-omni-dark shadow-cartoon overflow-hidden flex flex-col">
                    <div className="p-4 bg-omni-yellow border-b-2 border-omni-dark/20"><h3 className="font-black text-omni-dark flex items-center gap-2">EXTRAS ✨</h3></div>
                    <div className="flex-1 p-3 grid grid-cols-2 gap-2 overflow-y-auto custom-scrollbar">
                        <button onClick={handleInsuranceClick} className="bg-white rounded-xl border-2 border-omni-dark flex flex-col items-center justify-center p-2 hover:bg-blue-50 transition-colors"><ShieldCheck size={20} className="text-blue-500 mb-1"/><span className="text-[10px] font-black uppercase">Safety</span></button>
                        <button onClick={handleVisaClick} className="bg-white rounded-xl border-2 border-omni-dark flex flex-col items-center justify-center p-2 hover:bg-red-50 transition-colors"><Stamp size={20} className="text-red-500 mb-1"/><span className="text-[10px] font-black uppercase">Visa</span></button>
                        <button onClick={handleCarClick} className="bg-white rounded-xl border-2 border-omni-dark flex flex-col items-center justify-center p-2 hover:bg-orange-50 transition-colors"><Car size={20} className="text-orange-500 mb-1"/><span className="text-[10px] font-black uppercase">Cars</span></button>
                        <button onClick={handleEsimClick} className="bg-white rounded-xl border-2 border-omni-dark flex flex-col items-center justify-center p-2 hover:bg-purple-50 transition-colors"><Smartphone size={20} className="text-purple-500 mb-1"/><span className="text-[10px] font-black uppercase">eSIM</span></button>
                    </div>
                </div>
            </div>

            {/* --- MODALS --- */}
            
            {/* BUDGET DRAWER (Renamed/Replaced) */}
            <BudgetControl 
                segmentId={segmentId} 
                scheduleItems={scheduleItems}
                isOpen={isBudgetDrawerOpen} 
                onClose={() => setIsBudgetDrawerOpen(false)}
                currencySymbol={currencySymbol}
                convertPrice={convertPrice}
            />

            {/* EXPORT CONFIRMATION MODAL */}
            {exportConfirmType && (
                <div className="fixed inset-0 z-[600] bg-omni-dark/60 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="bg-white w-full max-w-sm rounded-3xl border-4 border-omni-dark shadow-cartoon p-6 animate-in zoom-in-95">
                        <div className="flex flex-col items-center text-center mb-6">
                            <div className="w-16 h-16 bg-red-100 rounded-full border-4 border-red-200 flex items-center justify-center mb-4">
                                <Lock size={32} className="text-red-500" />
                            </div>
                            <h3 className="text-xl font-black mb-2">Privacy Check 🔒</h3>
                            <p className="text-sm font-bold text-gray-500">
                                This file contains personal information. <br/>
                                Only export if you trust this device!
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setExportConfirmType(null)} 
                                className="flex-1 py-3 font-black text-gray-400 hover:bg-gray-50 rounded-xl"
                            >
                                CANCEL
                            </button>
                            <button 
                                onClick={executeExport} 
                                className="flex-1 bg-omni-dark text-white py-3 rounded-xl font-black shadow-cartoon-sm active:translate-y-1 hover:bg-gray-800"
                            >
                                EXPORT
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* INVITE */}
            {activeModule === 'invite' && (
                <div className="fixed inset-0 z-[500] bg-omni-dark/40 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="bg-white w-full max-w-sm rounded-3xl border-4 border-omni-dark shadow-cartoon p-6 text-center animate-in zoom-in-95">
                        <h3 className="text-xl font-black mb-2">INVITE SQUAD 👯‍♀️</h3>
                        <p className="text-xs font-bold text-gray-500 mb-4">Share this link to let them track you live!</p>
                        <div className="bg-gray-100 p-3 rounded-xl border-2 border-gray-300 flex items-center justify-between mb-4"><span className="text-xs font-mono truncate">{inviteLink}</span><button className="text-omni-dark hover:text-blue-500"><Copy size={16}/></button></div>
                        <div className="flex gap-2"><button onClick={() => setActiveModule(null)} className="flex-1 py-3 font-black text-gray-400">CLOSE</button><button onClick={simulateAcceptInvite} className="flex-1 bg-omni-green py-3 rounded-xl border-2 border-omni-dark font-black shadow-cartoon-sm active:translate-y-1">SIMULATE JOIN</button></div>
                    </div>
                </div>
            )}

            {/* --- CAR RENTAL MODAL (WITH ADD TO BUDGET) --- */}
            {activeModule === 'car' && (
                <div className="fixed inset-0 z-[500] bg-omni-dark/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-4xl h-[85vh] rounded-[2.5rem] border-4 border-omni-dark shadow-cartoon-lg flex flex-col overflow-hidden animate-in zoom-in-95">
                        <TripSummaryBar title="RENT A RIDE" icon={Car} details={carOptions.length > 0 ? `${carParams.loc} • ${carOptions.length} Options` : "Search for cars..."} isEditing={isSearchExpanded} onToggleEdit={() => setIsSearchExpanded(!isSearchExpanded)} onClose={() => setActiveModule(null)} />
                        {isSearchExpanded && (
                            <div className="bg-gray-50 p-4 border-b-4 border-omni-dark flex flex-col gap-4 animate-in slide-in-from-top-2">
                                {/* Labeled Rows for Context */}
                                <div className="bg-white p-3 rounded-xl border-2 border-gray-200 mb-2">
                                    <KeyValueRow 
                                        label="Pick-Up Location" 
                                        value={tripContext.destinationCity} 
                                        onEdit={() => {
                                            const newCity = prompt("Enter city override:", tripContext.destinationCity);
                                            if (newCity) saveOverride({ destinationCity: newCity });
                                        }}
                                    />
                                    <KeyValueRow label="Dates" value={`${tripContext.startDate} - ${tripContext.endDate || '?'}`} />
                                </div>

                                <div className="flex flex-col md:flex-row gap-2">
                                    <div className="flex-1"><label className="text-[10px] font-black uppercase text-gray-400 ml-1">Search Location</label><input value={carParams.loc} onChange={(e) => setCarParams(p => ({...p, loc: e.target.value}))} className="w-full px-4 py-2 rounded-xl border-2 border-omni-dark font-bold text-sm" placeholder="City" /></div>
                                    <div className="w-32"><label className="text-[10px] font-black uppercase text-gray-400 ml-1">Age</label><input type="number" value={carParams.age} onChange={(e) => setCarParams(p => ({...p, age: Number(e.target.value)}))} className="w-full px-4 py-2 rounded-xl border-2 border-omni-dark font-bold text-sm" /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-[10px] font-black uppercase text-gray-400 ml-1">Pick-up</label><input type="date" value={carParams.start} onChange={e => setCarParams(p => ({...p, start: e.target.value}))} className="w-full p-2 rounded-xl border-2 border-omni-dark text-xs font-bold" /></div>
                                    <div><label className="text-[10px] font-black uppercase text-gray-400 ml-1">Drop-off</label><input type="date" value={carParams.end} onChange={e => setCarParams(p => ({...p, end: e.target.value}))} className="w-full p-2 rounded-xl border-2 border-omni-dark text-xs font-bold" /></div>
                                </div>
                                <button onClick={() => { setIsSearchExpanded(false); runCarSearch(); }} className="bg-omni-dark text-white px-6 py-3 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-gray-700 active:scale-95 transition-all w-full"><Search size={18} /> SEARCH CARS</button>
                            </div>
                        )}
                        <div className="flex-1 overflow-y-auto bg-gray-50 p-4 custom-scrollbar">
                            {loadingState.car ? <div className="py-12 flex justify-center"><ThinkingChain steps={["Checking garages...", "Comparing rates...", "Polishing wheels..."]} /></div> : carOptions.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{carOptions.map(car => (
                                    <div key={car.id} className="bg-white rounded-3xl border-4 border-omni-dark shadow-cartoon-sm p-4 relative">
                                        <h4 className="font-black">{car.carModel}</h4>
                                        <p className="text-sm mb-4">{car.provider} • {currencySymbol}{convertPrice(car.pricePerDay)}/day</p>
                                        <div className="absolute bottom-4 right-4">
                                            <AddToBudgetButton 
                                                segmentId={segmentId}
                                                item={{
                                                    title: `${car.carModel} Rental`,
                                                    providerName: car.provider,
                                                    amount: car.pricePerDay * 3, // Mock duration calc
                                                    currency: car.currency,
                                                    type: 'transport',
                                                    source: 'extras'
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}</div>
                            ) : <div className="text-center py-12 text-gray-400 font-black">Enter trip details to find cars!</div>}
                        </div>
                    </div>
                </div>
            )}

            {/* --- INSURANCE MODAL (WITH ADD TO BUDGET) --- */}
            {activeModule === 'insurance' && (
                <div className="fixed inset-0 z-[500] bg-omni-dark/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-4xl h-[85vh] rounded-[2.5rem] border-4 border-omni-dark shadow-cartoon-lg flex flex-col overflow-hidden animate-in zoom-in-95">
                        <TripSummaryBar title="TRAVEL SAFETY" icon={ShieldCheck} details={insuranceOptions.length > 0 ? `${insParams.dest} • ${insParams.travelers} Pax` : "Get protected..."} isEditing={isSearchExpanded} onToggleEdit={() => setIsSearchExpanded(!isSearchExpanded)} onClose={() => setActiveModule(null)} />
                        {isSearchExpanded && (
                            <div className="bg-blue-50 p-4 border-b-4 border-omni-dark flex flex-col gap-4 animate-in slide-in-from-top-2">
                                
                                {/* LABELED SUMMARY BLOCK */}
                                <div className="bg-white p-4 rounded-xl border-2 border-omni-dark shadow-sm">
                                    <KeyValueRow 
                                        label="Destination" 
                                        value={tripContext.destinationCity} 
                                        onEdit={() => {
                                            const newCity = prompt("Override destination city:", tripContext.destinationCity);
                                            if (newCity) saveOverride({ destinationCity: newCity });
                                        }}
                                    />
                                    <KeyValueRow 
                                        label="Travelers" 
                                        value={tripContext.travelers} 
                                        onEdit={() => {
                                            const newNum = prompt("Number of travelers:", tripContext.travelers.toString());
                                            if (newNum && !isNaN(parseInt(newNum))) saveOverride({ travelers: parseInt(newNum) });
                                        }}
                                    />
                                    <KeyValueRow label="Dates" value={`${tripContext.startDate} - ${tripContext.endDate || '?'}`} />
                                    {tripContext.isCityEstimated && (
                                        <p className="text-[10px] text-orange-500 font-bold mt-1">* Destination inferred. Edit if needed.</p>
                                    )}
                                </div>

                                <div className="flex gap-2"><input value={insParams.dest} onChange={e => setInsParams(p => ({...p, dest: e.target.value}))} className="flex-1 px-4 py-2 rounded-xl border-2 border-omni-dark font-bold text-sm" placeholder="Dest" /><input type="number" value={insParams.travelers} onChange={e => setInsParams(p => ({...p, travelers: Number(e.target.value)}))} className="w-20 px-4 py-2 rounded-xl border-2 border-omni-dark font-bold text-sm" placeholder="Pax" /></div>
                                <button onClick={() => { setIsSearchExpanded(false); runInsuranceSearch(); }} className="bg-omni-dark text-white px-6 py-3 rounded-xl font-black w-full">FIND PLANS</button>
                            </div>
                        )}
                        <div className="flex-1 overflow-y-auto bg-gray-50 p-4 custom-scrollbar">
                            {loadingState.insurance ? <div className="py-12 flex justify-center"><ThinkingChain steps={["Assessing risks...", "Calculating premiums...", "Checking hospitals..."]} /></div> : insuranceOptions.length > 0 ? insuranceOptions.map((opt, i) => (
                                <div key={i} className="bg-white p-4 mb-4 rounded-3xl border-4 border-omni-dark shadow-cartoon-sm flex justify-between items-center">
                                    <div>
                                        <div className="font-black">{opt.planName}</div>
                                        <div className="text-xs text-gray-500">{opt.providerName}</div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="font-black text-xl">{currencySymbol}{convertPrice(opt.priceEstimate)}</div>
                                        <AddToBudgetButton 
                                            segmentId={segmentId}
                                            item={{
                                                title: `${opt.planName} Insurance`,
                                                providerName: opt.providerName,
                                                amount: opt.priceEstimate,
                                                currency: opt.currency,
                                                type: 'insurance',
                                                source: 'extras'
                                            }}
                                        />
                                    </div>
                                </div>
                            )) : <div className="text-center py-12 text-gray-400 font-black">Search to see plans.</div>}
                        </div>
                    </div>
                </div>
            )}

            {/* --- VISA MODAL --- */}
            {activeModule === 'visa' && (
                <div className="fixed inset-0 z-[500] bg-omni-dark/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] border-4 border-omni-dark shadow-cartoon-lg flex flex-col overflow-hidden animate-in zoom-in-95">
                        <TripSummaryBar title="VISA CHECK" icon={Stamp} details={visaRequirement ? `${visaRequirement.status} • ${visaParams.to}` : "Check requirements..."} isEditing={isSearchExpanded} onToggleEdit={() => setIsSearchExpanded(!isSearchExpanded)} onClose={() => setActiveModule(null)} />
                        
                        {isSearchExpanded && (
                            <div className="bg-red-50 p-6 border-b-4 border-omni-dark flex flex-col gap-4">
                                {/* Context Summary */}
                                <div className="bg-white p-3 rounded-xl border-2 border-red-200 mb-2">
                                    <KeyValueRow 
                                        label="Target Destination" 
                                        value={tripContext.destinationCity} 
                                        onEdit={() => {
                                            const newCity = prompt("Override destination:", tripContext.destinationCity);
                                            if (newCity) saveOverride({ destinationCity: newCity });
                                        }}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-[10px] font-black uppercase text-gray-400 ml-1">Passport</label><input value={visaParams.from} onChange={e => setVisaParams(p => ({...p, from: e.target.value}))} className="w-full p-3 border-2 border-omni-dark rounded-xl font-bold" /></div>
                                    <div><label className="text-[10px] font-black uppercase text-gray-400 ml-1">Destination</label><input value={visaParams.to} onChange={e => setVisaParams(p => ({...p, to: e.target.value}))} className="w-full p-3 border-2 border-omni-dark rounded-xl font-bold" /></div>
                                </div>
                                <button onClick={() => { setIsSearchExpanded(false); runVisaCheck(visaParams.from, visaParams.to); }} className="w-full bg-omni-dark text-white py-3 rounded-xl font-black">CHECK STATUS</button>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
                            {loadingState.visa ? <ThinkingChain steps={["Checking embassies...", "Scanning treaties...", "Verifying passport power..."]} /> : visaRequirement ? (
                                <div className="space-y-6">
                                    <div className="text-center py-4 bg-gray-50 rounded-2xl border-2 border-omni-dark"><h2 className="text-3xl font-black text-omni-dark">{visaRequirement.status}</h2><p className="text-sm font-bold text-gray-500">Processing: {visaRequirement.processingTime}</p></div>
                                    {visaRequirement.status !== 'Not Required' && (
                                        <div className="space-y-4">
                                            <div className="bg-yellow-50 p-4 rounded-xl border-2 border-omni-dark">
                                                <h4 className="font-black text-sm uppercase mb-2">Checklist</h4>
                                                <ul className="list-disc list-inside text-xs font-bold space-y-1">{visaRequirement.checklist.map((c, i) => <li key={i}>{c}</li>)}</ul>
                                            </div>
                                            {!visaForm ? (
                                                <button onClick={handleDraftVisa} className="w-full py-4 bg-omni-green rounded-2xl border-4 border-omni-dark font-black shadow-cartoon active:translate-y-1 flex items-center justify-center gap-2 hover:bg-emerald-300 transition-colors">
                                                    {isDraftingVisa ? <Loader2 className="animate-spin"/> : <><Sparkles size={18}/> AUTOFILL FROM DOCUMENTS</>}
                                                </button>
                                            ) : (
                                                <div className="bg-white p-4 rounded-2xl border-2 border-omni-dark animate-in fade-in">
                                                    <div className="flex justify-between items-start mb-4 border-b border-gray-100 pb-4">
                                                        <h4 className="font-black text-sm uppercase flex items-center gap-2"><ClipboardCheck className="text-green-500"/> Draft Ready</h4>
                                                        
                                                        {/* EXPORT BUTTONS */}
                                                        <div className="flex gap-2">
                                                            <button 
                                                                onClick={() => triggerExport('pdf')}
                                                                className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-omni-dark" 
                                                                title="Print to PDF"
                                                            >
                                                                <Printer size={16} />
                                                            </button>
                                                            <button 
                                                                onClick={() => triggerExport('json')}
                                                                className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-omni-dark" 
                                                                title="Download JSON"
                                                            >
                                                                <FileJson size={16} />
                                                            </button>
                                                            <button 
                                                                onClick={() => triggerExport('copy')}
                                                                className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-omni-dark" 
                                                                title="Copy Text"
                                                            >
                                                                <Copy size={16} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                                        <div className="p-2 bg-gray-50 rounded border text-xs font-bold">
                                                            <p className="text-[8px] uppercase text-gray-400 mb-1">Name</p>
                                                            <div className="flex items-center">
                                                                {visaForm.fullName}
                                                                <SourceChip source={visaForm.sources?.fullName} />
                                                            </div>
                                                        </div>
                                                        <div className="p-2 bg-gray-50 rounded border text-xs font-bold">
                                                            <p className="text-[8px] uppercase text-gray-400 mb-1">Passport</p>
                                                            <div className="flex items-center">
                                                                {visaForm.passportNumber}
                                                                <SourceChip source={visaForm.sources?.passportNumber} />
                                                            </div>
                                                        </div>
                                                        <div className="p-2 bg-gray-50 rounded border text-xs font-bold">
                                                            <p className="text-[8px] uppercase text-gray-400 mb-1">Nationality</p>
                                                            <div className="flex items-center">
                                                                {visaForm.nationality}
                                                                <SourceChip source={visaForm.sources?.nationality} />
                                                            </div>
                                                        </div>
                                                        <div className="p-2 bg-gray-50 rounded border text-xs font-bold">
                                                            <p className="text-[8px] uppercase text-gray-400 mb-1">DOB</p>
                                                            <div className="flex items-center">
                                                                {visaForm.dateOfBirth}
                                                                <SourceChip source={visaForm.sources?.dateOfBirth} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <p className="text-[10px] text-gray-400 italic text-center">This is a prototype draft. No real submission.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : <div className="text-center text-gray-400 font-bold mt-10">Enter details to check visa status.</div>}
                        </div>
                    </div>
                </div>
            )}

            {/* --- eSIM MODAL (WITH ADD TO BUDGET) --- */}
            {activeModule === 'esim' && (
                <div className="fixed inset-0 z-[500] bg-omni-dark/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-4xl h-[85vh] rounded-[2.5rem] border-4 border-omni-dark shadow-cartoon-lg flex flex-col overflow-hidden animate-in zoom-in-95">
                        <TripSummaryBar title="eSIM CONNECTIVITY" icon={Smartphone} details={esimOptions.length > 0 ? `${esimParams.dest} • ${esimParams.data}` : "Find connection..."} isEditing={isSearchExpanded} onToggleEdit={() => setIsSearchExpanded(!isSearchExpanded)} onClose={() => setActiveModule(null)} />
                        {isSearchExpanded && (
                            <div className="bg-purple-50 p-4 border-b-4 border-omni-dark flex flex-col gap-4 animate-in slide-in-from-top-2">
                                {/* Labeled Summary */}
                                <div className="bg-white p-3 rounded-xl border-2 border-purple-200 mb-2">
                                    <KeyValueRow 
                                        label="Roaming Location" 
                                        value={tripContext.destinationCity} 
                                        onEdit={() => {
                                            const newCity = prompt("Override roaming city:", tripContext.destinationCity);
                                            if (newCity) saveOverride({ destinationCity: newCity });
                                        }}
                                    />
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="col-span-2 md:col-span-1"><label className="text-[10px] font-black uppercase text-gray-400 ml-1">Destination</label><input value={esimParams.dest} onChange={(e) => setEsimParams(p => ({...p, dest: e.target.value}))} className="w-full px-3 py-2 rounded-xl border-2 border-omni-dark font-bold text-sm" placeholder="Country" /></div>
                                    <div><label className="text-[10px] font-black uppercase text-gray-400 ml-1">Days</label><input type="number" value={esimParams.days} onChange={(e) => setEsimParams(p => ({...p, days: Number(e.target.value)}))} className="w-full px-3 py-2 rounded-xl border-2 border-omni-dark font-bold text-sm" /></div>
                                    <div><label className="text-[10px] font-black uppercase text-gray-400 ml-1">Data</label><select value={esimParams.data} onChange={(e) => setEsimParams(p => ({...p, data: e.target.value}))} className="w-full px-3 py-2 rounded-xl border-2 border-omni-dark font-bold text-sm bg-white"><option>1GB</option><option>3GB</option><option>5GB</option><option>10GB</option><option>Unlimited</option></select></div>
                                    <div><label className="text-[10px] font-black uppercase text-gray-400 ml-1">Type</label><select value={esimParams.type} onChange={(e) => setEsimParams(p => ({...p, type: e.target.value}))} className="w-full px-3 py-2 rounded-xl border-2 border-omni-dark font-bold text-sm bg-white"><option>Data Only</option><option>Voice + Data</option></select></div>
                                </div>
                                <button onClick={() => { setIsSearchExpanded(false); runEsimSearch(); }} className="bg-omni-dark text-white px-6 py-3 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-gray-700 w-full shadow-cartoon-sm active:translate-y-1"><Wifi size={18} /> FIND MATCHES</button>
                            </div>
                        )}
                        <div className="flex-1 overflow-y-auto bg-gray-50 p-4 custom-scrollbar">
                             {loadingState.esim ? <div className="py-12 flex justify-center"><ThinkingChain steps={["Checking signal strength... 📶", "Scanning data packs... 💾", "Ranking best value... 🥇"]} /></div> : esimOptions.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{esimOptions.map((opt, i) => (
                                    <div key={i} className="bg-white rounded-3xl border-4 border-omni-dark shadow-cartoon-sm hover:-translate-y-1 transition-all flex flex-col overflow-hidden relative">
                                        <div className="bg-omni-dark p-4 flex justify-between items-start text-white"><div className="flex flex-col"><span className="text-[10px] font-black uppercase opacity-60 tracking-wider">eSIM</span><span className="text-lg font-black">{opt.provider}</span></div><Zap size={20} className="text-omni-yellow" /></div>
                                        <div className="p-4 pt-8 flex-1 flex flex-col gap-3"><div className="text-center"><div className="text-3xl font-black text-omni-dark">{opt.dataAmount}</div><div className="text-xs font-bold text-gray-400 uppercase tracking-widest">{opt.duration}</div></div><div className="flex flex-wrap gap-2 justify-center"><span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-lg text-[10px] font-black uppercase border border-purple-200">{opt.bestFor}</span></div><div className="mt-auto border-t-2 border-dashed border-gray-200 pt-4 flex items-center justify-between">
                                            <div><div className="text-xl font-black text-omni-dark">{currencySymbol}{convertPrice(opt.price)}</div></div>
                                            <AddToBudgetButton 
                                                segmentId={segmentId}
                                                item={{
                                                    title: `${opt.provider} ${opt.dataAmount}`,
                                                    providerName: opt.provider,
                                                    amount: opt.price,
                                                    currency: opt.currency,
                                                    type: 'other',
                                                    source: 'extras'
                                                }}
                                                label="GET"
                                            />
                                        </div></div>
                                    </div>
                                ))}</div>
                            ) : <div className="text-center py-12 text-gray-400 font-black">Search for connectivity!</div>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
