import { useState } from 'react';
import TopNav from '../components/TopNav';
import Sidebar from '../components/Sidebar';
import SkyMap from '../components/SkyMap';
import OverlaySelector from '../components/OverlaySelector';
import ForecastTimeline from '../components/ForecastTimeline';
import ForecastVariance from '../components/ForecastVariance';
import { tabs } from '../data/weatherData';

export default function Home() {
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [activeOverlay, setActiveOverlay] = useState('precipitation');

  return (
    <div className="flex flex-col h-screen bg-[#06060A] overflow-hidden">
      {/* Top Navigation */}
      <TopNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content */}
      <div className="flex flex-1 gap-3 p-3 pt-2 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar />

        {/* Map Area */}
        <div className="flex-1 relative min-w-0">
          <SkyMap overlay={activeOverlay} />
          <OverlaySelector
            activeOverlay={activeOverlay}
            onOverlayChange={setActiveOverlay}
          />
          {/* Forecast Variance - bottom right over map */}
          <div className="absolute bottom-4 right-4 z-[400] w-72">
            <ForecastVariance />
          </div>
        </div>
      </div>

      {/* Bottom Timeline */}
      <div className="px-3 pb-3">
        <ForecastTimeline />
      </div>
    </div>
  );
}
