# 🧠 🏗️ SYSTEM OVERVIEW
User App → Request Pipeline → Backend Engine → NGO Dashboard → Volunteer App
                     ↓
        (Supabase DB + Realtime + SMS + Offline Sync)

👉 **Think of it as:**
A resilient logistics + coordination system for disasters

---

## 🚀 1. USER REQUEST FLOW (ENTRY POINT)
### 🧑 Step 1: User Creates Request
**🚨 Option A: SOS**
- One tap
- Auto:
  - location
  - highest priority

**⚙️ Option B: Manual Request**
- User fills:
  - Type: Medical / Food / Rescue / Shelter
  - People affected
  - Severity
  - Optional note

---

## 📡 2. REQUEST PIPELINE (CONNECTIVITY HANDLING)
👉 *This is your core innovation*  
**Try API → If fail → Try SMS → If fail → Save Offline**

- **🟢 Case 1: Good Internet**
  - → API call → backend instantly
- **🟡 Case 2: Weak Network**
  - → API fails → Twilio SMS sent
- **🔴 Case 3: No Network**
  - → Saved in IndexedDB
  - → Service Worker retries later

---

## 🧠 3. BACKEND CORE ENGINE (BRAIN)
### 🔹 Step 3: Receive Request
From:
- API
- SMS parser
- Offline sync

### 🔹 Step 4: Deduplication + Clustering
Check:
- Same location (50m)
- Same need type
- Within 10 min

👉 **If cluster exists:**
- Merge request
- Update:
  - total_people
  - need counts

👉 **Else:**
- Create new cluster

### 🔹 Step 5: Cluster Structure
Each cluster contains:
- Location
- Multiple needs (medical, food, etc.)
- Aggregated people count

### 🔹 Step 6: Priority Engine
`priority = urgency + people_count + unmet_needs + time_waiting + hotspot_factor`

👉 *Example:* Medical + many people + long wait = HIGH

### 🔹 Step 7: NGO Selection Engine
- Filter NGOs by capability
- Score = distance + load + response_time + capability
- Pick best NGO
- Notify backup NGOs

👉 *NOT nearest — best suited NGO*

---

## 🏢 4. NGO DASHBOARD (CONTROL LAYER)
### 📥 Step 8: NGO Receives Cluster
Via:
- Supabase realtime

**📊 NGO sees:**
- Map location
- Needs breakdown: medical, food, rescue
- Total people
- Priority score

**🧠 System Assistance:**
- Suggested volunteers
- Urgent alerts
- Load warnings

### 🎯 Step 9: NGO Assigns Volunteers
👉 **NGO decides:**
- Doctor → medical
- Rescue team → rescue
- Food team → food

OR:
👉 **Click “Auto Assign”**

---

## 👷 5. VOLUNTEER EXECUTION FLOW
### 📲 Step 10: Volunteer Receives Task
- Notification
- Location
- Task details

### 🔄 Step 11: Status Updates
Available → En Route → On Task → Completed

👉 *Each update goes to backend in real-time*

---

## 🔁 6. CLUSTER UPDATE SYSTEM
🔹 **When volunteer completes work:**
- Update: `cluster_needs.completed += X`

🔹 **If partially completed:**
- Cluster remains active

🔹 **If all needs fulfilled:**
- `cluster.status = completed`

---

## 📊 7. COORDINATOR DASHBOARD (GLOBAL VIEW)
**📍 Shows:**
- All clusters on map
- Heatmap (hotspots)
- NGO load
- Volunteer availability

**⚙️ Actions:**
- Reassign NGO
- Escalate
- Mark resolved

---

## 🔔 8. ESCALATION SYSTEM (FAILURE HANDLING)
**If:**
- NGO not responding
- No volunteer assigned

**Then:**
- Expand search radius
- Notify more NGOs
- Increase priority

---

## 📡 9. REAL-TIME SYSTEM (SYNC ENGINE)
| Event | Who gets update |
| :--- | :--- |
| New request | NGO |
| Assignment | Volunteer |
| Status change | NGO + dashboard |
| Completion | All |

👉 *Powered by: Supabase realtime*

---

## 💾 10. OFFLINE SYSTEM (RELIABILITY)
**If request stored offline:**
- Saved in IndexedDB
- Service Worker retries

**When network returns:**
- Auto-send request

---

## 📶 11. SMS FALLBACK
**If API fails:**
- Send compressed SMS (e.g., `M|28.6|77.2|3`)
- NGO receives even in weak network

---

## 🔁 FINAL END-TO-END FLOW
1. User sends request
2. Connectivity pipeline (API / SMS / Offline)
3. Backend receives
4. Deduplication + Clustering
5. Priority calculation
6. NGO selection
7. NGO dashboard receives request
8. NGO assigns volunteers
9. Volunteers execute task
10. Status updates (real-time)
11. Cluster updated
12. Coordinator monitors + controls
13. Escalation if needed

---

## 🧠 COMPONENT INTERACTION (CLEAR)
| Component | Role |
| :--- | :--- |
| User App | Creates request |
| Pipeline | Handles connectivity |
| Backend | Core logic |
| Supabase DB | Stores data |
| NGO Dashboard | Assigns work |
| Volunteer App | Executes |
| Realtime | Syncs system |
| SMS | Backup |
| Service Worker | Retry offline |

---

## 🏆 WHAT MAKES YOUR SYSTEM STRONG
You combined:
- 🔥 Blinkit-style logistics
- 🔥 Cluster-based aggregation
- 🔥 NGO-based hierarchy
- 🔥 Multi-channel communication
- 🔥 Real-time coordination
