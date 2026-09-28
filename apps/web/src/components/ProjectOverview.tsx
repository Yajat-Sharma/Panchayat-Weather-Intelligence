import React from 'react';
import { Map, MapPin } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export default function ProjectOverview() {
  const { t } = useLanguage();
  
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-6 pt-20">
      
      <div className="bg-blue-50 text-blue-500 w-20 h-20 rounded-full flex items-center justify-center mb-4">
        <Map size={40} />
      </div>

      <div>
        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">{t('overview.title')}</h2>
        <p className="text-base text-gray-500 mt-3 max-w-sm mx-auto leading-relaxed">
          {t('overview.description')}
        </p>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-8 w-full text-left">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-2 text-sm">
          <MapPin size={16} className="text-red-500"/> {t('overview.howToStart')}
        </h3>
        <p className="text-sm text-gray-600">
          {t('overview.instruction')}
        </p>
      </div>

    </div>
  );
}
