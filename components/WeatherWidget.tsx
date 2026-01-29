
import React, { useState } from 'react';
import { CloudRain, Sun, CloudSnow, CloudLightning, Cloud, Wind, ChevronRight, AlertTriangle } from 'lucide-react';
import { WeatherData } from '../types';

interface WeatherWidgetProps {
    weatherData: WeatherData[];
    onSimulateChange: (date: string, condition: WeatherData['condition']) => void;
    locationName: string;
}

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ weatherData, onSimulateChange, locationName }) => {
    const [isSimulating, setIsSimulating] = useState(false);

    const getWeatherIcon = (condition: string) => {
        switch (condition) {
            case 'Rain': return <CloudRain className="text-blue-400" size={32} />;
            case 'Snow': return <CloudSnow className="text-sky-200" size={32} />;
            case 'Storm': return <CloudLightning className="text-purple-500" size={32} />;
            case 'Cloudy': return <Cloud className="text-gray-400" size={32} />;
            default: return <Sun className="text-omni-yellow fill-omni-yellow" size={32} />;
        }
    };

    const handleSimulate = () => {
        if (weatherData.length === 0) return;
        setIsSimulating(true);
        // Force the first day to RAIN to demonstrate dynamic planning
        onSimulateChange(weatherData[0].date, 'Rain');
        setTimeout(() => setIsSimulating(false), 1000);
    };

    if (weatherData.length === 0) {
        return (
            <div className="bg-white rounded-3xl border-4 border-omni-dark p-6 shadow-cartoon-sm flex flex-col items-center justify-center text-center h-full">
                <Sun className="text-gray-200 mb-2" size={48} />
                <p className="text-gray-400 font-bold text-xs">No forecast data available.</p>
            </div>
        );
    }

    const today = weatherData[0];

    return (
        <div className="bg-white rounded-3xl border-4 border-omni-dark overflow-hidden shadow-cartoon-sm flex flex-col h-full relative group">
            {/* Header / Current */}
            <div className={`p-4 flex justify-between items-center transition-colors duration-500 ${today.condition === 'Rain' ? 'bg-blue-50' : 'bg-yellow-50'}`}>
                <div>
                    <h3 className="text-lg font-black text-omni-dark uppercase flex items-center gap-2">
                        {locationName}
                    </h3>
                    <p className="text-xs font-bold text-gray-500">{new Date(today.date).toLocaleDateString(undefined, {weekday: 'long'})}</p>
                </div>
                <div className="flex flex-col items-center">
                    <div className={`transform transition-transform ${isSimulating ? 'scale-125' : ''}`}>
                        {getWeatherIcon(today.condition)}
                    </div>
                    <span className="text-xl font-black">{today.temp}°{today.unit}</span>
                </div>
            </div>

            {/* Forecast List */}
            <div className="flex-1 p-4 bg-white overflow-y-auto custom-scrollbar">
                <div className="space-y-3">
                    {weatherData.slice(1).map((day, i) => (
                        <div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black w-8">{new Date(day.date).toLocaleDateString(undefined, {weekday: 'short'})}</span>
                                {getWeatherIcon(day.condition)}
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="font-bold text-sm">{day.temp}°</span>
                                <span className="text-[8px] text-gray-400 font-bold">{day.condition}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Simulation Control (Demo Feature) */}
            <div className="p-3 border-t-2 border-dashed border-gray-200 bg-gray-50">
                <button 
                    onClick={handleSimulate}
                    disabled={today.condition === 'Rain'}
                    className={`w-full py-2 rounded-xl border-2 font-black text-[10px] flex items-center justify-center gap-2 transition-all ${
                        today.condition === 'Rain' 
                        ? 'bg-blue-100 border-blue-300 text-blue-600' 
                        : 'bg-white border-omni-dark hover:bg-gray-100'
                    }`}
                >
                    {today.condition === 'Rain' ? (
                        <><AlertTriangle size={12}/> STORM ACTIVE (SIMULATED)</>
                    ) : (
                        <><Wind size={12}/> SIMULATE SUDDEN RAIN</>
                    )}
                </button>
                {today.condition === 'Rain' && (
                    <p className="text-[8px] text-center mt-1 text-red-500 font-bold animate-pulse">
                        Check Itinerary for Alerts!
                    </p>
                )}
            </div>
        </div>
    );
};

export default WeatherWidget;
