import React from 'react';
import { CheckCircle2, ArrowRight, Database, Server, Cpu, Sprout, BarChart3, Info } from 'lucide-react';

export default function ProjectOverview() {
  return (
    <div className="flex flex-col gap-8 pb-10">
      
      {/* Hero Intro */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Project Overview</h2>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          Select a Gram Panchayat on the map to view its specific localized data. This system demonstrates how coarse weather information is downscaled using geospatial features and AI to generate actionable agricultural intelligence.
        </p>
      </div>

      {/* Hero Feature: AI Downscaling Pipeline */}
      <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-6 flex items-center gap-2 uppercase text-xs tracking-wider">
          <Cpu size={16} className="text-blue-600" /> System Architecture
        </h3>
        
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
            <div className="bg-blue-100 p-2 rounded-md text-blue-700"><Database size={20}/></div>
            <div>
              <div className="font-semibold text-gray-900 text-sm">1. Coarse Weather Input</div>
              <div className="text-xs text-gray-500">ERA5 Reanalysis / ECMWF IFS (~0.25° grid, ~27km)</div>
            </div>
          </div>
          
          <div className="flex justify-center -my-2 z-10"><ArrowRight size={20} className="text-gray-400 rotate-90" /></div>
          
          <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
            <div className="bg-emerald-100 p-2 rounded-md text-emerald-700"><Server size={20}/></div>
            <div>
              <div className="font-semibold text-gray-900 text-sm">2. Geospatial + Terrain Features</div>
              <div className="text-xs text-gray-500">Copernicus GLO-30 DEM, NIC Panchayat Boundaries (GeoPandas, Rasterio)</div>
            </div>
          </div>
          
          <div className="flex justify-center -my-2 z-10"><ArrowRight size={20} className="text-gray-400 rotate-90" /></div>
          
          <div className="flex items-center gap-4 bg-blue-600 p-3 rounded-lg shadow-md text-white">
            <div className="bg-blue-500 p-2 rounded-md text-white"><Cpu size={20}/></div>
            <div>
              <div className="font-semibold text-sm text-white">3. AI Downscaling</div>
              <div className="text-xs text-blue-100">XGBoost Residual Downscaling Model (FastAPI backend)</div>
            </div>
          </div>
          
          <div className="flex justify-center -my-2 z-10"><ArrowRight size={20} className="text-gray-400 rotate-90" /></div>
          
          <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
            <div className="bg-purple-100 p-2 rounded-md text-purple-700"><Sprout size={20}/></div>
            <div>
              <div className="font-semibold text-gray-900 text-sm">4. Panchayat Weather Intelligence</div>
              <div className="text-xs text-gray-500">Hyper-local agricultural risk assessment & AI Copilot</div>
            </div>
          </div>
        </div>
      </div>

      {/* Model Performance */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 p-6 rounded-xl shadow-sm">
        <h3 className="font-semibold text-indigo-900 mb-6 flex items-center gap-2 uppercase text-xs tracking-wider border-b border-indigo-200 pb-2">
          <BarChart3 size={16} /> Model Validation Performance
        </h3>
        
        <p className="text-xs text-indigo-700 mb-6 bg-white/60 p-3 rounded-md border border-indigo-100">
          <Info size={14} className="inline mr-1" />
          Spatial-block validation indicates that the experimental downscaling model generalizes across geographically separated regions of Pune. 
          Results are from a 2023 historical experiment using CHIRPS as the reference dataset.
        </p>

        <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-indigo-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg uppercase tracking-wider">Primary</div>
                <div className="text-xs font-bold text-gray-500 uppercase mb-2">Spatial Block Validation</div>
                <div className="text-3xl font-black text-indigo-700 mb-1">38.4%</div>
                <div className="text-xs text-gray-500 font-medium">RMSE Reduction</div>
                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-xs">
                  <div>
                    <span className="text-gray-400 block">ERA5 RMSE</span>
                    <span className="font-semibold text-gray-700">10.00 mm</span>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-400 block">AI Downscaled</span>
                    <span className="font-semibold text-green-600">6.16 mm</span>
                  </div>
                </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm border border-indigo-100">
                <div className="text-xs font-bold text-gray-500 uppercase mb-2">Random Panchayat Holdout</div>
                <div className="text-3xl font-black text-indigo-400 mb-1">54.3%</div>
                <div className="text-xs text-gray-500 font-medium">RMSE Reduction</div>
                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-xs">
                  <div className="text-gray-400">Susceptible to spatial autocorrelation</div>
                </div>
            </div>
        </div>
      </div>

      {/* Data & Methodology */}
      <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 uppercase text-xs tracking-wider border-b pb-2">
           Data & Methodology
        </h3>
        
        <div className="space-y-6">
          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wider">Data Sources</h4>
            <ul className="text-sm space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="text-green-500 shrink-0 mt-0.5" size={16}/>
                <div>
                  <span className="font-semibold text-gray-800 block">ERA5 Reanalysis (2023)</span>
                  <span className="text-gray-500 text-xs block mt-0.5">Coarse historical weather input (0.25°)</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="text-green-500 shrink-0 mt-0.5" size={16}/>
                <div>
                  <span className="font-semibold text-gray-800 block">Copernicus GLO-30 DEM</span>
                  <span className="text-gray-500 text-xs block mt-0.5">High-resolution global digital elevation model (~30m)</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="text-green-500 shrink-0 mt-0.5" size={16}/>
                <div>
                  <span className="font-semibold text-gray-800 block">Gram Manchitra / NIC</span>
                  <span className="text-gray-500 text-xs block mt-0.5">Official Gram Panchayat administrative boundaries</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="text-green-500 shrink-0 mt-0.5" size={16}/>
                <div>
                  <span className="font-semibold text-gray-800 block">CHIRPS v2.0 Reference</span>
                  <span className="text-gray-500 text-xs block mt-0.5">Fine-resolution satellite rainfall target (0.05°)</span>
                </div>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wider">Methodology Audit</h4>
            <ul className="text-sm space-y-2">
              <li className="flex items-center gap-2 text-gray-700">
                <CheckCircle2 className="text-blue-500 shrink-0" size={16}/>
                <span>Temporal leakage strictly prevented</span>
              </li>
              <li className="flex items-center gap-2 text-gray-700">
                <CheckCircle2 className="text-blue-500 shrink-0" size={16}/>
                <span>Panchayat representative-point sampling</span>
              </li>
              <li className="flex items-center gap-2 text-gray-700">
                <CheckCircle2 className="text-blue-500 shrink-0" size={16}/>
                <span>Deterministic residual clipping bounds</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

    </div>
  );
}
