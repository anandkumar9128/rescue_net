import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import translationEN from './i18n/en.json';
import translationHI from './i18n/hi.json';
import translationTA from './i18n/ta.json';
import translationTE from './i18n/te.json';
import translationBN from './i18n/bn.json';
import translationMR from './i18n/mr.json';
import translationML from './i18n/ml.json';
import translationOR from './i18n/or.json';

const resources = {
  en: { translation: translationEN },
  hi: { translation: translationHI },
  ta: { translation: translationTA },
  te: { translation: translationTE },
  bn: { translation: translationBN },
  mr: { translation: translationMR },
  ml: { translation: translationML },
  or: { translation: translationOR },
};

i18n
  // Detects user language from localStorage or the browser
  .use(LanguageDetector)
  // Passes i18n instance to react-i18next
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    // i18next-browser-languagedetector options
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false, // React already safeguards from XSS
    },
  });

export default i18n;
