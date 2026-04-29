import { useMemo } from 'react';

interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  showArea?: boolean;
}

export default function Sparkline({
  data,
  color = '#3B82F6',
  width = 120,
  height = 40,
  showArea = true,
}: SparklineProps) {
  const pathD = useMemo(() => {
    if (data.length < 2) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 4;
    const chartW = width - padding * 2;
    const chartH = height - padding * 2;

    return data
      .map((v, i) => {
        const x = padding + (i / (data.length - 1)) * chartW;
        const y = padding + chartH - ((v - min) / range) * chartH;
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
      })
      .join(' ');
  }, [data, width, height]);

  const areaD = useMemo(() => {
    if (data.length < 2) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 4;
    const chartW = width - padding * 2;
    const chartH = height - padding * 2;

    let d = '';
    data.forEach((v, i) => {
      const x = padding + (i / (data.length - 1)) * chartW;
      const y = padding + chartH - ((v - min) / range) * chartH;
      d += `${i === 0 ? 'M' : 'L'}${x},${y} `;
    });
    d += `L${width - padding},${height} L${padding},${height} Z`;
    return d;
  }, [data, width, height]);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {showArea && (
        <path
          d={areaD}
          fill={`url(#grad-${color.replace('#', '')})`}
        />
      )}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
