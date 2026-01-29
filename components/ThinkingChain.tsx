import React, { useState, useEffect } from 'react';
import { Loader2, Check, Sparkles, BrainCircuit } from 'lucide-react';

interface ThinkingChainProps {
  steps: string[];
  className?: string;
}

const ThinkingChain: React.FC<ThinkingChainProps> = ({ steps, className = "" }) => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (currentStep < steps.length - 1) {
      // Steps take between 1.5s and 2.5s to feel realistic
      const duration = 1500 + Math.random() * 1000; 
      const timer = setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [currentStep, steps.length]);

  return (
    <div className={`flex flex-col items-center ${className}`}>
        {/* Animated Logo/Mascot */}
       <div className="relative mb-8">
            <div className="w-24 h-24 bg-omni-yellow rounded-full border-4 border-omni-dark flex items-center justify-center shadow-cartoon animate-bounce z-10 relative">
                <BrainCircuit size={48} className="text-omni-dark" />
            </div>
            <div className="absolute -top-2 -right-4 animate-pulse delay-75">
                <Sparkles size={32} className="text-omni-pink fill-omni-pink" />
            </div>
            <div className="absolute -bottom-2 -left-4 animate-pulse delay-150">
                <Sparkles size={24} className="text-omni-blue fill-omni-blue" />
            </div>
       </div>

       {/* Steps List */}
       <div className="w-full max-w-xs space-y-3">
          {steps.map((step, idx) => {
             // Don't render future steps yet
             if (idx > currentStep) return null;
             
             const isActive = idx === currentStep;
             
             return (
                <div key={idx} className={`flex items-center gap-3 transition-all duration-500 animate-in slide-in-from-bottom-2 fade-in ${isActive ? 'scale-105' : 'opacity-60'}`}>
                   <div className={`w-8 h-8 rounded-full border-2 border-omni-dark flex items-center justify-center shrink-0 transition-colors ${
                       isActive ? 'bg-white' : 'bg-omni-green'
                   }`}>
                       {isActive ? <Loader2 className="animate-spin text-omni-dark" size={16} /> : <Check size={16} strokeWidth={3} />}
                   </div>
                   <span className={`font-black text-sm md:text-base tracking-tight ${isActive ? 'text-omni-dark' : 'text-gray-400 line-through decoration-2'}`}>
                       {step}
                   </span>
                </div>
             );
          })}
       </div>
    </div>
  );
};

export default ThinkingChain;