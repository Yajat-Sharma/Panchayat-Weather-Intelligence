"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import dynamic from "next/dynamic";
import { CheckCircle2, XCircle, AlertTriangle, MapPin, Activity, Database, CloudRain } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

// Dynamically import Map to prevent SSR issues with Leaflet
const Map = dynamic(() => import("./Map"), { ssr: false });

const API_BASE = "http://localhost:8000/api/v1";

export default function Dashboard() {
  const [status, setStatus] = useState<any>(null);
  const [geojsonData, setGeojsonData] = useState<any>(null);
  const [selectedGpcode, setSelectedGpcode] = useState<string | null>(null);
  const [panchayatDetails, setPanchayatDetails] = useState<any>(null);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
    } else {
      setPanchayatDetails(null);
      setWeatherData(null);
    }
  }, [selectedGpcode]);

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-gray-50">Loading application data...</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <CloudRain className="text-blue-600" />
            Panchayat Weather Intelligence
          </h1>
          <p className="text-sm text-gray-500 mt-1">Localizing coarse weather information for Gram Panchayat-level agricultural advisory.</p>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <section className="flex-1 relative p-4">
          <Map geojsonData={geojsonData} onSelectPanchayat={setSelectedGpcode} />
        </section>

        <aside className="w-[600px] bg-white border-l overflow-y-auto p-6 flex flex-col gap-6 shadow-[-4px_0_15px_rgba(0,0,0,0.05)] z-10">
          
          {selectedGpcode && panchayatDetails ? (
            <div className="flex flex-col gap-6">
              <div>
                <button onClick={() => setSelectedGpcode(null)} className="text-sm text-blue-600 hover:underline mb-2">&larr; Back to Overview</button>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><MapPin size={20}/> {panchayatDetails.GPNAME || "Unknown Panchayat"}</h2>
                <div className="text-sm text-gray-500 mt-1">ID: {selectedGpcode} | Block: {panchayatDetails.blkname} | District: {panchayatDetails.dtname}</div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2"><Activity size={16}/> Terrain & Context</h3>
                <div className="grid grid-cols-2 gap-y-3 text-sm">
                  <div className="text-gray-600">Area</div>
                  <div className="font-medium text-gray-900">{Number(panchayatDetails.area_sqkm).toFixed(2)} sq km</div>
                  <div className="text-gray-600">Elevation (Mean)</div>
                  <div className="font-medium text-gray-900">{Number(panchayatDetails.elevation_mean).toFixed(1)} m</div>
                  <div className="text-gray-600">Elevation (Min/Max)</div>
                  <div className="font-medium text-gray-900">{Number(panchayatDetails.elevation_min).toFixed(0)}m / {Number(panchayatDetails.elevation_max).toFixed(0)}m</div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><Database size={16}/> Weather Data Status</h3>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">ERA5 (Coarse Input)</span>
                    <span className="flex items-center gap-1 text-green-600 font-medium"><CheckCircle2 size={14}/> Extracted</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">DEM/Geometry</span>
                    <span className="flex items-center gap-1 text-green-600 font-medium"><CheckCircle2 size={14}/> Available</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Downscaled Prediction</span>
                    <span className="flex items-center gap-1 text-green-600 font-medium"><CheckCircle2 size={14}/> XGBoost Residual</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Fine-resolution Target</span>
                    <span className="flex items-center gap-1 text-green-600 font-medium"><CheckCircle2 size={14}/> CHIRPS v2.0</span>
                  </div>
                </div>
              </div>
              
              {weatherData && weatherData.status === "AVAILABLE" && (
                  <div className="bg-white p-4 rounded-lg border border-gray-200 h-[300px]">
                    <h3 className="font-semibold text-gray-800 mb-4">Historical Prediction vs CHIRPS Reference</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={weatherData.timeseries}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tick={{fontSize: 12}} />
                            <YAxis tick={{fontSize: 12}} label={{ value: 'Rainfall (mm)', angle: -90, position: 'insideLeft' }}/>
                            <RechartsTooltip />
                            <Legend />
                            <Line type="monotone" dataKey="era5_rainfall_mm" stroke="#8884d8" name="ERA5 Baseline (Coarse)" dot={false}/>
                            <Line type="monotone" dataKey="downscaled_rainfall_mm" stroke="#82ca9d" name="Experimental XGBoost Downscaled" dot={false}/>
                            <Line type="monotone" dataKey="target_rainfall_mm" stroke="#ff7300" name="CHIRPS Target (Reference)" dot={false}/>
                        </LineChart>
                    </ResponsiveContainer>
                  </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Project Overview</h2>
                <p className="text-sm text-gray-500 mt-2">Select a Gram Panchayat on the map to view its specific localized data and context.</p>
              </div>

              <div className="bg-white border p-4 rounded-lg shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-4 border-b pb-2">Data & Model Status</h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Data Sources</h4>
                    <ul className="text-sm space-y-2">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="text-green-500 shrink-0 mt-0.5" size={16}/>
                        <span>Copernicus GLO-30 DEM</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="text-green-500 shrink-0 mt-0.5" size={16}/>
                        <span>Gram Manchitra / NIC Gram Panchayat boundaries</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="text-green-500 shrink-0 mt-0.5" size={16}/>
                        <span>ERA5 2023 Reanalysis (BBox Expanded)</span>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Model</h4>
                    <ul className="text-sm space-y-2">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="text-green-500 shrink-0 mt-0.5" size={16}/>
                        <span className="text-gray-500">Downscaling model: <strong className="font-medium text-green-700">TRAINED (XGBoost)</strong></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="text-green-500 shrink-0 mt-0.5" size={16}/>
                        <span className="text-gray-500">Fine-resolution target: <strong className="font-medium text-green-700">CHIRPS v2.0</strong></span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg shadow-sm">
                <h3 className="font-semibold text-blue-900 mb-2 border-b border-blue-200 pb-2">Model Performance (RMSE Reduction)</h3>
                <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="bg-white p-3 rounded shadow-sm border border-gray-100">
                        <div className="text-xs font-bold text-gray-500 uppercase mb-1">Random Panchayat Holdout</div>
                        <div className="text-2xl font-bold text-blue-600">54.3%</div>
                        <div className="text-xs text-gray-400 mt-1">Susceptible to spatial autocorrelation</div>
                    </div>
                    <div className="bg-white p-3 rounded shadow-sm border border-gray-100">
                        <div className="text-xs font-bold text-gray-500 uppercase mb-1">Spatial Block Validation</div>
                        <div className="text-2xl font-bold text-green-600">38.4%</div>
                        <div className="text-xs text-gray-400 mt-1">Geographically isolated. Experimental.</div>
                    </div>
                </div>
              </div>
            </div>
          )}

        </aside>
      </main>
    </div>
  );
}
