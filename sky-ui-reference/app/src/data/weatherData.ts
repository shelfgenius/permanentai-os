export interface WeatherStation {
  id: string;
  name: string;
  temp: number;
  humidity: number;
  wind: number;
  windDir: string;
  pressure: number;
  status: 'online' | 'offline';
  timestamp: string;
  image: string;
  chartData: number[];
}

export interface HourlyForecast {
  hour: string;
  temp: number;
  condition: string;
  precipitation: number;
}

export interface AccuracyData {
  time: string;
  value: number;
}

export interface VarianceData {
  label: string;
  value: number;
}

export const weatherStations: WeatherStation[] = [
  {
    id: 'constanta',
    name: 'Constanța City',
    temp: 24,
    humidity: 68,
    wind: 12,
    windDir: 'N',
    pressure: 1013,
    status: 'online',
    timestamp: '29.04.2026, 14:30:22',
    image: '/assets/station-constanta.jpg',
    chartData: [22, 23, 24, 24, 25, 24, 23, 24],
  },
  {
    id: 'mangalia',
    name: 'Mangalia',
    temp: 23,
    humidity: 72,
    wind: 15,
    windDir: 'NE',
    pressure: 1012,
    status: 'online',
    timestamp: '29.04.2026, 14:28:15',
    image: '/assets/station-mangalia.jpg',
    chartData: [21, 22, 22, 23, 24, 23, 22, 23],
  },
  {
    id: 'medgidia',
    name: 'Medgidia',
    temp: 26,
    humidity: 55,
    wind: 8,
    windDir: 'NW',
    pressure: 1014,
    status: 'online',
    timestamp: '29.04.2026, 14:25:40',
    image: '/assets/station-medgidia.jpg',
    chartData: [24, 25, 25, 26, 27, 26, 25, 26],
  },
  {
    id: 'eforie',
    name: 'Eforie',
    temp: 22,
    humidity: 75,
    wind: 18,
    windDir: 'E',
    pressure: 1011,
    status: 'offline',
    timestamp: '29.04.2026, 11:22:18',
    image: '/assets/station-eforie.jpg',
    chartData: [20, 21, 21, 22, 22, 21, 21, 22],
  },
];

export const accuracyTrend: AccuracyData[] = [
  { time: '06:00', value: 88 },
  { time: '07:00', value: 90 },
  { time: '08:00', value: 91 },
  { time: '09:00', value: 89 },
  { time: '10:00', value: 92 },
  { time: '11:00', value: 93 },
  { time: '12:00', value: 94 },
  { time: '13:00', value: 93 },
  { time: '14:00', value: 95 },
  { time: '15:00', value: 94 },
  { time: '16:00', value: 96 },
  { time: '17:00', value: 94 },
];

export const hourlyForecast: HourlyForecast[] = [
  { hour: '00:00', temp: 19, condition: 'Clear', precipitation: 0 },
  { hour: '03:00', temp: 17, condition: 'Clear', precipitation: 0 },
  { hour: '06:00', temp: 18, condition: 'Partly Cloudy', precipitation: 5 },
  { hour: '09:00', temp: 22, condition: 'Partly Cloudy', precipitation: 10 },
  { hour: '12:00', temp: 26, condition: 'Cloudy', precipitation: 20 },
  { hour: '15:00', temp: 27, condition: 'Rain', precipitation: 65 },
  { hour: '18:00', temp: 24, condition: 'Rain', precipitation: 80 },
  { hour: '21:00', temp: 21, condition: 'Light Rain', precipitation: 45 },
];

export const varianceData: VarianceData[] = [
  { label: 'L1', value: -2 },
  { label: 'L2', value: 1 },
  { label: 'L3', value: -1.5 },
  { label: 'L4', value: 0.5 },
  { label: 'L5', value: -1 },
  { label: 'L6', value: 2 },
  { label: 'L7', value: -2.5 },
  { label: 'L8', value: 1.5 },
];

export const tabs = [
  'Live Map',
  'Forecast',
  'Radar',
  'Analytics',
  'Alerts',
  'History',
  'Settings',
];

export const overlayOptions = [
  { label: 'None', value: 'none' },
  { label: 'Precipitation', value: 'precipitation' },
  { label: 'Wind', value: 'wind' },
  { label: 'Temperature', value: 'temperature' },
];
