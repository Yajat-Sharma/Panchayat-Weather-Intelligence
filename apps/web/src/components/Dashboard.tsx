"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import dynamic from "next/dynamic";
import { CheckCircle2, XCircle, AlertTriangle, MapPin, Activity, Database, CloudRain } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

// Dynamically import Map to prevent SSR issues with Leaflet
const Map = dynamic(() => import("./Map"), { ssr: false });

const API_BASE = "http://localhost:8000/api/v1";

import ProjectOverview from "./ProjectOverview";
import PanchayatDetail from "./PanchayatDetail";
import ChatbotDrawer from "./ChatbotDrawer";

export default function Dashboard() {
  const [status, setStatus] = useState<any>(null);
  const [geojsonData, setGeojsonData] = useState<any>(null);
  const [selectedGpcode, setSelectedGpcode] = useState<string | null>(null);
  const [panchayatDetails, setPanchayatDetails] = useState<any>(null);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [operationalForecast, setOperationalForecast] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [selectedCrop, setSelectedCrop] = useState<string | null>(null);

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
    return <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-500 font-medium">Loading Panchayat Weather Intelligence platform...</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-8">
          <div>
            <h1 className="text-xl font-black text-gray-900 flex items-center gap-2 tracking-tight">
              <CloudRain className="text-blue-600" size={24} />
              Panchayat Weather
            </h1>
          </div>
          
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-gray-500">
             <a href="#" className="text-blue-600 border-b-2 border-blue-600 pb-1">My Panchayat</a>
             <a href="#" className="hover:text-gray-900">Map</a>
             <a href="#" className="hover:text-gray-900">Advisory</a>
             <a href="#" className="hover:text-gray-900">AI Copilot</a>
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full border border-amber-200 font-bold tracking-wide uppercase text-[10px]">
             Prototype / Next-Gen
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <section className="flex-1 relative p-4">
          <div className="absolute inset-4 rounded-2xl overflow-hidden shadow-inner border border-gray-200">
             <Map geojsonData={geojsonData} onSelectPanchayat={setSelectedGpcode} />
          </div>
        </section>

        <aside className="w-[650px] bg-white border-l overflow-y-auto p-8 shadow-[-4px_0_25px_rgba(0,0,0,0.05)] z-10 relative">
          
          {selectedGpcode && panchayatDetails ? (
            <PanchayatDetail 
              selectedGpcode={selectedGpcode}
              panchayatDetails={panchayatDetails}
              weatherData={weatherData}
              operationalForecast={operationalForecast}
              onClose={() => setSelectedGpcode(null)}
              selectedCrop={selectedCrop}
              setSelectedCrop={setSelectedCrop}
            />
          ) : (
            <ProjectOverview />
          )}

        </aside>
      </main>
      
      {/* Ask Panchayat AI Copilot Drawer */}
      <ChatbotDrawer 
        selectedGpcode={selectedGpcode} 
        panchayatName={panchayatDetails?.GPNAME || null} 
        selectedCrop={selectedCrop} 
      />
    </div>
  );
}
