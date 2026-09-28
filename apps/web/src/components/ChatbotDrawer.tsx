import React, { useState, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, AlertTriangle, MapPin, Sprout } from 'lucide-react';

interface Props {
  selectedGpcode: string | null;
  panchayatName: string | null;
  selectedCrop: string | null;
  isOpenMobile?: boolean;
  setIsOpenMobile?: (open: boolean) => void;
}

export default function ChatbotDrawer({ selectedGpcode, panchayatName, selectedCrop, isOpenMobile, setIsOpenMobile }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Sync with mobile state if provided
  useEffect(() => {
    if (isOpenMobile !== undefined) {
      setIsOpen(isOpenMobile);
    }
  }, [isOpenMobile]);

  const handleClose = () => {
    setIsOpen(false);
    if (setIsOpenMobile) setIsOpenMobile(false);
  };

  const [messages, setMessages] = useState<{role: 'bot' | 'user', text: string}[]>([
    { role: 'bot', text: 'Hello! I am your Panchayat Weather Copilot. How can I help you interpret the weather or agricultural data today?' }
  ]);
  const [input, setInput] = useState('');

  const suggestedQuestions = [
    "Will it rain tomorrow?",
    "Should I irrigate my crop?",
    "Is this week suitable for field activity?",
    "Why is there a weather alert?",
    "Explain today's weather.",
    "Why is the downscaled rainfall different from ERA5?"
  ];

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    
    // Mock response
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'bot', 
        text: 'This is a prototype UI. The live LLM integration (Panchayat Weather Copilot) is planned for the next phase. I cannot answer real questions yet.' 
      }]);
    }, 600);
  };

  return (
    <>
      {/* Floating Action Button (Desktop Only) */}
      {selectedGpcode && (
        <button 
          onClick={() => setIsOpen(true)}
          className="hidden md:flex fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-xl shadow-blue-900/20 items-center justify-center transition-transform hover:scale-105 z-40 group"
          aria-label="Ask Panchayat AI"
        >
          <MessageSquare size={24} />
          <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 ease-in-out font-medium group-hover:ml-3 group-hover:mr-1">
            Ask Panchayat AI
          </span>
        </button>
      )}

      {/* Drawer Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 md:bg-black/20 z-50 md:z-40 backdrop-blur-sm transition-opacity" 
          onClick={handleClose}
        />
      )}

      {/* Drawer Panel */}
      {/* Mobile: 100% width, Desktop: 400px. Respects safe-area on mobile. */}
      <div className={`fixed top-0 right-0 h-full w-full md:w-[400px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="bg-blue-600 p-4 md:p-5 text-white flex justify-between items-start shrink-0 pt-[calc(1rem+env(safe-area-inset-top))]">
          <div>
            <h2 className="font-bold text-base md:text-lg flex items-center gap-2"><Bot size={20}/> Panchayat Copilot</h2>
            <p className="text-blue-100 text-xs md:text-sm mt-1">Ask about weather and agriculture.</p>
          </div>
          <button onClick={handleClose} className="text-blue-100 hover:text-white bg-blue-700/50 p-1 rounded-md">
            <X size={20} />
          </button>
        </div>

        {/* Context Bar */}
        <div className="bg-blue-50 px-4 py-2 border-b border-blue-100 flex items-center gap-3 shrink-0 text-[10px] md:text-xs overflow-x-auto whitespace-nowrap hide-scrollbar">
          <div className="flex items-center gap-1.5 text-blue-800 bg-blue-100/50 px-2 py-1 rounded">
             <MapPin size={12}/> 
             <span className="font-semibold truncate max-w-[150px]">{panchayatName || "No Panchayat"}</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-100/50 px-2 py-1 rounded">
             <Sprout size={12}/> 
             <span className="font-semibold">{selectedCrop || "Select a crop"}</span>
          </div>
        </div>

        {/* Prototype Warning */}
        <div className="bg-amber-50 border-b border-amber-200 p-2 md:p-3 flex items-start gap-2 md:gap-3 shrink-0">
          <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={14} />
          <div className="text-[10px] md:text-xs text-amber-800 leading-tight">
            <strong>Prototype Interface:</strong> Conversational AI backend planned for the next development phase.
          </div>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 flex flex-col gap-4 bg-gray-50 pb-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 md:gap-3 max-w-[90%] md:max-w-[85%] ${msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}>
              <div className={`shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
                {msg.role === 'user' ? <User size={14}/> : <Bot size={14}/>}
              </div>
              <div className={`p-3 rounded-2xl text-[13px] md:text-sm shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'}`}>
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* Suggested Questions */}
        <div className="p-3 bg-white border-t border-gray-100 shrink-0">
          <div className="text-[10px] md:text-xs font-semibold text-gray-400 mb-2 uppercase tracking-widest">Suggested</div>
          <div className="flex overflow-x-auto gap-2 pb-1 hide-scrollbar snap-x">
            {suggestedQuestions.map((q, i) => (
              <button 
                key={i} 
                onClick={() => handleSend(q)}
                className="snap-start shrink-0 text-[11px] md:text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 px-3 rounded-full transition-colors border border-gray-200 text-left whitespace-nowrap"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input Area */}
        {/* pb-[env(safe-area-inset-bottom)] ensures it stays above iOS home bar */}
        <div className="p-3 md:p-4 bg-white border-t border-gray-200 shrink-0 flex items-center gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
            placeholder="Ask a question..."
            className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-[13px] md:text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-50"
          />
          <button 
            onClick={() => handleSend(input)}
            disabled={!input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white p-2 md:p-2.5 rounded-full transition-colors flex items-center justify-center shrink-0"
          >
            <Send size={16} className="ml-0.5" />
          </button>
        </div>

      </div>
    </>
  );
}
