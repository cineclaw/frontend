# CineClaw Frontend

[![Docker Image](https://github.com/cineclaw/frontend/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/cineclaw/frontend/actions/workflows/docker-publish.yml)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/cineclaw/frontend/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**CineClaw Frontend** — современный веб-интерфейс и Progressive Web Application (PWA) для домашнего кинотеатра CineClaw. Разработан с фокусом на мобильную эргономику (Mobile-First Thumb-Zone), плавную физику анимаций и мгновенный поиск медиа-контента.

---

## Возможности и архитектура

- **React 19 & Vite**: Ультрабыстрая разработка с HMR и высокооптимизированный бандл (сборка за ~0.5 сек).
- **Mobile-First Ergonomics**:
  - **Нижний док поиска (Thumb-Zone)**: Поле ввода и фильтры зафиксированы внизу экрана с учётом `safe-area-inset-bottom`.
  - **Выдача снизу вверх (`flex-col-reverse`)**: Результат №1 располагается прямо над большим пальцем руки.
  - **Плавные анимации Framer-Motion**: Эффект «вылета сверху» для карточек, замена результатов через `AnimatePresence`, нативные жесты свайпа назад.
- **Полноценное PWA-приложение**:
  - Установка в качестве нативного приложения на iOS / Android («На экран "Домой"`).
  - Поддержка Dynamic Island / выреза экрана (`viewport-fit=cover`, `env(safe-area-inset-top)`).
  - Единая палитра `#07090e` (obsidian cinema), исключающая артефакты оверскролла.
- **Богатые метаданные TMDB**:
  - Постеры высокой чёткости с локальным кэшированием.
  - Персоналии, съёмочная группа (создатели сериалов, режиссёры, сценаристы, композиторы).
  - Встроенный просмотр трейлеров YouTube без перехода на сторонние ресурсы.
  - Интерактивная карточка персоны и фильмография с переходом к фильмам в 1 клик.
- **Диагностический модуль (`DiagnosticModal`)**:
  - Экран мониторинга реального времени для проверки статусов и версий всех 7 микросервисов стека с замером пинга (мс).
  - Быстрое копирование диагностического отчёта для логов.
- **Интеграция с Jellyfin и Tiramisu**:
  - Запуск стриминга торрента в 1 клик через виртуальное FUSE-монтирование.
  - Динамическое разрешение хоста (`window.location.hostname`), позволяющее управлять кинотеатром с любого устройства в локальной сети.

---

## Структура проекта

```
frontend/
├── public/                 # PWA-манифест, иконки, Service Worker
├── src/
│   ├── api/                # RTK Query API сервисы (moviesApi, torrentsApi)
│   ├── components/
│   │   ├── common/         # Общие компоненты UI (Header, Базовые элементы)
│   │   ├── diagnostic/     # Экран диагностики микросервисов (DiagnosticModal)
│   │   ├── home/           # Домашние полки TMDB (HomeShelves, ShelfModal)
│   │   ├── layout/         # Каркас интерфейса
│   │   ├── movie/          # Карточки, модальное окно фильма, список торрентов
│   │   ├── person/         # Карточка персоны и фильмография (PersonModal)
│   │   ├── search/         # Поисковый док, фильтры, быстрые категории
│   │   └── ui/             # Radix-примитивы и Tailwind UI
│   ├── hooks/              # Хуки (useMediaQuery)
│   ├── store/              # Redux Toolkit хранилище (searchSlice, store)
│   ├── App.tsx             # Корневой компонент приложения
│   └── main.tsx            # Точка монтирования React 19
├── Dockerfile              # Multi-stage production сборка (Node.js -> Nginx)
├── nginx.conf              # Nginx reverse-proxy и fallback для SPA
└── package.json            # Зависимости и скрипты
```

---

## Запуск в режиме разработки

### Требования
- Node.js 20+
- npm 10+

### Установка и запуск
```bash
# Установка зависимостей
npm install

# Запуск dev-сервера (порт 3000)
npm run dev
```

В dev-режиме запросы проксируются через `vite.config.ts` на бэкенд-сервисы:
- `http://localhost:8090` (`imdb-indexer`)
- `http://localhost:9118` (`tracker-proxy`)

---

## Сборка продакшн-образа Docker

Фронтенд поставляется в виде минималистичного контейнера на базе `nginx:alpine`:

```bash
# Локальная сборка Docker-образа
docker build -t ghcr.io/cineclaw/frontend:latest .

# Запуск контейнера
docker run -d -p 3000:3000 ghcr.io/cineclaw/frontend:latest
```

Готовый образ автоматически публикуется через GitHub Actions в GitHub Container Registry:
```bash
docker pull ghcr.io/cineclaw/frontend:latest
```

---

## Лицензия
MIT License. См. файл [LICENSE](../LICENSE) для подробностей.
