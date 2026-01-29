
import React, { useState, useEffect } from 'react';
import { Map, Globe, Plane, Camera, Compass, X, Loader2, Check, Sparkles, Cloud } from 'lucide-react';

interface PlanningLoaderProps {
  destination: string;
  onCancel: () => void;
}

const LOADER_STEPS = [
  { id: 'step_init', title: "Unpacking your ideas... 🧳", subtitle: "Reviewing preferences", duration: 2000 },
  { id: 'step_logistics', title: "Checking the calendar... 📅", subtitle: "Looking at dates & transport", duration: 2500 },
  { id: 'step_geo', title: "Scanning the map... 🗺️", subtitle: "Finding the best neighborhoods", duration: 2000 },
  { id: 'step_gems', title: "Hunting for hidden gems... 💎", subtitle: "Locating local favorites", duration: 3000 },
  { id: 'step_vibe', title: "Checking the vibe... ✨", subtitle: "Weather, events, & atmosphere", duration: 2000 },
  { id: 'step_safety', title: "Ensuring safe travels... 🛡️", subtitle: "Checking travel advice", duration: 1500 },
  { id: 'step_final', title: "Polishing your itinerary... 📝", subtitle: "Putting it all together", duration: 1500 }
];

const PlanningLoader: React.FC<PlanningLoaderProps> = ({ destination, onCancel }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    if (currentStepIndex < LOADER_STEPS.length - 1) {
      const step = LOADER_STEPS[currentStepIndex];
      const timer = setTimeout(() => {
        setCurrentStepIndex(prev => prev + 1);
      }, step.duration);
      return () => clearTimeout(timer);
    }
  }, [currentStepIndex]);

  return (
    <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300 rounded-[2rem] overflow-hidden">
      
      {/* Animated Background Motifs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
         <Cloud className="absolute top-10 left-10 text-omni-blue animate-float" size={64} style={{ animationDuration: '8s' }} />
         <Cloud className="absolute bottom-20 right-10 text-omni-blue animate-float" size={48} style={{ animationDelay: '2s', animationDuration: '10s' }} />
         <Plane className="absolute top-1/4 right-1/4 text-omni-dark animate-wiggle" size={32} />
      </div>

      {/* Main Overlay Card */}
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] border-4 border-omni-dark shadow-cartoon-lg relative overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Header Ribbon */}
        <div className="bg-omni-yellow p-6 border-b-4 border-omni-dark flex items-center justify-between z-10">
           <div>
             <h3 className="text-xl font-black text-omni-dark leading-tight">Crafting your dream trip... 🌍</h3>
             <p className="text-xs font-bold text-omni-dark/60">To {destination || 'Unknown Lands'}</p>
           </div>
           <button 
             onClick={onCancel}
             className="w-10 h-10 bg-white rounded-full border-2 border-omni-dark flex items-center justify-center hover:bg-red-50 hover:border-red-500 hover:text-red-500 transition-all active:scale-95"
           >
             <X size={20} />
           </button>
        </div>

        {/* Dynamic Visual Area */}
        <div className="h-32 bg-sky-50 relative flex items-center justify-center border-b-4 border-omni-dark overflow-hidden">
             {/* Floating Icons */}
             <div className="absolute animate-float" style={{ animationDelay: '0s' }}>
                <Globe size={64} className="text-omni-blue fill-white" />
             </div>
             <div className="absolute top-4 right-10 animate-bounce" style={{ animationDuration: '3s' }}>
                <Compass size={24} className="text-omni-dark" />
             </div>
             <div className="absolute bottom-4 left-10 animate-bounce" style={{ animationDuration: '2.5s' }}>
                <Camera size={24} className="text-omni-pink" />
             </div>
             <div className="absolute top-8 left-8 animate-pulse">
                <Map size={20} className="text-omni-green" />
             </div>
             
             {/* Sparkles */}
             <Sparkles className="absolute top-4 left-1/2 text-omni-yellow animate-spin-slow" size={20} />
        </div>

        {/* Steps List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white custom-scrollbar">
           {LOADER_STEPS.map((step, idx) => {
              // Don't show steps too far in future
              if (idx > currentStepIndex + 1) return null;

              const isActive = idx === currentStepIndex;
              const isDone = idx < currentStepIndex;

              return (
                <div 
                  key={step.id} 
                  className={`flex items-start gap-4 transition-all duration-500 ${
                    isActive ? 'scale-105 opacity-100' : isDone ? 'opacity-50 scale-100' : 'opacity-0 translate-y-4'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-2xl border-2 border-omni-dark flex items-center justify-center shrink-0 transition-colors ${
                      isActive ? 'bg-omni-yellow shadow-cartoon-sm' : isDone ? 'bg-omni-green' : 'bg-gray-100'
                  }`}>
                      {isActive ? (
                        <Loader2 className="animate-spin text-omni-dark" size={20} /> 
                      ) : isDone ? (
                        <Check size={20} strokeWidth={3} className="text-omni-dark" />
                      ) : (
                        <div className="w-2 h-2 bg-gray-300 rounded-full" />
                      )}
                  </div>
                  <div>
                    <h4 className={`font-black text-sm ${isActive ? 'text-omni-dark' : 'text-gray-500'}`}>
                      {step.title}
                    </h4>
                    <p className="text-xs font-bold text-gray-400">{step.subtitle}</p>
                  </div>
                </div>
              );
           })}
        </div>
        
        {/* Footer Hint */}
        <div className="p-4 bg-gray-50 border-t-4 border-omni-dark text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">
               Creating the magic... ✨
            </p>
        </div>

      </div>
    </div>
  );
};

export default PlanningLoader;
