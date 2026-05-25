# Interactive Online Board

Вебресурс «Інтерактивна онлайн-дошка для колективної роботи».

## Технології

- Node.js
- Express.js
- PostgreSQL
- Socket.IO
- HTML/CSS/JavaScript
- JWT
- Google OAuth 2.0

## Запуск

1. Встановити залежності:

npm install

2. Створити файл .env на основі .env.example

3. Створити базу PostgreSQL та виконати database/schema.sql

4. Запустити сервер:

npm start

5. Відкрити:

http://localhost:3000

## Основні можливості

- Реєстрація та авторизація користувачів
- Вхід через Google OAuth 2.0
- JWT-захист API
- Створення та видалення дошок
- Додавання нотаток, прямокутників і ліній
- Зміна кольору та розміру елементів
- Поворот ліній
- Синхронізація змін через Socket.IO
- Спільний доступ за посиланням у режимах перегляду та редагування
- Панель адміністратора
- Блокування та видалення користувачів
- Модерація дошок

## Змінні середовища

Для запуску проєкту потрібно створити файл `.env` на основі `.env.example`.

Приклад:

PORT=3000

DB_USER=postgres  
DB_HOST=localhost  
DB_NAME=collab_board  
DB_PASSWORD=your_password  
DB_PORT=5432  

JWT_SECRET=your_secret_key  

GOOGLE_CLIENT_ID=your_google_client_id

Google Client ID також використовується у файлі public/login.html для відображення кнопки входу через Google.