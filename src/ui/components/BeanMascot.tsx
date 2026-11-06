export type MascotState = 'happy' | 'sad' | 'worried';

const LABELS: Record<MascotState, string> = {
  happy: '豆豆很开心',
  sad: '豆豆超支了',
  worried: '豆豆进入保底阶段',
};

const POT_LEAVES = {
  happy: (
    <>
      <path d="M60 70 q-2 -20 -16 -28" stroke="#5F6B5A" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M49 48 q-16 -8 -22 4 q14 10 22 -4Z" fill="#9DB08A" stroke="#5F6B5A" strokeWidth="2" />
      <path d="M61 56 q14 -12 24 -2 q-12 12 -24 2Z" fill="#B7C3B0" stroke="#5F6B5A" strokeWidth="2" />
      <path d="M56 35 q-10 -12 -22 -6 q6 14 22 6Z" fill="#C4D0BE" stroke="#5F6B5A" strokeWidth="2" />
      <path d="M66 44 q12 -12 22 -4 q-8 12 -22 4Z" fill="#C4D0BE" stroke="#5F6B5A" strokeWidth="2" />
      <path d="M46 62 q-16 -4 -20 8 q12 8 20 -8Z" fill="#B7C3B0" stroke="#5F6B5A" strokeWidth="2" />
    </>
  ),
  sad: <path d="M60 70 q-2 -12 -10 -18" stroke="#8A6654" strokeWidth="3" fill="none" strokeLinecap="round" />,
  worried: (
    <>
      <path d="M60 70 q-2 -20 -16 -28" stroke="#5F6B5A" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M49 48 q-16 -8 -22 4 q14 10 22 -4Z" fill="#9DB08A" stroke="#5F6B5A" strokeWidth="2" />
      <path d="M56 35 q-10 -12 -22 -6 q6 14 22 6Z" fill="#C4D0BE" stroke="#5F6B5A" strokeWidth="2" />
    </>
  ),
};

interface BeanMascotProps {
  state: MascotState;
  className?: string;
}

export function BeanMascot({ state, className = '' }: BeanMascotProps) {
  return (
    <svg
      className={`mascot ${className}`}
      viewBox="0 0 260 240"
      role="img"
      aria-label={LABELS[state]}
    >
      <circle cx="120" cy="110" r="58" fill="#F7F3EA" stroke="#D8CFC3" strokeWidth="3" />

      {state === 'happy' && (
        <>
          <circle cx="102" cy="105" r="6" fill="#4B4742" />
          <circle cx="138" cy="105" r="6" fill="#4B4742" />
          <path d="M112 130 Q120 136 128 130" stroke="#4B4742" strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="84" cy="120" r="7" fill="#E2B6B0" opacity=".6" />
          <circle cx="156" cy="120" r="7" fill="#E2B6B0" opacity=".6" />
          <path d="M46 88 l3-7 3 7-3-2z" fill="#F0D9A8" />
          <circle cx="196" cy="84" r="2.5" fill="#F0D9A8" />
        </>
      )}

      {state === 'sad' && (
        <>
          <rect x="84" y="90" width="24" height="6" rx="3" fill="#5F6B5A" transform="rotate(-18 96 93)" />
          <rect x="132" y="90" width="24" height="6" rx="3" fill="#5F6B5A" transform="rotate(18 144 93)" />
          <path d="M90 106 Q100 98 110 106 Q100 102 90 106Z" fill="#4B4742" />
          <path d="M130 106 Q140 98 150 106 Q140 102 130 106Z" fill="#4B4742" />
          <path d="M96 108 q-3 18 1 30 q5 2 5 -30Z" fill="#A9C6D6" opacity=".92" />
          <path d="M144 108 q3 18 -1 30 q-5 2 -5 -30Z" fill="#A9C6D6" opacity=".92" />
          <ellipse cx="98" cy="140" rx="4" ry="6" fill="#A9C6D6" />
          <ellipse cx="142" cy="140" rx="4" ry="6" fill="#A9C6D6" />
          <ellipse cx="120" cy="136" rx="9" ry="7" fill="#4B3A2E" />
          <ellipse cx="120" cy="139" rx="5" ry="3" fill="#C98A8A" />
        </>
      )}

      {state === 'worried' && (
        <>
          <path
            d="M90 96 L108 106 L90 116"
            stroke="#3F4A3C"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M150 96 L132 106 L150 116"
            stroke="#3F4A3C"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <ellipse cx="120" cy="136" rx="6" ry="7" fill="#4B3A2E" />
          <ellipse cx="120" cy="139" rx="3" ry="3" fill="#C98A8A" />
          <path d="M156 94 C162 104 160 112 154 114 C148 112 148 102 156 94Z" fill="#A9C6D6" stroke="#7FA6BA" strokeWidth="2" />
        </>
      )}

      <g transform="translate(12, 120) scale(0.55)">
        <path
          d="M36 112 L28 72 L92 72 L84 112 Q60 118 36 112Z"
          fill="#C08B72"
          stroke="#8A6654"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <ellipse cx="60" cy="72" rx="32" ry="8" fill="#8A6654" />
        <ellipse cx="60" cy="70" rx="25" ry="5" fill="#6B4B36" />
        {POT_LEAVES[state]}
      </g>

      {state === 'sad' && (
        <>
          <path d="M30 206 q-10 6 -8 14 q10 2 8 -14Z" fill="#B7C3B0" stroke="#5F6B5A" strokeWidth="2" />
          <path d="M44 212 q10 6 8 14 q-10 2 -8 -14Z" fill="#C4D0BE" stroke="#5F6B5A" strokeWidth="2" />
          <path d="M18 214 q-6 8 -2 14 q8 0 2 -14Z" fill="#9DB08A" stroke="#5F6B5A" strokeWidth="2" />
        </>
      )}
      {state === 'worried' && (
        <path d="M30 210 q-8 8 -2 14 q8 -2 2 -14Z" fill="#B7C3B0" stroke="#5F6B5A" strokeWidth="2" />
      )}
    </svg>
  );
}
