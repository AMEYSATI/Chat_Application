import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import pool from "./db.js";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();
const port = 3001;

// Middleware
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000","https://chat-application-1-8qrw.onrender.com"],
  credentials: true, 
  methods: ["GET", "POST", "PUT", "DELETE"]
}));

app.use(express.json());
app.use(cookieParser());
const __dirname = path.resolve();
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Create an HTTP server
const server = createServer(app);

// Define `io` before using it
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3000","https://chat-application-1-8qrw.onrender.com"],
    credentials: true,
  },
});

// WebSocket Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    console.log("Missing auth token in WebSocket handshake");
    return next(new Error("Unauthorized"));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    console.log("✅ WebSocket Authenticated:", socket.user);
    next();
  } catch (error) {
    console.log("Invalid token:", error.message);
    next(new Error("Invalid token"));
  }
});

// API Routes
app.get("/", (req, res) => {
  res.send("Chat App API is running...");
});
app.use("/auth", authRoutes);
app.use("/messages", messageRoutes);

const userSockets = {}; // Maps userId -> socketId

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
  const userId = socket.user.id;
  userSockets[userId] = socket.id;
  console.log(`User ${userId} mapped to socket ${socket.id}`);

  socket.on("sendMessage", async ({ sender_id, receiver_id, content }) => {
    if (!sender_id || !receiver_id || !content) return;
    const chat_id = sender_id < receiver_id ? `${sender_id}_${receiver_id}` : `${receiver_id}_${sender_id}`;
    try {
      const result = await pool.query(
        `INSERT INTO messages (chat_id, sender_id, receiver_id, content, timestamp) 
         VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
        [chat_id, sender_id, receiver_id, content]
      );
      const savedMessage = result.rows[0];
      const receiverSocket = userSockets[receiver_id];
      if (receiverSocket) {
        io.to(receiverSocket).emit("receiveMessage", savedMessage);
      }
      socket.emit("messageSent", savedMessage);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    delete userSockets[userId];
  });
});

// Start the server with WebSockets
server.listen(port, () => console.log(`Server running on port ${port}`));


// import express from "express";
// import { createServer } from "http";
// import { Server } from "socket.io";
// import cors from "cors";
// import authRoutes from "./routes/authRoutes.js";
// import messageRoutes from "./routes/messageRoutes.js";
// import db from "./db.js";
// import cookieParser from "cookie-parser";
// import jwt from "jsonwebtoken";
// import dotenv from "dotenv";
// import path from "path";

// dotenv.config();

// const app = express();
// const port = 3001;

// // Middleware
// app.use(cors({
//   origin: ["http://localhost:5173", "http://localhost:3000"],
//   credentials: true, 
//   methods: ["GET", "POST", "PUT", "DELETE"]
// }));

// app.use(express.json());
// app.use(cookieParser());
// const __dirname = path.resolve();
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));


// // Create an HTTP server
// const server = createServer(app);

// // ✅ Define `io` before using it
// const io = new Server(server, {
//   cors: {
//     origin: ["http://localhost:5173", "http://localhost:3000"], // ✅ Match frontend
//     credentials: true, // ✅ Ensure cookies are sent
//   },
// });


// // ✅ Now use `io` middleware (AFTER defining `io`)
// io.use((socket, next) => {
//   const token = socket.handshake.auth?.token; // ✅ Get token from `auth`

//   if (!token) {
//     console.log("Missing auth token in WebSocket handshake");
//     return next(new Error("Unauthorized"));
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     socket.user = decoded;
//     console.log("✅ WebSocket Authenticated:", socket.user);
//     next();
//   } catch (error) {
//     console.log("Invalid token:", error.message);
//     next(new Error("Invalid token"));
//   }
// });



// // API Routes
// app.get("/", (req, res) => {
//   res.send("Chat App API is running...");
// });
// app.use("/auth", authRoutes);
// app.use("/messages", messageRoutes);

// const userSockets = {}; // Maps userId -> socketId

// io.on("connection", (socket) => {
//   console.log("A user connected:", socket.id);

//   // Register user with their ID
//   const userId = socket.user.id;
//   userSockets[userId] = socket.id;
//   console.log(`User ${userId} mapped to socket ${socket.id}`);

//   socket.on("sendMessage", async ({ sender_id, receiver_id, content }) => {
//     if (!sender_id || !receiver_id || !content) return;

//     const chat_id = sender_id < receiver_id ? `${sender_id}_${receiver_id}` : `${receiver_id}_${sender_id}`;

//     try {
//       const result = await db.query(
//         `INSERT INTO messages (chat_id, sender_id, receiver_id, content, timestamp) 
//          VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
//         [chat_id, sender_id, receiver_id, content]
//       );

//       const savedMessage = result.rows[0];

//       // Send message only to the receiver
//       const receiverSocket = userSockets[receiver_id];
//       if (receiverSocket) {
//         io.to(receiverSocket).emit("receiveMessage", savedMessage);
//       }

//       // Send acknowledgment to the sender
//       socket.emit("messageSent", savedMessage);
//     } catch (error) {
//       console.error("Error sending message:", error);
//     }
//   });

//   socket.on("disconnect", () => {
//     console.log(`User disconnected: ${socket.id}`);
//     delete userSockets[userId]; // Remove from active users
//   });
// });


// // Start the server with WebSockets
// server.listen(port, () => console.log(`Server running on port ${port}`));
