'use client';

import Navigation from '@/components/Navigation';

export default function AboutPage() {
  return (
    <div className="min-h-screen page-shell">
      <Navigation user={null} onLogout={() => {}} />
      
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8 md:mb-12 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-primary mb-3 md:mb-4">
            <span className="wise-gradient-text">
              О компании Breez
            </span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted max-w-2xl mx-auto px-4">
            Лидер в области мониторинга и очистки воздуха
          </p>
        </div>

        {/* About Section */}
        <div className="glass-strong rounded-2xl sm:rounded-3xl border border-green-500/30 p-4 sm:p-6 md:p-8 mb-6 md:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-primary mb-4 sm:mb-6">О нас</h2>
          <div className="text-secondary text-base sm:text-lg leading-relaxed space-y-3 sm:space-y-4">
            <p>
              Breez — ведущая компания в области мониторинга и очистки воздуха, основанная в 1963 году. 
              Мы специализируемся на создании инновационных решений для улучшения качества воздуха в домах, 
              офисах и общественных местах.
            </p>
            <p>
              Наша миссия — сделать информацию о качестве воздуха доступной для всех, чтобы каждый мог 
              принимать обоснованные решения о своем здоровье и здоровье своих близких.
            </p>
            <p>
              С более чем 50 миллионами пользователей по всему миру, Breez является доверенным партнером 
              для тысяч корпораций, школ, больниц и правительственных организаций.
            </p>
          </div>
        </div>

        {/* Team Section */}
        <div className="glass-strong rounded-2xl sm:rounded-3xl border border-green-500/30 p-4 sm:p-6 md:p-8 mb-6 md:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-primary mb-4 sm:mb-6">Наша команда</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {[
              { name: 'Александр Иванов', role: 'CEO', image: '👨‍💼' },
              { name: 'Мария Петрова', role: 'CTO', image: '👩‍💻' },
              { name: 'Дмитрий Сидоров', role: 'Head of Research', image: '👨‍🔬' },
            ].map((member) => (
              <div key={member.name} className="text-center">
                <div className="text-6xl mb-4">{member.image}</div>
                <h3 className="text-xl font-bold text-primary mb-2">{member.name}</h3>
                <p className="text-muted">{member.role}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Careers Section */}
        <div className="glass-strong rounded-2xl sm:rounded-3xl border border-green-500/30 p-4 sm:p-6 md:p-8 mb-6 md:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-primary mb-4 sm:mb-6">Карьера</h2>
          <p className="text-secondary text-base sm:text-lg mb-4 sm:mb-6">
            Присоединяйтесь к команде Breez и помогите нам сделать воздух чище для всех!
          </p>
          <div className="space-y-3 sm:space-y-4">
            {[
              'Senior Software Engineer',
              'Data Scientist',
              'Product Manager',
              'Marketing Specialist'
            ].map((position) => (
              <div key={position} className="glass rounded-xl border border-green-500/20 p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                <div className="flex-1">
                  <h3 className="text-primary font-semibold text-base sm:text-lg">{position}</h3>
                  <p className="text-muted text-xs sm:text-sm">Алматы, Казахстан • Полная занятость</p>
                </div>
                <button className="w-full sm:w-auto px-5 sm:px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-primary font-semibold rounded-lg hover:scale-105 transition-transform text-sm sm:text-base">
                  Подать заявку
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Contact Section */}
        <div className="glass-strong rounded-2xl sm:rounded-3xl border border-green-500/30 p-4 sm:p-6 md:p-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-primary mb-4 sm:mb-6">Контакты</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xl font-bold text-primary mb-4">Офис в Алматы</h3>
              <div className="space-y-2 text-secondary">
                <p>📍 ул. Абая, 150</p>
                <p>📞 +7 (727) 123-45-67</p>
                <p>✉️ info@breez.kz</p>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-primary mb-4">Свяжитесь с нами</h3>
              <form className="space-y-4">
                <input
                  type="text"
                  placeholder="Ваше имя"
                  className="w-full px-4 py-3 bg-white/5 border border-green-500/30 rounded-lg text-primary placeholder-gray-500 focus:outline-none focus:border-green-500"
                />
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full px-4 py-3 bg-white/5 border border-green-500/30 rounded-lg text-primary placeholder-gray-500 focus:outline-none focus:border-green-500"
                />
                <textarea
                  placeholder="Сообщение"
                  rows={4}
                  className="w-full px-4 py-3 bg-white/5 border border-green-500/30 rounded-lg text-primary placeholder-gray-500 focus:outline-none focus:border-green-500"
                />
                <button className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-primary font-semibold rounded-lg hover:scale-105 transition-transform">
                  Отправить
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

