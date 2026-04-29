import { motion } from 'framer-motion';
import { hourlyForecast } from '../data/weatherData';

export default function ForecastTimeline() {
  const maxPrecip = Math.max(...hourlyForecast.map((h) => h.precipitation));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.7 }}
      className="glass-panel rounded-xl px-4 py-3"
    >
      <div className="text-xs text-white/40 mb-3">24h Forecast</div>
      <div className="flex items-end gap-3">
        {hourlyForecast.map((hour, i) => (
          <div key={hour.hour} className="flex flex-col items-center gap-1.5 flex-1">
            <div className="text-xs font-light text-white">{hour.temp}°</div>
            <div className="w-full flex flex-col items-center gap-0.5">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(hour.precipitation / maxPrecip) * 24}px` }}
                transition={{ duration: 0.5, delay: 0.8 + i * 0.05 }}
                className={`w-full rounded-t-sm ${
                  hour.precipitation > 50
                    ? 'bg-blue-500/60'
                    : hour.precipitation > 20
                    ? 'bg-cyan-500/50'
                    : 'bg-white/10'
                }`}
              />
              <div className="w-full h-0.5 bg-white/10" />
            </div>
            <div className="text-[9px] text-white/30">{hour.hour}</div>
            <div className="text-[8px] text-white/20 truncate w-full text-center">
              {hour.condition}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
