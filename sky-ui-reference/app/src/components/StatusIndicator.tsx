import { motion } from 'framer-motion';

interface StatusIndicatorProps {
  status: 'active' | 'inactive';
  count: number;
}

export default function StatusIndicator({ status, count }: StatusIndicatorProps) {
  const isActive = status === 'active';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="flex items-center justify-between"
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {isActive ? (
            <div className="w-2 h-2 rounded-full bg-emerald-500 status-pulse" />
          ) : (
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-amber-500" />
          )}
          <span className="text-xs text-white/60 capitalize">{status}</span>
        </div>
        <span className="text-lg font-light text-white">{count}</span>
      </div>
    </motion.div>
  );
}
