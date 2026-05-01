import axios from 'axios';

// Lazily require `js-cookie` at runtime to avoid referencing `window` during
// server-side builds/prerender. When running server-side, provide a no-op
// fallback so imports don't throw.
const getCookies = () => {
  if (typeof window !== 'undefined') {
    return require('js-cookie');
  }
  return { get: () => undefined, set: () => {}, remove: () => {} };
};

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const Cookies = getCookies();
  const token = Cookies.get('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
  sensor_permissions?: string[];
}

export interface AirQualityData {
  city: string;
  state: string;
  country: string;
  location: {
    type: string;
    coordinates: number[];
  };
  current: {
    pollution: {
      ts: string;
      aqius: number;
      mainus: string;
      aqicn: number;
      maincn: string;
      pm1?: number;
      pm25?: number;
      pm10?: number;
      co2?: number;
      voc?: number;
      ch2o?: number;
      co?: number;
      o3?: number;
      no2?: number;
    };
    weather: {
      ts: string;
      tp: number;
      pr: number;
      hu: number;
      ws: number;
      wd: number;
      ic: string;
    };
  };
  sensor_data?: {
    device_id: string;
    site: string;
    danger_level?: string;
  };
}

export interface Sensor {
  id: string;
  name: string;
  description?: string;
  price: number;
  location?: {
    type: string;
    coordinates: number[];
  };
  city?: string;
  country?: string;
  parameters?: Record<string, number>;
  created_at?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  sensor_permissions: string[];
}

export interface WeatherSnapshot {
  provider: string;
  temperature: number;
  humidity: number;
  wind_speed: number;
  pressure: number;
  condition: string;
  timestamp: string;
  forecast?: WeatherSnapshot[];
}

export interface MlPredictionPayload {
  pm1: number;
  pm25: number;
  pm10: number;
  co2: number;
  voc: number;
  ch2o: number;
  co: number;
  o3: number;
  no2: number;
  temp: number;
  humidity: number;
  wind_speed: number;
  pressure: number;
}

export interface MlPredictionResult {
  predicted_aqi: number;
  danger_level: string;
  main_pollutant: string;
  recommendation: string;
  model_used: 'almaty_smog_model.pkl' | 'rule_based_fallback';
}

export const authAPI = {
  register: async (email: string, password: string, name: string) => {
    const response = await api.post('/register', { email, password, name });
    return response.data;
  },
  
  login: async (email: string, password: string) => {
    const params = new URLSearchParams();
    params.append('username', email);
    params.append('password', password);
    const response = await axios.post(`${API_URL}/token`, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (response.data.access_token) {
      const Cookies = getCookies();
      Cookies.set('token', response.data.access_token, { expires: 7 });
    }
    return response.data;
  },
  
  logout: () => {
    const Cookies = getCookies();
    Cookies.remove('token');
  },
  
  getMe: async (): Promise<User> => {
    const response = await api.get('/me');
    return response.data;
  },
};

export const adminAuthAPI = {
  login: async (secret: string) => {
    const response = await api.post('/admin/login', { secret });
    if (response.data.access_token) {
      const Cookies = getCookies();
      Cookies.set('token', response.data.access_token, { expires: 1 });
    }
    return response.data;
  },
};

export const airQualityAPI = {
  getAirQuality: async (
    city?: string,
    state?: string,
    country?: string,
    lat?: number,
    lon?: number
  ): Promise<AirQualityData> => {
    const params: any = {};
    if (city) params.city = city;
    if (state) params.state = state;
    if (country) params.country = country;
    if (lat) params.lat = lat;
    if (lon) params.lon = lon;
    
    const response = await api.get('/air-quality', { params });
    return response.data;
  },
  
  getCities: async () => {
    const response = await api.get('/cities');
    return response.data;
  },
  
  getHistory: async (city: string, state: string, country: string) => {
    const response = await api.get('/air-quality/history', {
      params: { city, state, country },
    });
    return response.data;
  },
  
  saveData: async (data: AirQualityData) => {
    const response = await api.post('/air-quality/save', data);
    return response.data;
  },
  
  getAllAirQuality: async (): Promise<AirQualityData[]> => {
    const response = await api.get('/air-quality/all');
    return response.data.data || [];
  },
};

export const sensorAPI = {
  purchase: async (sensorId: string) => {
    const response = await api.post(`/purchase/sensors/${sensorId}`);
    return response.data;
  },
  mySensors: async (): Promise<Sensor[]> => {
    const response = await api.get('/me/sensors');
    return response.data.data || [];
  },
  availableSensors: async (): Promise<Sensor[]> => {
    const response = await api.get('/sensors/available');
    return response.data.data || [];
  },
  allSensors: async (): Promise<(Sensor & { is_purchased: boolean })[]> => {
    const response = await api.get('/sensors/all');
    return response.data.data || [];
  },
  mapSensors: async (): Promise<any[]> => {
    const response = await api.get('/sensors/map');
    return response.data.data || [];
  },
};

export const weatherAPI = {
  getCurrent: async (lat: number, lon: number): Promise<WeatherSnapshot> => {
    const response = await api.get('/weather/current', { params: { lat, lon } });
    return response.data;
  },
  getForecast: async (lat: number, lon: number): Promise<WeatherSnapshot> => {
    const response = await api.get('/weather/forecast', { params: { lat, lon } });
    return response.data;
  },
};

export const mlAPI = {
  predict: async (payload: MlPredictionPayload): Promise<MlPredictionResult> => {
    const response = await api.post('/ml/predict', payload);
    return response.data;
  },
};

export const adminAPI = {
  createSensor: async (sensor: Partial<Sensor>) => {
    const response = await api.post('/admin/sensors', sensor);
    return response.data as Sensor;
  },
  listSensors: async (): Promise<Sensor[]> => {
    const response = await api.get('/admin/sensors');
    return response.data.data || [];
  },
  grantAccess: async (sensorId: string, email: string) => {
    const response = await api.post(`/admin/sensors/${sensorId}/grant`, { email });
    return response.data;
  },
  makeAdmin: async (email: string) => {
    const response = await api.post('/admin/users/make-admin', { email });
    return response.data;
  },
  listUsers: async (): Promise<AdminUser[]> => {
    const response = await api.get('/admin/users');
    return response.data.data || [];
  },
};
