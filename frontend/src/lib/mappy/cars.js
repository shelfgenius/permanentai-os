/**
 * Car / vehicle catalog for Mappy.
 *
 * Each entry is what the user picks as their vehicle for navigation.
 * `profile` maps to an OSRM routing profile (driving | cycling | foot).
 * `topSpeed` is a km/h hint used only for radar-warning thresholds.
 * `icon` is the emoji shown on the map and in the selector.
 *
 * This is a working Waze-style catalog — add makes/models freely.
 */

export const CAR_CLASSES = [
  { id: 'walking',    icon: '🚶', label: 'Walking',       profile: 'foot',    topSpeed: 6   },
  { id: 'bike',       icon: '🚲', label: 'Bike',          profile: 'cycling', topSpeed: 35  },
  { id: 'scooter',    icon: '🛵', label: 'Scooter',       profile: 'driving', topSpeed: 80  },
  { id: 'motorcycle', icon: '🏍️', label: 'Motorcycle',    profile: 'driving', topSpeed: 220 },
  { id: 'sedan',      icon: '🚗', label: 'Sedan',         profile: 'driving', topSpeed: 220 },
  { id: 'suv',        icon: '🚙', label: 'SUV / Crossover', profile: 'driving', topSpeed: 220 },
  { id: 'sports',     icon: '🏎️', label: 'Sports car',    profile: 'driving', topSpeed: 320 },
  { id: 'ev',         icon: '⚡',  label: 'Electric (Tesla)', profile: 'driving', topSpeed: 250 },
  { id: 'van',        icon: '🚐', label: 'Van / Minibus', profile: 'driving', topSpeed: 160 },
  { id: 'pickup',     icon: '🛻', label: 'Pickup truck',  profile: 'driving', topSpeed: 180 },
  { id: 'truck',      icon: '🚚', label: 'Truck',         profile: 'driving', topSpeed: 110 },
  { id: 'bus',        icon: '🚌', label: 'Bus',           profile: 'driving', topSpeed: 120 },
  { id: 'taxi',       icon: '🚕', label: 'Taxi',          profile: 'driving', topSpeed: 200 },
  { id: 'police',     icon: '🚓', label: 'Emergency',     profile: 'driving', topSpeed: 280 },
];

/**
 * A tiny-but-real list of popular car makes/models so the user can pick
 * "Tesla · Model 3" the Waze way. These only affect the on-map label;
 * routing uses the parent class's `profile`.
 */
