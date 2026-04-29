import { motion } from 'framer-motion';
import { Thermometer, Droplets, Wind, Gauge } from 'lucide-react';

const stats = [
  { icon: Thermometer, label: 'Temp', value: '24°C' },
  { icon: Droplets, label: 'Humidity', value: '68%' },
  { icon: Wind, label: 'Wind', value: '12 km/h' },
  { icon: Gauge, label: 'Pressure', value: '1013 hPa' },
];

export default function StatsRow() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="flex items-center gap-2"
    >
      {stats.map((stat) => (
        <motion.div
          key={stat.label}
          whileHover={{ scale: 1.02 }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0E0E16] border border-white/[0.06] cursor-default flex-1"
        >
          <stat.icon className="w-3.5 h-3.5 text-white/40" />
          <div>
            <div className="text-[11px] text-white/40 leading-tight">{stat.label}</div>
            <div className="text-xs font-semibold text-white leading-tight">{stat.value}</div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
