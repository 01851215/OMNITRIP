
import React, { useState, useMemo } from 'react';
import { Search, Globe, X, Check } from 'lucide-react';
import { Language } from '../types';

// A comprehensive list of 100+ languages
const LANGUAGES: Language[] = [
  { name: 'English', code: 'en', flag: '🇺🇸' },
  { name: 'Spanish', code: 'es', flag: '🇪🇸' },
  { name: 'French', code: 'fr', flag: '🇫🇷' },
  { name: 'German', code: 'de', flag: '🇩🇪' },
  { name: 'Chinese', code: 'zh', flag: '🇨🇳' },
  { name: 'Japanese', code: 'ja', flag: '🇯🇵' },
  { name: 'Korean', code: 'ko', flag: '🇰🇷' },
  { name: 'Italian', code: 'it', flag: '🇮🇹' },
  { name: 'Portuguese', code: 'pt', flag: '🇵🇹' },
  { name: 'Russian', code: 'ru', flag: '🇷🇺' },
  { name: 'Arabic', code: 'ar', flag: '🇸🇦' },
  { name: 'Turkish', code: 'tr', flag: '🇹🇷' },
  { name: 'Dutch', code: 'nl', flag: '🇳🇱' },
  { name: 'Swedish', code: 'sv', flag: '🇸🇪' },
  { name: 'Polish', code: 'pl', flag: '🇵🇱' },
  { name: 'Greek', code: 'el', flag: '🇬🇷' },
  { name: 'Hebrew', code: 'he', flag: '🇮🇱' },
  { name: 'Hindi', code: 'hi', flag: '🇮🇳' },
  { name: 'Thai', code: 'th', flag: '🇹🇭' },
  { name: 'Vietnamese', code: 'vi', flag: '🇻🇳' },
  { name: 'Indonesian', code: 'id', flag: '🇮🇩' },
  { name: 'Malay', code: 'ms', flag: '🇲🇾' },
  { name: 'Filipino', code: 'tl', flag: '🇵🇭' },
  { name: 'Danish', code: 'da', flag: '🇩🇰' },
  { name: 'Finnish', code: 'fi', flag: '🇫🇮' },
  { name: 'Norwegian', code: 'no', flag: '🇳🇴' },
  { name: 'Hungarian', code: 'hu', flag: '🇭🇺' },
  { name: 'Czech', code: 'cs', flag: '🇨🇿' },
  { name: 'Romanian', code: 'ro', flag: '🇷🇴' },
  { name: 'Bulgarian', code: 'bg', flag: '🇧🇬' },
  { name: 'Ukrainian', code: 'uk', flag: '🇺🇦' },
  { name: 'Catalan', code: 'ca', flag: '🇪🇸' },
  { name: 'Croatian', code: 'hr', flag: '🇭🇷' },
  { name: 'Slovak', code: 'sk', flag: '🇸🇰' },
  { name: 'Slovenian', code: 'sl', flag: '🇸🇮' },
  { name: 'Lithuanian', code: 'lt', flag: '🇱🇹' },
  { name: 'Latvian', code: 'lv', flag: '🇱🇻' },
  { name: 'Estonian', code: 'et', flag: '🇪🇪' },
  { name: 'Serbian', code: 'sr', flag: '🇷🇸' },
  { name: 'Persian', code: 'fa', flag: '🇮🇷' },
  { name: 'Urdu', code: 'ur', flag: '🇵🇰' },
  { name: 'Bengali', code: 'bn', flag: '🇧🇩' },
  { name: 'Tamil', code: 'ta', flag: '🇮🇳' },
  { name: 'Telugu', code: 'te', flag: '🇮🇳' },
  { name: 'Kannada', code: 'kn', flag: '🇮🇳' },
  { name: 'Malayalam', code: 'ml', flag: '🇮🇳' },
  { name: 'Marathi', code: 'mr', flag: '🇮🇳' },
  { name: 'Gujarati', code: 'gu', flag: '🇮🇳' },
  { name: 'Punjabi', code: 'pa', flag: '🇮🇳' },
  { name: 'Burmese', code: 'my', flag: '🇲🇲' },
  { name: 'Khmer', code: 'km', flag: '🇰🇭' },
  { name: 'Lao', code: 'lo', flag: '🇱🇦' },
  { name: 'Amharic', code: 'am', flag: '🇪🇹' },
  { name: 'Swahili', code: 'sw', flag: '🇰🇪' },
  { name: 'Afrikaans', code: 'af', flag: '🇿🇦' },
  { name: 'Zulu', code: 'zu', flag: '🇿🇦' },
  { name: 'Xhosa', code: 'xh', flag: '🇿🇦' },
  { name: 'Yoruba', code: 'yo', flag: '🇳🇬' },
  { name: 'Igbo', code: 'ig', flag: '🇳🇬' },
  { name: 'Hausa', code: 'ha', flag: '🇳🇬' },
  { name: 'Albanian', code: 'sq', flag: '🇦🇱' },
  { name: 'Armenian', code: 'hy', flag: '🇦🇲' },
  { name: 'Azerbaijani', code: 'az', flag: '🇦🇿' },
  { name: 'Basque', code: 'eu', flag: '🇪🇸' },
  { name: 'Belarusian', code: 'be', flag: '🇧🇾' },
  { name: 'Bosnian', code: 'bs', flag: '🇧🇦' },
  { name: 'Esperanto', code: 'eo', flag: '🌍' },
  { name: 'Galician', code: 'gl', flag: '🇪🇸' },
  { name: 'Georgian', code: 'ka', flag: '🇬🇪' },
  { name: 'Icelandic', code: 'is', flag: '🇮🇸' },
  { name: 'Irish', code: 'ga', flag: '🇮🇪' },
  { name: 'Kazakh', code: 'kk', flag: '🇰🇿' },
  { name: 'Macedonian', code: 'mk', flag: '🇲🇰' },
  { name: 'Maltese', code: 'mt', flag: '🇲🇹' },
  { name: 'Maori', code: 'mi', flag: '🇳🇿' },
  { name: 'Mongolian', code: 'mn', flag: '🇲🇳' },
  { name: 'Nepali', code: 'ne', flag: '🇳🇵' },
  { name: 'Samoan', code: 'sm', flag: '🇼🇸' },
  { name: 'Welsh', code: 'cy', flag: '🇬🇧' },
  { name: 'Yiddish', code: 'yi', flag: '🇮🇱' },
  { name: 'Pashto', code: 'ps', flag: '🇦🇫' },
  { name: 'Kurdish', code: 'ku', flag: '🇮🇶' },
  { name: 'Sindhi', code: 'sd', flag: '🇵🇰' },
  { name: 'Somali', code: 'so', flag: '🇸🇴' },
  { name: 'Uzbek', code: 'uz', flag: '🇺🇿' },
  { name: 'Tajik', code: 'tg', flag: '🇹🇯' },
  { name: 'Kyrgyz', code: 'ky', flag: '🇰🇬' },
  { name: 'Turkmen', code: 'tk', flag: '🇹🇲' },
  { name: 'Tatar', code: 'tt', flag: '🇷🇺' },
  { name: 'Bashkir', code: 'ba', flag: '🇷🇺' },
  { name: 'Chuvash', code: 'cv', flag: '🇷🇺' },
  { name: 'Uighur', code: 'ug', flag: '🇨🇳' },
  { name: 'Tibetan', code: 'bo', flag: '🇨🇳' },
  { name: 'Cebuano', code: 'ceb', flag: '🇵🇭' },
  { name: 'Javanese', code: 'jv', flag: '🇮🇩' },
  { name: 'Sundanese', code: 'su', flag: '🇮🇩' },
  { name: 'Malagasy', code: 'mg', flag: '🇲🇬' },
  { name: 'Sesotho', code: 'st', flag: '🇱🇸' },
  { name: 'Shona', code: 'sn', flag: '🇿🇼' },
  { name: 'Chichewa', code: 'ny', flag: '🇲🇼' },
  { name: 'Kinyarwanda', code: 'rw', flag: '🇷🇼' },
  { name: 'Oromo', code: 'om', flag: '🇪🇹' },
  { name: 'Tigrinya', code: 'ti', flag: '🇪🇷' },
  { name: 'Guarani', code: 'gn', flag: '🇵🇾' },
  { name: 'Quechua', code: 'qu', flag: '🇵🇪' },
  { name: 'Aymara', code: 'ay', flag: '🇧🇴' },
  { name: 'Inuktitut', code: 'iu', flag: '🇨🇦' },
  { name: 'Greenlandic', code: 'kl', flag: '🇬🇱' }
].sort((a, b) => a.name.localeCompare(b.name));

