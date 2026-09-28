import React from 'react';
import { MapPin, Activity, Database, CheckCircle2, TrendingUp, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import AgriculturalIntelligence from './AgriculturalIntelligence';

interface Props {
  selectedGpcode: string;
  panchayatDetails: any;
  weatherData: any;
  operationalForecast: any;
  onClose: () => void;
}

export default function PanchayatDetail({ selectedGpcode, panchayatDetails, weatherData, operationalForecast, onClose }: Props) {
  return (
    <div className="flex flex-col gap-6 pb-20">
      {/* Header */}
      <div>
        <button onClick={onClose} className="text-sm text-blue-600 hover:underline mb-2">&larr; Back to Overview</button>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MapPin size={24} className="text-red-500" /> {panchayatDetails.GPNAME || "Unknown Panchayat"}
        </h2>
        <div className="text-sm text-gray-500 mt-1 flex gap-2 items-center">
          <span className="bg-gray-100 px-2 py-0.5 rounded border border-gray-200">ID: {selectedGpcode}</span>
          <span>• Block: {panchayatDetails.blkname}</span>
          <span>• District: {panchayatDetails.dtname}</span>
        </div>
      </div>

      {/* Terrain Context */}
      <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm">
        <h3 className="font-semibold text-emerald-900 mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
          <Activity size={16}/> Terrain & Context
        </h3>
        <div className="grid grid-cols-2 gap-y-4 text-sm">
          <div>
            <div className="text-emerald-700/70 mb-1 text-xs uppercase font-bold">Area</div>
            <div className="font-semibold text-emerald-900">{Number(panchayatDetails.area_sqkm).toFixed(2)} sq km</div>
          </div>
          <div>
            <div className="text-emerald-700/70 mb-1 text-xs uppercase font-bold">Elevation (Mean)</div>
            <div className="font-semibold text-emerald-900">{Number(panchayatDetails.elevation_mean).toFixed(1)} m</div>
          </div>
          <div>
            <div className="text-emerald-700/70 mb-1 text-xs uppercase font-bold">Elevation Range</div>
            <div className="font-semibold text-emerald-900">{Number(panchayatDetails.elevation_min).toFixed(0)}m - {Number(panchayatDetails.elevation_max).toFixed(0)}m</div>
          </div>
        </div>
      </div>

      {/* Weather Data Status */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
          <Database size={16}/> System Data Status
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded border border-gray-100">
            <span className="text-gray-600 font-medium">ERA5 Coarse Input</span>
            <span className="flex items-center gap-1 text-green-600 font-bold"><CheckCircle2 size={16}/> READY</span>
          </div>
          <div className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded border border-gray-100">
            <span className="text-gray-600 font-medium">DEM/Geometry</span>
            <span className="flex items-center gap-1 text-green-600 font-bold"><CheckCircle2 size={16}/> READY</span>
          </div>
          <div className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded border border-gray-100">
            <span className="text-gray-600 font-medium">XGBoost Model</span>
            <span className="flex items-center gap-1 text-green-600 font-bold"><CheckCircle2 size={16}/> DEPLOYED</span>
          </div>
          <div className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded border border-gray-100">
            <span className="text-gray-600 font-medium">CHIRPS Target</span>
            <span className="flex items-center gap-1 text-green-600 font-bold"><CheckCircle2 size={16}/> READY</span>
          </div>
        </div>
      </div>

      {/* 7-Day Operational Forecast */}
      {operationalForecast && operationalForecast.status === "AVAILABLE" && (
        <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-200 shadow-sm">
          <h3 className="font-semibold text-indigo-900 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2 uppercase tracking-wider text-sm"><TrendingUp size={16}/> 7-Day Operational Forecast</span>
              <span className="text-[10px] font-bold text-white bg-indigo-600 px-2 py-1 rounded shadow-sm">LIVE ECMWF IFS</span>
          </h3>
          <p className="text-xs text-indigo-700/80 mb-4">
            Direct integration with operational ECMWF IFS 0.25° run, downscaled instantly using local Panchayat terrain.
          </p>
          <div className="h-[300px] w-full bg-white rounded-lg p-2 border border-indigo-100">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={operationalForecast.forecast}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff"/>
                    <XAxis dataKey="date" tick={{fontSize: 12, fill: '#3730a3'}} />
                    <YAxis tick={{fontSize: 12, fill: '#3730a3'}} label={{ value: 'Rainfall (mm)', angle: -90, position: 'insideLeft', fill: '#3730a3' }}/>
                    <RechartsTooltip contentStyle={{backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #c7d2fe'}}/>
                    <Legend />
                    <Line type="monotone" dataKey="era5_baseline_input_mm" stroke="#6366f1" strokeWidth={2} name="ECMWF Coarse Input" dot={{fill: '#6366f1', r: 4}}/>
                    <Line type="monotone" dataKey="final_downscaled_prediction_mm" stroke="#10b981" strokeWidth={3} name="XGBoost Downscaled Forecast" dot={{fill: '#10b981', r: 5}}/>
                </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Explainability Panel */}
      {operationalForecast && operationalForecast.status === "AVAILABLE" && (
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
           <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
             <Info size={16} className="text-blue-500"/> Why this result?
           </h3>
           <p className="text-sm text-gray-600 mb-3">
             The XGBoost model corrects the coarse ECMWF forecast specifically for <strong>{panchayatDetails.GPNAME}</strong> based on local conditions:
           </p>
           <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5 marker:text-blue-500">
             <li>The Panchayat's mean elevation of <strong>{Number(panchayatDetails.elevation_mean).toFixed(0)}m</strong> influences orographic precipitation models.</li>
             <li>The geographical location ({panchayatDetails.dtname} district) alters monsoonal wind exposure.</li>
             <li>Historical CHIRPS observations taught the model that standard 0.25° models typically {operationalForecast.forecast[0]?.model_residual_correction_mm > 0 ? "underestimate" : "overestimate"} rainfall here during this season.</li>
           </ul>
        </div>
      )}

      {/* Historical Downscaling */}
      {weatherData && weatherData.status === "AVAILABLE" && (
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center justify-between">
              <span className="text-sm uppercase tracking-wider flex items-center gap-2">Historical Validation (2023)</span>
              <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">EXPERIMENT</span>
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Comparison of the coarse ERA5 baseline against the experimental AI downscaled prediction, benchmarked against the fine-resolution CHIRPS reference target.
          </p>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weatherData.timeseries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                    <XAxis dataKey="date" tick={{fontSize: 12, fill: '#64748b'}} />
                    <YAxis tick={{fontSize: 12, fill: '#64748b'}} label={{ value: 'Rainfall (mm)', angle: -90, position: 'insideLeft', fill: '#64748b' }}/>
                    <RechartsTooltip contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0'}}/>
                    <Legend />
                    <Line type="monotone" dataKey="era5_rainfall_mm" stroke="#94a3b8" strokeWidth={2} name="ERA5 Baseline (Coarse)" dot={false}/>
                    <Line type="monotone" dataKey="downscaled_rainfall_mm" stroke="#10b981" strokeWidth={2} name="XGBoost Downscaled" dot={false}/>
                    <Line type="monotone" dataKey="target_rainfall_mm" stroke="#f59e0b" strokeWidth={2} name="CHIRPS Target (Reference)" dot={false}/>
                </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Agricultural Intelligence */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider mt-4">
          Agricultural Intelligence
        </h3>
        <AgriculturalIntelligence />
      </div>

    </div>
  );
}
