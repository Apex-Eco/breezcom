'use client';

import { useState, useEffect } from 'react';
import { airQualityAPI } from '@/lib/api';

interface City {
  city: string;
  state: string;
  country: string;
  lat?: number;
  lon?: number;
}

interface CitySelectorProps {
  onCitySelect: (city: City) => void;
  selectedCity: City;
}

export default function CitySelector({ onCitySelect, selectedCity }: CitySelectorProps) {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCities();
  }, []);

  const loadCities = async () => {
    try {
      const data = await airQualityAPI.getCities();
      // Фильтруем только Алматы или используем дефолтный список
      const almatyCities = data.cities?.filter((c: { city: string; country?: string }) => 
        c.city.toLowerCase() === 'almaty' || 
        (c.city === 'Almaty' && c.country === 'Kazakhstan')
      ) || [{ city: 'Almaty', state: 'Almaty', country: 'Kazakhstan', lat: 43.2220, lon: 76.8512 }];
      setCities(almatyCities.length > 0 ? almatyCities : [
        { city: 'Almaty', state: 'Almaty', country: 'Kazakhstan', lat: 43.2220, lon: 76.8512 }
      ]);
    } catch (error) {
      console.error('Error loading cities:', error);
      // Если ошибка, используем только Алматы
      setCities([{ city: 'Almaty', state: 'Almaty', country: 'Kazakhstan', lat: 43.2220, lon: 76.8512 }]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Выбор города</h3>
        </div>
        <div className="p-4">
          <p className="text-muted">Загрузка городов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="bg-gray-50 px-6 py-4 border-b">
        <h3 className="text-lg font-semibold text-gray-800">Выбор города</h3>
      </div>
      <div className="p-4">
        <select
          value={`${selectedCity.city}-${selectedCity.state}-${selectedCity.country}`}
          onChange={(e) => {
            const [city, state, country] = e.target.value.split('-');
            onCitySelect({ city, state, country });
          }}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 bg-white text-gray-800 font-medium transition-colors"
        >
          {cities.map((city, index) => (
            <option
              key={index}
              value={`${city.city}-${city.state}-${city.country}`}
            >
              {city.city}, {city.state}, {city.country}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

