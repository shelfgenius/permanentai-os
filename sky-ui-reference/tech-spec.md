# Sky Weather - Technical Specification

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^19.0.0 | UI framework |
| `react-dom` | ^19.0.0 | DOM renderer |
| `leaflet` | ^1.9.4 | Interactive map |
| `react-leaflet` | ^5.0.0 | React wrapper for Leaflet |
| `framer-motion` | ^12.0.0 | Animations & transitions |
| `lucide-react` | ^0.460.0 | Icons |
| `recharts` | ^2.15.0 | Charts & sparklines |
| `@types/leaflet` | ^1.9.15 | TypeScript types for Leaflet |
| `tailwindcss` | ^3.4.19 | Styling (already installed) |
| `clsx` | ^2.1.1 | Conditional classes (already installed) |
| `tailwind-merge` | ^2.6.0 | Tailwind class merging (already installed) |

## Component Inventory

### shadcn/ui Components (Built-in)
- `Tabs` - Top navigation bar tabs
- `Badge` - Status indicators, stat pills
- `Button` - Map zoom controls, action buttons
- `Card` - Weather station cards base
- `Separator` - Visual dividers

### Custom Components

| Component | Props | Description |
|-----------|-------|-------------|
| `App` | - | Root layout: nav + sidebar + map |
| `TopNav` | `activeTab, onTabChange` | Navigation bar with tabs |
| `Sidebar` | - | Left panel with all data sections |
| `StatsRow` | `stats[]` | Horizontal stat badges |
| `StatusIndicator` | `status, count` | Online/offline indicator |
| `AccuracyPanel` | `percentage, target, data[]` | Weather accuracy with sparkline |
| `LocationCard` | `station, temp, humidity, wind, pressure, status, chartData` | Weather station card |
| `ForecastVariance` | `variance, data[]` | Bottom variance panel |
| `SkyMap` | `center, zoom, overlay` | Leaflet map with satellite tiles |
| `WeatherOverlay` | `type, intensity` | Canvas weather overlay layer |
| `PrecipitationOverlay` | - | Animated radar precipitation |
| `WindOverlay` | - | Animated wind flow particles |
| `TempOverlay` | - | Temperature gradient overlay |
| `MapControlPanel` | `title, subtitle` | Floating glass panel on map |
| `ConditionsCard` | `temp, condition, location` | Current conditions float card |
| `ZoomControls` | `onZoomIn, onZoomOut, onReset` | Vertical zoom button stack |
| `WeatherLegend` | `type` | Color scale legend |
| `ForecastTimeline` | `data[]` | Bottom 24h timeline |
| `Sparkline` | `data[], color` | Mini SVG sparkline chart |

## Animation Implementation

| Animation | Library | Implementation |
|-----------|---------|----------------|
| Page entrance stagger | Framer Motion | `motion.div` with `staggerChildren: 0.1` on parent, `y: 20 → 0, opacity: 0 → 1` on children |
| Card hover lift | Framer Motion | `whileHover={{ y: -2, boxShadow: "..." }}` |
| Tab underline grow | CSS | `scaleX(0) → scaleX(1)` with `transform-origin: center` |
| Chart draw | Framer Motion | `pathLength: 0 → 1` via SVG path animation |
| Count up numbers | Custom hook | `useCountUp(target, duration)` with `requestAnimationFrame` |
| Online pulse | CSS | `@keyframes pulse` with `box-shadow` animation, infinite |
| Radar overlay pulse | Canvas + rAF | Slow sine-wave opacity modulation on precipitation blobs |
| Wind particles | Canvas + rAF | Particle system with velocity vectors, 60fps loop |
| Map pan | Leaflet | Built-in inertia/momentum panning |

## State & Logic

### State Management
React `useState` only — no external state library needed for UI-only demo.

Key state:
- `activeTab`: string — current top nav tab
- `activeOverlay`: 'precipitation' | 'wind' | 'temperature' | 'none'
- `mapZoom`: number — current zoom level
- `selectedStation`: string | null — selected weather station
- `hoveredHour`: number | null — hovered hour on timeline

### Map Logic
- Leaflet map with `esri-leaflet` or direct Esri World Imagery tile URL
- Center: `[44.1598, 28.6348]` (Constanța)
- Default zoom: 9
- Max zoom: 15
- Min zoom: 7

### Weather Overlay Logic
All overlays rendered via Leaflet Canvas layer:
- Precipitation: Render colored circles with radial gradients, modulate opacity with `sin(time)`
- Wind: Particle system — 100 particles with random positions, velocity based on wind direction, wrap around canvas edges
- Temperature: Static gradient overlay colored by temperature zones

### Data Flow
All data is static mock data defined in `src/data/weatherData.ts`:
- Station data array
- 24h forecast array
- Accuracy trend array (12 points)
- Variance data by route/hour

## Project Structure

```
src/
  App.tsx                 # Root component with layout
  index.css               # Global styles + Tailwind + custom CSS
  main.tsx                # Entry point
  data/
    weatherData.ts        # All mock data
  components/
    TopNav.tsx            # Navigation bar
    Sidebar.tsx           # Left panel container
    StatsRow.tsx          # Quick stats badges
    StatusIndicator.tsx   # Online/offline status
    AccuracyPanel.tsx     # Accuracy metric + sparkline
    LocationCard.tsx      # Weather station card
    ForecastVariance.tsx  # Bottom variance panel
    SkyMap.tsx            # Leaflet map wrapper
    WeatherOverlay.tsx    # Canvas overlay base
    PrecipitationOverlay.tsx
    WindOverlay.tsx
    TempOverlay.tsx
    MapControlPanel.tsx   # Floating map panels
    ConditionsCard.tsx
    ZoomControls.tsx
    WeatherLegend.tsx
    ForecastTimeline.tsx  # Bottom timeline
    Sparkline.tsx         # Mini chart component
  hooks/
    useCountUp.ts         # Animated number counter
    useAnimationFrame.ts  # rAF loop helper
  types/
    weather.ts            # TypeScript interfaces
```

## Key Implementation Details

### Satellite Tiles
Use Esri World Imagery (free, no key):
```
https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}
```

### Glassmorphism CSS
```css
.glass-panel {
  background: rgba(14, 14, 22, 0.75);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
```

### Sparkline Component
Custom SVG with gradient fill:
- Calculate path from data points
- Area fill with linear gradient (color → transparent)
- White stroke line
- No axes, no labels — pure visual trend

### Canvas Overlay on Leaflet
Use Leaflet's `L.canvas()` or `L.GridLayer` with custom `drawTile`:
- Get canvas context
- Draw weather visualization
- Request animation frame for updates

### Responsive Breakpoints
- Desktop: `lg:` (1024px+) — full two-column
- Tablet: `md:` (768px-1024px) — sidebar collapsible
- Mobile: default (<768px) — bottom sheet layout

## Build Configuration

No special build config needed. Standard Vite build. Ensure Leaflet CSS is imported:
```typescript
import 'leaflet/dist/leaflet.css';
```

## Performance Considerations

- Canvas overlays use `requestAnimationFrame` — throttle to 30fps if needed
- Sparklines are static SVG (no continuous animation)
- Map tile loading is lazy by Leaflet
- Card animations use `transform` and `opacity` only
- Use `will-change: transform` on frequently animated elements
