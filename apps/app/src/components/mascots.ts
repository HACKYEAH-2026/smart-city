/**
 * The place mascots (one per kind of place, from the design "Maskotka"): decorative illustrations on the dashboard.
 * Their artwork palette is the design's own (the brand gradient, the ink, the cream), so the colours stay in the markup.
 * Each drawing is a 240 × 280 artboard; the screen draws it with `SvgXml` and hides it from assistive tech.
 */
import type { PlaceKind } from "@app/shared";

export const MASCOT_VIEWBOX = { width: 240, height: 280 } as const;

const ESTATE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 280">
<defs><linearGradient id="os1" gradientUnits="userSpaceOnUse" x1="40" y1="40" x2="200" y2="210"><stop offset="0" stop-color="#D81B60"/><stop offset="1" stop-color="#F2545B"/></linearGradient></defs>
<ellipse cx="120" cy="229" rx="46" ry="6" fill="#D81B60" opacity="0.16"/>
<path d="M104 196 Q101.6 210.4 99.2 221.2" stroke="#3A0A1C" stroke-width="7" stroke-linecap="round" fill="none"/>
<path d="M140 196 Q149.6 206.8 158 211.6" stroke="#3A0A1C" stroke-width="7" stroke-linecap="round" fill="none"/>
<ellipse cx="95" cy="225" rx="11" ry="6.5" fill="#3A0A1C" transform="rotate(-8 95 225)"/>
<ellipse cx="163" cy="214" rx="11" ry="6.5" fill="#3A0A1C" transform="rotate(30 163 214)"/>
<path d="M62 128 Q50 118.4 47.6 101.6" stroke="#3A0A1C" stroke-width="7" stroke-linecap="round" fill="none"/>
<path d="M184 126 Q198.4 134.4 187.6 147.6" stroke="#3A0A1C" stroke-width="7" stroke-linecap="round" fill="none"/>
<circle cx="47.6" cy="96.6" r="7.5" fill="#3A0A1C"/>
<circle cx="188" cy="150" r="7.5" fill="#3A0A1C"/>
<rect x="58" y="96" width="46" height="104" rx="10" fill="url(#os1)"/>
<rect x="140" y="80" width="46" height="120" rx="10" fill="url(#os1)"/>
<rect x="92" y="50" width="60" height="150" rx="12" fill="url(#os1)"/>
<g fill="#FFFFFF" opacity="0.4">
<rect x="67" y="112" width="10" height="10" rx="2"/><rect x="67" y="132" width="10" height="10" rx="2"/><rect x="67" y="152" width="10" height="10" rx="2"/><rect x="67" y="172" width="10" height="10" rx="2"/>
<rect x="166" y="98" width="10" height="10" rx="2"/><rect x="166" y="118" width="10" height="10" rx="2"/><rect x="166" y="138" width="10" height="10" rx="2"/><rect x="166" y="158" width="10" height="10" rx="2"/>
<rect x="102" y="142" width="10" height="10" rx="2"/><rect x="132" y="142" width="10" height="10" rx="2"/><rect x="102" y="162" width="10" height="10" rx="2"/><rect x="132" y="162" width="10" height="10" rx="2"/>
</g>
<path d="M112 200 V188 A10 10 0 0 1 132 188 V200 Z" fill="#FFD9DE"/>
<path d="M100 62 Q104 56 112 56" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="5" stroke-linecap="round" fill="none"/>
<path d="M5 -18 C-2 -19 -8 -14 -10 -6 C-13 4 -12 14 -3 17 C5 19 12 15 13 6 C14 -3 11 -16 5 -18 Z" transform="translate(111 85) scale(0.82)" fill="#FFFFFF"/>
<path d="M-4 -17 C-10 -16 -13 -6 -13 3 C-13 12 -6 17 2 17 C10 17 15 10 14 1 C13 -8 5 -18 -4 -17 Z" transform="translate(133 85) scale(0.82)" fill="#FFFFFF"/>
<circle cx="113" cy="81" r="4" fill="#3A0A1C"/>
<circle cx="136" cy="81" r="4" fill="#3A0A1C"/>
<path d="M114 110 Q122 117 130 110" stroke="#3A0A1C" stroke-width="3.5" stroke-linecap="round" fill="none"/>
</svg>`;

const BUILDING = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 280">
<defs><linearGradient id="bu1" gradientUnits="userSpaceOnUse" x1="40" y1="40" x2="200" y2="210"><stop offset="0" stop-color="#D81B60"/><stop offset="1" stop-color="#F2545B"/></linearGradient></defs>
<ellipse cx="120" cy="229" rx="46" ry="6" fill="#D81B60" opacity="0.16"/>
<path d="M104 196 Q94.4 204.4 86 208" stroke="#3A0A1C" stroke-width="7" stroke-linecap="round" fill="none"/>
<path d="M136 196 Q138.4 210.4 140.8 221.2" stroke="#3A0A1C" stroke-width="7" stroke-linecap="round" fill="none"/>
<ellipse cx="81" cy="210" rx="11" ry="6.5" fill="#3A0A1C" transform="rotate(-30 81 210)"/>
<ellipse cx="145" cy="225" rx="11" ry="6.5" fill="#3A0A1C" transform="rotate(8 145 225)"/>
<path d="M74 124 Q60.8 127.6 50 121.6" stroke="#3A0A1C" stroke-width="7" stroke-linecap="round" fill="none"/>
<path d="M166 116 Q181.6 106.4 184 88.4" stroke="#3A0A1C" stroke-width="7" stroke-linecap="round" fill="none"/>
<circle cx="46" cy="119.6" r="7.5" fill="#3A0A1C"/>
<circle cx="184" cy="83.4" r="7.5" fill="#3A0A1C"/>
<rect x="72" y="46" width="96" height="154" rx="14" fill="url(#bu1)"/>
<rect x="64" y="38" width="112" height="16" rx="7" fill="#C2185B"/>
<g fill="#FFFFFF" opacity="0.4">
<rect x="84" y="138" width="14" height="16" rx="3"/><rect x="142" y="138" width="14" height="16" rx="3"/>
<rect x="84" y="164" width="14" height="16" rx="3"/><rect x="142" y="164" width="14" height="16" rx="3"/>
</g>
<path d="M108 200 V184 A12 12 0 0 1 132 184 V200 Z" fill="#FFD9DE"/>
<path d="M82 68 Q86 62 94 62" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="5" stroke-linecap="round" fill="none"/>
<path d="M5 -18 C-2 -19 -8 -14 -10 -6 C-13 4 -12 14 -3 17 C5 19 12 15 13 6 C14 -3 11 -16 5 -18 Z" transform="translate(107 84)" fill="#FFFFFF"/>
<path d="M-4 -17 C-10 -16 -13 -6 -13 3 C-13 12 -6 17 2 17 C10 17 15 10 14 1 C13 -8 5 -18 -4 -17 Z" transform="translate(133 84)" fill="#FFFFFF"/>
<circle cx="101" cy="86" r="4.5" fill="#3A0A1C"/>
<circle cx="129" cy="86" r="4.5" fill="#3A0A1C"/>
<path d="M112 111 Q120 118 128 111" stroke="#3A0A1C" stroke-width="3.5" stroke-linecap="round" fill="none"/>
</svg>`;

