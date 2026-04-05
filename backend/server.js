require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const connectDB = require("./src/config/db");
const errorHandler = require("./src/middleware/errorHandler");
const offlineQueue = require("./src/utils/offlineQueue");
const Request = require("./src/models/Request");

// ─── App Setup ────────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  },
});

// Attach io to app so controllers can access it via req.app.get('io')
app.set("io", io);

// ─── Socket.io Room Management ────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // NGO joins their dedicated room for targeted notifications
  socket.on("join_ngo_room", (ngoId) => {
    socket.join(`ngo_${ngoId}`);
    console.log(`🏥 NGO ${ngoId} joined room ngo_${ngoId}`);
  });

  // Volunteer joins their own room for task offers
  socket.on("join_volunteer_room", (volunteerId) => {
    socket.join(`volunteer_${volunteerId}`);
    console.log(
      `🙋 Volunteer ${volunteerId} joined room volunteer_${volunteerId}`,
    );
  });

  // Volunteer updates their location in real-time
  socket.on("volunteer_location_update", async ({ volunteer_id, lat, lng }) => {
    try {
      const Volunteer = require("./src/models/Volunteer");
      await Volunteer.findByIdAndUpdate(volunteer_id, {
        "location.lat": lat,
        "location.lng": lng,
        last_active: new Date(),
      });
      // Broadcast to the NGO room so the map updates
      const vol = await Volunteer.findById(volunteer_id).select("ngo_id");
      if (vol?.ngo_id) {
        io.to(`ngo_${vol.ngo_id}`).emit("volunteer_location", {
          volunteer_id,
          lat,
          lng,
        });
      }
    } catch (err) {
      console.error(`❌ Location update error: ${err.message}`);
    }
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} [${new Date().toISOString()}]`);
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", require("./src/routes/auth"));
app.use("/api/requests", require("./src/routes/requests"));
app.use("/api/ngos", require("./src/routes/ngos"));
app.use("/api/volunteers", require("./src/routes/volunteers"));
app.use("/api/join-requests", require("./src/routes/joinRequests"));
app.use("/api/sms-webhook", require("./src/routes/smsRoutes"));

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    offline_queue: offlineQueue.queueLength(),
    mongo:
      require("mongoose").connection.readyState === 1
        ? "connected"
        : "disconnected",
  });
});

// 404 handler
app.use((req, res) => {
  res
    .status(404)
    .json({ success: false, message: `Route ${req.path} not found` });
});

// Global error handler
app.use(errorHandler);

// ─── Offline Queue Flush ───────────────────────────────────────────────────────
// Every 30 seconds, try to flush the offline queue if DB is connected
setInterval(async () => {
  if (
    require("mongoose").connection.readyState === 1 &&
    offlineQueue.queueLength() > 0
  ) {
    await offlineQueue.flushQueue(async (data) => {
      await Request.create({
        need_type: data.need_type || "Rescue",
        location: data.location || { lat: 0, lng: 0 },
        people_count: data.people_count || 1,
        severity: data.severity || "Medium",
        description: data.description || "Offline queued request",
        is_sos: data.is_sos || false,
        queued_offline: true,
      });
    });
  }
}, 30000);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`\n🚀 RescueNet server running on http://localhost:${PORT}`);
    console.log(`🔌 Socket.io ready`);
    console.log(`📦 Environment: ${process.env.NODE_ENV || "development"}\n`);

    // Initialize background cron for timeouts
    const { initTimeoutChecker } = require("./src/services/timeoutChecker");
    initTimeoutChecker(io);
  });
};

startServer();
