import React from 'react';
import { Map, MapPin } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export default function ProjectOverview() {
  const { t } = useLanguage();
  
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-6 pt-20">
      
      <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 w-20 h-20 rounded-full flex items-center justify-center mb-4">
        <Map size={40} />
      </div>

      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">{t('overview.title')}</h2>
        <p className="text-base text-gray-500 dark:text-gray-400 mt-3 max-w-sm mx-auto leading-relaxed">
          {t('overview.description')}
        </p>
      </div>

      <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-4 mt-8 w-full text-left">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-2 text-sm">
          <MapPin size={16} className="text-red-500"/> {t('overview.howToStart')}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('overview.instruction')}
        </p>
      </div>

    </div>
  );
}
