import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import commonEn from './locales/en/common.json';
import commonZh from './locales/zh/common.json';
import ganttEn from './locales/en/gantt.json';
import ganttZh from './locales/zh/gantt.json';

const savedLang = () => {
  try { return localStorage.getItem('gantt-lang') || 'zh'; }
  catch { return 'zh'; }
};

i18n.use(initReactI18next).init({
  resources: {
    en: { common: commonEn, gantt: ganttEn },
    zh: { common: commonZh, gantt: ganttZh },
  },
  lng: savedLang(),
  fallbackLng: 'zh',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

export default i18n;
