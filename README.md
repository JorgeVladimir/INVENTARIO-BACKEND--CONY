# Backend - Inventario CONY

Este proyecto contiene la API (Express) con:

- SQLite para módulos internos de inventario/órdenes.
- SQL Server para ecommerce, incluyendo la tabla `Productos` en la base `E-COMERCE`.

## Requisitos

- Node.js 20+

## Configuración

1. Instalar dependencias:
   `npm install`
2. Copiar `.env.example` a `.env` (opcional) y ajustar valores.

Variables SQL Server:

- `SQLSERVER_HOST` (ej: `localhost`)
- `SQLSERVER_DATABASE` (ej: `E-COMERCE`)
- `SQLSERVER_USER` (ej: `jvtt`)
- `SQLSERVER_PASSWORD` (ej: `jvtt1995`)

## Ejecutar en desarrollo

`npm run dev`

API local: `http://localhost:7002`
Health check: `http://localhost:7002/api/health`

## Endpoints principales

- `POST /api/login`
- `GET /api/public/products`
- `GET /api/products`
- `GET /api/ecommerce/productos` (lee desde SQL Server `E-COMERCE.dbo.Productos`)
- `POST /api/ecommerce/import-excel` (importa Excel hacia SQL Server `E-COMERCE.dbo.Productos`)
- `GET /api/orders`
- `POST /api/orders`
- `POST /api/checkout`
