import React from 'react';

const ICON_COLORS = {
  sunny: '#F59E0B',
  'partly-cloudy': '#94A3B8',
  cloudy: '#64748B',
  rain: '#60A5FA',
  storm: '#A78BFA',
  snow: '#E2E8F0',
  'clear-night': '#CBD5E1',
};

export default function WeatherIcon({ condition = 'sunny', size = 24, className = '' }) {
  const color = ICON_COLORS[condition] || ICON_COLORS.sunny;

  if (condition === 'sunny') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`animate-sun-rotate ${className}`}>
        <circle cx="12" cy="12" r="5" fill={color} />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <line key={angle} x1="12" y1="2" x2="12" y2="5"
            stroke={color} strokeWidth="2" strokeLinecap="round"
            transform={`rotate(${angle} 12 12)`} />
        ))}
      </svg>
    );
  }

  if (condition === 'partly-cloudy') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="8" cy="8" r="4" fill="#F59E0B" />
        <g className="animate-cloud-drift">
          <path d="M10 18h8a4 4 0 0 0 0-8 5 5 0 0 0-9.9 1A3 3 0 0 0 10 18z" fill={color} fillOpacity="0.9" />
        </g>
      </svg>
    );
  }

  if (condition === 'cloudy') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`animate-cloud-drift ${className}`}>
        <path d="M6 18h12a5 5 0 0 0 0-10 6 6 0 0 0-11.8 1.5A4 4 0 0 0 6 18z" fill={color} fillOpacity="0.8" />
      </svg>
    );
  }

  if (condition === 'rain') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M6 12h12a5 5 0 0 0 0-10 6 6 0 0 0-11.8 1.5A4 4 0 0 0 6 12z" fill="#64748B" fillOpacity="0.6" />
        {[8, 12, 16].map((x, i) => (
          <line key={x} x1={x} y1="14" x2={x} y2="18"
            stroke={color} strokeWidth="1.5" strokeLinecap="round"
            className="animate-rain-drop" style={{ animationDelay: `${i * 0.3}s` }} />
        ))}
      </svg>
    );
  }

  if (condition === 'storm') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M6 10h12a5 5 0 0 0 0-10 6 6 0 0 0-11.8 1.5A4 4 0 0 0 6 10z" fill="#64748B" fillOpacity="0.7" />
        <path d="M13 11l-2 5h4l-2 5" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (condition === 'snow') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M6 12h12a5 5 0 0 0 0-10 6 6 0 0 0-11.8 1.5A4 4 0 0 0 6 12z" fill="#94A3B8" fillOpacity="0.5" />
        {[8, 12, 16].map((x) => (
          <circle key={x} cx={x} cy="16" r="1.5" fill={color} className="animate-rain-drop" />
        ))}
      </svg>
    );
  }

  if (condition === 'clear-night') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`animate-moon-pulse ${className}`}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill={color} />
      </svg>
    );
  }

  // Fallback
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="5" fill={color} />
    </svg>
  );
}
