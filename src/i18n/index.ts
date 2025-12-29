import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import sr from './locales/sr.json';
import en from './locales/en.json';

const savedLanguage = localStorage.getItem('language') || 'sr';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      sr: { translation: sr },
      en: { translation: en }
    },
    lng: savedLanguage,
    fallbackLng: 'sr',
    interpolation: {
      escapeValue: false
    }
  });

// Save language preference when it changes
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('language', lng);
});

export default i18n;
