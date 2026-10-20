# TrackCal AI — Global AI Food Intelligence Platform

An original, production-grade AI-powered nutrition and food tracking platform inspired by the state of the art in calorie and food intelligence (Cal AI).

---

## 🚀 Key Features & Capabilities

- **AI Photo Food Scanner**: Real-time multi-component segmentation, 3D volumetric depth heuristics, and confidence scoring.
- **Dynamic Portion Adjustment**: Real-time gram adjustment slider with automatic macro recalculation (Calories, Protein, Carbohydrates, Fat).
- **Explainable AI Breakdown**: Plate coverage percentage, density index, and allergen alerts (EU 14 & FDA allergen classes).
- **Global Food Database**: 49+ pre-seeded regional items across Indian, Japanese, Mediterranean, Mexican, and Western cuisines, backed by USDA FoodData Central and Open Food Facts schemas.
- **Meal Journal & Daily Targets**: Multi-meal categorization (Breakfast, Lunch, Dinner, Snack) with circular macro target rings and habit streak counters.
- **Hydration Tracker**: Instant water intake logger with daily hydration goal monitoring.
- **Cross-Platform Experience**:
  - Web client powered by **Next.js 16 (App Router) + React 19 + Tailwind CSS**.
  - Mobile client powered by **React Native & Expo**.
  - High-performance asynchronous backend powered by **FastAPI & MySQL 8.0**.

---

## 📂 Repository Structure

```text
track-cal/
├── backend/
│   ├── main.py              # FastAPI application entrypoint & middleware
│   ├── database.py          # SQLAlchemy engine, pool & session factory
│   ├── models.py            # Complete MySQL 8.0 relational data models
│   ├── seed_data.py         # 49 global food seeds, 16 nutrients, 14 allergens
│   ├── routers/
│   │   ├── ai_scan.py       # Vision AI scanner (photo, text, barcode)
│   │   ├── auth.py          # JWT authentication & bcrypt password hashing
│   │   ├── foods.py         # Nutrition search & allergen filters
│   │   ├── meal_logs.py     # Meal logging timeline
│   │   ├── nutrition.py     # Aggregated analytics & deficit tracker
│   │   ├── recipes.py       # Custom user recipes & yield factors
│   │   ├── subscriptions.py # Free vs. Pro tier billing & quota limits
│   │   ├── users.py         # User profiles & nutritional goals
│   │   └── support.py       # Ticketing & crowdsourced submissions
│   └── requirements.txt
├── frontend/
│   ├── web/                 # Next.js 16 Web Dashboard
│   └── mobile/              # React Native / Expo Mobile App
└── docs/
    └── ARCHITECTURE.md      # Full engineering architecture specification
```

---

## 🛠️ Getting Started

### 1. Backend Setup (FastAPI & MySQL 8.0)

1. Make sure MySQL 8.0 is running and configure `.env` in `backend/.env`:
   ```ini
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=foodai_app
   DB_PASSWORD=your_password
   DB_NAME=global_food_ai
   AI_MOCK_MODE=true
   ```

2. Seed the database with global nutrition records:
   ```bash
   cd backend
   py -3.11 seed_data.py
   ```

3. Launch the FastAPI server:
   ```bash
   py -3.11 -m uvicorn main:app --reload --port 8000
   ```
   Interactive API documentation will be available at [http://localhost:8000/api/docs](http://localhost:8000/api/docs).

---

### 2. Web Dashboard Setup (Next.js)

```bash
cd frontend/web
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the interactive dashboard.

---

### 3. Mobile App Setup (React Native / Expo)

```bash
cd frontend/mobile
npm install
npx expo start
```
Scan the QR code with the Expo Go app on iOS or Android to test the native mobile camera scanner.

---

## 🔒 Architectural Note on REA (Reverse Engineer Anything)

- **REA is not used in this project.** 
- TrackCal is built as an original, greenfield clean-room platform using standard open web and mobile frameworks and public nutrition datasets.
