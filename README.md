# TDO Intelligence Dashboard & Product Scraper

A unified platform for Shopify product intelligence, SOP auditing, and automated competitive price scraping.

## 🚀 Overview

This project consolidates two powerful tools into a single interface:
1.  **Product Intelligence Hub**: Audits Shopify products for SOP compliance, syncs prices/inventory across stores (TDO, WDO, KOS), and uses AI to fix descriptions.
2.  **Product Scraper (v4)**: Extracts style numbers from vendor PDFs/CSVs and searches the web via Serper API to find where those products are listed online.

---

## 🛠 Prerequisites

*   **Node.js**: v18.0 or higher
*   **Python**: v3.10 or higher
*   **Git**

---

## 📦 Installation & Setup

### 1. Frontend Setup
Navigate to the frontend directory and install dependencies:
```bash
cd react-dashboard/react-dashboard
npm install
```

### 2. Backend Setup
Navigate to the main backend directory and install Python dependencies:
```bash
cd "backend (1)/backend"
pip install -r requirements.txt
```

### 3. Environment Variables
Create a `.env` file in the following locations based on the `.env.example` or provided templates:

*   **Main Backend (`backend (1)/backend/.env`)**:
    *   `OPENAI_API_KEY`: Required for AI description generation.
    *   `SECRET_KEY`: For auth security.
*   **Scraper Engine (`backend (1)/backend/scraper_engine/.env`)**:
    *   `SERPER_API_KEY`: Required for Google searches.
*   **Frontend (`react-dashboard/react-dashboard/.env`)**:
    *   `VITE_API_URL`: Should point to `http://localhost:8000/api`.

---

## ⚡ Running the Project

To run the full system, you need to start **three** separate terminals:

### Terminal 1: Main Dashboard Backend (Port 8000)
```bash
cd "backend (1)/backend"
python -m uvicorn app.main:app --reload --port 8000
```

### Terminal 2: Scraper Engine Backend (Port 8001)
```bash
cd "backend (1)/backend/scraper_engine"
python -m uvicorn main:app --port 8001
```

### Terminal 3: Frontend Dashboard (Port 5173)
```bash
cd react-dashboard/react-dashboard
npm run dev
```

The application will be available at **[http://localhost:5173](http://localhost:5173)**.

---

## 📂 Project Structure

*   `react-dashboard/`: Unified React 19 + Vite frontend.
*   `backend (1)/backend/app/`: FastAPI logic for the Audit Dashboard.
*   `backend (1)/backend/scraper_engine/`: Independent FastAPI logic for the Product Scraper.

---

## 🛡 License
Internal DTLA Marketing Technology. All rights reserved.