interface LanguageSelectorProps {
  currentLanguage: string;
  onLanguageChange: (lang: Language) => void;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ currentLanguage, onLanguageChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredLanguages = useMemo(() => {
    if (!search) return LANGUAGES;
    const s = search.toLowerCase();
    return LANGUAGES.filter(l => l.name.toLowerCase().includes(s));
  }, [search]);

  const activeLang = LANGUAGES.find(l => l.name === currentLanguage) || LANGUAGES[0];

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border-2 border-omni-dark shadow-cartoon-sm hover:translate-y-0.5 transition-all"
      >
        <span className="text-xl">{activeLang.flag}</span>
        <span className="font-black text-sm hidden sm:block">{activeLang.name}</span>
        <Globe size={18} className="text-omni-dark" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-omni-dark/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md max-h-[80vh] rounded-[2.5rem] border-4 border-omni-dark shadow-cartoon-lg flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b-4 border-omni-dark bg-omni-yellow flex justify-between items-center">
              <h3 className="text-2xl font-black flex items-center gap-3">
                <Globe className="text-omni-dark" /> Language
              </h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="w-10 h-10 bg-white rounded-full border-2 border-omni-dark flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b-2 border-omni-dark bg-gray-50">
              <div className="relative">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  autoFocus
                  type="text"
                  placeholder="Find your tongue..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white border-2 border-omni-dark rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-omni-yellow"
                />
              </div>
            </div>

            {/* Language List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
              {filteredLanguages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    onLanguageChange(lang);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                    currentLanguage === lang.name 
                      ? 'bg-omni-green border-omni-dark shadow-cartoon-sm' 
                      : 'border-transparent hover:bg-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{lang.flag}</span>
                    <span className={`font-black ${currentLanguage === lang.name ? 'text-omni-dark' : 'text-gray-600'}`}>
                      {lang.name}
                    </span>
                  </div>
                  {currentLanguage === lang.name && (
                    <div className="bg-white w-8 h-8 rounded-full border-2 border-omni-dark flex items-center justify-center">
                      <Check size={16} strokeWidth={4} />
                    </div>
                  )}
                </button>
              ))}
              {filteredLanguages.length === 0 && (
                <div className="py-12 text-center text-gray-400 font-black uppercase tracking-widest">
                  Not found! 🕵️‍♀️
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t-4 border-omni-dark bg-gray-50 text-center">
               <p className="text-[10px] font-black text-gray-400 uppercase">Omnitrip speaks over 100 languages fluently!</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
