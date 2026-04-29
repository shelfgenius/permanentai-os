import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { varianceData } from '../data/weatherData';
import { useCountUp } from '../hooks/useCountUp';

export default function ForecastVariance() {
  const countValue = useCountUp(2.5, 600, 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.6 }}
      className="p-4 rounded-2xl bg-[#0E0E16] border border-white/[0.06]"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs text-white/60">Forecast Variance</div>
        <ArrowUpRight className="w-3.5 h-3.5 text-white/30" />
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-3xl font-light text-white">± {countValue}</span>
        <span className="text-sm text-white/40">min</span>
      </div>
      <div className="text-[11px] text-white/30 mb-3">Average Variance</div>

      {/* Variance bars */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[9px] text-white/30 mb-1">
          <span>Route</span>
          <span>Variance</span>
        </div>
        {varianceData.map((v) => (
          <div key={v.label} className="flex items-center gap-2">
            <span className="text-[9px] text-white/40 w-6">{v.label}</span>
            <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(Math.abs(v.value) / 3 * 100, 100)}%` }}
                transition={{ duration: 0.8, delay: 0.8 }}
                className={`h-full rounded-full ${
                  v.value > 0 ? 'bg-amber-500/60' : 'bg-emerald-500/60'
                }`}
                style={{ marginLeft: v.value < 0 ? 'auto' : 0, marginRight: v.value > 0 ? 'auto' : 0 }}
              />
            </div>
            <span
              className={`text-[9px] w-8 text-right ${
                v.value > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {v.value > 0 ? `+${v.value}` : v.value}min
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
