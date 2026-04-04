# RescueNet — Real-Time Disaster Resource Coordination Platform

A production-ready MERN stack application connecting affected communities, NGOs, and volunteers during disasters.

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- MongoDB Atlas account (URI provided)

### 1. Setup Backend

```bash
cd backend
npm install
```

Edit `backend/.env` — replace `YOUR_DB_PASSWORD` with your actual MongoDB password:
```
MONGODB_URI=mongodb+srv://anandkumargrd11_db_user:YOUR_PASSWORD@cluster0.vz0e3uw.mongodb.net/rescuenet?appName=Cluster0
```

Optionally add Twilio credentials for SMS fallback.

### 2. Seed Database

```bash
cd backend
npm run seed
```

NGO Login credentials after seeding:
| NGO          | Phone            | Password      |
|--------------|------------------|---------------|
| Red Cross    | +911111111111    | password123   |
| NDRF Team    | +912222222222    | password123   |
| Goonj Relief | +913333333333    | password123   |

### 3. Start Backend

```bash
cd backend
npm run dev
# Runs on http://localhost:5000
```

### 4. Setup & Start Frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

---

## 🏗 Architecture

```
rescue net/
├── backend/
│   ├── server.js              # Express + Socket.io entry
│   └── src/
│       ├── config/db.js       # MongoDB connection (retry logic)
│       ├── models/            # Mongoose schemas
│       ├── routes/            # Express routers
│       ├── controllers/       # Request handlers
│       ├── services/
│       │   ├── clusteringService.js       # Merges nearby requests (50m, 10min)
│       │   ├── priorityService.js         # Computes urgency scores
│       │   ├── ngoSelectionService.js     # Picks best NGO (distance+load+speed)
│       │   ├── volunteerAssignmentService.js # Auto-assigns with timeout/retry
│       │   └── smsService.js              # Twilio SMS fallback
│       └── utils/
│           ├── offlineQueue.js            # In-memory queue for offline mode
│           └── seed.js                    # DB seed script
└── frontend/
    └── src/
        ├── pages/
        │   ├── HomePage.jsx        # SOS button + role selection
        │   ├── RequestPage.jsx     # Manual request form
        │   ├── NGODashboard.jsx    # Full NGO management UI
        │   └── VolunteerDashboard.jsx # Task accept/reject with countdown
        ├── context/AuthContext.jsx # JWT auth + socket room join
        └── services/
            ├── api.js              # Axios with JWT interceptor
            └── socket.js           # Shared Socket.io client
```

---

## 🔑 Key Features

### Request Pipeline (Fault Tolerant)
1. **API** → Save to MongoDB + run full pipeline
2. **SMS Fallback** (Twilio) → If API fails, SMS nearest NGO
3. **Offline Queue** → If SMS fails, queue locally + flush when online

### Clustering Algorithm
- Merges requests: same type + within 50m + within 10 minutes
- Tracks `total_people`, `max_severity`, recalculates cluster center

### Priority Scoring
| Factor        | Max Points |
|---------------|------------|
| Type (Medical=40, Rescue=30, Shelter=20, Food=10) | 40 |
| Severity (Critical=30, High=20, Medium=10, Low=5) | 30 |
| People count (0.5/person) | 25 |
| Time waiting (1/minute) | 30 |

### NGO Selection
Scored on distance (40pts) + current load (30pts) + avg response time (30pts)

### Volunteer Assignment
- Auto-assigns top 3 volunteers simultaneously
- First to accept wins → others auto-released
- 2 minute timeout → retry with next batch
- Socket.io task offer modal with countdown timer

---

## 🌐 API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Register (user/volunteer/ngo_admin) |
| POST | `/api/auth/login` | Login |
| GET  | `/api/auth/me` | Current user |
| POST | `/api/requests` | Submit request (public) |
| GET  | `/api/requests` | List requests |
| GET  | `/api/requests/clusters` | Active clusters |
| GET  | `/api/ngos` | List NGOs |
| GET  | `/api/ngos/:id/dashboard` | NGO dashboard data |
| PATCH| `/api/ngos/:id/assignments/:aid/override` | Override volunteer |
| GET  | `/api/volunteers` | List volunteers |
| PATCH| `/api/volunteers/:id/status` | Update status |
| POST | `/api/volunteers/accept-task` | Accept task offer |
| PATCH| `/api/volunteers/assignments/:id/status` | Update assignment status |
| GET  | `/api/health` | Health check |

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)
```env
PORT=5000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_secret
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1xxx
FRONTEND_URL=http://localhost:5173
```
