'use client';

import Navigation from '@/components/Navigation';

export default function NewsPage() {
  const news = [
    {
      title: 'Новое исследование: качество воздуха в Алматы улучшилось на 15%',
      date: '15 января 2024',
      category: 'Новости',
      image: '📰',
      excerpt: 'Согласно последним данным, качество воздуха в Алматы значительно улучшилось благодаря новым экологическим инициативам...'
    },
    {
      title: 'Breez запускает новую программу для школ',
      date: '12 января 2024',
      category: 'Пресс-релиз',
      image: '🏫',
      excerpt: 'Breez объявляет о запуске специальной программы мониторинга качества воздуха для образовательных учреждений...'
    },
    {
      title: 'Влияние PM2.5 на здоровье: результаты исследования',
      date: '8 января 2024',
      category: 'Исследование',
      image: '🔬',
      excerpt: 'Новое исследование показывает прямую связь между уровнем PM2.5 и респираторными заболеваниями...'
    },
    {
      title: 'Как улучшить качество воздуха дома: 5 простых шагов',
      date: '5 января 2024',
      category: 'Блог',
      image: '🏠',
      excerpt: 'Практические советы по улучшению качества воздуха в вашем доме без больших затрат...'
    },
  ];

  return (
    <div className="min-h-screen page-shell">
      <Navigation user={null} onLogout={() => {}} />
      
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8 md:mb-12 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-primary mb-3 md:mb-4">
            <span className="wise-gradient-text">
              Новости и исследования
            </span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted max-w-2xl mx-auto px-4">
            Последние новости о качестве воздуха, исследования и полезные статьи
          </p>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap justify-center gap-3 md:gap-4 mb-6 md:mb-8">
          {['Все', 'Новости', 'Исследования', 'Блог', 'Пресс-релизы'].map((cat) => (
            <button
              key={cat}
              className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-lg text-primary font-semibold hover:scale-105 transition-transform text-sm sm:text-base"
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          {news.map((item, index) => (
            <div key={index} className="glass-strong rounded-3xl border border-green-500/30 overflow-hidden hover-lift">
              <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/10 p-8 text-center">
                <div className="text-8xl mb-4">{item.image}</div>
                <div className="px-3 py-1 bg-green-500/30 rounded-full text-green-300 text-sm font-semibold inline-block mb-3">
                  {item.category}
                </div>
              </div>
              <div className="p-6">
                <div className="text-muted text-sm mb-3">{item.date}</div>
                <h2 className="text-2xl font-bold text-primary mb-4">{item.title}</h2>
                <p className="text-secondary mb-6">{item.excerpt}</p>
                <button className="text-green-400 font-semibold hover:text-green-300 transition-colors">
                  Читать далее →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

