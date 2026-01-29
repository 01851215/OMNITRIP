
import React, { useState, useEffect, useRef } from 'react';
import { ExploreCategory, ExplorePlace } from '../types';
import { exploreLocation } from '../services/geminiService';
import { 
    Search, MapPin, Star, Calendar, Info, X, Map as MapIcon, 
    List, Utensils, Camera, PartyPopper, BedDouble, Landmark, BookOpen,
    ChefHat, DollarSign, Navigation, AlertCircle, LocateFixed
} from 'lucide-react';
import MapView from './MapView';
import ThinkingChain from './ThinkingChain';

interface ExploreViewProps {
    location: string;
    language: string;
}

const CATEGORIES: { label: ExploreCategory; icon: React.ElementType }[] = [
    { label: 'All', icon: Search },
    { label: 'Restaurant', icon: Utensils },
    { label: 'Things to do', icon: Camera },
    { label: 'Events', icon: PartyPopper },
    { label: 'Stay', icon: BedDouble },
    { label: 'Landmark', icon: Landmark },
    { label: 'Guide', icon: BookOpen },
];

const ExploreView: React.FC<ExploreViewProps> = ({ location, language }) => {
    const [selectedCategory, setSelectedCategory] = useState<ExploreCategory>('All');
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    const [places, setPlaces] = useState<ExplorePlace[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedPlace, setSelectedPlace] = useState<ExplorePlace | null>(null);

    // Geolocation States
    const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'prompt' | 'granted' | 'denied'>('unknown');
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);

    // Haversine Distance Calculator
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; // Radius of the earth in km
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c; // Distance in km
        return d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`;
    };

    const handleLocateMe = () => {
        setPermissionStatus('prompt');
        setLocationError(null);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                    setPermissionStatus('granted');
                },
                (error) => {
                    console.error("Geo Error", error);
                    setPermissionStatus('denied');
                    setLocationError("Could not access location.");
                }
            );
        } else {
            setPermissionStatus('denied');
            setLocationError("Geolocation not supported.");
        }
    };

    // Initial check on mount
    useEffect(() => {
        // If we haven't asked yet, trigger the check
        if (permissionStatus === 'unknown') {
            handleLocateMe();
        }
    }, []);

    // Fetch places when category changes OR location permission settles
    useEffect(() => {
        if (permissionStatus === 'granted' && userLocation) {
            fetchPlaces(selectedCategory, userLocation);
        } else if (permissionStatus === 'denied') {
            // Fallback to text location if denied
            fetchPlaces(selectedCategory, undefined);
        }
    }, [selectedCategory, permissionStatus, userLocation]);

    const fetchPlaces = async (cat: ExploreCategory, coords?: { lat: number; lng: number }) => {
        setIsLoading(true);
        setPlaces([]); 
        try {
            const results = await exploreLocation(location, cat, language, coords);
            
            // Post-process to add distance if we have user coordinates
            const processed = results.map(p => ({
                ...p,
                distance: coords && p.lat && p.lng 
                    ? calculateDistance(coords.lat, coords.lng, p.lat, p.lng)
                    : undefined
            }));

            // Sort by distance if available
            if (coords) {
                processed.sort((a, b) => {
                    const distA = a.distance?.includes('m') ? parseInt(a.distance) : parseFloat(a.distance || '99') * 1000;
                    const distB = b.distance?.includes('m') ? parseInt(b.distance) : parseFloat(b.distance || '99') * 1000;
                    return distA - distB;
                });
            }

            setPlaces(processed);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const getPlaceholderImage = (place: ExplorePlace) => {
        const keywords = place.cuisine ? place.cuisine.split(' ')[0] : place.category;
        return `https://loremflickr.com/400/300/${encodeURIComponent(keywords)},travel/all?lock=${place.id.length}`;
    };

    const customScrollbarStyle = `
    .custom-scrollbar::-webkit-scrollbar {
      width: 12px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: #f1f5f9;
      border-left: 2px solid #334155;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #fde047;
      border: 2px solid #334155;
      border-radius: 99px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #fbcfe8;
    }
  `;

    return (
        <div className="h-full flex flex-col gap-4 relative">
             <style>{customScrollbarStyle}</style>

            {/* Top Ribbon */}
            <div className="bg-white p-4 rounded-3xl border-4 border-omni-dark shadow-cartoon-sm flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                         <h2 className="text-2xl font-black text-omni-dark flex items-center gap-2">
                            <MapPin className="text-omni-pink" /> 
                            {permissionStatus === 'granted' ? "Near Me" : `Explore ${location}`}
                        </h2>
                        {permissionStatus === 'denied' && (
                             <button onClick={handleLocateMe} className="bg-gray-100 hover:bg-gray-200 p-2 rounded-full border-2 border-omni-dark text-xs font-bold flex items-center gap-1">
                                <LocateFixed size={14} /> Retry GPS
                             </button>
                        )}
                    </div>

                    <div className="flex bg-gray-100 p-1 rounded-2xl border-2 border-omni-dark">
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`px-4 py-2 rounded-xl font-black text-xs flex items-center gap-2 transition-all ${viewMode === 'list' ? 'bg-white shadow-cartoon-sm border-2 border-omni-dark translate-y-[-2px]' : 'hover:bg-white/50'}`}
                        >
                            <List size={16} /> LIST
                        </button>
                        <button 
                            onClick={() => setViewMode('map')}
                            className={`px-4 py-2 rounded-xl font-black text-xs flex items-center gap-2 transition-all ${viewMode === 'map' ? 'bg-omni-blue shadow-cartoon-sm border-2 border-omni-dark translate-y-[-2px]' : 'hover:bg-white/50'}`}
                        >
                            <MapIcon size={16} /> MAP
                        </button>
                    </div>
                </div>

                {/* Categories Ribbon */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {CATEGORIES.map((cat) => (
                        <button
                            key={cat.label}
                            onClick={() => setSelectedCategory(cat.label)}
                            className={`flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl border-2 font-black text-xs uppercase transition-all whitespace-nowrap ${
                                selectedCategory === cat.label
                                    ? 'bg-omni-yellow border-omni-dark shadow-cartoon-sm translate-y-[-2px]'
                                    : 'bg-white border-gray-200 text-gray-400 hover:border-omni-dark hover:text-omni-dark'
                            }`}
                        >
                            <cat.icon size={16} />
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 bg-white rounded-[2.5rem] border-4 border-omni-dark shadow-cartoon overflow-hidden relative">
                
                {/* Permission Request State */}
                {permissionStatus === 'prompt' && !isLoading && (
                    <div className="absolute inset-0 z-20 bg-white/90 flex flex-col items-center justify-center text-center p-6">
                        <div className="w-20 h-20 bg-omni-blue rounded-full border-4 border-omni-dark flex items-center justify-center animate-bounce mb-4">
                            <Navigation size={40} className="text-omni-dark" />
                        </div>
                        <h3 className="text-2xl font-black mb-2">Use Location? 🌍</h3>
                        <p className="text-gray-500 font-bold mb-6 max-w-xs">Omnitrip needs your GPS to find hidden gems right around you!</p>
                        <div className="flex gap-4">
                             <button 
                                onClick={() => setPermissionStatus('denied')}
                                className="px-6 py-3 rounded-2xl border-2 border-omni-dark font-black text-gray-400 hover:bg-gray-100"
                            >
                                NO THANKS
                             </button>
                             <button 
                                onClick={handleLocateMe}
                                className="px-6 py-3 rounded-2xl border-2 border-omni-dark bg-omni-green font-black shadow-cartoon-sm hover:translate-y-[-2px] active:translate-y-0"
                            >
                                ALLOW GPS
                             </button>
                        </div>
                    </div>
                )}

                {isLoading ? (
                     <div className="absolute inset-0 z-10 bg-white flex items-center justify-center">
                         <ThinkingChain 
                            steps={[
                                permissionStatus === 'granted' ? "Triangulating your position... 📡" : `Scanning ${location}... 🔭`,
                                "Digging for hidden gems... 💎",
                                "Searching street food to fine dining... 🍜",
                                "Checking opening hours... 🕰️",
                                "Curating your top picks! 📋"
                            ]} 
                        />
                     </div>
                ) : viewMode === 'list' ? (
                    <div className="h-full overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {places.map((place, idx) => (
                            <div 
                                key={place.id}
                                onClick={() => setSelectedPlace(place)}
                                className="group bg-white rounded-3xl border-4 border-omni-dark shadow-cartoon-sm hover:translate-y-[-2px] hover:shadow-cartoon transition-all cursor-pointer overflow-hidden flex flex-row h-32 md:h-40"
                            >
                                {/* Left Image (Fixed Width) */}
                                <div className="w-28 md:w-40 bg-gray-100 border-r-4 border-omni-dark relative shrink-0">
                                     <img 
                                        src={place.imageUrl && place.imageUrl.startsWith('http') ? place.imageUrl : getPlaceholderImage(place)} 
                                        alt={place.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = getPlaceholderImage(place);
                                        }}
                                     />
                                     <div className="absolute inset-0 bg-omni-dark/10 group-hover:bg-transparent transition-colors" />
                                     
                                     {/* Index Badge */}
                                     <div className="absolute top-2 left-2 w-6 h-6 bg-omni-yellow border-2 border-omni-dark rounded-lg flex items-center justify-center font-black text-xs shadow-sm">
                                         {idx + 1}
                                     </div>
                                </div>
                                
                                {/* Right Content */}
                                <div className="flex-1 p-3 md:p-4 flex flex-col justify-between overflow-hidden">
                                    <div>
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className="text-base md:text-lg font-black text-omni-dark line-clamp-1 truncate pr-2 group-hover:text-blue-600">
                                                {place.name}
                                            </h3>
                                            {place.distance && (
                                                <span className="shrink-0 bg-omni-blue px-2 py-0.5 rounded-md border border-omni-dark text-[10px] font-black whitespace-nowrap">
                                                    📍 {place.distance}
                                                </span>
                                            )}
                                        </div>
                                        
                                        <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase text-gray-400 mb-2">
                                            <span>{place.category}</span>
                                            {place.cuisine && <span className="text-orange-500">• {place.cuisine}</span>}
                                            {place.priceLevel && <span className="text-green-600">• {place.priceLevel}</span>}
                                        </div>

                                        <p className="text-xs font-bold text-gray-500 line-clamp-2 leading-tight">
                                            {place.description}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3 mt-1">
                                         <div className="flex items-center gap-1 bg-yellow-100 px-2 py-0.5 rounded-lg border border-yellow-300">
                                             <Star size={10} className="text-omni-dark fill-omni-yellow" />
                                             <span className="text-xs font-black">{place.rating}</span>
                                         </div>
                                         {place.events && place.events.length > 0 && (
                                             <span className="text-[10px] font-black text-omni-pink animate-pulse">
                                                 🎉 {place.events.length} Event
                                             </span>
                                         )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        
                        {places.length === 0 && !isLoading && (
                            <div className="flex flex-col items-center justify-center h-full opacity-50">
                                <Search size={48} className="text-gray-300 mb-4" />
                                <p className="text-xl font-black text-gray-400">Nothing nearby! 🌵</p>
                                <p className="text-xs font-bold text-gray-400">Try switching categories or moving around.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="h-full w-full">
                         <MapView 
                            explorePlaces={places} 
                            isFullView={true} 
                            center={places.length > 0 ? [places[0].lat, places[0].lng] : (userLocation ? [userLocation.lat, userLocation.lng] : undefined)}
                        />
                    </div>
                )}
            </div>

            {/* Place Detail Modal */}
            {selectedPlace && (
                <div className="fixed inset-0 z-[200] bg-omni-dark/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-2xl max-h-[85vh] rounded-[2.5rem] border-4 border-omni-dark shadow-cartoon-lg flex flex-col overflow-hidden animate-in zoom-in-95">
                        {/* Header Image */}
                        <div className="h-48 bg-gray-100 border-b-4 border-omni-dark relative flex items-center justify-center overflow-hidden">
                             <img 
                                src={selectedPlace.imageUrl && selectedPlace.imageUrl.startsWith('http') ? selectedPlace.imageUrl : getPlaceholderImage(selectedPlace)}
                                alt={selectedPlace.name}
                                className="w-full h-full object-cover"
                             />
                             <div className="absolute inset-0 bg-gradient-to-t from-omni-dark/80 via-transparent to-transparent pointer-events-none" />

                             <button 
                                onClick={() => setSelectedPlace(null)}
                                className="absolute top-4 right-4 w-10 h-10 bg-white border-2 border-omni-dark rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors z-20 shadow-cartoon-sm"
                            >
                                <X size={20} />
                            </button>
                            <div className="absolute bottom-4 left-6 bg-white px-4 py-2 rounded-xl border-2 border-omni-dark shadow-cartoon-sm z-20 flex flex-col">
                                <h3 className="text-2xl font-black text-omni-dark">{selectedPlace.name}</h3>
                                {selectedPlace.distance && (
                                     <span className="text-xs font-black text-blue-600 flex items-center gap-1 mt-1">
                                        <Navigation size={12} /> {selectedPlace.distance} away
                                     </span>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white custom-scrollbar">
                            {/* Stats */}
                            <div className="flex gap-4 flex-wrap">
                                <div className="bg-omni-yellow px-4 py-2 rounded-xl border-2 border-omni-dark flex items-center gap-2 font-black text-sm">
                                    <Star size={16} /> {selectedPlace.rating} Rating
                                </div>
                                {selectedPlace.priceLevel && (
                                    <div className="bg-omni-green px-4 py-2 rounded-xl border-2 border-omni-dark flex items-center gap-2 font-black text-sm">
                                        <DollarSign size={16} /> {selectedPlace.priceLevel}
                                    </div>
                                )}
                                <div className="bg-gray-100 px-4 py-2 rounded-xl border-2 border-omni-dark flex items-center gap-2 font-black text-sm text-gray-600">
                                    <MapPin size={16} /> {selectedPlace.address || 'Address hidden'}
                                </div>
                            </div>

                            {/* Description */}
                            <div className="bg-sky-50 p-4 rounded-2xl border-l-4 border-omni-dark">
                                <h4 className="font-black text-sm uppercase text-gray-400 mb-2 flex items-center gap-2">
                                    <Info size={14}/> About
                                </h4>
                                <p className="text-sm font-bold leading-relaxed">{selectedPlace.description}</p>
                            </div>

                            {/* Reviews */}
                            <div>
                                <h4 className="font-black text-lg mb-4 flex items-center gap-2">💬 Reviews</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {selectedPlace.reviews.map((rev, i) => (
                                        <div key={i} className="bg-gray-50 p-4 rounded-2xl border-2 border-gray-200">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-black text-xs uppercase">{rev.user}</span>
                                                <div className="flex text-omni-yellow">
                                                    {[...Array(5)].map((_, starI) => (
                                                        <Star key={starI} size={10} fill={starI < rev.rating ? "currentColor" : "none"} className={starI < rev.rating ? "text-omni-yellow" : "text-gray-300"} />
                                                    ))}
                                                </div>
                                            </div>
                                            <p className="text-xs italic text-gray-600">"{rev.text}"</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExploreView;
