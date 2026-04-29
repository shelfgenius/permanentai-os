import { motion } from 'framer-motion';
import { LayoutGrid, Wifi, Battery, Signal } from 'lucide-react';
import { tabs } from '../data/weatherData';

interface TopNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function TopNav({ activeTab, onTabChange }: TopNavProps) {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex items-center justify-between px-5 h-14 border-b border-white/[0.06]"
    >
      {/* Left: Logo */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 flex items-center justify-center">
          <LayoutGrid className="w-5 h-5 text-white" />
        </div>
        <span className="text-white text-lg font-semibold tracking-tight">Sky</span>
      </div>

      {/* Center: Tabs */}
      <div className="flex items-center gap-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`relative px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
              activeTab === tab
                ? 'text-white bg-white/[0.08]'
                : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Right: Status Icons */}
      <div className="flex items-center gap-3 text-white/60">
        <Signal className="w-4 h-4" />
        <Wifi className="w-4 h-4" />
        <div className="flex items-center gap-1">
          <Battery className="w-4 h-4" />
          <span className="text-xs">51</span>
        </div>
      </div>
    </motion.nav>
  );
}
