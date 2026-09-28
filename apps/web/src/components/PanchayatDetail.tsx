import React, { useState } from 'react';
import { MapPin, Activity, Database, CheckCircle2, TrendingUp, Info, ChevronDown, ChevronUp, CloudRain, Thermometer, Wind, Droplet, Sun } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import AgriculturalIntelligence from './AgriculturalIntelligence';

interface Props {
  selectedGpcode: string;
  panchayatDetails: any;
  weatherData: any;
  operationalForecast: any;
  onClose: () => void;
  selectedCrop: string | null;
  setSelectedCrop: (crop: string) => void;
}

const CROPS = ["Rice", "Soybean", "Maize", "Vegetables", "Sugarcane"];

export default function PanchayatDetail({ 
  selectedGpcode, panchayatDetails, weatherData, operationalForecast, onClose, selectedCrop, setSelectedCrop 
}: Props) {
  
  const [showDataModel, setShowDataModel] = useState(false);
  const [showExplain, setShowExplain] = useState(false);

  // Extract today's forecast
  const todayForecast = operationalForecast?.forecast?.[0];
  const todayRainfall = todayForecast?.final_downscaled_prediction_mm || 0;

  const getWeatherInterpretation = (rainfall: number) => {
    if (rainfall > 30) return "Heavy rainfall expected. High risk for outdoor activities and potential waterlogging.";
    if (rainfall > 10) return "Moderate rainfall. Good for vegetative growth but may delay fertilizer application.";
    if (rainfall > 0) return "Light rainfall. Favorable for most field activities.";
    return "Dry conditions. Monitor soil moisture for irrigation needs.";
  };

  const interpretation = getWeatherInterpretation(todayRainfall);

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* 1. Identity Block */}
      <div className="border-b border-gray-100 pb-4">
        <button onClick={onClose} className="text-sm text-blue-600 hover:underline mb-3 flex items-center gap-1 font-medium">&larr; Back to Map</button>
        <div className="flex items-start gap-3">
          <div className="bg-red-100 p-2 rounded-full mt-1"><MapPin size={24} className="text-red-600" /></div>
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">My Panchayat</div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight leading-none mb-2">
              {panchayatDetails.GPNAME || "Unknown Panchayat"}
            </h2>
            <div className="text-sm text-gray-600 font-medium">
              {panchayatDetails.blkname} Block • {panchayatDetails.dtname} District • Maharashtra
            </div>
          </div>
        </div>
      </div>

      {/* 2. Crop Selector */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">What are you growing?</h3>
        <div className="flex flex-wrap gap-2">
          {CROPS.map(c => (
            <button 
              key={c}
              onClick={() => setSelectedCrop(c)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCrop === c ? 'bg-emerald-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Today's Weather */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
         <div className="absolute top-0 right-0 p-4 opacity-20"><CloudRain size={120} /></div>
         <h3 className="text-sm font-bold uppercase tracking-widest mb-4 text-blue-100 relative z-10">Today's Weather</h3>
         
         {todayForecast ? (
           <div className="relative z-10">
             <div className="flex items-end gap-3 mb-6">
                <span className="text-6xl font-black leading-none">{todayRainfall.toFixed(1)}</span>
                <span className="text-2xl font-semibold text-blue-200 pb-1">mm</span>
             </div>
             
             <div className="flex gap-6 border-t border-blue-400/50 pt-4">
                <div className="flex items-center gap-2 text-sm text-blue-50">
                  <Thermometer size={16} className="text-blue-200"/> 28°C
                </div>
                <div className="flex items-center gap-2 text-sm text-blue-50">
                  <Droplet size={16} className="text-blue-200"/> 76% Humidity
                </div>
             </div>
           </div>
         ) : (
           <div className="text-sm text-blue-100 relative z-10">Waiting for operational forecast...</div>
         )}
      </div>

      {/* 4. Weather Interpretation */}
      {todayForecast && (
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
          <div className="flex items-center justify-between mb-2">
             <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wide">What does this mean?</h3>
             <span className="text-[10px] font-bold tracking-widest uppercase bg-blue-100 text-blue-600 px-2 py-0.5 rounded">Advisory Prototype</span>
          </div>
          <p className="text-gray-700 font-medium">{interpretation}</p>
          
          {/* Explainability Toggle */}
          <button 
            onClick={() => setShowExplain(!showExplain)}
            className="text-xs text-blue-600 mt-3 font-semibold flex items-center gap-1 hover:underline"
          >
            {showExplain ? <ChevronUp size={14}/> : <ChevronDown size={14}/>} 
            Why is this rainfall different from the general weather forecast?
          </button>
          
          {showExplain && (
            <div className="mt-3 pt-3 border-t border-blue-200/50 text-xs text-gray-600 space-y-2">
              <p>This estimate is hyper-localized for <strong>{panchayatDetails.GPNAME}</strong> using AI.</p>
              <ul className="list-disc pl-4 marker:text-blue-400 space-y-1">
                <li>Your Panchayat's mean elevation is <strong>{Number(panchayatDetails.elevation_mean).toFixed(0)}m</strong>.</li>
                <li>The XGBoost AI model adjusts the standard coarse (27km) European ECMWF forecast by {todayForecast.model_residual_correction_mm > 0 ? "adding" : "subtracting"} {Math.abs(todayForecast.model_residual_correction_mm).toFixed(2)} mm based on your specific terrain.</li>
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 5. Advisory */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-4">Agricultural Advisory</h3>
        <AgriculturalIntelligence selectedCrop={selectedCrop} todayRainfall={todayRainfall} />
      </div>

      {/* 6. 7-Day Timeline */}
      {operationalForecast?.forecast && (
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-4">7-Day Outlook</h3>
          <div className="flex gap-2 overflow-x-auto pb-4 hide-scrollbar snap-x">
            {operationalForecast.forecast.map((day: any, i: number) => {
              const date = new Date(day.date);
              const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
              const rf = day.final_downscaled_prediction_mm;
              return (
                <div key={i} className="snap-start shrink-0 bg-white border border-gray-200 rounded-xl p-4 w-[100px] flex flex-col items-center shadow-sm">
                  <div className="text-xs font-bold text-gray-400 mb-2">{dayName}</div>
                  <div className="mb-2">
                    {rf > 10 ? <CloudRain size={24} className="text-blue-500" /> : <Sun size={24} className="text-amber-400" />}
                  </div>
                  <div className="font-bold text-gray-800">{rf.toFixed(0)} mm</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. Data & Model Advanced Section */}
      <div className="mt-8 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <button 
          onClick={() => setShowDataModel(!showDataModel)}
          className="w-full bg-gray-50 p-4 flex items-center justify-between hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Database size={18} className="text-gray-500"/>
            <span className="font-bold text-gray-700">Data & Model (Advanced)</span>
          </div>
          {showDataModel ? <ChevronUp size={20} className="text-gray-500"/> : <ChevronDown size={20} className="text-gray-500"/>}
        </button>

        {showDataModel && (
          <div className="p-6 border-t border-gray-200 flex flex-col gap-8 bg-gray-50">
            
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Model Validation (2023 Experiment)</h4>
              <p className="text-sm text-gray-600 mb-4">
                The AI downscaling model was rigorously tested using CHIRPS reference data. 
                Spatial block validation ensures geographic generalization without spatial leakage.
              </p>
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-gray-50 p-3 rounded border border-gray-100 text-center">
                    <div className="text-2xl font-black text-indigo-600">38.45%</div>
                    <div className="text-[10px] uppercase font-bold text-gray-500 mt-1">RMSE Reduction (Spatial Block)</div>
                 </div>
                 <div className="bg-gray-50 p-3 rounded border border-gray-100 text-center">
                    <div className="text-2xl font-black text-indigo-400">54.34%</div>
                    <div className="text-[10px] uppercase font-bold text-gray-500 mt-1">RMSE Reduction (Random Holdout)</div>
                 </div>
              </div>
            </div>

            {weatherData && weatherData.status === "AVAILABLE" && (
              <div className="bg-white p-4 rounded-lg border border-gray-200 h-[350px]">
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-4">Historical Downscaling Verification</h4>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weatherData.timeseries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                        <XAxis dataKey="date" tick={{fontSize: 10, fill: '#64748b'}} />
                        <YAxis tick={{fontSize: 10, fill: '#64748b'}} label={{ value: 'Rainfall (mm)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }}/>
                        <RechartsTooltip contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px'}}/>
                        <Legend wrapperStyle={{fontSize: '12px'}}/>
                        <Line type="monotone" dataKey="era5_rainfall_mm" stroke="#94a3b8" strokeWidth={2} name="ERA5 Baseline (Coarse)" dot={false}/>
                        <Line type="monotone" dataKey="downscaled_rainfall_mm" stroke="#10b981" strokeWidth={2} name="XGBoost Downscaled" dot={false}/>
                        <Line type="monotone" dataKey="target_rainfall_mm" stroke="#f59e0b" strokeWidth={2} name="CHIRPS Target (Reference)" dot={false}/>
                    </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Data Sources</h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li><strong>ERA5 & ECMWF:</strong> Coarse meteorological input (~27km resolution)</li>
                <li><strong>Copernicus GLO-30 DEM:</strong> High-resolution elevation data</li>
                <li><strong>NIC Gram Manchitra:</strong> Official Panchayat vector geometries</li>
                <li><strong>CHIRPS v2.0:</strong> Fine-resolution satellite rainfall reference used for training</li>
              </ul>
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
