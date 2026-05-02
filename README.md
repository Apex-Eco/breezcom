# Breez - Air Quality Monitoring Application

Полнофункциональное приложение для мониторинга качества воздуха с фронтендом на Next.js и бэкендом на FastAPI.

## Структура проекта

```
breez/
├── backend/          # FastAPI бэкенд
│   ├── main.py      # Основной файл приложения
│   ├── requirements.txt
│   └── .env.example
├── frontend/         # Next.js фронтенд
│   ├── app/          # Next.js App Router
│   ├── components/   # React компоненты
│   ├── lib/          # Утилиты и API клиент
│   └── package.json
└── README.md
```

## Функции

- ✅ Авторизация через MongoDB
- ✅ Карта визуализации с Leaflet
- ✅ Отображение данных о качестве воздуха в реальном времени
- ✅ Интеграция с Breez API
- ✅ История данных о качестве воздуха
- ✅ Выбор города
- ✅ Красивый современный UI

## Установка и запуск

### Бэкенд (FastAPI)

1. Перейдите в папку backend:
```bash
cd backend
```

2. Создайте виртуальное окружение:
```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
```

3. Установите зависимости:
```bash
pip install -r requirements.txt
```

4. Создайте файл `.env` на основе `.env.example`:
```bash
cp .env.example .env
```

5. Заполните переменные окружения в `.env`:
- `MONGO_URL` - URL MongoDB (по умолчанию: mongodb://localhost:27017)
- `DATABASE_NAME` - имя базы данных (по умолчанию: breez)
- `SECRET_KEY` - секретный ключ для JWT
- `BREEZ_API_KEY` - API ключ (опционально, можно использовать mock данные)

6. Убедитесь, что MongoDB запущен

7. Запустите сервер:
```bash
python main.py
```

Сервер будет доступен на `http://localhost:8000`
API документация: `http://localhost:8000/docs`

### Фронтенд (Next.js)

1. Перейдите в папку frontend:
```bash
cd frontend
```

2. Установите зависимости:
```bash
npm install
```

3. Создайте файл `.env.local` на основе `.env.local.example`:
```bash
cp .env.local.example .env.local
```

4. Убедитесь, что `NEXT_PUBLIC_API_URL` указывает на ваш бэкенд (по умолчанию: http://localhost:8000)

5. Запустите dev сервер:
```bash
npm run dev
```

Приложение будет доступно на `http://localhost:3000`

## Использование

1. Откройте приложение в браузере
2. Зарегистрируйтесь или войдите
3. Выберите город из списка
4. Просмотрите данные о качестве воздуха на карте и в карточке
5. Данные обновляются автоматически при выборе нового города

## API Endpoints

### Авторизация
- `POST /register` - Регистрация нового пользователя
- `POST /token` - Получение JWT токена
- `GET /me` - Получение информации о текущем пользователе

### Данные о качестве воздуха
- `GET /air-quality` - Получение данных о качестве воздуха
- `GET /air-quality/history` - Получение истории данных
- `POST /air-quality/save` - Сохранение данных
- `GET /cities` - Список доступных городов

### Историческая погода для ML
- `POST /admin/weather-history/backfill` - Загрузить до 366 дней почасовой погоды в коллекцию `weather_history`
- `GET /weather/history` - Прочитать сохраненную историю погоды по координатам

Можно также заполнить MongoDB напрямую:

```bash
cd backend
python backfill_weather_history.py --days 365
```

Скрипт использует Open-Meteo Historical Weather API и сохраняет примерно 8,760 почасовых строк для Алматы.

## Технологии

### Бэкенд
- FastAPI
- MongoDB (Motor)
- JWT для аутентификации
- bcrypt для хеширования паролей

### Фронтенд
- Next.js 14
- React 18
- TypeScript
- Leaflet для карт
- Tailwind CSS для стилей
- Axios для HTTP запросов

## Примечания

- Если у вас нет API ключа, приложение будет использовать mock данные
- Убедитесь, что MongoDB запущен перед запуском бэкенда




