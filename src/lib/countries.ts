export interface Country {
  name: string;
  code: string;       // ISO 3166-1 alpha-2
  flag: string;       // emoji flag
  dialCode: string;   // e.g. '+91'
  phoneMin: number;   // min digits (local, no dial code)
  phoneMax: number;   // max digits
  phoneHint: string;  // human-readable hint
}

export const COUNTRIES: Country[] = [
  { name: 'Afghanistan', code: 'AF', flag: '🇦🇫', dialCode: '+93', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Albania', code: 'AL', flag: '🇦🇱', dialCode: '+355', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Algeria', code: 'DZ', flag: '🇩🇿', dialCode: '+213', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Argentina', code: 'AR', flag: '🇦🇷', dialCode: '+54', phoneMin: 10, phoneMax: 11, phoneHint: '10–11 digits' },
  { name: 'Australia', code: 'AU', flag: '🇦🇺', dialCode: '+61', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Austria', code: 'AT', flag: '🇦🇹', dialCode: '+43', phoneMin: 10, phoneMax: 13, phoneHint: '10–13 digits' },
  { name: 'Bahrain', code: 'BH', flag: '🇧🇭', dialCode: '+973', phoneMin: 8, phoneMax: 8, phoneHint: '8 digits' },
  { name: 'Bangladesh', code: 'BD', flag: '🇧🇩', dialCode: '+880', phoneMin: 10, phoneMax: 10, phoneHint: '10 digits' },
  { name: 'Belgium', code: 'BE', flag: '🇧🇪', dialCode: '+32', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Brazil', code: 'BR', flag: '🇧🇷', dialCode: '+55', phoneMin: 10, phoneMax: 11, phoneHint: '10–11 digits' },
  { name: 'Cambodia', code: 'KH', flag: '🇰🇭', dialCode: '+855', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Canada', code: 'CA', flag: '🇨🇦', dialCode: '+1', phoneMin: 10, phoneMax: 10, phoneHint: '10 digits' },
  { name: 'Chile', code: 'CL', flag: '🇨🇱', dialCode: '+56', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'China', code: 'CN', flag: '🇨🇳', dialCode: '+86', phoneMin: 11, phoneMax: 11, phoneHint: '11 digits' },
  { name: 'Colombia', code: 'CO', flag: '🇨🇴', dialCode: '+57', phoneMin: 10, phoneMax: 10, phoneHint: '10 digits' },
  { name: 'Croatia', code: 'HR', flag: '🇭🇷', dialCode: '+385', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Czech Republic', code: 'CZ', flag: '🇨🇿', dialCode: '+420', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Denmark', code: 'DK', flag: '🇩🇰', dialCode: '+45', phoneMin: 8, phoneMax: 8, phoneHint: '8 digits' },
  { name: 'Egypt', code: 'EG', flag: '🇪🇬', dialCode: '+20', phoneMin: 10, phoneMax: 10, phoneHint: '10 digits' },
  { name: 'Ethiopia', code: 'ET', flag: '🇪🇹', dialCode: '+251', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Finland', code: 'FI', flag: '🇫🇮', dialCode: '+358', phoneMin: 9, phoneMax: 10, phoneHint: '9–10 digits' },
  { name: 'France', code: 'FR', flag: '🇫🇷', dialCode: '+33', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Germany', code: 'DE', flag: '🇩🇪', dialCode: '+49', phoneMin: 10, phoneMax: 12, phoneHint: '10–12 digits' },
  { name: 'Ghana', code: 'GH', flag: '🇬🇭', dialCode: '+233', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Greece', code: 'GR', flag: '🇬🇷', dialCode: '+30', phoneMin: 10, phoneMax: 10, phoneHint: '10 digits' },
  { name: 'Hong Kong', code: 'HK', flag: '🇭🇰', dialCode: '+852', phoneMin: 8, phoneMax: 8, phoneHint: '8 digits' },
  { name: 'Hungary', code: 'HU', flag: '🇭🇺', dialCode: '+36', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'India', code: 'IN', flag: '🇮🇳', dialCode: '+91', phoneMin: 10, phoneMax: 10, phoneHint: '10 digits (starts 6–9)' },
  { name: 'Indonesia', code: 'ID', flag: '🇮🇩', dialCode: '+62', phoneMin: 9, phoneMax: 12, phoneHint: '9–12 digits' },
  { name: 'Iran', code: 'IR', flag: '🇮🇷', dialCode: '+98', phoneMin: 10, phoneMax: 10, phoneHint: '10 digits' },
  { name: 'Iraq', code: 'IQ', flag: '🇮🇶', dialCode: '+964', phoneMin: 10, phoneMax: 10, phoneHint: '10 digits' },
  { name: 'Ireland', code: 'IE', flag: '🇮🇪', dialCode: '+353', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Israel', code: 'IL', flag: '🇮🇱', dialCode: '+972', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Italy', code: 'IT', flag: '🇮🇹', dialCode: '+39', phoneMin: 9, phoneMax: 11, phoneHint: '9–11 digits' },
  { name: 'Japan', code: 'JP', flag: '🇯🇵', dialCode: '+81', phoneMin: 10, phoneMax: 11, phoneHint: '10–11 digits' },
  { name: 'Jordan', code: 'JO', flag: '🇯🇴', dialCode: '+962', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Kenya', code: 'KE', flag: '🇰🇪', dialCode: '+254', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Kuwait', code: 'KW', flag: '🇰🇼', dialCode: '+965', phoneMin: 8, phoneMax: 8, phoneHint: '8 digits' },
  { name: 'Lebanon', code: 'LB', flag: '🇱🇧', dialCode: '+961', phoneMin: 7, phoneMax: 8, phoneHint: '7–8 digits' },
  { name: 'Malaysia', code: 'MY', flag: '🇲🇾', dialCode: '+60', phoneMin: 9, phoneMax: 10, phoneHint: '9–10 digits' },
  { name: 'Maldives', code: 'MV', flag: '🇲🇻', dialCode: '+960', phoneMin: 7, phoneMax: 7, phoneHint: '7 digits' },
  { name: 'Mexico', code: 'MX', flag: '🇲🇽', dialCode: '+52', phoneMin: 10, phoneMax: 10, phoneHint: '10 digits' },
  { name: 'Morocco', code: 'MA', flag: '🇲🇦', dialCode: '+212', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Myanmar', code: 'MM', flag: '🇲🇲', dialCode: '+95', phoneMin: 8, phoneMax: 10, phoneHint: '8–10 digits' },
  { name: 'Nepal', code: 'NP', flag: '🇳🇵', dialCode: '+977', phoneMin: 10, phoneMax: 10, phoneHint: '10 digits' },
  { name: 'Netherlands', code: 'NL', flag: '🇳🇱', dialCode: '+31', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'New Zealand', code: 'NZ', flag: '🇳🇿', dialCode: '+64', phoneMin: 8, phoneMax: 10, phoneHint: '8–10 digits' },
  { name: 'Nigeria', code: 'NG', flag: '🇳🇬', dialCode: '+234', phoneMin: 10, phoneMax: 10, phoneHint: '10 digits' },
  { name: 'Norway', code: 'NO', flag: '🇳🇴', dialCode: '+47', phoneMin: 8, phoneMax: 8, phoneHint: '8 digits' },
  { name: 'Oman', code: 'OM', flag: '🇴🇲', dialCode: '+968', phoneMin: 8, phoneMax: 8, phoneHint: '8 digits' },
  { name: 'Pakistan', code: 'PK', flag: '🇵🇰', dialCode: '+92', phoneMin: 10, phoneMax: 10, phoneHint: '10 digits' },
  { name: 'Peru', code: 'PE', flag: '🇵🇪', dialCode: '+51', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Philippines', code: 'PH', flag: '🇵🇭', dialCode: '+63', phoneMin: 10, phoneMax: 10, phoneHint: '10 digits' },
  { name: 'Poland', code: 'PL', flag: '🇵🇱', dialCode: '+48', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Portugal', code: 'PT', flag: '🇵🇹', dialCode: '+351', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Qatar', code: 'QA', flag: '🇶🇦', dialCode: '+974', phoneMin: 8, phoneMax: 8, phoneHint: '8 digits' },
  { name: 'Romania', code: 'RO', flag: '🇷🇴', dialCode: '+40', phoneMin: 10, phoneMax: 10, phoneHint: '10 digits' },
  { name: 'Russia', code: 'RU', flag: '🇷🇺', dialCode: '+7', phoneMin: 10, phoneMax: 10, phoneHint: '10 digits' },
  { name: 'Saudi Arabia', code: 'SA', flag: '🇸🇦', dialCode: '+966', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Singapore', code: 'SG', flag: '🇸🇬', dialCode: '+65', phoneMin: 8, phoneMax: 8, phoneHint: '8 digits' },
  { name: 'South Africa', code: 'ZA', flag: '🇿🇦', dialCode: '+27', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'South Korea', code: 'KR', flag: '🇰🇷', dialCode: '+82', phoneMin: 9, phoneMax: 10, phoneHint: '9–10 digits' },
  { name: 'Spain', code: 'ES', flag: '🇪🇸', dialCode: '+34', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Sri Lanka', code: 'LK', flag: '🇱🇰', dialCode: '+94', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Sweden', code: 'SE', flag: '🇸🇪', dialCode: '+46', phoneMin: 7, phoneMax: 10, phoneHint: '7–10 digits' },
  { name: 'Switzerland', code: 'CH', flag: '🇨🇭', dialCode: '+41', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Taiwan', code: 'TW', flag: '🇹🇼', dialCode: '+886', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Tanzania', code: 'TZ', flag: '🇹🇿', dialCode: '+255', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Thailand', code: 'TH', flag: '🇹🇭', dialCode: '+66', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Turkey', code: 'TR', flag: '🇹🇷', dialCode: '+90', phoneMin: 10, phoneMax: 10, phoneHint: '10 digits' },
  { name: 'Uganda', code: 'UG', flag: '🇺🇬', dialCode: '+256', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'Ukraine', code: 'UA', flag: '🇺🇦', dialCode: '+380', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'United Arab Emirates', code: 'AE', flag: '🇦🇪', dialCode: '+971', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
  { name: 'United Kingdom', code: 'GB', flag: '🇬🇧', dialCode: '+44', phoneMin: 10, phoneMax: 11, phoneHint: '10–11 digits' },
  { name: 'United States', code: 'US', flag: '🇺🇸', dialCode: '+1', phoneMin: 10, phoneMax: 10, phoneHint: '10 digits' },
  { name: 'Vietnam', code: 'VN', flag: '🇻🇳', dialCode: '+84', phoneMin: 9, phoneMax: 10, phoneHint: '9–10 digits' },
  { name: 'Zimbabwe', code: 'ZW', flag: '🇿🇼', dialCode: '+263', phoneMin: 9, phoneMax: 9, phoneHint: '9 digits' },
];

/** Validate a local phone number (without dial code) against country rules */
export function validatePhoneForCountry(phone: string, dialCode: string): string | null {
  const digits = phone.replace(/\D/g, '');
  const country = COUNTRIES.find(c => c.dialCode === dialCode);
  if (!country) {
    // Generic: 6–15 digits
    if (digits.length < 6 || digits.length > 15) return 'Phone must be 6–15 digits';
    return null;
  }
  if (digits.length < country.phoneMin || digits.length > country.phoneMax) {
    return `Phone must be ${country.phoneHint} for ${country.name}`;
  }
  // India-specific: must start with 6–9
  if (dialCode === '+91' && !/^[6-9]/.test(digits)) {
    return 'Indian mobile numbers must start with 6, 7, 8 or 9';
  }
  return null;
}

/** Validate email format */
export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email is required';
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!re.test(email.trim())) return 'Enter a valid email address (e.g. name@domain.com)';
  return null;
}
