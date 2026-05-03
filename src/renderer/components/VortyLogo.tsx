import React from 'react';

interface Props {
  size?: number;
  className?: string;
  glow?: boolean;
}

export default function VortyLogo({ size = 32, className = '', glow = false }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={glow ? { filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.6)) drop-shadow(0 0 20px rgba(124, 58, 237, 0.3))' } : undefined}
    >
      <defs>
        <linearGradient id="vortyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="50%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#d946ef" />
        </linearGradient>
        <linearGradient id="vortyGradInner" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <filter id="vortyGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect x="2" y="2" width="96" height="96" rx="16" ry="16"
        fill="url(#vortyGrad)" opacity="0.15" stroke="url(#vortyGrad)" strokeWidth="2" />
      <path
        d="M 25 22 L 42 72 C 43.5 76 46 78 50 78 C 54 78 56.5 76 58 72 L 75 22"
        fill="none"
        stroke="url(#vortyGrad)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#vortyGlow)"
      />
      <path
        d="M 30 26 L 45 70 C 46 73 48 74 50 74 C 52 74 54 73 55 70 L 70 26"
        fill="none"
        stroke="url(#vortyGradInner)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
    </svg>
  );
}
