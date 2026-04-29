import { motion } from 'framer-motion';
import { CloudRain, Wind, Thermometer, Eye } from 'lucide-react';

interface OverlaySelectorProps {
  activeOverlay: string;
  onOverlayChange: (overlay: string) => void;
}

const overlays = [
  { value: 'none', label: 'None', icon: Eye },
  { value: 'precipitation', label: 'Precipitation', icon: CloudRain },
  { value: 'wind', label: 'Wind', icon: Wind },
  { value: 'temperature', label: 'Temperature', icon: Thermometer },
];

export default function OverlaySelector({ activeOverlay, onOverlayChange }: OverlaySelectorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.55 }}
      className="absolute top-4 right-16 z-[400] glass-panel rounded-xl p-1.5 flex gap-1"
    >
      {overlays.map((o) => (
        <button
          key={o.value}
          onClick={() => onOverlayChange(o.value)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
            activeOverlay === o.value
              ? 'bg-white/[0.12] text-white'
              : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
          }`}
        >
          <o.icon className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">{o.label}</span>
        </button>
      ))}
    </motion.div>
  );
}
