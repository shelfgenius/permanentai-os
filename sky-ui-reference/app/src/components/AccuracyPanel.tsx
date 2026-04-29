import { motion } from 'framer-motion';
import Sparkline from './Sparkline';
import { accuracyTrend } from '../data/weatherData';
import { useCountUp } from '../hooks/useCountUp';

export default function AccuracyPanel() {
  const countValue = useCountUp(94.2, 800, 1);
  const sparkData = accuracyTrend.map((d) => d.value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="p-4 rounded-2xl bg-[#0E0E16] border border-white/[0.06]"
    >
      <div className="text-xs text-white/60 mb-1">Weather Accuracy</div>
      <div className="flex items-baseline gap-1">
        <span className="text-4xl font-light text-white">{countValue}</span>
        <span className="text-sm text-white/40">%</span>
      </div>
      <div className="text-[11px] text-white/30 mb-3">Target: 95%</div>
      <Sparkline data={sparkData} color="#3B82F6" width={260} height={50} />
      <div className="flex justify-between mt-2">
        {['06:00', '09:00', '12:00', '15:00', '17:00'].map((t) => (
          <span key={t} className="text-[9px] text-white/25">{t}</span>
        ))}
      </div>
    </motion.div>
  );
}
