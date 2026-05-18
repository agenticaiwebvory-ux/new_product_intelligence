# TDO Product Intelligence Dashboard - Architecture Documentation

> **Last Updated:** May 18, 2026  
> **Version:** 2.0 (Unified Backend + Redux Frontend)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Backend Architecture](#backend-architecture)
4. [Frontend Architecture](#frontend-architecture)
5. [API Endpoints](#api-endpoints)
6. [Database Schema](#database-schema)
7. [Data Flow](#data-flow)
8. [Technology Stack](#technology-stack)
9. [Setup & Configuration](#setup--configuration)

---

## System Overview

The TDO Product Intelligence Dashboard is a full-stack web application that provides:

- **Multi-store product catalog management** across Shopify stores (TDO, WDO, KOS, IM)
- **Merchandising analytics** with sell-through rates and inventory insights
- **Real-time dashboard** with store connectivity status
- **Product synchronization** with Shopify for inventory, pricing, and tags

### Key Features

- Unified backend (FastAPI) serving all API routes
- Redux Toolkit for frontend state management
- Store-credential based configuration (no hardcoded store names)
- Server-side pagination and filtering
- Redis caching for performance

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React + Redux)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  App.jsx    │  │ Components  │  │  Features   │  │      Services       │ │
│  │  (Router)   │  │ (Merch/UI)  │  │ (Redux)     │  │    (API Client)     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTP/REST
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (FastAPI)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        API Routes (/api)                            │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │    │
│  │  │  auth    │ │ products  │ │dashboard │ │merch     │ │ stores   │  │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        Services Layer                               │    │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │    │
│  │  │ CatalogSvc   │ │ DashboardSvc │ │ MerchSvc    │ │ StoreSvc   │ │    │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        Core Layer                                   │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │    │
│  │  │ Config   │ │ Database │ │ Exceptions│ │ Redis   │ │ Auth    │  │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL INTEGRATIONS                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Shopify    │  │    Redis     │  │   SQLite    │  │   (Planned)      │  │
│  │   Stores     │  │   Cache      │  │  Databases  │  │ Google Analytics │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │ ShipStation      │  │
│                                                          │ Redo Returns     │  │
│                                                          └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Backend Architecture

### Directory Structure

```
backend_main/backend/app/
├── api/                    # API Route handlers
│   ├── auth.py            # Authentication endpoints
│   ├── products.py        # Product catalog endpoints
│   ├── dashboard.py       # Dashboard stats endpoints
│   ├── merchandising.py   # Merchandising report endpoints
│   └── stores.py          # Store management endpoints
├── core/                  # Core utilities
│   ├── config.py          # Settings & store config loader
│   ├── database.py        # SQLAlchemy session management
│   ├── exceptions.py      # Custom exception classes
│   ├── limiter.py         # Rate limiting
│   └── redis_client.py    # Redis cache client
├── models/                # SQLAlchemy ORM models
│   ├── catalog.py         # Product/Inventory models
│   └── merchandising.py  # Merchandising analytics models
├── schemas/               # Pydantic request/response models
│   ├── catalog.py
│   ├── merchandising.py
│   └── product.py
├── services/              # Business logic layer
│   ├── catalog_service.py     # Product catalog operations
│   ├── dashboard_service.py   # Dashboard statistics
│   ├── merchandising_service.py # Merchandising analytics
│   └── store_service.py       # Store management
├── integrations/          # External integrations
│   └── shopify/           # Shopify API client
├── config/                # Additional config
├── tools/                 # Utility scripts
└── main.py               # FastAPI app entry point
```

### Core Components

#### 1. API Layer (`api/`)

| File | Purpose | Endpoints |
|------|---------|-----------|
| `auth.py` | Login/logout, session management | `/api/auth/login`, `/api/auth/logout` |
| `products.py` | Product listing, sync, updates | `/api/products`, `/api/products/sync` |
| `dashboard.py` | Dashboard statistics | `/api/dashboard/stats` |
| `merchandising.py` | Merchandising reports | `/api/merchandising/report`, `/api/merchandising/stats` |
| `stores.py` | Store connectivity | `/api/stores`, `/api/stores/{store}/connect` |

#### 2. Services Layer (`services/`)

| Service | Responsibility |
|---------|----------------|
| `CatalogService` | Product CRUD, inventory management |
| `DashboardService` | Aggregated stats, store health |
| `MerchandisingService` | Sell-through calculations, report generation |
| `StoreService` | Store credentials, connectivity validation |

#### 3. Core Layer (`core/`)

| Module | Purpose |
|--------|---------|
| `config.py` | Loads settings from `.env`, fetches store credentials from DB |
| `database.py` | SQLAlchemy engine, session factory, get_db dependency |
| `exceptions.py` | Custom exceptions (AppBaseException, etc.) |
| `redis_client.py` | Redis cache operations |
| `limiter.py` | API rate limiting |

---

## Frontend Architecture

### Directory Structure

```
react-dashboard/src/
├── app/
│   ├── store.js           # Redux store configuration
│   └── hooks.js           # Typed Redux hooks (useAppDispatch, useAppSelector)
├── components/
│   ├── common/            # Reusable UI components
│   │   └── ConfirmationDialog.jsx
│   ├── merchandising/     # Merchandising-specific components
│   │   └── KpiGrid.jsx
│   ├── AuditDetailsModal.jsx
│   ├── ControlPanel.jsx
│   ├── Header.jsx
│   ├── LoginPage.jsx
│   ├── MerchandisingReport.jsx  # Main merchandising view (to be broken down)
│   ├── ScraperDashboard.jsx
│   └── Sidebar.jsx
├── features/              # Redux slices & thunks
│   ├── auth/              # Authentication state
│   ├── dashboard/         # Dashboard stats state
│   ├── layout/            # Sidebar, active view state
│   ├── merchandising/     # Merchandising report state
│   ├── products/          # Products list state
│   ├── stores/            # Store connectivity state
│   └── users/             # Users management state
├── services/
│   └── api.js             # API client (axios-based)
├── utils/
│   └── format.js          # Formatting utilities
├── App.jsx                # Main app component
└── main.jsx               # Entry point
```

### Redux State Structure

```javascript
{
  auth: {
    user: null,
    isLoggedIn: false,
    loading: false,
    error: null
  },
  layout: {
    activeView: 'dashboard',
    isSidebarCollapsed: false,
    sidebarLinks: []
  },
  dashboard: {
    stats: {},
    loading: false,
    error: null
  },
  merchandising: {
    report: [],
    stats: {},
    filters: {},
    pagination: {},
    loading: false,
    error: null
  },
  products: {
    items: [],
    filters: {},
    pagination: {},
    loading: false
  },
  stores: {
    list: [],
    selectedStore: null,
    connectivity: {},
    loading: false
  },
  users: {
    list: [],
    loading: false
  }
}
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| GET | `/api/auth/me` | Get current user |

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List products (paginated, filtered) |
| GET | `/api/products/{id}` | Get product details |
| POST | `/api/products/sync` | Sync products from Shopify |
| PUT | `/api/products/{id}` | Update product |
| PUT | `/api/products/{id}/inventory` | Update inventory |
| PUT | `/api/products/{id}/tags` | Update product tags |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Get dashboard statistics |
| GET | `/api/dashboard/health` | Get store connectivity health |

### Merchandising

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/merchandising/report` | Get merchandising report |
| GET | `/api/merchandising/stats` | Get merchandising stats |
| POST | `/api/merchandising/export` | Export report data |
| PUT | `/api/merchandising/tags` | Update product tags |

### Stores

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stores` | List all configured stores |
| GET | `/api/stores/{store}` | Get store details |
| POST | `/api/stores/{store}/connect` | Test store connection |
| GET | `/api/stores/{store}/products` | Get products for specific store |

---

## Database Schema

### Primary Databases

| Database | Purpose |
|----------|---------|
| `in_stock_1.db` | Product catalog, inventory, Shopify data |
| `hitl.db` | Authentication, user sessions |
| `tdo_merch.db` | Merchandising analytics, sell-through data |

### Key Tables

#### Store Credentials (in `in_stock_1.db`)

```sql
CREATE TABLE store_credentials (
    id INTEGER PRIMARY KEY,
    store_name TEXT NOT NULL,
    shop_domain TEXT,
    api_key TEXT,
    api_secret TEXT,
    last_error TEXT,
    last_sync TEXT
);
```

#### Products (in `in_stock_1.db`)

```sql
CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    style TEXT NOT NULL,
    title TEXT,
    vendor TEXT,
    tags TEXT,
    price REAL,
    inventory INTEGER,
    images TEXT,
    store_id TEXT
);
```

#### Merchandising (in `tdo_merch.db`)

```sql
CREATE TABLE merch_report (
    id INTEGER PRIMARY KEY,
    style TEXT,
    vendor TEXT,
    store TEXT,
    sell_through REAL,
    units_sold INTEGER,
    units_remaining INTEGER,
    period_start DATE,
    period_end DATE
);
```

---

## Data Flow

### 1. Product Listing Flow

```
Frontend (MerchandisingReport)
    │
    ▼ GET /api/merchandising/report?page=1&limit=20
API Layer (merchandising.py)
    │
    ▼
MerchandisingService.get_report()
    │
    ├──► Query merch_report table
    ├──► Apply filters (vendor, store, date range)
    └──► Return paginated results
    │
    ▼ JSON Response
Frontend (Redux → UI)
```

### 2. Store Connectivity Check

```
Frontend (Sidebar)
    │
    ▼ GET /api/stores
StoreService.load_stores()
    │
    ├──► Query store_credentials table
    └──► Return store list with status
    │
    ▼ JSON Response
Frontend (StoreStatusPill → Display)
```

### 3. Product Sync Flow

```
Frontend (ControlPanel)
    │
    ▼ POST /api/products/sync
ProductsService.sync_products()
    │
    ├──► ShopifyClient for each store
    ├──► Fetch products from Shopify API
    └──► Upsert to local database
    │
    ▼ Sync status response
Frontend (Toast notification)
```

---

## Technology Stack

### Backend

| Technology | Purpose |
|------------|---------|
| **FastAPI** | REST API framework |
| **SQLAlchemy** | ORM |
| **SQLite** | Primary database |
| **Redis** | Caching layer |
| **Pydantic** | Data validation |
| **python-dotenv** | Environment configuration |

### Frontend

| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework |
| **Redux Toolkit** | State management |
| **React Router** | Client-side routing |
| **Axios** | HTTP client |
| **Tailwind CSS** | Styling |
| **Lucide React** | Icons |
| **React Hot Toast** | Notifications |

---

## Setup & Configuration

### Backend Setup

```bash
# Navigate to backend
cd backend_main/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with your configuration

# Run the server
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

```bash
# Navigate to frontend
cd react-dashboard

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit VITE_API_URL to point to backend

# Run development server
npm run dev
```

### Environment Variables

#### Backend (.env)

```env
DB_URL=path/to/in_stock_1.db
DATABASE_URL=path/to/tdo_merch.db
AUTH_DB_URL=path/to/hitl.db
REDIS_URL=redis://localhost:6379
SECRET_KEY=your-secret-key
FRONTEND_URL=http://localhost:5173
```

#### Frontend (.env)

```env
VITE_API_URL=http://localhost:8000
```

---

## Future Enhancements

- [ ] Break down `MerchandisingReport.jsx` into smaller components
- [ ] Add Google Analytics integration
- [ ] Add ShipStation integration
- [ ] Add Redo Returns integration
- [ ] Implement real-time WebSocket updates
- [ ] Add unit tests for services

---

## Contact

For questions about this architecture, contact the development team.