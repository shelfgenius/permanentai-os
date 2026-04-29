import { motion } from 'framer-motion';
import StatsRow from './StatsRow';
import StatusIndicator from './StatusIndicator';
import AccuracyPanel from './AccuracyPanel';
import LocationCard from './LocationCard';
import { weatherStations } from '../data/weatherData';

export default function Sidebar() {
  const activeCount = weatherStations.filter((s) => s.status === 'online').length;
  const inactiveCount = weatherStations.filter((s) => s.status === 'offline').length;

  return (
    <motion.aside
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="flex flex-col gap-3 w-[420px] min-w-[420px] h-full overflow-y-auto pr-1 scrollbar-hide"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {/* Stats Row */}
      <StatsRow />

      {/* Status Row */}
      <div className="flex items-center justify-between px-1">
        <StatusIndicator status="active" count={activeCount} />
        <StatusIndicator status="inactive" count={inactiveCount} />
      </div>

      {/* Accuracy Panel */}
      <AccuracyPanel />

      {/* Location Cards Grid */}
      <div className="grid grid-cols-2 gap-2">
        {weatherStations.map((station, i) => (
          <LocationCard key={station.id} station={station} index={i} />
        ))}
      </div>
    </motion.aside>
  );
}