const SCHOOL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 280">
<defs><linearGradient id="sz1" gradientUnits="userSpaceOnUse" x1="60" y1="74" x2="180" y2="194"><stop offset="0" stop-color="#D81B60"/><stop offset="1" stop-color="#F2545B"/></linearGradient></defs>
<ellipse cx="120" cy="228" rx="46" ry="6" fill="#D81B60" opacity="0.16"/>
<path d="M104 190 Q101.6 205.6 99.2 218.8" stroke="#3A0A1C" stroke-width="7" stroke-linecap="round" fill="none"/>
<path d="M136 190 Q145.6 200.8 155.2 204.4" stroke="#3A0A1C" stroke-width="7" stroke-linecap="round" fill="none"/>
<ellipse cx="95" cy="223" rx="11" ry="6.5" fill="#3A0A1C" transform="rotate(-8 95 223)"/>
<ellipse cx="160" cy="205" rx="11" ry="6.5" fill="#3A0A1C" transform="rotate(30 160 205)"/>
<path d="M62 146 Q48.8 156.8 46.4 168.8" stroke="#3A0A1C" stroke-width="7" stroke-linecap="round" fill="none"/>
<path d="M178 136 Q188.8 120.4 191.2 100" stroke="#3A0A1C" stroke-width="7" stroke-linecap="round" fill="none"/>
<circle cx="46.4" cy="173.8" r="7.5" fill="#3A0A1C"/>
<circle cx="191.2" cy="95" r="7.5" fill="#3A0A1C"/>
<circle cx="120" cy="134" r="60" fill="url(#sz1)"/>
<path d="M88 82 V98 Q120 112 152 98 V82 Z" fill="#3A0A1C"/>
<path d="M120 50 L188 74 L120 98 L52 74 Z" fill="#3A0A1C" stroke="#3A0A1C" stroke-width="4" stroke-linejoin="round"/>
<path d="M120 74 L172 86 V108" stroke="#FFC24B" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
<circle cx="172" cy="112" r="5.5" fill="#FFC24B"/>
<path d="M76 126 Q78 114 88 108" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="5" stroke-linecap="round" fill="none"/>
<path d="M5 -18 C-2 -19 -8 -14 -10 -6 C-13 4 -12 14 -3 17 C5 19 12 15 13 6 C14 -3 11 -16 5 -18 Z" transform="translate(107 134)" fill="#FFFFFF"/>
<path d="M-4 -17 C-10 -16 -13 -6 -13 3 C-13 12 -6 17 2 17 C10 17 15 10 14 1 C13 -8 5 -18 -4 -17 Z" transform="translate(133 134)" fill="#FFFFFF"/>
<circle cx="110" cy="128" r="4.5" fill="#3A0A1C"/>
<circle cx="138" cy="128" r="4.5" fill="#3A0A1C"/>
<path d="M112 159 Q120 166 128 159" stroke="#3A0A1C" stroke-width="3.5" stroke-linecap="round" fill="none"/>
</svg>`;

const COMPANY = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 280">
<defs><linearGradient id="fi1" gradientUnits="userSpaceOnUse" x1="40" y1="50" x2="200" y2="200"><stop offset="0" stop-color="#D81B60"/><stop offset="1" stop-color="#F2545B"/></linearGradient></defs>
<ellipse cx="120" cy="226" rx="46" ry="6" fill="#D81B60" opacity="0.16"/>
<path d="M100 186 Q97.6 202.8 95.2 216" stroke="#3A0A1C" stroke-width="7" stroke-linecap="round" fill="none"/>
<path d="M140 186 Q150.8 196.8 159.2 200.4" stroke="#3A0A1C" stroke-width="7" stroke-linecap="round" fill="none"/>
<ellipse cx="91" cy="220" rx="11" ry="6.5" fill="#3A0A1C" transform="rotate(-8 91 220)"/>
<ellipse cx="164" cy="201" rx="11" ry="6.5" fill="#3A0A1C" transform="rotate(25 164 201)"/>
<path d="M52 118 Q36.4 128.8 48.4 142" stroke="#3A0A1C" stroke-width="7" stroke-linecap="round" fill="none"/>
<path d="M188 116 Q204.8 113.6 202.4 96.8" stroke="#3A0A1C" stroke-width="7" stroke-linecap="round" fill="none"/>
<circle cx="50" cy="144" r="7.5" fill="#3A0A1C"/>
<circle cx="202.4" cy="91.8" r="7.5" fill="#3A0A1C"/>
<path d="M98 76 V58 Q98 48 108 48 H132 Q142 48 142 58 V76" stroke="#C2185B" stroke-width="10" stroke-linecap="round" fill="none"/>
<rect x="48" y="72" width="144" height="116" rx="24" fill="url(#fi1)"/>
<rect x="48" y="148" width="144" height="8" fill="#FFFFFF" opacity="0.25"/>
<rect x="110" y="142" width="20" height="20" rx="5" fill="#FFD9DE"/>
<path d="M62 94 Q66 84 78 82" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="5" stroke-linecap="round" fill="none"/>
<clipPath id="fiEyeL"><path d="M5 -18 C-2 -19 -8 -14 -10 -6 C-13 4 -12 14 -3 17 C5 19 12 15 13 6 C14 -3 11 -16 5 -18 Z" transform="translate(107 100)"/></clipPath>
<clipPath id="fiEyeR"><path d="M-4 -17 C-10 -16 -13 -6 -13 3 C-13 12 -6 17 2 17 C10 17 15 10 14 1 C13 -8 5 -18 -4 -17 Z" transform="translate(133 100)"/></clipPath>
<path d="M5 -18 C-2 -19 -8 -14 -10 -6 C-13 4 -12 14 -3 17 C5 19 12 15 13 6 C14 -3 11 -16 5 -18 Z" transform="translate(107 100)" fill="#FFFFFF"/>
<path d="M-4 -17 C-10 -16 -13 -6 -13 3 C-13 12 -6 17 2 17 C10 17 15 10 14 1 C13 -8 5 -18 -4 -17 Z" transform="translate(133 100)" fill="#FFFFFF"/>
<circle cx="110" cy="107" r="4.5" fill="#3A0A1C"/>
<circle cx="136" cy="107" r="4.5" fill="#3A0A1C"/>
<rect x="88" y="78" width="34" height="22" fill="#DE2A5E" clip-path="url(#fiEyeL)"/>
<rect x="118" y="78" width="34" height="22" fill="#E2305D" clip-path="url(#fiEyeR)"/>
<path d="M95.5 100 Q107 102 120 99 M120 99 Q134 102 146.5 100" stroke="#3A0A1C" stroke-width="1.5" stroke-linecap="round" fill="none"/>
<path d="M112 125 Q120 132 128 125" stroke="#3A0A1C" stroke-width="3.5" stroke-linecap="round" fill="none"/>
</svg>`;

