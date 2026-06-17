interface Props {
  className?: string;
  size?: number;
}

export default function FairKamerLogo({ className, size = 16 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Roof */}
      <polyline points="3 10 12 3 21 10" />
      {/* Walls */}
      <path d="M5 10 v11 h14 v-11" />
      {/* Arched door */}
      <path d="M9 21 v-5 a3 3 0 0 1 6 0 v5" />
    </svg>
  );
}