export const CAR_MODELS = {
  sedan: [
    { id: 'toyota-corolla',   label: 'Toyota Corolla' },
    { id: 'toyota-camry',     label: 'Toyota Camry' },
    { id: 'honda-civic',      label: 'Honda Civic' },
    { id: 'honda-accord',     label: 'Honda Accord' },
    { id: 'dacia-logan',      label: 'Dacia Logan' },
    { id: 'vw-passat',        label: 'Volkswagen Passat' },
    { id: 'vw-jetta',         label: 'Volkswagen Jetta' },
    { id: 'bmw-3',            label: 'BMW 3 Series' },
    { id: 'bmw-5',            label: 'BMW 5 Series' },
    { id: 'mercedes-c',       label: 'Mercedes-Benz C-Class' },
    { id: 'mercedes-e',       label: 'Mercedes-Benz E-Class' },
    { id: 'audi-a4',          label: 'Audi A4' },
    { id: 'audi-a6',          label: 'Audi A6' },
    { id: 'skoda-octavia',    label: 'Škoda Octavia' },
    { id: 'ford-mondeo',      label: 'Ford Mondeo' },
    { id: 'opel-insignia',    label: 'Opel Insignia' },
  ],
  suv: [
    { id: 'toyota-rav4',      label: 'Toyota RAV4' },
    { id: 'honda-crv',        label: 'Honda CR-V' },
    { id: 'dacia-duster',     label: 'Dacia Duster' },
    { id: 'dacia-bigster',    label: 'Dacia Bigster' },
    { id: 'vw-tiguan',        label: 'Volkswagen Tiguan' },
    { id: 'vw-touareg',       label: 'Volkswagen Touareg' },
    { id: 'bmw-x3',           label: 'BMW X3' },
    { id: 'bmw-x5',           label: 'BMW X5' },
    { id: 'mercedes-glc',     label: 'Mercedes-Benz GLC' },
    { id: 'mercedes-gle',     label: 'Mercedes-Benz GLE' },
    { id: 'audi-q5',          label: 'Audi Q5' },
    { id: 'audi-q7',          label: 'Audi Q7' },
    { id: 'ford-kuga',        label: 'Ford Kuga' },
    { id: 'hyundai-tucson',   label: 'Hyundai Tucson' },
    { id: 'hyundai-santafe',  label: 'Hyundai Santa Fe' },
    { id: 'kia-sportage',     label: 'Kia Sportage' },
    { id: 'mazda-cx5',        label: 'Mazda CX-5' },
    { id: 'mitsubishi-asx',   label: 'Mitsubishi ASX' },
  ],
  sports: [
    { id: 'porsche-911',      label: 'Porsche 911' },
    { id: 'porsche-cayman',   label: 'Porsche Cayman' },
    { id: 'ferrari-488',      label: 'Ferrari 488' },
    { id: 'ferrari-sf90',     label: 'Ferrari SF90' },
    { id: 'lamborghini-huracan', label: 'Lamborghini Huracán' },
    { id: 'lamborghini-urus', label: 'Lamborghini Urus' },
    { id: 'bmw-m3',           label: 'BMW M3' },
    { id: 'bmw-m4',           label: 'BMW M4' },
    { id: 'audi-rs5',         label: 'Audi RS5' },
    { id: 'mercedes-amg-c63', label: 'Mercedes-AMG C63' },
    { id: 'nissan-gtr',       label: 'Nissan GT-R' },
    { id: 'mazda-mx5',        label: 'Mazda MX-5' },
  ],
  ev: [
    { id: 'tesla-model3',     label: 'Tesla Model 3' },
    { id: 'tesla-modely',     label: 'Tesla Model Y' },
    { id: 'tesla-models',     label: 'Tesla Model S' },
    { id: 'tesla-modelx',     label: 'Tesla Model X' },
    { id: 'tesla-cybertruck', label: 'Tesla Cybertruck' },
    { id: 'vw-id4',           label: 'Volkswagen ID.4' },
    { id: 'vw-id7',           label: 'Volkswagen ID.7' },
    { id: 'bmw-i4',           label: 'BMW i4' },
    { id: 'bmw-ix',           label: 'BMW iX' },
    { id: 'mercedes-eqe',     label: 'Mercedes-Benz EQE' },
    { id: 'mercedes-eqs',     label: 'Mercedes-Benz EQS' },
    { id: 'dacia-spring',     label: 'Dacia Spring' },
    { id: 'hyundai-ioniq5',   label: 'Hyundai IONIQ 5' },
    { id: 'kia-ev6',          label: 'Kia EV6' },
    { id: 'nissan-leaf',      label: 'Nissan Leaf' },
    { id: 'porsche-taycan',   label: 'Porsche Taycan' },
  ],
  motorcycle: [
    { id: 'honda-cbr',        label: 'Honda CBR' },
    { id: 'yamaha-r1',        label: 'Yamaha R1' },
    { id: 'kawasaki-ninja',   label: 'Kawasaki Ninja' },
    { id: 'ducati-panigale',  label: 'Ducati Panigale' },
    { id: 'bmw-s1000rr',      label: 'BMW S1000RR' },
    { id: 'harley-sportster', label: 'Harley-Davidson Sportster' },
    { id: 'ktm-duke',         label: 'KTM Duke' },
  ],
  truck: [
    { id: 'mercedes-actros',  label: 'Mercedes-Benz Actros' },
    { id: 'volvo-fh',         label: 'Volvo FH' },
    { id: 'scania-r',         label: 'Scania R-series' },
    { id: 'man-tgx',          label: 'MAN TGX' },
    { id: 'daf-xf',           label: 'DAF XF' },
    { id: 'iveco-stralis',    label: 'Iveco Stralis' },
  ],
  van: [
    { id: 'mercedes-sprinter', label: 'Mercedes-Benz Sprinter' },
    { id: 'vw-crafter',        label: 'Volkswagen Crafter' },
    { id: 'ford-transit',      label: 'Ford Transit' },
    { id: 'renault-master',    label: 'Renault Master' },
    { id: 'iveco-daily',       label: 'Iveco Daily' },
    { id: 'peugeot-boxer',     label: 'Peugeot Boxer' },
  ],
  pickup: [
    { id: 'ford-ranger',       label: 'Ford Ranger' },
    { id: 'toyota-hilux',      label: 'Toyota Hilux' },
    { id: 'nissan-navara',     label: 'Nissan Navara' },
    { id: 'vw-amarok',         label: 'Volkswagen Amarok' },
    { id: 'ford-f150',         label: 'Ford F-150' },
    { id: 'rivian-r1t',        label: 'Rivian R1T' },
  ],
};

export const DEFAULT_VEHICLE = { classId: 'sedan', modelId: 'dacia-logan' };

export function findClass(classId) {
  return CAR_CLASSES.find((c) => c.id === classId) ?? CAR_CLASSES[4];
}

export function findModel(classId, modelId) {
  const list = CAR_MODELS[classId] ?? [];
  return list.find((m) => m.id === modelId) ?? null;
}
