export default function Logo({ size = 28, className = '' }: { size?: number; className?: string }) {
  const navyStroke = 'stroke-slate-900 dark:stroke-navy-200';
  const navyFill = 'fill-slate-900 dark:fill-navy-200';
  const greenStroke = 'stroke-emerald-600 dark:stroke-emerald-400';

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className}>
      {/* navy edges */}
      <g className={navyStroke} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 30 L50 10 L85 30 L85 70 L50 90" />
        <path d="M50 50 L50 10" />
        <path d="M50 50 L85 70" />
      </g>
      {/* green edges */}
      <g className={greenStroke} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M50 90 L15 70 L15 30" />
        <path d="M50 50 L15 70" />
      </g>
      {/* vertex dots */}
      <g className={navyFill}>
        {[[50, 10], [85, 30], [85, 70], [50, 90], [15, 70], [15, 30], [50, 50]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="5.5" />
        ))}
      </g>
    </svg>
  );
}
