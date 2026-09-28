import React, { useState } from 'react';
import { MapPin, Activity, Database, CheckCircle2, TrendingUp, Info, ChevronDown, ChevronUp, CloudRain, Thermometer, Wind, Droplet, Sun } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import AgriculturalIntelligence from './AgriculturalIntelligence';
import { useLanguage } from '../i18n/LanguageContext';

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
  const { t, language } = useLanguage();

  
  const [showDataModel, setShowDataModel] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [weatherCardExpanded, setWeatherCardExpanded] = useState(false);

  // Extract selected forecast
  const selectedForecast = operationalForecast?.forecast?.[selectedDayIndex];
  const selectedRainfall = selectedForecast?.final_downscaled_prediction_mm || 0;
  
  // Use today's info if it's the 0th index, otherwise just state the date.
  const isToday = selectedDayIndex === 0;

  const getWeatherInterpretation = (rainfall: number) => {
    if (rainfall > 30) return "Heavy rainfall expected. High risk for outdoor activities and potential waterlogging.";
    if (rainfall > 10) return "Moderate rainfall. Good for vegetative growth but may delay fertilizer application.";
    if (rainfall > 0) return "Light rainfall. Favorable for most field activities.";
    return "Dry conditions. Monitor soil moisture for irrigation needs.";
  };

  const interpretation = getWeatherInterpretation(selectedRainfall);

  return (
    <div className="flex flex-col gap-6 md:gap-8 pb-10 md:pb-24">
      {/* 1. Identity Block */}
      <div className="border-b border-gray-100 pb-4">
        {/* Mobile only back button in the header */}
        <button onClick={onClose} className="md:hidden text-sm text-blue-600 hover:underline mb-3 flex items-center gap-1 font-medium p-2 -ml-2 rounded-lg">&larr; Back to Map</button>
        
        <div className="flex items-start gap-3">
          <div className="bg-red-100 p-2 md:p-3 rounded-full mt-1 shrink-0"><MapPin size={24} className="text-red-600 w-5 h-5 md:w-6 md:h-6" /></div>
          <div>
            <div className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">{t('panchayat.myPanchayat')}</div>
            <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight leading-none mb-2">
              {panchayatDetails.GPNAME || "Unknown Panchayat"}
            </h2>
            <div className="text-xs md:text-sm text-gray-600 font-medium">
              {panchayatDetails.blkname} {t('panchayat.block')} • {panchayatDetails.dtname} {t('panchayat.district')}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Crop Selector - Horizontal scroll on mobile */}
      <div>
        <h3 className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">{t('ag.growing')}</h3>
        <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar snap-x">
          {CROPS.map(c => (
            <button 
              key={c}
              onClick={() => setSelectedCrop(c)}
              className={`snap-start shrink-0 px-4 md:px-5 py-2 md:py-2.5 rounded-full text-[13px] md:text-sm font-bold transition-all border ${selectedCrop === c ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200'}`}
            >
              {t(`ag.${c.toLowerCase()}`)}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Selected Day Weather */}
      <div 
        onClick={() => setWeatherCardExpanded(!weatherCardExpanded)}
        className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-5 md:p-6 text-white shadow-lg relative overflow-hidden cursor-pointer transition-all hover:shadow-xl"
      >
         <div className="absolute -top-4 -right-4 p-4 opacity-20"><CloudRain size={120} /></div>
         <div className="flex justify-between items-center relative z-10 mb-4">
           <h3 className="text-xs md:text-sm font-bold uppercase tracking-widest text-blue-100">
             {isToday ? t('weather.today') : new Date(selectedForecast?.date).toLocaleDateString(language === 'hi' ? 'hi-IN' : language === 'mr' ? 'mr-IN' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
           </h3>
           <div className="text-blue-200">
             {weatherCardExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
           </div>
         </div>
         
         {selectedForecast ? (
           <div className="relative z-10">
             <div className="flex items-end gap-2 md:gap-3 mb-2">
                <span className="text-5xl md:text-6xl font-black leading-none tracking-tighter">{selectedRainfall.toFixed(1)}</span>
                <span className="text-xl md:text-2xl font-bold text-blue-200 pb-1">mm</span>
             </div>
             
             {/* Always visible quick summary */}
             {!weatherCardExpanded && (
               <div className="text-sm font-medium text-blue-50 mt-2">
                 {getWeatherInterpretation(selectedRainfall).split('.')[0]}
               </div>
             )}

             {/* Expanded Details */}
             <div className={`transition-all duration-300 overflow-hidden ${weatherCardExpanded ? 'max-h-96 opacity-100 mt-6' : 'max-h-0 opacity-0 mt-0'}`}>
               <div className="flex justify-between md:justify-start md:gap-8 border-t border-blue-400/50 pt-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 text-[13px] md:text-sm text-blue-50 font-medium">
                    <span className="flex items-center gap-1 text-blue-200"><Thermometer size={14}/> Temp</span> 
                    <span className="text-white text-lg md:text-sm font-bold md:font-medium">28°C</span>
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 text-[13px] md:text-sm text-blue-50 font-medium">
                    <span className="flex items-center gap-1 text-blue-200"><Droplet size={14}/> Hum</span> 
                    <span className="text-white text-lg md:text-sm font-bold md:font-medium">76%</span>
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 text-[13px] md:text-sm text-blue-50 font-medium">
                    <span className="flex items-center gap-1 text-blue-200"><Wind size={14}/> Wind</span> 
                    <span className="text-white text-lg md:text-sm font-bold md:font-medium">11kph</span>
                  </div>
               </div>
               <div className="mt-4 pt-3 border-t border-blue-400/50 flex flex-col gap-1 text-xs text-blue-100">
                 <div><strong>Source:</strong> Operational ECMWF Forecast (Open-Meteo)</div>
                 <div><strong>Model:</strong> XGBoost Downscaling</div>
               </div>
             </div>
           </div>
         ) : (
           <div className="text-sm text-blue-100 relative z-10">Waiting for operational forecast...</div>
         )}
      </div>

      {/* 4. Weather Interpretation */}
      {selectedForecast && (
        <div className="bg-blue-50/50 border border-blue-100 p-4 md:p-5 rounded-xl">
          <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
             <h3 className="text-[11px] md:text-sm font-bold text-blue-900 uppercase tracking-widest flex items-center gap-1.5"><Info size={14} className="text-blue-500"/> {t('explain.whatDoesThisMean')}</h3>
             <span className="text-[9px] md:text-[10px] font-bold tracking-widest uppercase bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{t('sys.prototype')}</span>
          </div>
          <p className="text-[13px] md:text-[15px] text-gray-800 font-medium leading-relaxed">{interpretation}</p>
          
          {/* Explainability Toggle */}
          <button 
            onClick={() => setShowExplain(!showExplain)}
            className="text-[11px] md:text-xs text-blue-600 mt-4 font-bold flex items-center gap-1 hover:bg-blue-50 py-1.5 px-2 -ml-2 rounded transition-colors"
          >
            {showExplain ? <ChevronUp size={14}/> : <ChevronDown size={14}/>} 
            {t('explain.whyDifferent')}
          </button>
          
          {showExplain && (
            <div className="mt-3 pt-3 border-t border-blue-200/50 text-[12px] md:text-xs text-gray-600 space-y-4">
              <p>This estimate is hyper-localized for <strong>{panchayatDetails.GPNAME}</strong> using AI.</p>
              
              <div className="flex flex-col md:flex-row md:items-center gap-2 bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-gray-400 uppercase">Step 1</div>
                  <div className="font-bold text-gray-700">Coarse Forecast</div>
                  <div className="text-blue-600">{Number(selectedForecast.era5_baseline_input_mm).toFixed(1)} mm</div>
                </div>
                <div className="text-blue-300 hidden md:block">→</div>
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-gray-400 uppercase">Step 2</div>
                  <div className="font-bold text-gray-700">AI Correction</div>
                  <div className={selectedForecast.model_residual_correction_mm > 0 ? "text-emerald-600" : "text-amber-600"}>
                    {selectedForecast.model_residual_correction_mm > 0 ? "+" : ""}{Number(selectedForecast.model_residual_correction_mm).toFixed(2)} mm
                  </div>
                  <div className="text-[9px] text-gray-400 leading-tight mt-0.5">(Based on {Number(panchayatDetails.elevation_mean).toFixed(0)}m elevation)</div>
                </div>
                <div className="text-blue-300 hidden md:block">→</div>
                <div className="flex-1 bg-blue-50 p-2 rounded">
                  <div className="text-[10px] font-bold text-blue-400 uppercase">Final</div>
                  <div className="font-bold text-blue-900">Panchayat Estimate</div>
                  <div className="text-blue-700 font-black">{Number(selectedRainfall).toFixed(1)} mm</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Advisory */}
      <div>
        <h3 className="text-lg md:text-xl font-black text-gray-900 mb-3 md:mb-4 tracking-tight">{t('ag.advisory')}</h3>
        <AgriculturalIntelligence selectedCrop={selectedCrop} todayRainfall={selectedRainfall} />
      </div>

      {/* 6. 7-Day Timeline */}
      {operationalForecast?.forecast && (
        <div className="w-full overflow-hidden">
          <h3 className="text-lg md:text-xl font-black text-gray-900 mb-3 md:mb-4 tracking-tight">{t('weather.outlook7Day')}</h3>
          <div className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar snap-x w-full">
            {operationalForecast.forecast.map((day: any, i: number) => {
              const date = new Date(day.date);
              const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
              const rf = day.final_downscaled_prediction_mm;
              return (
                <div 
                  key={i} 
                  onClick={() => setSelectedDayIndex(i)}
                  className={`snap-start shrink-0 border rounded-xl p-3 md:p-4 w-[85px] md:w-[100px] flex flex-col items-center shadow-sm cursor-pointer transition-all ${selectedDayIndex === i ? 'bg-blue-50 border-blue-300 scale-105' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                >
                  <div className={`text-[10px] md:text-xs font-bold mb-2 ${i === 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                    {i === 0 ? 'TODAY' : dayName}
                  </div>
                  <div className="mb-2">
                    {rf > 10 ? <CloudRain size={20} className="text-blue-500 md:w-6 md:h-6" /> : <Sun size={20} className="text-amber-400 md:w-6 md:h-6" />}
                  </div>
                  <div className="font-bold text-gray-800 text-[13px] md:text-base">{rf.toFixed(0)} <span className="text-[10px] md:text-xs text-gray-400 font-normal">mm</span></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. Data & Model Advanced Section */}
      <div className="mt-4 md:mt-8 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <button 
          onClick={() => setShowDataModel(!showDataModel)}
          className="w-full bg-gray-50 p-4 md:p-5 flex items-center justify-between hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2 md:gap-3">
            <Database size={18} className="text-gray-500"/>
            <span className="text-[13px] md:text-sm font-bold text-gray-700 tracking-wide">{t('nav.dataModel')}</span>
          </div>
          {showDataModel ? <ChevronUp size={20} className="text-gray-500"/> : <ChevronDown size={20} className="text-gray-500"/>}
        </button>

        {showDataModel && (
          <div className="p-4 md:p-6 border-t border-gray-200 flex flex-col gap-6 md:gap-8 bg-gray-50/50">
            
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <h4 className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Model Validation (2023)</h4>
              <p className="text-[13px] md:text-sm text-gray-600 mb-4 leading-relaxed">
                The AI downscaling model was tested using CHIRPS reference data. 
                Spatial block validation ensures geographic generalization without leakage.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                 <div className="bg-indigo-50 p-3 md:p-4 rounded-lg border border-indigo-100 text-center flex flex-row md:flex-col items-center justify-between md:justify-center">
                    <div className="text-left md:text-center">
                      <div className="text-[9px] uppercase font-bold text-indigo-500 mb-1">Spatial Block</div>
                      <div className="text-[11px] font-bold text-indigo-900">RMSE Reduction</div>
                    </div>
                    <div className="text-xl md:text-2xl font-black text-indigo-600">38.45%</div>
                 </div>
                 <div className="bg-emerald-50 p-3 md:p-4 rounded-lg border border-emerald-100 text-center flex flex-row md:flex-col items-center justify-between md:justify-center">
                    <div className="text-left md:text-center">
                      <div className="text-[9px] uppercase font-bold text-emerald-600 mb-1">Random Holdout</div>
                      <div className="text-[11px] font-bold text-emerald-900">RMSE Reduction</div>
                    </div>
                    <div className="text-xl md:text-2xl font-black text-emerald-600">54.34%</div>
                 </div>
              </div>
            </div>

            {weatherData && weatherData.status === "AVAILABLE" && (
              <div className="bg-white p-3 md:p-4 rounded-xl border border-gray-200 h-[250px] md:h-[350px] shadow-sm w-full overflow-hidden">
                <h4 className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Historical Downscaling</h4>
                <div className="w-full h-[200px] md:h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weatherData.timeseries}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                          <XAxis dataKey="date" tick={{fontSize: 10, fill: '#64748b'}} minTickGap={20} />
                          <YAxis tick={{fontSize: 10, fill: '#64748b'}} width={30} />
                          <RechartsTooltip contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px'}}/>
                          {/* Hide legend on mobile to save space, show on desktop */}
                          <Legend wrapperStyle={{fontSize: '10px', paddingTop: '10px'}} />
                          <Line type="monotone" dataKey="era5_rainfall_mm" stroke="#94a3b8" strokeWidth={2} name="ERA5 Coarse" dot={false}/>
                          <Line type="monotone" dataKey="downscaled_rainfall_mm" stroke="#10b981" strokeWidth={2} name="XGBoost" dot={false}/>
                          <Line type="monotone" dataKey="target_rainfall_mm" stroke="#f59e0b" strokeWidth={2} name="CHIRPS Target" dot={false}/>
                      </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="bg-white p-4 md:p-5 rounded-xl border border-gray-200 shadow-sm">
              <h4 className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Data Sources</h4>
              <ul className="text-[13px] md:text-sm text-gray-600 space-y-3">
                <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 shrink-0"/> <strong>ERA5 & ECMWF:</strong> Coarse meteorological input (~27km resolution)</li>
                <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 shrink-0"/> <strong>Copernicus DEM:</strong> High-resolution elevation data</li>
                <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 shrink-0"/> <strong>Gram Manchitra:</strong> Official Panchayat geometries</li>
                <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 shrink-0"/> <strong>CHIRPS v2.0:</strong> Fine-resolution satellite rainfall reference used for training</li>
              </ul>
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
