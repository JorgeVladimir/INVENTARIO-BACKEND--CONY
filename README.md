# Backend - Inventario CONY

Este proyecto contiene solo la API (Express + SQLite).

## Requisitos

- Node.js 20+

## Configuración

1. Instalar dependencias:
   `npm install`
2. Copiar `.env.example` a `.env` (opcional) y ajustar valores.

## Ejecutar en desarrollo

`npm run dev`

API local: `http://localhost:7002`
Health check: `http://localhost:7002/api/health`

## Endpoints principales

- `POST /api/login`
- `GET /api/public/products`
- `GET /api/products`
- `GET /api/orders`
- `POST /api/orders`
- `POST /api/checkout`
