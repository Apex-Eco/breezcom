'use client';

import Navigation from '@/components/Navigation';

export default function SolutionsPage() {
  const solutions = [
    {
      title: 'Для бизнеса',
      icon: '💼',
      description: 'Корпоративные решения для офисов и коммерческих помещений',
      features: ['Мониторинг в реальном времени', 'API интеграция', 'Аналитика и отчеты', 'Техническая поддержка 24/7']
    },
    {
      title: 'Для школ',
      icon: '🏫',
      description: 'Защита здоровья детей с помощью мониторинга качества воздуха',
      features: ['Специальные программы', 'Образовательные материалы', 'Родительские уведомления', 'Интеграция с системами школы']
    },
    {
      title: 'Для больниц',
      icon: '🏥',
      description: 'Критически важные решения для медицинских учреждений',
      features: ['Высокая точность измерений', 'Соответствие стандартам', 'Интеграция с медоборудованием', 'Экстренные уведомления']
    },
    {
      title: 'API интеграция',
      icon: '🔌',
      description: 'Интегрируйте данные о качестве воздуха в ваши приложения',
      features: ['REST API', 'WebSocket поддержка', 'Документация', 'Примеры кода']
    },
  ];

  return (
    <div className="min-h-screen page-shell">
      <Navigation user={null} onLogout={() => {}} />
      
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8 md:mb-12 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-primary mb-3 md:mb-4">
            <span className="wise-gradient-text">
              Корпоративные решения
            </span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted max-w-2xl mx-auto px-4">
            Комплексные решения для мониторинга качества воздуха
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-8 md:mb-12">
          {solutions.map((solution) => (
            <div key={solution.title} className="glass-strong rounded-3xl border border-green-500/30 p-8 hover-lift">
              <div className="text-6xl mb-6">{solution.icon}</div>
              <h2 className="text-3xl font-bold text-primary mb-4">{solution.title}</h2>
              <p className="text-secondary mb-6 text-lg">{solution.description}</p>
              <ul className="space-y-3 mb-6">
                {solution.features.map((feature, index) => (
                  <li key={index} className="flex items-center text-secondary">
                    <span className="text-green-400 mr-3 text-xl">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-primary font-semibold rounded-lg hover:scale-105 transition-transform">
                Связаться с нами
              </button>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="glass-strong rounded-3xl border border-green-500/30 p-8">
          <h2 className="text-3xl font-bold text-primary mb-8 text-center">Breez в цифрах</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { number: '10,000+', label: 'Корпоративных клиентов' },
              { number: '150+', label: 'Стран' },
              { number: '50M+', label: 'Пользователей' },
              { number: '24/7', label: 'Поддержка' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl font-black text-green-400 mb-2">{stat.number}</div>
                <div className="text-muted">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

