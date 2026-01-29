
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { SavedTicket, TicketStatus } from '../types';
import { 
    Ticket, Plus, Upload, Type, AlertCircle, CheckCircle, Clock, XCircle, 
    FileText, Calendar, DollarSign, MapPin, Hash, Trash2, Edit2, ShieldCheck, 
    Loader2, Save, X, Globe, ChevronLeft, ChevronRight, PlayCircle, Share2, Download
} from 'lucide-react';
import { simulateTicketImport, submitForReview, finalizeMockReview } from '../services/ticketService';
import { generateJourneyTrace, generateTripRecapVideo } from '../services/geminiService';
import ThinkingChain from './ThinkingChain';
import MapView from './MapView';

interface MemoriesViewProps {
    tickets: SavedTicket[];
    setTickets: React.Dispatch<React.SetStateAction<SavedTicket[]>>;
    currencySymbol: string;
}

const MemoriesView: React.FC<MemoriesViewProps> = ({ tickets, setTickets, currencySymbol }) => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    
    // Journey Map State
    const [isJourneyMapOpen, setIsJourneyMapOpen] = useState(false);
    const [isTracing, setIsTracing] = useState(false);
    const [journeyData, setJourneyData] = useState<{ coordinates: [number, number][], summary: string, totalKm: string } | null>(null);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    
    // Video Recap State
    const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

    // Form/Editing State
    const [editingTicket, setEditingTicket] = useState<Partial<SavedTicket>>({
        type: 'attraction',
        currency: 'USD',
        status: 'draft'
    });
    
    // Import State
    const [importMode, setImportMode] = useState<'none' | 'file' | 'text'>('none');
    const [importText, setImportText] = useState('');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [isParsing, setIsParsing] = useState(false);

    // Dev Tools for Prototype
    const [devForceOutcome, setDevForceOutcome] = useState<'random' | 'approve' | 'reject'>('random');

    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Computed ---
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        years.add(new Date().getFullYear());
        tickets.forEach(t => {
            if (t.date) years.add(new Date(t.date).getFullYear());
        });
        return Array.from(years).sort((a, b) => b - a); // Descending
    }, [tickets]);

    // --- Actions ---

    const handleStartAdd = () => {
        setEditingTicket({
            id: `new-${Date.now()}`,
            type: 'attraction',
            currency: 'USD',
            status: 'draft',
            date: new Date().toISOString().split('T')[0],
            details: {}
        });
        setImportMode('none');
        setIsAddModalOpen(true);
    };

    const handleOpenJourneyMap = async () => {
        setIsJourneyMapOpen(true);
        // We always refresh trace when opening to ensure it matches current year filter
        fetchTraceForYear(selectedYear);
    };

    const fetchTraceForYear = async (year: number) => {
        setIsTracing(true);
        setJourneyData(null);
        setGeneratedVideoUrl(null); // Reset video when year changes
        try {
            const yearTickets = tickets.filter(t => t.date && new Date(t.date).getFullYear() === year);
            const trace = await generateJourneyTrace(yearTickets);
            setJourneyData(trace);
        } catch (e) {
            console.error(e);
        } finally {
            setIsTracing(false);
        }
    };

    const handleYearChange = (direction: 'prev' | 'next') => {
        const idx = availableYears.indexOf(selectedYear);
        if (idx === -1) return;
        
        let newYear = selectedYear;
        if (direction === 'next' && idx > 0) {
            newYear = availableYears[idx - 1];
        } else if (direction === 'prev' && idx < availableYears.length - 1) {
            newYear = availableYears[idx + 1];
        }

        if (newYear !== selectedYear) {
            setSelectedYear(newYear);
            fetchTraceForYear(newYear);
        }
    };

    const handleGenerateRecapVideo = async () => {
        if (!journeyData) return;

        // API Key Check for Veo
        if ((window as any).aistudio) {
            const hasKey = await (window as any).aistudio.hasSelectedApiKey();
            if (!hasKey) {
                try {
                    const success = await (window as any).aistudio.openSelectKey();
                    if (!success) return; // User cancelled
                } catch (e) {
                    console.error("Key selection failed", e);
                    return;
                }
            }
        }

        setIsGeneratingVideo(true);
        try {
            // Extract distinct locations from tickets of that year
            const yearTickets = tickets.filter(t => t.date && new Date(t.date).getFullYear() === selectedYear);
            const locations = Array.from(new Set(yearTickets.map(t => t.details?.location || t.name))) as string[];
            
            const videoUrl = await generateTripRecapVideo(journeyData.summary, locations);
            setGeneratedVideoUrl(videoUrl);
        } catch (e) {
            alert("Failed to generate video. Please try again.");
        } finally {
            setIsGeneratingVideo(false);
        }
    };

    const handleShare = async (url: string) => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `My ${selectedYear} Travel Recap`,
                    text: `Check out my travel highlights from ${selectedYear}! ${journeyData?.summary}`,
                    url: url
                });
            } catch (e) {
                console.log("Share cancelled");
            }
        } else {
            // Fallback
            navigator.clipboard.writeText(url);
            alert("Video link copied to clipboard! 📋");
        }
    };

    const handleImportAnalysis = async () => {
        setIsParsing(true);
        try {
            const parsed = await simulateTicketImport(importFile, importText);
            setEditingTicket(prev => ({ ...prev, ...parsed }));
            setImportMode('none'); // Switch to form view
        } catch (e) {
            alert("Parsing failed. Please enter manually.");
        } finally {
            setIsParsing(false);
        }
    };

    const handleSaveOrSubmit = async () => {
        if (!editingTicket.name || !editingTicket.price) {
            alert("Name and Price are required!");
            return;
        }

        const newTicket = editingTicket as SavedTicket;
        
        // Optimistic UI Update
        let updatedList = [...tickets];
        const existingIdx = tickets.findIndex(t => t.id === newTicket.id);
        
        if (existingIdx >= 0) {
            updatedList[existingIdx] = newTicket;
        } else {
            updatedList.push(newTicket);
        }
        
        setTickets(updatedList);
        setIsAddModalOpen(false);
        setIsDetailModalOpen(false);

        // Reset journey data cache if tickets change
        setJourneyData(null);

        // If submitting, trigger the mock review flow
        if (newTicket.status === 'draft' || newTicket.status === 'rejected') {
            const underReview = await submitForReview(newTicket);
            
            // Update UI to 'Under Review'
            setTickets(prev => prev.map(t => t.id === newTicket.id ? underReview : t));

            // Simulate System Delay
            setTimeout(() => {
                const final = finalizeMockReview(underReview, devForceOutcome === 'random' ? undefined : devForceOutcome);
                setTickets(prev => prev.map(t => t.id === newTicket.id ? final : t));
            }, 3000);
        }
    };

    const handleDelete = (id: string) => {
        if (confirm("Delete this memory?")) {
            setTickets(prev => prev.filter(t => t.id !== id));
            setIsDetailModalOpen(false);
            setJourneyData(null); // Clear cache
        }
    };

    const openTicketDetail = (ticket: SavedTicket) => {
        setEditingTicket({ ...ticket });
        setIsDetailModalOpen(true);
    };

    // --- Render Helpers ---

    const getStatusBadge = (status: TicketStatus) => {
        switch (status) {
            case 'approved':
                return <span className="bg-omni-green px-2 py-1 rounded-lg border border-omni-dark flex items-center gap-1 text-[10px] font-black uppercase"><CheckCircle size={12}/> Verified</span>;
            case 'rejected':
                return <span className="bg-red-100 px-2 py-1 rounded-lg border border-red-500 text-red-500 flex items-center gap-1 text-[10px] font-black uppercase"><XCircle size={12}/> Action Needed</span>;
            case 'under_review':
                return <span className="bg-omni-yellow px-2 py-1 rounded-lg border border-omni-dark flex items-center gap-1 text-[10px] font-black uppercase animate-pulse"><Clock size={12}/> Reviewing...</span>;
            default:
                return <span className="bg-gray-100 px-2 py-1 rounded-lg border border-gray-400 text-gray-500 flex items-center gap-1 text-[10px] font-black uppercase"><Edit2 size={12}/> Draft</span>;
        }
    };

    return (
        <div className="h-full flex flex-col gap-6 relative">
            
            {/* Header */}
            <div className="bg-white p-4 rounded-3xl border-4 border-omni-dark shadow-cartoon-sm flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-omni-pink rounded-2xl border-4 border-omni-dark flex items-center justify-center shadow-cartoon-sm rotate-3">
                        <Ticket size={24} className="text-omni-dark" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-omni-dark">Memories & Tickets</h2>
                        <p className="text-xs font-bold text-gray-500">Keep your receipts safe!</p>
                    </div>
                </div>
                
                <div className="flex gap-2">
                    <button 
                        onClick={handleOpenJourneyMap}
                        className="bg-omni-blue hover:bg-sky-300 px-4 py-3 rounded-2xl border-4 border-omni-dark font-black text-sm flex items-center gap-2 shadow-cartoon active:translate-y-1 transition-all"
                    >
                        <Globe size={18} strokeWidth={3} /> YEARLY MAP
                    </button>
                    <button 
                        onClick={handleStartAdd}
                        className="bg-omni-green hover:bg-emerald-300 px-4 py-3 rounded-2xl border-4 border-omni-dark font-black text-sm flex items-center gap-2 shadow-cartoon active:translate-y-1 transition-all"
                    >
                        <Plus size={18} strokeWidth={3} /> ADD NEW
                    </button>
                </div>
            </div>

            {/* List Grid */}
            <div className="flex-1 overflow-y-auto p-2">
                {tickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 opacity-50">
                        <Ticket size={64} className="text-gray-300 mb-4" />
                        <p className="font-black text-xl text-gray-400">Box is empty!</p>
                        <p className="font-bold text-sm text-gray-400">Add your first trip memory.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {tickets.map(ticket => (
                            <button 
                                key={ticket.id}
                                onClick={() => openTicketDetail(ticket)}
                                className="bg-white p-4 rounded-3xl border-4 border-omni-dark shadow-cartoon-sm hover:-translate-y-1 hover:shadow-cartoon transition-all text-left group relative overflow-hidden"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="bg-gray-100 px-2 py-0.5 rounded-lg border border-gray-300 text-[10px] font-black uppercase text-gray-500">
                                        {ticket.type}
                                    </span>
                                    {getStatusBadge(ticket.status)}
                                </div>
                                <h3 className="text-lg font-black leading-tight mb-1 group-hover:text-blue-600 transition-colors line-clamp-2">
                                    {ticket.name}
                                </h3>
                                <div className="flex items-center gap-1 text-xs font-bold text-gray-500 mb-4">
                                    <Calendar size={12} /> {ticket.date}
                                </div>
                                <div className="flex justify-between items-end border-t-2 border-dashed border-gray-200 pt-3">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">Provider</span>
                                        <span className="text-xs font-black">{ticket.provider}</span>
                                    </div>
                                    <span className="text-xl font-black bg-omni-yellow px-2 rounded-lg border border-omni-dark transform rotate-2 group-hover:rotate-0 transition-transform">
                                        {currencySymbol}{ticket.price}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* JOURNEY MAP MODAL */}
            {isJourneyMapOpen && (
                <div className="fixed inset-0 z-[100] bg-omni-dark/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-4xl h-[85vh] rounded-[2.5rem] border-4 border-omni-dark shadow-cartoon-lg flex flex-col overflow-hidden animate-in zoom-in-95">
                        
                        {/* Modal Header with Year Selector */}
                        <div className="bg-omni-blue p-4 border-b-4 border-omni-dark flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <h3 className="text-xl font-black flex items-center gap-2">
                                    <Globe /> JOURNEY
                                </h3>
                                {/* Year Selector */}
                                <div className="flex items-center bg-white rounded-xl border-2 border-omni-dark p-1">
                                    <button 
                                        onClick={() => handleYearChange('prev')}
                                        disabled={availableYears.indexOf(selectedYear) >= availableYears.length - 1}
                                        className="p-1 hover:bg-gray-100 rounded-lg disabled:opacity-30"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <span className="px-3 font-black text-lg">{selectedYear}</span>
                                    <button 
                                        onClick={() => handleYearChange('next')}
                                        disabled={availableYears.indexOf(selectedYear) <= 0}
                                        className="p-1 hover:bg-gray-100 rounded-lg disabled:opacity-30"
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                </div>
                            </div>
                            <button onClick={() => setIsJourneyMapOpen(false)} className="w-8 h-8 bg-white border-2 border-omni-dark rounded-full flex items-center justify-center hover:bg-gray-100">
                                <XCircle size={20} />
                            </button>
                        </div>
                        
                        <div className="flex-1 relative bg-sky-50">
                            {isTracing ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-20">
                                    <ThinkingChain steps={[
                                        "Scanning your tickets... 🎟️",
                                        "Connecting the dots... 📍",
                                        "Calculating miles flown... ✈️",
                                        "Drawing your world map! 🗺️"
                                    ]} />
                                </div>
                            ) : generatedVideoUrl ? (
                                <div className="absolute inset-0 z-30 bg-black flex flex-col">
                                    <video 
                                        src={generatedVideoUrl} 
                                        controls 
                                        autoPlay 
                                        className="w-full h-full object-contain"
                                    />
                                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 bg-black/50 p-4 rounded-3xl backdrop-blur-md border border-white/20">
                                        <button 
                                            onClick={() => {
                                                const link = document.createElement('a');
                                                link.href = generatedVideoUrl!;
                                                link.download = `Omnitrip_Recap_${selectedYear}.mp4`;
                                                link.click();
                                            }}
                                            className="flex flex-col items-center text-white gap-1 hover:scale-110 transition-transform"
                                        >
                                            <div className="w-12 h-12 bg-omni-green rounded-full flex items-center justify-center text-omni-dark">
                                                <Download size={24} strokeWidth={3} />
                                            </div>
                                            <span className="text-[10px] font-black uppercase">Save</span>
                                        </button>

                                        <button 
                                            onClick={() => handleShare(generatedVideoUrl!)}
                                            className="flex flex-col items-center text-white gap-1 hover:scale-110 transition-transform"
                                        >
                                            <div className="w-12 h-12 bg-omni-pink rounded-full flex items-center justify-center text-omni-dark">
                                                <Share2 size={24} strokeWidth={3} />
                                            </div>
                                            <span className="text-[10px] font-black uppercase">Share</span>
                                        </button>

                                        <button 
                                            onClick={() => setGeneratedVideoUrl(null)}
                                            className="flex flex-col items-center text-white gap-1 hover:scale-110 transition-transform"
                                        >
                                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-omni-dark">
                                                <X size={24} strokeWidth={3} />
                                            </div>
                                            <span className="text-[10px] font-black uppercase">Close</span>
                                        </button>
                                    </div>
                                </div>
                            ) : journeyData ? (
                                <>
                                    <MapView journeyTrace={journeyData} />
                                    
                                    {/* Map Overlay Controls */}
                                    <div className="absolute bottom-6 left-6 right-6 z-[400] flex flex-col md:flex-row gap-4 items-end md:items-center pointer-events-none">
                                        {/* Stats Card */}
                                        <div className="bg-white/90 backdrop-blur border-4 border-omni-dark rounded-3xl p-6 shadow-cartoon flex-1 pointer-events-auto w-full md:w-auto">
                                            <div className="flex flex-col md:flex-row gap-6 items-center">
                                                <div className="flex-1">
                                                    <h4 className="text-xl font-black mb-1">Total Distance: {journeyData.totalKm} km</h4>
                                                    <p className="text-sm font-bold text-gray-600 italic">"{journeyData.summary}"</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="bg-omni-yellow px-4 py-2 rounded-xl border-2 border-omni-dark font-black text-xs">
                                                        {journeyData.coordinates.length} Stops
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Video Action Button */}
                                        <button 
                                            onClick={handleGenerateRecapVideo}
                                            disabled={isGeneratingVideo}
                                            className="bg-omni-pink hover:bg-pink-300 px-6 py-6 rounded-3xl border-4 border-omni-dark shadow-cartoon pointer-events-auto active:translate-y-1 transition-all flex flex-col items-center gap-1 group w-full md:w-auto"
                                        >
                                            {isGeneratingVideo ? (
                                                <Loader2 size={32} className="animate-spin text-omni-dark" />
                                            ) : (
                                                <PlayCircle size={32} className="text-omni-dark group-hover:scale-110 transition-transform" />
                                            )}
                                            <span className="font-black text-xs uppercase text-omni-dark">
                                                {isGeneratingVideo ? "Creating..." : "Get Recap Vid"}
                                            </span>
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 font-black p-8 text-center">
                                    <Ticket size={48} className="mb-4 opacity-50" />
                                    <p>No trips found for {selectedYear}.</p>
                                    <p className="text-xs mt-2 opacity-60">Add some tickets to see your path!</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ADD / IMPORT MODAL */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[100] bg-omni-dark/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] border-4 border-omni-dark shadow-cartoon-lg flex flex-col overflow-hidden animate-in zoom-in-95">
                        
                        <div className="bg-omni-green p-6 border-b-4 border-omni-dark flex justify-between items-center">
                            <h3 className="text-xl font-black flex items-center gap-2">
                                <Plus /> ADD MEMORY
                            </h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="w-8 h-8 bg-white border-2 border-omni-dark rounded-full flex items-center justify-center hover:bg-gray-100">
                                <XCircle size={20} />
                            </button>
                        </div>

                        <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            {isParsing ? (
                                <div className="py-12">
                                    <ThinkingChain steps={[
                                        "Scanning pixels... 🧐",
                                        "Extracting dates... 📅",
                                        "Verifying prices... 💰",
                                        "Structuring data... 📝"
                                    ]} />
                                </div>
                            ) : importMode === 'none' ? (
                                <div className="grid grid-cols-2 gap-4">
                                    <button 
                                        onClick={() => setImportMode('file')}
                                        className="flex flex-col items-center gap-3 p-6 rounded-2xl border-4 border-gray-200 hover:border-omni-dark hover:bg-omni-blue/20 transition-all group"
                                    >
                                        <div className="w-16 h-16 bg-omni-blue rounded-full border-4 border-omni-dark flex items-center justify-center shadow-cartoon-sm group-hover:scale-110 transition-transform">
                                            <Upload size={32} className="text-omni-dark" />
                                        </div>
                                        <span className="font-black text-sm">UPLOAD RECEIPT</span>
                                    </button>
                                    <button 
                                        onClick={() => setImportMode('none')} // Actually opens form directly, but here we just show buttons
                                        className="flex flex-col items-center gap-3 p-6 rounded-2xl border-4 border-gray-200 hover:border-omni-dark hover:bg-omni-yellow/20 transition-all group"
                                        onMouseDown={() => {
                                            // Directly to Manual Form inside Modal Logic
                                            setImportMode('none'); 
                                            setIsDetailModalOpen(true); 
                                            setIsAddModalOpen(false); 
                                        }}
                                    >
                                        <div className="w-16 h-16 bg-omni-yellow rounded-full border-4 border-omni-dark flex items-center justify-center shadow-cartoon-sm group-hover:scale-110 transition-transform">
                                            <Edit2 size={32} className="text-omni-dark" />
                                        </div>
                                        <span className="font-black text-sm">ENTER MANUALLY</span>
                                    </button>
                                    
                                    <div className="col-span-2 mt-2">
                                        <div className="relative">
                                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t-2 border-gray-200"></div></div>
                                            <div className="relative flex justify-center text-xs"><span className="px-2 bg-white text-gray-400 font-bold uppercase">Or paste text</span></div>
                                        </div>
                                        <div className="mt-4 flex gap-2">
                                            <input 
                                                type="text" 
                                                value={importText}
                                                onChange={(e) => setImportText(e.target.value)}
                                                placeholder="Paste email confirmation..." 
                                                className="flex-1 p-3 rounded-xl border-2 border-gray-300 font-bold text-sm focus:border-omni-dark focus:outline-none"
                                            />
                                            <button 
                                                onClick={handleImportAnalysis}
                                                disabled={!importText.trim()}
                                                className="bg-omni-dark text-white px-4 rounded-xl font-black text-xs hover:bg-gray-700 disabled:opacity-50"
                                            >
                                                PARSE
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : importMode === 'file' ? (
                                <div className="text-center py-8">
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        accept="image/*,.pdf"
                                        onChange={(e) => {
                                            if (e.target.files?.[0]) {
                                                setImportFile(e.target.files[0]);
                                                handleImportAnalysis();
                                            }
                                        }}
                                    />
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="bg-white border-4 border-dashed border-omni-dark rounded-3xl p-8 w-full hover:bg-gray-50 transition-colors flex flex-col items-center gap-4"
                                    >
                                        <Upload size={48} className="text-gray-400" />
                                        <span className="font-black text-lg">Click to Upload Image/PDF</span>
                                    </button>
                                    <button onClick={() => setImportMode('none')} className="mt-4 text-xs font-bold text-gray-500 hover:underline">Cancel</button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}

            {/* DETAIL / EDIT MODAL */}
            {isDetailModalOpen && (
                <div className="fixed inset-0 z-[100] bg-omni-dark/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-[2.5rem] border-4 border-omni-dark shadow-cartoon-lg flex flex-col overflow-hidden animate-in zoom-in-95">
                        
                        {/* Status Header */}
                        <div className={`p-4 border-b-4 border-omni-dark flex justify-between items-center ${
                            editingTicket.status === 'rejected' ? 'bg-red-100' : 
                            editingTicket.status === 'approved' ? 'bg-omni-green' : 'bg-gray-100'
                        }`}>
                            <div className="flex items-center gap-2">
                                {getStatusBadge(editingTicket.status || 'draft')}
                                {editingTicket.status === 'rejected' && (
                                    <span className="text-xs font-bold text-red-600">Please correct details.</span>
                                )}
                            </div>
                            <button onClick={() => setIsDetailModalOpen(false)} className="w-8 h-8 bg-white border-2 border-omni-dark rounded-full flex items-center justify-center hover:bg-gray-100">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar space-y-4">
                            
                            {/* Rejection Note */}
                            {editingTicket.status === 'rejected' && editingTicket.verificationNotes && (
                                <div className="bg-red-50 p-4 rounded-2xl border-2 border-red-200 flex gap-3 items-start">
                                    <AlertCircle className="text-red-500 shrink-0" size={20} />
                                    <div>
                                        <p className="font-black text-red-800 text-sm">System Rejected</p>
                                        <p className="text-xs text-red-600 font-bold">{editingTicket.verificationNotes}</p>
                                    </div>
                                </div>
                            )}

                            {/* Main Form */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Title</label>
                                    <input 
                                        className="w-full p-3 bg-white border-2 border-omni-dark rounded-xl font-bold focus:ring-4 focus:ring-omni-yellow focus:outline-none"
                                        value={editingTicket.name || ''}
                                        onChange={e => setEditingTicket({...editingTicket, name: e.target.value})}
                                        placeholder="e.g. Flight to Paris"
                                        disabled={editingTicket.status === 'under_review'}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Type</label>
                                        <select 
                                            className="w-full p-3 bg-white border-2 border-omni-dark rounded-xl font-bold focus:outline-none"
                                            value={editingTicket.type}
                                            onChange={e => setEditingTicket({...editingTicket, type: e.target.value as any})}
                                            disabled={editingTicket.status === 'under_review'}
                                        >
                                            <option value="flight">Flight ✈️</option>
                                            <option value="hotel">Hotel 🏨</option>
                                            <option value="attraction">Attraction 🎟️</option>
                                            <option value="event">Event 🎉</option>
                                            <option value="transport">Transport 🚆</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Date</label>
                                        <input 
                                            type="date"
                                            className="w-full p-3 bg-white border-2 border-omni-dark rounded-xl font-bold focus:outline-none"
                                            value={editingTicket.date || ''}
                                            onChange={e => setEditingTicket({...editingTicket, date: e.target.value})}
                                            disabled={editingTicket.status === 'under_review'}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Price</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-3.5 font-black text-gray-400">$</span>
                                            <input 
                                                type="number"
                                                className="w-full pl-6 p-3 bg-white border-2 border-omni-dark rounded-xl font-bold focus:outline-none"
                                                value={editingTicket.price || ''}
                                                onChange={e => setEditingTicket({...editingTicket, price: Number(e.target.value)})}
                                                disabled={editingTicket.status === 'under_review'}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Provider</label>
                                        <input 
                                            className="w-full p-3 bg-white border-2 border-omni-dark rounded-xl font-bold focus:outline-none"
                                            value={editingTicket.provider || ''}
                                            onChange={e => setEditingTicket({...editingTicket, provider: e.target.value})}
                                            placeholder="e.g. Delta"
                                            disabled={editingTicket.status === 'under_review'}
                                        />
                                    </div>
                                </div>

                                {/* Dynamic Details based on Type */}
                                <div className="bg-gray-50 p-4 rounded-2xl border-2 border-dashed border-gray-300">
                                    <p className="text-[10px] font-black uppercase text-gray-400 mb-2">Details</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <input 
                                            placeholder={editingTicket.type === 'flight' ? "Flight Code (e.g. UA123)" : "Reference #"}
                                            className="p-2 border border-gray-300 rounded-lg text-xs font-bold"
                                            value={editingTicket.details?.referenceNumber || ''}
                                            onChange={e => setEditingTicket({
                                                ...editingTicket, 
                                                details: { ...editingTicket.details, referenceNumber: e.target.value }
                                            })}
                                            disabled={editingTicket.status === 'under_review'}
                                        />
                                        <input 
                                            placeholder={editingTicket.type === 'flight' ? "Seat" : "Location"}
                                            className="p-2 border border-gray-300 rounded-lg text-xs font-bold"
                                            value={editingTicket.details?.location || ''}
                                            onChange={e => setEditingTicket({
                                                ...editingTicket, 
                                                details: { ...editingTicket.details, location: e.target.value }
                                            })}
                                            disabled={editingTicket.status === 'under_review'}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 bg-gray-50 border-t-4 border-omni-dark flex flex-col gap-3">
                            
                            {/* Dev Toggles for Prototype */}
                            {editingTicket.status !== 'approved' && (
                                <div className="flex items-center justify-between px-2 text-[10px] text-gray-400">
                                    <span className="font-black uppercase">Dev Override:</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => setDevForceOutcome('approve')} className={`px-2 py-0.5 rounded border ${devForceOutcome === 'approve' ? 'bg-green-100 border-green-500 text-green-700' : 'bg-white'}`}>Force Pass</button>
                                        <button onClick={() => setDevForceOutcome('reject')} className={`px-2 py-0.5 rounded border ${devForceOutcome === 'reject' ? 'bg-red-100 border-red-500 text-red-700' : 'bg-white'}`}>Force Fail</button>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3">
                                {editingTicket.id && !editingTicket.id.startsWith('new') && (
                                    <button 
                                        onClick={() => handleDelete(editingTicket.id!)}
                                        className="p-4 rounded-2xl border-2 border-red-200 text-red-500 hover:bg-red-50"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                )}
                                <button 
                                    onClick={handleSaveOrSubmit}
                                    disabled={editingTicket.status === 'under_review'}
                                    className={`flex-1 p-4 rounded-2xl border-4 border-omni-dark font-black shadow-cartoon active:translate-y-1 transition-all flex items-center justify-center gap-2 ${
                                        editingTicket.status === 'under_review' 
                                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                                            : 'bg-omni-yellow hover:bg-yellow-300'
                                    }`}
                                >
                                    {editingTicket.status === 'draft' || editingTicket.status === 'rejected' ? (
                                        <><ShieldCheck /> SUBMIT FOR REVIEW</>
                                    ) : (
                                        <><Save /> SAVE CHANGES</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MemoriesView;
