"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import dynamic from "next/dynamic";
import { CheckCircle2, XCircle, AlertTriangle, MapPin, Activity, Database, CloudRain, Home, Map as MapIcon, Bot } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

// Dynamically import Map to prevent SSR issues with Leaflet
const Map = dynamic(() => import("./Map"), { ssr: false });

const API_BASE = "http://localhost:8000/api/v1";

import ProjectOverview from "./ProjectOverview";
import PanchayatDetail from "./PanchayatDetail";
import ChatbotDrawer from "./ChatbotDrawer";
import { useLanguage } from "../i18n/LanguageContext";
import { LanguageCode } from "../i18n/translations";

type MobileTab = 'home' | 'map' | 'ai';

export default function Dashboard() {
  const { language, setLanguage, t } = useLanguage();
  
  const [status, setStatus] = useState<any>(null);
  const [geojsonData, setGeojsonData] = useState<any>(null);
  const [selectedGpcode, setSelectedGpcode] = useState<string | null>(null);
  const [panchayatDetails, setPanchayatDetails] = useState<any>(null);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [operationalForecast, setOperationalForecast] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [selectedCrop, setSelectedCrop] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [isAiOpen, setIsAiOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statusRes, geojsonRes] = await Promise.all([
          axios.get(`${API_BASE}/status`),
          axios.get(`${API_BASE}/panchayats`).catch(() => ({ data: null }))
        ]);
        setStatus(statusRes.data);
        if (geojsonRes.data) {
          setGeojsonData(geojsonRes.data);
        }
      } catch (e) {
        console.error("Failed to load initial data", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedGpcode) {
      axios.get(`${API_BASE}/panchayats/${selectedGpcode}`)
        .then(res => setPanchayatDetails(res.data))
        .catch(e => {
          console.error(e);
          setPanchayatDetails(null);
        });
        
      axios.get(`${API_BASE}/panchayats/${selectedGpcode}/weather`)
        .then(res => setWeatherData(res.data))
        .catch(e => {
          console.error(e);
          setWeatherData(null);
        });
        
      axios.get(`${API_BASE}/panchayats/${selectedGpcode}/weather/forecast`)
        .then(res => setOperationalForecast(res.data))
        .catch(e => {
          console.error(e);
          setOperationalForecast(null);
        });
    } else {
      setPanchayatDetails(null);
      setWeatherData(null);
      setOperationalForecast(null);
    }
  }, [selectedGpcode]);

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-500 font-medium">{t('sys.loading')}</div>;
  }

  // Determine visibility logic based on responsive state
  const isMapVisibleMobile = activeTab === 'map';
  const isHomeVisibleMobile = activeTab === 'home';

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">
      
      {/* HEADER */}
      <header className="bg-white border-b px-4 md:px-6 py-3 md:py-4 flex items-center justify-between shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-8">
          <div>
            <h1 className="text-lg md:text-xl font-black text-gray-900 flex items-center gap-2 tracking-tight">
              <CloudRain className="text-blue-600" size={24} />
              {t('nav.title')}
            </h1>
          </div>
          
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-gray-500">
             <a href="#" className="text-blue-600 border-b-2 border-blue-600 pb-1">{t('nav.myPanchayat')}</a>
             <a href="#" className="hover:text-gray-900">{t('nav.map')}</a>
             <a href="#" className="hover:text-gray-900">{t('nav.advisory')}</a>
             <button onClick={() => setIsAiOpen(true)} className="hover:text-gray-900">{t('nav.aiCopilot')}</button>
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative flex items-center bg-gray-100 hover:bg-gray-200 transition-colors rounded-full px-2 py-1">
             <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                className="appearance-none bg-transparent text-gray-800 text-xs font-bold pl-2 pr-6 outline-none cursor-pointer"
                aria-label="Select language"
              >
                <option value="en">EN</option>
                <option value="hi">हिंदी</option>
                <option value="mr">मराठी</option>
             </select>
             <div className="pointer-events-none absolute right-2 text-gray-500">
               <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
             </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full border border-amber-200 font-bold tracking-wide uppercase text-[10px]">
             {t('sys.prototype')}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Map Section - Full width on mobile when map tab is active, always visible on desktop taking remaining flex space */}
        <section className={`flex-1 relative p-0 md:p-4 ${isMapVisibleMobile ? 'block' : 'hidden md:block'}`}>
          <div className="absolute inset-0 md:inset-4 md:rounded-2xl overflow-hidden md:shadow-inner md:border border-gray-200 z-0">
             <Map 
               geojsonData={geojsonData} 
               selectedGpcode={selectedGpcode}
               onSelectPanchayat={(gpcode) => {
                 setSelectedGpcode(gpcode);
                 setActiveTab('home'); // Auto-switch to home tab on mobile when a Panchayat is selected
               }} 
             />
          </div>
          {/* Mobile floating prompt over map if no panchayat selected */}
          {!selectedGpcode && isMapVisibleMobile && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg border border-gray-200 text-sm font-bold text-gray-800 z-[400] md:hidden flex items-center gap-2">
              <MapPin size={16} className="text-red-500"/>
              Tap a Panchayat
            </div>
          )}
        </section>

        {/* Aside Panel (Panchayat Details / Explore) */}
        {/* On Mobile: Absolute full screen over map if Home is active. On Desktop: Fixed 650px width. */}
        <aside className={`
          w-full md:w-[650px] 
          bg-white md:border-l 
          overflow-y-auto 
          shadow-[-4px_0_25px_rgba(0,0,0,0.05)] 
          z-10 relative 
          pb-20 md:pb-0
          ${isHomeVisibleMobile ? 'block' : 'hidden md:block'}
        `}>
          {selectedGpcode && panchayatDetails ? (
            <PanchayatDetail 
              selectedGpcode={selectedGpcode}
              panchayatDetails={panchayatDetails}
              weatherData={weatherData}
              operationalForecast={operationalForecast}
              onClose={() => {
                setSelectedGpcode(null);
                setActiveTab('map');
              }}
              selectedCrop={selectedCrop}
              setSelectedCrop={setSelectedCrop}
            />
          ) : (
            <ProjectOverview />
          )}
        </aside>

      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      <div className="md:hidden bg-white border-t border-gray-200 fixed bottom-0 left-0 right-0 z-[1000] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16">
          <button 
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${activeTab === 'home' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <Home size={22} className={activeTab === 'home' ? 'fill-blue-100' : ''} />
            <span className="text-[10px] font-bold">Home</span>
          </button>
          <button 
            onClick={() => setActiveTab('map')}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${activeTab === 'map' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <MapIcon size={22} className={activeTab === 'map' ? 'fill-blue-100' : ''} />
            <span className="text-[10px] font-bold">{t('nav.map')}</span>
          </button>
          <button 
            onClick={() => setIsAiOpen(true)}
            className="flex flex-col items-center justify-center w-full h-full space-y-1 text-gray-500 hover:text-gray-900"
          >
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full p-2 text-white shadow-md transform -translate-y-2">
              <Bot size={22} />
            </div>
            <span className="text-[10px] font-bold transform -translate-y-1">{t('nav.aiCopilot')}</span>
          </button>
        </div>
      </div>
      
      {/* Ask Panchayat AI Copilot Drawer */}
      <ChatbotDrawer 
        selectedGpcode={selectedGpcode} 
        panchayatName={panchayatDetails?.GPNAME || null} 
        selectedCrop={selectedCrop}
        isOpenMobile={isAiOpen}
        setIsOpenMobile={setIsAiOpen}
      />
    </div>
  );
}