const DISTRICT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 280">
<defs><linearGradient id="dz1" gradientUnits="userSpaceOnUse" x1="50" y1="50" x2="190" y2="196"><stop offset="0" stop-color="#D81B60"/><stop offset="1" stop-color="#F2545B"/></linearGradient></defs>
<ellipse cx="120" cy="228" rx="46" ry="6" fill="#D81B60" opacity="0.16"/>
<path d="M100 188 Q91.6 197.6 83.2 201.2" stroke="#3A0A1C" stroke-width="7" stroke-linecap="round" fill="none"/>
<path d="M140 194 Q142.4 209.6 143.6 220.4" stroke="#3A0A1C" stroke-width="7" stroke-linecap="round" fill="none"/>
<ellipse cx="78" cy="202" rx="11" ry="6.5" fill="#3A0A1C" transform="rotate(-30 78 202)"/>
<ellipse cx="148" cy="224" rx="11" ry="6.5" fill="#3A0A1C" transform="rotate(8 148 224)"/>
<path d="M52 116 Q41.2 113.6 31.6 110" stroke="#3A0A1C" stroke-width="7" stroke-linecap="round" fill="none"/>
<path d="M188 112 Q203.6 104.8 201.2 88" stroke="#3A0A1C" stroke-width="7" stroke-linecap="round" fill="none"/>
<circle cx="27.6" cy="109" r="7.5" fill="#3A0A1C"/>
<circle cx="201.2" cy="83" r="7.5" fill="#3A0A1C"/>
<path d="M50 64 L92 50 L148 64 L190 50 V182 L148 196 L92 182 L50 196 Z" fill="url(#dz1)" stroke="url(#dz1)" stroke-width="8" stroke-linejoin="round"/>
<path d="M92 50 V182 M148 64 V196" stroke="#FFFFFF" stroke-opacity="0.3" stroke-width="3"/>
<path d="M62 176 Q66 150 80 132" stroke="#FFFFFF" stroke-opacity="0.55" stroke-width="3" stroke-dasharray="5 6" stroke-linecap="round" fill="none"/>
<path d="M5 -18 C-2 -19 -8 -14 -10 -6 C-13 4 -12 14 -3 17 C5 19 12 15 13 6 C14 -3 11 -16 5 -18 Z" transform="translate(109 107) scale(0.82)" fill="#FFFFFF"/>
<path d="M-4 -17 C-10 -16 -13 -6 -13 3 C-13 12 -6 17 2 17 C10 17 15 10 14 1 C13 -8 5 -18 -4 -17 Z" transform="translate(131 107) scale(0.82)" fill="#FFFFFF"/>
<circle cx="104" cy="108" r="4" fill="#3A0A1C"/>
<circle cx="128" cy="108" r="4" fill="#3A0A1C"/>
<path d="M113 130 Q120 136 127 130" stroke="#3A0A1C" stroke-width="3.5" stroke-linecap="round" fill="none"/>
</svg>`;

const OTHER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 280">
<defs><linearGradient id="in2" gradientUnits="userSpaceOnUse" x1="60" y1="78" x2="180" y2="194"><stop offset="0" stop-color="#D81B60"/><stop offset="1" stop-color="#F2545B"/></linearGradient></defs>
<ellipse cx="120" cy="199" rx="62" ry="6" fill="#D81B60" opacity="0.16"/>
<path d="M62 136 Q48 154 54 174" stroke="#3A0A1C" stroke-width="7" stroke-linecap="round" fill="none"/>
<path d="M178 136 Q192 154 186 174" stroke="#3A0A1C" stroke-width="7" stroke-linecap="round" fill="none"/>
<circle cx="54" cy="179" r="7.5" fill="#3A0A1C"/>
<circle cx="186" cy="179" r="7.5" fill="#3A0A1C"/>
<rect x="60" y="78" width="120" height="116" rx="52" fill="url(#in2)"/>
<path d="M120 30 L146 84 L94 84 Z" fill="#FFC24B" stroke="#FFC24B" stroke-width="6" stroke-linejoin="round"/>
<path d="M107 62 L133 62 M101 75 L139 75" stroke="#F2545B" stroke-width="5" stroke-linecap="round"/>
<circle cx="120" cy="27" r="8" fill="#F2545B"/>
<path d="M74 118 Q76 104 88 98" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="5" stroke-linecap="round" fill="none"/>
<path d="M5 -18 C-2 -19 -8 -14 -10 -6 C-13 4 -12 14 -3 17 C5 19 12 15 13 6 C14 -3 11 -16 5 -18 Z" transform="translate(107 122)" fill="#FFFFFF"/>
<circle cx="108" cy="124" r="4.5" fill="#3A0A1C"/>
<path d="M124 125 C128 117 138 115 144 123" stroke="#3A0A1C" stroke-width="3.5" stroke-linecap="round" fill="none"/>
<path d="M112 149 Q120 156 128 149" stroke="#3A0A1C" stroke-width="3.5" stroke-linecap="round" fill="none"/>
<path d="M102 188 L99 193 M138 188 L141 193" stroke="#3A0A1C" stroke-width="7" stroke-linecap="round"/>
<ellipse cx="97" cy="196" rx="12" ry="7" fill="#3A0A1C" transform="rotate(-12 97 196)"/>
<ellipse cx="143" cy="196" rx="12" ry="7" fill="#3A0A1C" transform="rotate(12 143 196)"/>
</svg>`;

/** The mascot of each kind of place. */
export const PLACE_MASCOTS: Record<PlaceKind, string> = {
  estate: ESTATE,
  building: BUILDING,
  company: COMPANY,
  school: SCHOOL,
  district: DISTRICT,
  other: OTHER,
};
