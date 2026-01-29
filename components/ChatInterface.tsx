
import React, { useState, useEffect, useRef } from 'react';
import { Send, MapPin, Globe, Sparkles, X, Coffee, Zap, DollarSign, Gem, Battery, BatteryCharging, BatteryFull } from 'lucide-react';
import { sendMessageToGemini, startChat } from '../services/geminiService';
import { ChatMessage, CalendarEvent, TripPacing, TripBudgetTier } from '../types';

interface ChatInterfaceProps {
  onPlanReady: (chatHistory: string, pacing: TripPacing, budgetTier: TripBudgetTier) => void;
  language: string;
  calendarEvents: CalendarEvent[];
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onPlanReady, language, calendarEvents }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Config Modal State
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [pacing, setPacing] = useState<TripPacing>('balanced');
  const [budgetTier, setBudgetTier] = useState<TripBudgetTier>('medium');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial greeting based on language
    startChat(language);
    
    // Simple greeting map
    const greetings: Record<string, string> = {
        'English': "Hi bestie! 👋 I'm Omnitrip! Where are we dreaming of going today? Let's check some flights first! ✈️🌍",
        'Spanish': "¡Hola mejor amigo! 👋 ¡Soy Omnitrip! ¿A dónde soñamos ir hoy? ¡Revisemos algunos vuelos primero! ✈️🌍",
        'French': "Salut meilleur ami ! 👋 Je suis Omnitrip ! Où rêvons-nous d'aller aujourd'hui ? Vérifions d'abord quelques vols ! ✈️🌍",
        'Chinese': "嗨，好朋友！👋 我是 Omnitrip！我们今天梦想去哪里？让我们先查看一些航班！ ✈️🌍",
        'Japanese': "やあ、親友！👋 私はOmnitripです！今日はどこへ行く夢を見ていますか？まずはフライトをチェックしましょう！✈️🌍"
    };

    setMessages([{
      id: 'init',
      role: 'model',
      text: greetings[language] || `Hi! I speak ${language}! Let's plan a trip! 🌍✈️`,
      timestamp: new Date()
    }]);
  }, [language]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await sendMessageToGemini(input, language);
      
      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text || "...",
        groundingLinks: response.links,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, modelMsg]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = () => {
     setIsConfigOpen(false);
     const history = messages.map(m => `${m.role}: ${m.text}`).join('\n');
     onPlanReady(history, pacing, budgetTier); 
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border-4 border-omni-dark shadow-cartoon overflow-hidden relative">
      <div className="bg-omni-pink p-4 border-b-4 border-omni-dark flex justify-between items-center">
        <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-omni-dark">Consultant 💬</h2>
            {calendarEvents.length > 0 && (
                <span className="bg-omni-yellow text-[10px] font-black px-2 py-1 rounded-full border border-omni-dark">
                    📅 CALENDAR SYNCED
                </span>
            )}
        </div>
        <button 
          onClick={() => setIsConfigOpen(true)}
          className="bg-omni-yellow px-4 py-2 rounded-xl font-black border-2 border-omni-dark shadow-cartoon-sm hover:translate-y-0.5 active:shadow-none transition-all text-xs sm:text-base flex items-center gap-2"
        >
          <Sparkles size={16}/> Generate Plan!
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[80%] p-4 rounded-2xl border-2 border-omni-dark shadow-cartoon-sm text-sm md:text-base whitespace-pre-wrap ${
                msg.role === 'user' ? 'bg-omni-blue rounded-tr-none' : 'bg-white rounded-tl-none'
              }`}
            >
              {msg.text}
              {msg.groundingLinks && msg.groundingLinks.length > 0 && (
                <div className="mt-3 pt-2 border-t border-dashed border-omni-dark">
                  <p className="text-[10px] font-black uppercase mb-1">Places Found:</p>
                  {msg.groundingLinks.map((link, i) => (
                    <a key={i} href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline text-[10px] mb-1 font-bold">
                      {link.type === 'map' ? <MapPin size={10} /> : <Globe size={10} />}
                      {link.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
           <div className="flex justify-start">
             <div className="bg-gray-100 p-4 rounded-2xl rounded-tl-none border-2 border-omni-dark animate-pulse text-sm font-black italic">
               Planning... 🌍
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-gray-50 border-t-4 border-omni-dark">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="..."
            className="flex-1 p-3 rounded-xl border-2 border-omni-dark focus:outline-none focus:ring-2 focus:ring-omni-yellow font-bold"
          />
          <button 
            onClick={handleSend}
            disabled={loading}
            className="bg-omni-green p-3 rounded-xl border-2 border-omni-dark shadow-cartoon-sm hover:bg-emerald-300 disabled:opacity-50 active:translate-y-0.5 active:shadow-none transition-all"
          >
            <Send size={24} className="text-omni-dark" />
          </button>
        </div>
      </div>

      {/* --- CONFIGURATION MODAL --- */}
      {isConfigOpen && (
          <div className="absolute inset-0 z-50 bg-omni-dark/40 backdrop-blur-sm flex items-end md:items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white w-full max-w-sm rounded-[2.5rem] border-4 border-omni-dark shadow-cartoon-lg overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95">
                  <div className="bg-omni-yellow p-4 border-b-4 border-omni-dark flex justify-between items-center">
                      <h3 className="font-black text-lg flex items-center gap-2 text-omni-dark">
                          <Sparkles size={20} /> TRIP SETTINGS
                      </h3>
                      <button onClick={() => setIsConfigOpen(false)} className="w-8 h-8 bg-white border-2 border-omni-dark rounded-full flex items-center justify-center hover:bg-gray-100">
                          <X size={16} />
                      </button>
                  </div>
                  
                  <div className="p-6 space-y-6">
                      
                      {/* Pacing Selector */}
                      <div>
                          <p className="text-xs font-black text-gray-400 uppercase mb-3 flex items-center gap-1">
                              <BatteryFull size={14} /> Busyness / Pacing
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                              <button 
                                onClick={() => setPacing('relaxed')}
                                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${pacing === 'relaxed' ? 'bg-omni-green border-omni-dark shadow-cartoon-sm' : 'bg-gray-50 border-gray-200 text-gray-400'}`}
                              >
                                  <Coffee size={24} />
                                  <span className="text-[10px] font-black uppercase">Relaxed</span>
                              </button>
                              <button 
                                onClick={() => setPacing('balanced')}
                                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${pacing === 'balanced' ? 'bg-omni-blue border-omni-dark shadow-cartoon-sm' : 'bg-gray-50 border-gray-200 text-gray-400'}`}
                              >
                                  <BatteryCharging size={24} />
                                  <span className="text-[10px] font-black uppercase">Balanced</span>
                              </button>
                              <button 
                                onClick={() => setPacing('packed')}
                                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${pacing === 'packed' ? 'bg-omni-pink border-omni-dark shadow-cartoon-sm' : 'bg-gray-50 border-gray-200 text-gray-400'}`}
                              >
                                  <Zap size={24} />
                                  <span className="text-[10px] font-black uppercase">Packed</span>
                              </button>
                          </div>
                      </div>

                      {/* Budget Selector */}
                      <div>
                          <p className="text-xs font-black text-gray-400 uppercase mb-3 flex items-center gap-1">
                              <DollarSign size={14} /> Spending Vibe
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                              <button 
                                onClick={() => setBudgetTier('budget')}
                                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${budgetTier === 'budget' ? 'bg-green-100 border-green-500 text-green-700 shadow-cartoon-sm' : 'bg-gray-50 border-gray-200 text-gray-400'}`}
                              >
                                  <span className="text-xl">💸</span>
                                  <span className="text-[10px] font-black uppercase">Saver</span>
                              </button>
                              <button 
                                onClick={() => setBudgetTier('medium')}
                                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${budgetTier === 'medium' ? 'bg-blue-100 border-blue-500 text-blue-700 shadow-cartoon-sm' : 'bg-gray-50 border-gray-200 text-gray-400'}`}
                              >
                                  <span className="text-xl">💰</span>
                                  <span className="text-[10px] font-black uppercase">Standard</span>
                              </button>
                              <button 
                                onClick={() => setBudgetTier('splurge')}
                                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${budgetTier === 'splurge' ? 'bg-purple-100 border-purple-500 text-purple-700 shadow-cartoon-sm' : 'bg-gray-50 border-gray-200 text-gray-400'}`}
                              >
                                  <Gem size={24} />
                                  <span className="text-[10px] font-black uppercase">Splurge</span>
                              </button>
                          </div>
                      </div>

                      <div className="bg-gray-50 p-3 rounded-xl border-2 border-gray-200 text-[10px] font-bold text-gray-500 italic">
                          "I'll make sure to include Breakfast, Lunch, and Dinner recommendations based on your budget!"
                      </div>

                      <button 
                          onClick={handleCreatePlan}
                          className="w-full py-4 bg-omni-green rounded-2xl border-4 border-omni-dark font-black text-lg shadow-cartoon active:translate-y-1 transition-all flex items-center justify-center gap-2 hover:bg-emerald-300"
                      >
                          <Sparkles size={20} /> CREATE ITINERARY
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ChatInterface;
