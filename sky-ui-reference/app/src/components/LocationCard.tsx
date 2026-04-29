import { motion } from 'framer-motion';
import { Wifi, Signal, ArrowUpRight } from 'lucide-react';
import Sparkline from './Sparkline';
import type { WeatherStation } from '../data/weatherData';

interface LocationCardProps {
  station: WeatherStation;
  index: number;
}

export default function LocationCard({ station, index }: LocationCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 + index * 0.08 }}
      whileHover={{ y: -2 }}
      className="rounded-xl bg-[#0E0E16] border border-white/[0.06] overflow-hidden card-hover cursor-pointer"
    >
      <div className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-xs font-medium text-white">{station.name}</div>
            <div className="text-[9px] text-white/30 mt-0.5">{station.timestamp}</div>
          </div>
          <ArrowUpRight className="w-3.5 h-3.5 text-white/30" />
        </div>

        <div className="flex items-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#161622]">
            <img
              src={station.image}
              alt={station.name}
              className="w-full h-full object-cover opacity-80"
            />
          </div>
          <div>
            <div className="text-lg font-light text-white">{station.temp}°C</div>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center gap-1">
            {station.status === 'online' ? (
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            ) : (
              <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-amber-500" />
            )}
            <span className="text-[10px] text-white/50 capitalize">{station.status}</span>
          </div>
          <div className="flex items-center gap-1 text-white/30">
            <Signal className="w-3 h-3" />
            <span className="text-[9px]">GPS</span>
          </div>
          <div className="flex items-center gap-1 text-white/30">
            <Wifi className="w-3 h-3" />
            <span className="text-[9px]">LTE</span>
          </div>
        </div>

        <Sparkline
          data={station.chartData}
          color={station.status === 'online' ? '#3B82F6' : '#EF4444'}
          width={140}
          height={28}
        />
      </div>
    </motion.div>
  );
}
