import React from 'react';
import { Sprout, Droplet, CloudLightning, Sun, Wind, ShieldAlert, BadgeInfo } from 'lucide-react';

export default function AgriculturalIntelligence() {
  return (
    <div className="flex flex-col gap-6">
      
      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-3">
        <BadgeInfo className="text-amber-600 shrink-0 mt-0.5" size={18} />
        <div className="text-sm text-amber-800">
          <strong>Decision-Support Prototype:</strong> This section demonstrates how Panchayat-level weather intelligence can be translated into agricultural advisories. Live operational advisory generation is planned for a future phase.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        
        {/* Rainfall Risk */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
              <CloudLightning size={16} className="text-blue-600"/> Rainfall Risk
            </h4>
            <span className="text-[10px] font-bold tracking-widest uppercase bg-gray-100 text-gray-500 px-2 py-1 rounded">Prototype</span>
          </div>
          <div className="flex items-end gap-3 mb-2">
            <span className="text-xl font-bold text-amber-600">Elevated</span>
          </div>
          <p className="text-xs text-gray-500">
            Intense isolated showers likely due to high local elevation compared to surrounding block. Monitor drainage.
          </p>
        </div>

        {/* Irrigation Need */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
              <Droplet size={16} className="text-blue-400"/> Irrigation Need
            </h4>
            <span className="text-[10px] font-bold tracking-widest uppercase bg-gray-100 text-gray-500 px-2 py-1 rounded">Prototype</span>
          </div>
          <div className="flex items-end gap-3 mb-2">
            <span className="text-xl font-bold text-green-600">Low</span>
          </div>
          <p className="text-xs text-gray-500">
            Soil moisture expected to be sufficient for next 3 days based on downscaled forecast.
          </p>
        </div>
        
        {/* Crop Condition */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
              <Sprout size={16} className="text-emerald-500"/> Crop Stage
            </h4>
            <span className="text-[10px] font-bold tracking-widest uppercase bg-gray-100 text-gray-500 px-2 py-1 rounded">Prototype</span>
          </div>
          <div className="flex items-end gap-3 mb-2">
            <span className="text-xl font-bold text-gray-700">Vegetative</span>
          </div>
          <p className="text-xs text-gray-500">
            Current conditions are highly favorable for vegetative growth. No heat stress detected.
          </p>
        </div>

        {/* Field Activity */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
              <ShieldAlert size={16} className="text-purple-500"/> Pest Risk
            </h4>
            <span className="text-[10px] font-bold tracking-widest uppercase bg-gray-100 text-gray-500 px-2 py-1 rounded">Prototype</span>
          </div>
          <div className="flex items-end gap-3 mb-2">
            <span className="text-xl font-bold text-red-500">High</span>
          </div>
          <p className="text-xs text-gray-500">
            Humid conditions post-rainfall increase risk of fungal infections. Prepare fungicide.
          </p>
        </div>
      </div>

    </div>
  );
}
