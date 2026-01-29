
import React, { useEffect, useState, useRef } from 'react';
import { OfflineKnowledge } from '../types';
import { 
  Plane, 
  BookOpen, 
  Coffee, 
  Landmark, 
  Sparkles, 
  Smile, 
  Navigation, 
  Globe, 
  Cloud,
  Heart,
  Star,
  Map as MapIcon,
  MessageCircle,
  Send,
  X,
  User,
  RefreshCw,
  Zap
} from 'lucide-react';
import { chatWithLocalResident } from '../services/geminiService';

interface OfflineModeProps {
  knowledge?: OfflineKnowledge;
  destination: string;
  language: string;
  onRefresh: () => Promise<void>;
}

// Custom Mascot Components
const SuitcaseMascot = () => (
  <div className="w-16 h-16 relative animate-float">
    <div className="w-12 h-10 bg-omni-pink border-4 border-omni-dark rounded-lg relative shadow-cartoon-sm mx-auto">
      <div className="absolute top-1 left-1 w-2 h-2 bg-white rounded-full"></div>
      <div className="absolute top-4 left-2 w-8 h-1 bg-omni-dark opacity-20"></div>
      {/* Eyes */}
      <div className="absolute top-3 left-3 w-1.5 h-1.5 bg-omni-dark rounded-full"></div>
      <div className="absolute top-3 right-3 w-1.5 h-1.5 bg-omni-dark rounded-full"></div>
      {/* Smile */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-4 h-2 border-b-2 border-omni-dark rounded-full"></div>
    </div>
    <div className="w-6 h-3 border-4 border-omni-dark border-b-0 rounded-t-lg mx-auto -mt-1"></div>
  </div>
);

const GlobeMascot = () => (
  <div className="w-16 h-16 relative animate-float" style={{ animationDelay: '0.5s' }}>
    <div className="w-12 h-12 bg-omni-blue border-4 border-omni-dark rounded-full relative shadow-cartoon-sm mx-auto overflow-hidden">
      <div className="absolute top-2 left-2 w-4 h-3 bg-omni-green rounded-full opacity-60"></div>
      <div className="absolute bottom-2 right-1 w-5 h-4 bg-omni-green rounded-full opacity-60"></div>
      {/* Eyes */}
      <div className="absolute top-4 left-3 w-2 h-2 bg-omni-dark rounded-full"></div>
      <div className="absolute top-4 right-3 w-2 h-2 bg-omni-dark rounded-full"></div>
      {/* Smile */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-4 h-2 border-b-2 border-omni-dark rounded-full"></div>
    </div>
    <div className="w-8 h-2 bg-omni-dark rounded-full mx-auto -mt-1 opacity-20"></div>
  </div>
);

const FlightMap: React.FC<{ destLat: number; destLng: number }> = ({ destLat, destLng }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => (p < 1 ? p + 0.003 : 0));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const startX = 15;
  const startY = 75;
  const endX = 85;
  const endY = 25;
  const ctrlX = 50;
  const ctrlY = 10;

  const t = progress;
  const curX = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * ctrlX + t * t * endX;
  const curY = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * ctrlY + t * t * endY;

  return (
    <div className="w-full h-full bg-sky-100 relative overflow-hidden flex items-center justify-center">
      {/* Cartoon Background Elements */}
      <div className="absolute inset-0 opacity-20">
         <Cloud className="absolute top-10 left-10 text-white cloud" size={48} />
         <Cloud className="absolute bottom-20 right-20 text-white cloud" style={{ animationDelay: '1s' }} size={64} />
         <Cloud className="absolute top-1/2 left-1/3 text-white cloud" style={{ animationDelay: '2s' }} size={32} />
      </div>
      
      <svg className="w-full h-full p-8 relative z-10" viewBox="0 0 100 100">
        <defs>
          <filter id="shadow">
            <feDropShadow dx="2" dy="2" stdDeviation="0" floodColor="#334155" />
          </filter>
        </defs>
        <path 
          d={`M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`} 
          fill="none" 
          stroke="#334155" 
          strokeWidth="2" 
          strokeDasharray="4,4" 
        />
        <g transform={`translate(${startX-5}, ${startY-5})`}>
          <rect width="10" height="10" fill="white" stroke="#334155" strokeWidth="1" />
          <path d="M0,0 L5,-5 L10,0" fill="white" stroke="#334155" strokeWidth="1" />
        </g>
        <g transform={`translate(${endX}, ${endY})`}>
          <circle r="6" fill="#fde047" stroke="#334155" strokeWidth="2" filter="url(#shadow)" />
          <Sparkles className="text-omni-dark -translate-x-3 -translate-y-3" size={12} />
        </g>
        <g transform={`translate(${curX}, ${curY}) rotate(${-20})`}>
           <rect x="-8" y="-4" width="16" height="8" rx="4" fill="white" stroke="#334155" strokeWidth="2" filter="url(#shadow)" />
           <path d="M-4,4 L-6,8 M4,4 L6,8" stroke="#334155" strokeWidth="2" />
           <circle cx="-3" cy="-1" r="1" fill="#334155" />
           <circle cx="3" cy="-1" r="1" fill="#334155" />
           <path d="M-2,2 Q0,4 2,2" fill="none" stroke="#334155" strokeWidth="1" />
        </g>
      </svg>

      <div className="absolute bottom-6 left-6 bg-white border-4 border-omni-dark p-3 rounded-2xl shadow-cartoon-sm flex items-center gap-3">
        <div className="w-10 h-10 bg-omni-green rounded-full border-2 border-omni-dark flex items-center justify-center animate-wiggle">
            <Navigation className="text-omni-dark" size={20} />
        </div>
        <div>
            <p className="text-xs font-black uppercase">FLYING! ✈️</p>
        </div>
      </div>
    </div>
  );
};

const OfflineMode: React.FC<OfflineModeProps> = ({ knowledge, destination, language, onRefresh }) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isTyping]);

  useEffect(() => {
    if (isChatOpen && chatMessages.length === 0) {
      setChatMessages([{
        role: 'model',
        text: `Hey bestie! 👋 I'm your local guide from ${destination}! I've got deep secrets from our central data bank! Ask me anything about our culture, hidden politics, or legends while you're soaring! 🍕🏰`
      }]);
    }
  }, [isChatOpen, destination]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !knowledge || isTyping) return;

    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    setIsTyping(true);

    try {
      const response = await chatWithLocalResident(userMsg, knowledge, destination, language);
      setChatMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'model', text: "Signal lost in the clouds! ☁️ Try again in a bit?" }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    try {
        await onRefresh();
    } finally {
        setIsRefreshing(false);
    }
  }

  if (!knowledge) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-white rounded-3xl border-4 border-omni-dark shadow-cartoon overflow-hidden relative">
        <div className="animate-float">
            <GlobeMascot />
        </div>
        <h2 className="text-3xl font-black mb-4 mt-4">Empty Bag! 🧳</h2>
        <p className="text-gray-500 max-w-md font-black italic uppercase">
          "Bestie, generate a plan first!"
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto space-y-8 pb-32 px-2 relative">
      <div className="relative">
        <div className="bg-omni-yellow p-8 rounded-3xl border-4 border-omni-dark shadow-cartoon-lg flex flex-col md:flex-row items-center gap-6 overflow-hidden">
            <div className="relative z-10 p-2 bg-white rounded-2xl border-4 border-omni-dark shadow-cartoon-sm -rotate-3 transition-transform">
                <Plane size={48} className="text-omni-dark animate-float" />
            </div>
            <div className="relative z-10 text-center md:text-left flex-1">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-3xl md:text-4xl font-black text-omni-dark tracking-tight uppercase">BESTIE GUIDE ✨</h2>
                    <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
                        <span className="bg-white px-3 py-1 rounded-full border-2 border-omni-dark font-black text-sm uppercase">{destination}</span>
                        <Heart className="text-red-400 fill-red-400 animate-pulse" size={20} />
                    </div>
                  </div>
                  <button 
                    onClick={handleRefreshClick}
                    disabled={isRefreshing}
                    className="bg-white border-4 border-omni-dark px-4 py-2 rounded-2xl font-black text-xs flex items-center gap-2 shadow-cartoon-sm hover:translate-y-0.5 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                  >
                    <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
                    REFRESH BATCH
                  </button>
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 h-[400px] bg-white rounded-3xl border-4 border-omni-dark shadow-cartoon overflow-hidden relative group">
           <FlightMap destLat={knowledge.destLat || 0} destLng={knowledge.destLng || 0} />
        </div>

        <div className="flex flex-col gap-6">
            <div className="flex justify-center">
                <SuitcaseMascot />
            </div>
            <div className="bg-white p-6 rounded-3xl border-4 border-omni-dark shadow-cartoon relative sticker-hover">
                <h3 className="text-2xl font-black mb-4 flex items-center gap-2">
                    <Smile className="text-omni-pink"/> Culture Deep Dive
                </h3>
                <p className="text-sm md:text-base leading-relaxed text-gray-700 whitespace-pre-wrap font-black italic">
                    {knowledge.culture}
                </p>
            </div>
        </div>

        <div className="bg-omni-blue p-8 rounded-3xl border-4 border-omni-dark shadow-cartoon relative sticker-hover">
          <h3 className="text-2xl font-black mb-4 flex items-center gap-2">
            <Landmark className="text-omni-dark"/> Origins & Roots
          </h3>
          <p className="text-base leading-relaxed text-omni-dark whitespace-pre-wrap italic font-black opacity-80">
            {knowledge.historyAndPolitics}
          </p>
        </div>

        <div className="bg-red-100 p-8 rounded-3xl border-4 border-omni-dark shadow-cartoon relative sticker-hover">
          <h3 className="text-2xl font-black mb-4 flex items-center gap-2">
            <Zap className="text-red-600"/> Politics & Tensions
          </h3>
          <p className="text-base leading-relaxed text-red-900 whitespace-pre-wrap font-black italic">
            {knowledge.politicsConflicts}
          </p>
        </div>

        <div className="bg-omni-pink p-8 rounded-3xl border-4 border-omni-dark shadow-cartoon relative sticker-hover">
          <h3 className="text-2xl font-black mb-4 flex items-center gap-2">
            <Coffee className="text-omni-dark"/> Local Chill
          </h3>
          <p className="text-base leading-relaxed text-omni-dark whitespace-pre-wrap font-black italic">
            {knowledge.leisureTips}
          </p>
        </div>

        <div className="md:col-span-3 bg-white p-8 rounded-3xl border-4 border-omni-dark shadow-cartoon-lg relative overflow-hidden">
          <h3 className="text-2xl md:text-3xl font-black mb-8 flex items-center gap-4">
            <div className="w-12 h-12 bg-omni-green rounded-2xl border-4 border-omni-dark flex items-center justify-center shadow-cartoon-sm -rotate-6">
                <BookOpen className="text-omni-dark"/> 
            </div>
            LOCAL LEGENDS & LOLS
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {knowledge.funnyStories.map((story, i) => (
              <div key={i} className="p-6 bg-white border-4 border-dashed border-omni-dark rounded-3xl relative">
                  <span className="absolute -left-4 -top-4 w-10 h-10 bg-omni-yellow border-4 border-omni-dark rounded-full flex items-center justify-center text-lg font-black shadow-cartoon-sm">
                  {i + 1}
                  </span>
                  <p className="text-base md:text-lg font-black italic leading-relaxed">"{story}"</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Local Bestie Chat */}
      <div className="fixed bottom-6 right-6 z-50">
        {!isChatOpen ? (
          <button 
            onClick={() => setIsChatOpen(true)}
            className="w-16 h-16 bg-omni-yellow rounded-full border-4 border-omni-dark shadow-cartoon flex items-center justify-center hover:scale-110 transition-transform animate-float group"
          >
            <MessageCircle size={32} className="text-omni-dark group-hover:rotate-12 transition-transform" />
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-omni-green border-2 border-omni-dark rounded-full flex items-center justify-center">
                <span className="text-[10px] font-black">Hi!</span>
            </div>
          </button>
        ) : (
          <div className="w-[320px] h-[450px] bg-white rounded-3xl border-4 border-omni-dark shadow-cartoon-lg flex flex-col overflow-hidden animate-in slide-in-from-bottom-10">
            {/* Chat Header */}
            <div className="bg-omni-green p-4 border-b-4 border-omni-dark flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-white rounded-full border-2 border-omni-dark flex items-center justify-center overflow-hidden">
                   <User className="text-omni-dark" size={20} />
                </div>
                <div>
                   <h4 className="font-black text-xs uppercase leading-none">Local Bestie</h4>
                   <p className="text-[10px] font-bold text-omni-dark/60">EXPERT FROM {destination.split(' ')[0].toUpperCase()}</p>
                </div>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="w-8 h-8 bg-white/50 rounded-full border-2 border-omni-dark flex items-center justify-center hover:bg-white">
                <X size={16} />
              </button>
            </div>

            {/* Chat Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 scrollbar-hide"
            >
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl border-2 border-omni-dark text-xs font-bold leading-relaxed ${
                    m.role === 'user' ? 'bg-omni-blue rounded-tr-none' : 'bg-white rounded-tl-none'
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white p-3 rounded-2xl rounded-tl-none border-2 border-omni-dark text-[10px] font-black italic animate-pulse">
                    Pulling from central brain... 🤫
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="p-3 border-t-4 border-omni-dark bg-white">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask about local secrets..."
                  className="flex-1 bg-gray-100 border-2 border-omni-dark p-2 rounded-xl text-xs font-bold focus:outline-none"
                />
                <button 
                  onClick={handleSendMessage}
                  className="bg-omni-yellow p-2 rounded-xl border-2 border-omni-dark shadow-cartoon-sm hover:translate-y-0.5 active:translate-y-1 transition-all"
                >
                  <Send size={18} className="text-omni-dark" />
                </button>
              </div>
              <p className="text-[8px] font-black text-center mt-2 text-gray-400 uppercase tracking-tighter">Extended Knowledge Brain Active 🧠</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OfflineMode;
