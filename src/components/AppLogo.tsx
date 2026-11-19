interface AppAntiqueLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function AppAntiqueLogo({ className = '', size = 'md' }: AppAntiqueLogoProps) {
  const sizeClass =
    size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-16 w-16' : 'h-11 w-11';

  return (
    <svg
      viewBox="0 0 120 120"
      className={`shrink-0 ${sizeClass} ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ga-bg-grad" x1="12" y1="8" x2="108" y2="112" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#145A38" />
          <stop offset="55%" stopColor="#0D4027" />
          <stop offset="100%" stopColor="#072717" />
        </linearGradient>
        <linearGradient id="ga-gold-grad" x1="18" y1="14" x2="102" y2="106" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F3DC9B" />
          <stop offset="50%" stopColor="#D4AF5A" />
          <stop offset="100%" stopColor="#A67E2E" />
        </linearGradient>
      </defs>

      {/* Outer antique medallion cartouche */}
      <rect x="4" y="4" width="112" height="112" rx="26" fill="url(#ga-bg-grad)" />
      <rect
        x="7.5"
        y="7.5"
        width="105"
        height="105"
        rx="22.5"
        stroke="url(#ga-gold-grad)"
        strokeWidth="2.2"
      />
      <rect
        x="13"
        y="13"
        width="94"
        height="94"
        rx="18"
        stroke="url(#ga-gold-grad)"
        strokeOpacity="0.45"
        strokeWidth="1"
        strokeDasharray="2.5 2.5"
      />

      {/* Moorish / Heritage arch crest & vintage corner ornaments */}
      <path
        d="M24 38 C24 24, 42 18, 60 18 C78 18, 96 24, 96 38"
        stroke="url(#ga-gold-grad)"
        strokeOpacity="0.55"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path d="M60 14 L63 18 L60 22 L57 18 Z" fill="url(#ga-gold-grad)" />
      <path d="M60 98 L63 102 L60 106 L57 102 Z" fill="url(#ga-gold-grad)" />
      <circle cx="22" cy="22" r="2" fill="url(#ga-gold-grad)" fillOpacity="0.8" />
      <circle cx="98" cy="22" r="2" fill="url(#ga-gold-grad)" fillOpacity="0.8" />
      <circle cx="22" cy="98" r="2" fill="url(#ga-gold-grad)" fillOpacity="0.8" />
      <circle cx="98" cy="98" r="2" fill="url(#ga-gold-grad)" fillOpacity="0.8" />

      {/* Antique engraved serif monogram "G A" */}
      <text
        x="60"
        y="74"
        textAnchor="middle"
        fill="url(#ga-gold-grad)"
        fontFamily="'Playfair Display', 'Liberation Serif', 'Times New Roman', Georgia, serif"
        fontWeight="700"
        fontSize="44"
        letterSpacing="2"
      >
        GA
      </text>

      {/* Subtle engraved horizontal flourish under monogram */}
      <path
        d="M32 84 H52 M68 84 H88"
        stroke="url(#ga-gold-grad)"
        strokeOpacity="0.7"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="60" cy="84" r="2" fill="url(#ga-gold-grad)" />
    </svg>
  );
}
