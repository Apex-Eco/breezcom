'use client';

import Navigation from '@/components/Navigation';
import { useState } from 'react';
import dynamic from 'next/dynamic';

const AlmatyMap = dynamic(() => import('@/components/map/AlmatyMap'), {
  ssr: false,
});

export default function AirQualityPage() {
  const [selectedTab, setSelectedTab] = useState('map');

  const cities = [
    { name: 'Алматы', country: 'Казахстан', aqi: 45, rank: 1, status: 'Хорошо' },
    { name: 'Астана', country: 'Казахстан', aqi: 52, rank: 2, status: 'Умеренно' },
    { name: 'Шымкент', country: 'Казахстан', aqi: 68, rank: 3, status: 'Умеренно' },
    { name: 'Караганда', country: 'Казахстан', aqi: 75, rank: 4, status: 'Умеренно' },
    { name: 'Актобе', country: 'Казахстан', aqi: 82, rank: 5, status: 'Умеренно' },
  ];

  const historicalData = [
    { date: '2024-01-15', aqi: 42, pm25: 12.5 },
    { date: '2024-01-14', aqi: 48, pm25: 15.2 },
    { date: '2024-01-13', aqi: 55, pm25: 18.7 },
    { date: '2024-01-12', aqi: 38, pm25: 10.3 },
    { date: '2024-01-11', aqi: 52, pm25: 16.8 },
  ];

  return (
    <div className="min-h-screen page-shell">
      <Navigation user={null} onLogout={() => {}} />
      
      <div className="container mx-auto px-4 py-12">
        <div className="mb-6 md:mb-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-primary mb-3 md:mb-4">
            <span className="wise-gradient-text">
              Качество воздуха
            </span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted">Мониторинг качества воздуха в реальном времени по всему миру</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 md:mb-8 border-b border-green-500/20 overflow-x-auto">
          {['map', 'ranking', 'history', 'forecast'].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`px-4 sm:px-6 py-2 sm:py-3 font-semibold transition-all text-sm sm:text-base whitespace-nowrap ${
                selectedTab === tab
                  ? 'text-green-400 border-b-2 border-green-400'
                  : 'text-muted hover:text-primary'
              }`}
            >
              {tab === 'map' && 'Карта'}
              {tab === 'ranking' && 'Рейтинг городов'}
              {tab === 'history' && 'Исторические данные'}
              {tab === 'forecast' && 'Прогноз'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="glass-strong rounded-2xl sm:rounded-3xl border border-green-500/30 p-4 sm:p-6 md:p-8">
          {selectedTab === 'map' && <AlmatyMap />}

          {selectedTab === 'ranking' && (
            <div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-primary mb-4 sm:mb-6">Рейтинг городов Казахстана</h2>
              <div className="space-y-3 sm:space-y-4">
                {cities.map((city, index) => (
                  <div key={city.name} className="glass rounded-xl border border-green-500/20 p-4 sm:p-6 hover-lift">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                      <div className="flex items-center space-x-3 sm:space-x-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-primary font-bold text-base sm:text-lg">
                          {index + 1}
                        </div>
                        <div>
                          <h3 className="text-lg sm:text-xl font-bold text-primary">{city.name}</h3>
                          <p className="text-sm sm:text-base text-muted">{city.country}</p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right w-full sm:w-auto">
                        <div className="text-2xl sm:text-3xl font-black text-green-400 mb-1">{city.aqi}</div>
                        <div className="text-xs sm:text-sm text-muted">AQI</div>
                        <div className="text-xs sm:text-sm text-green-300 mt-1">{city.status}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedTab === 'history' && (
            <div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-primary mb-4 sm:mb-6">Исторические данные - Алматы</h2>
              <div className="space-y-2 sm:space-y-3">
                {historicalData.map((data) => (
                  <div key={data.date} className="glass rounded-xl border border-green-500/20 p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                    <div>
                      <div className="text-primary font-semibold text-sm sm:text-base">{data.date}</div>
                      <div className="text-muted text-xs sm:text-sm">PM2.5: {data.pm25} µg/m³</div>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-green-400">{data.aqi}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedTab === 'forecast' && (
            <div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-primary mb-4 sm:mb-6">Прогноз качества воздуха - Алматы</h2>
              <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8">
                <div className="grid grid-cols-7 gap-2 sm:gap-4">
                  {['Сегодня', 'Завтра', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day, index) => (
                    <div key={day} className="text-center">
                      <div className="text-muted mb-1 sm:mb-2 text-xs sm:text-sm">{day}</div>
                      <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">🌤️</div>
                      <div className="text-lg sm:text-xl font-bold text-green-400 mb-1">{45 + index * 2}</div>
                      <div className="text-xs text-muted">AQI</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

