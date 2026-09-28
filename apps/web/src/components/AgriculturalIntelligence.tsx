import React, { useState, useEffect } from 'react';
import { Droplet, CloudLightning, Sun, ShieldAlert, Sprout, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface Props {
  selectedCrop: string | null;
  todayRainfall: number;
}

export default function AgriculturalIntelligence({ selectedCrop, todayRainfall }: Props) {
  const { t } = useLanguage();
  const [showDetails, setShowDetails] = useState(false);
  const [cropToast, setCropToast] = useState(false);

  // Show a brief toast when crop changes
  useEffect(() => {
    if (selectedCrop) {
      setCropToast(true);
      const timer = setTimeout(() => setCropToast(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [selectedCrop]);

  const isHighRain = todayRainfall > 15;

  return (
    <div className="flex flex-col gap-3 md:gap-4 mt-2">
      
      {/* Toast Notification */}
      <div className={`transition-all duration-300 overflow-hidden ${cropToast ? 'max-h-12 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-md inline-block shadow-sm">
           {t('ag.contextUpdated', selectedCrop ? { crop: t(`ag.${selectedCrop.toLowerCase()}`) } : { crop: '' })}
        </div>
      </div>
      
      {/* Disclaimer */}
      <div className="bg-amber-50/50 dark:bg-amber-900/20 p-2 md:p-2.5 rounded-lg flex items-start gap-2 border border-amber-100 dark:border-amber-900/50">
        <Info className="text-amber-500 dark:text-amber-400 shrink-0 mt-0.5 w-3.5 h-3.5 md:w-4 md:h-4" />
        <div className="text-[10px] md:text-xs text-amber-700 dark:text-amber-400 leading-tight">
          {t('sys.decisionSupport')}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Irrigation Need */}
        <div className="bg-white dark:bg-gray-950 p-3 md:p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex md:block items-center md:items-start gap-4 md:gap-0">
          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 mb-0 md:mb-2 w-20 md:w-auto shrink-0">
            <Droplet size={18} className="text-blue-500 dark:text-blue-400 hidden md:block"/>
            <h4 className="font-bold text-gray-500 dark:text-gray-400 md:text-gray-700 dark:md:text-gray-300 text-[10px] md:text-sm uppercase tracking-wider md:tracking-normal md:normal-case">{t('ag.irrigation')}</h4>
          </div>
          <div>
            <div className="text-base md:text-lg font-black text-gray-900 dark:text-gray-100 mb-0.5 md:mb-1">
              {isHighRain ? t('ag.monitor') : t('ag.maintain')}
            </div>
            <p className="text-[11px] md:text-xs text-gray-500 dark:text-gray-400 leading-snug">
              {isHighRain 
                ? "Recent rainfall will likely reduce immediate irrigation requirements." 
                : "Standard irrigation schedules should be maintained."}
            </p>
          </div>
        </div>

        {/* Field Activity */}
        <div className="bg-white dark:bg-gray-950 p-3 md:p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex md:block items-center md:items-start gap-4 md:gap-0">
          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 mb-0 md:mb-2 w-20 md:w-auto shrink-0">
            <Sun size={18} className="text-amber-500 dark:text-amber-400 hidden md:block"/>
            <h4 className="font-bold text-gray-500 dark:text-gray-400 md:text-gray-700 dark:md:text-gray-300 text-[10px] md:text-sm uppercase tracking-wider md:tracking-normal md:normal-case">{t('ag.fieldWork')}</h4>
          </div>
          <div>
            <div className="text-base md:text-lg font-black text-gray-900 dark:text-gray-100 mb-0.5 md:mb-1">
               {isHighRain ? t('ag.delay') : t('ag.favorable')}
            </div>
            <p className="text-[11px] md:text-xs text-gray-500 dark:text-gray-400 leading-snug">
              {isHighRain 
                ? "Wet soil conditions may impede tractor usage and fertilizer application." 
                : "Weather is suitable for planned outdoor field activities."}
            </p>
          </div>
        </div>
        
        {/* Pest Risk */}
        <div className="bg-white dark:bg-gray-950 p-3 md:p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex md:block items-center md:items-start gap-4 md:gap-0">
          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 mb-0 md:mb-2 w-20 md:w-auto shrink-0">
            <ShieldAlert size={18} className="text-purple-500 dark:text-purple-400 hidden md:block"/>
            <h4 className="font-bold text-gray-500 dark:text-gray-400 md:text-gray-700 dark:md:text-gray-300 text-[10px] md:text-sm uppercase tracking-wider md:tracking-normal md:normal-case">{t('ag.pestRisk')}</h4>
          </div>
          <div>
            <div className="text-base md:text-lg font-black text-gray-900 dark:text-gray-100 mb-0.5 md:mb-1">
              {isHighRain ? t('ag.elevated') : t('ag.normal')}
            </div>
            <p className="text-[11px] md:text-xs text-gray-500 dark:text-gray-400 leading-snug">
               {isHighRain 
                ? "Humid conditions post-rainfall increase risk." 
                : "Standard monitoring recommended."}
            </p>
          </div>
        </div>
        {/* Crop Context */}
        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 md:p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/50 shadow-sm flex md:block items-center md:items-start gap-4 md:gap-0">
          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 mb-0 md:mb-2 w-20 md:w-auto shrink-0">
            <Sprout size={18} className="text-emerald-600 dark:text-emerald-400 hidden md:block"/>
            <h4 className="font-bold text-emerald-700 dark:text-emerald-300 md:text-emerald-800 dark:md:text-emerald-200 text-[10px] md:text-sm uppercase tracking-wider md:tracking-normal md:normal-case">Crop</h4>
          </div>
          <div>
            <div className="text-base md:text-lg font-black text-emerald-900 dark:text-emerald-100 mb-0.5 md:mb-1">
               {selectedCrop ? t(`ag.${selectedCrop.toLowerCase()}`) : t('ag.generic')}
            </div>
            <p className="text-[11px] md:text-xs text-emerald-700/80 dark:text-emerald-300/80 leading-snug">
               {selectedCrop 
                ? t('ag.tailoredFor', { crop: t(`ag.${selectedCrop.toLowerCase()}`) }) 
                : t('ag.selectCrop')}
            </p>
          </div>
        </div>
      </div>

      {/* Expandable Details Toggle */}
      <button 
        onClick={() => setShowDetails(!showDetails)}
        className="text-[11px] md:text-xs text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 hover:bg-blue-50 dark:hover:bg-blue-900/30 py-2 px-3 rounded-lg border border-blue-100 dark:border-blue-900/50 self-start transition-colors"
      >
        {showDetails ? <ChevronUp size={14}/> : <ChevronDown size={14}/>} 
        {showDetails ? t('ag.hideDetails') : t('ag.viewDetails')}
      </button>

      {/* Expanded Details Section */}
      <div className={`transition-all duration-300 overflow-hidden ${showDetails ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 text-[12px] md:text-xs text-gray-700 dark:text-gray-300 space-y-3">
          <div>
            <strong className="text-gray-900 dark:text-gray-100 block mb-1">{t('ag.why')}</strong>
            {isHighRain ? "Heavy rainfall saturates the soil and creates humid conditions, which can delay operations and increase disease pressure." : "Current weather conditions do not pose immediate threats to standard operations."}
          </div>
          <div>
            <strong className="text-gray-900 dark:text-gray-100 block mb-1">{t('ag.whatToWatch')}</strong>
            Monitor the 7-day outlook for prolonged wet spells or sudden dry periods. Watch for localized waterlogging in lower elevations of your Panchayat.
          </div>
          <div>
            <strong className="text-gray-900 dark:text-gray-100 block mb-1">{t('ag.dataUsed')}</strong>
            Advisory generated using {todayRainfall.toFixed(1)} mm AI-downscaled prediction and {selectedCrop ? t(`ag.${selectedCrop.toLowerCase()}`) : t('ag.generic')} crop profile.
          </div>
        </div>
      </div>

    </div>
  );
}
