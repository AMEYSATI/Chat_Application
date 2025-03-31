import express from "express";
import pool from "../db.js";
import authenticate from "./authMiddleware.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

// Ensure the "uploads/messages" directory exists
const uploadDir = "uploads/messages/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// File Upload Configuration for Messages (Images & Videos)
const messageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});

// Allow only images and videos
const messageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
    cb(null, true);
  } else {
    req.fileValidationError = "Only images and videos are allowed!";
    cb(null, false);
  }
};

const uploadMessage = multer({
  storage: messageStorage,
  fileFilter: messageFileFilter
});

// ✅ Send a message (Text Only)
router.post("/", authenticate, async (req, res) => {
  const { receiver_id, content } = req.body;
  const sender_id = req.user.id;

  try {
    if (!receiver_id || !content?.trim()) {
      return res.status(400).json({ error: "Receiver ID and message content are required" });
    }

    if (sender_id === receiver_id) {
      return res.status(400).json({ error: "You cannot message yourself" });
    }

    // Check if receiver exists
    const userCheck = await pool.query("SELECT id FROM users WHERE id = $1", [receiver_id]);
    if (userCheck.rowCount === 0) {
      return res.status(404).json({ error: "Receiver not found" });
    }

    const chat_id = sender_id < receiver_id ? `${sender_id}_${receiver_id}` : `${receiver_id}_${sender_id}`;

    const result = await pool.query(
      `INSERT INTO messages (chat_id, sender_id, receiver_id, content, timestamp) 
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
      [chat_id, sender_id, receiver_id, content]
    );

    res.status(201).json({ message: "Message sent", data: result.rows[0] });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Get chat messages
router.get("/:chatId", authenticate, async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user.id;

  try {
    const [user1, user2] = chatId.split("_").map(Number);

    if (![user1, user2].includes(userId)) {
      return res.status(403).json({ error: "Unauthorized access to chat" });
    }

    // Security: Ensure both users exist
    const userExists = await pool.query("SELECT id FROM users WHERE id IN ($1, $2)", [user1, user2]);
    if (userExists.rowCount < 2) {
      return res.status(404).json({ error: "Invalid chat participants" });
    }

    const result = await pool.query(
      "SELECT * FROM messages WHERE chat_id = $1 ORDER BY timestamp ASC",
      [chatId]
    );

    res.status(200).json({ messages: result.rows });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Send a message with text or media (File Upload)
router.post("/send-message", authenticate, uploadMessage.single("file"), async (req, res) => {
  const { receiver_id, content } = req.body;
  const sender_id = req.user.id;
  const filePath = req.file ? req.file.filename : null;

  try {
    if (req.fileValidationError) {
      return res.status(400).json({ error: req.fileValidationError });
    }

    if (!receiver_id || (!content && !filePath)) {
      return res.status(400).json({ error: "Message or file is required" });
    }

    const chat_id = sender_id < receiver_id ? `${sender_id}_${receiver_id}` : `${receiver_id}_${sender_id}`;

    const result = await pool.query(
      `INSERT INTO messages (chat_id, sender_id, receiver_id, content, file_path, timestamp) 
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
      [chat_id, sender_id, receiver_id, content || null, filePath]
    );

    res.status(201).json({ success: true, message: result.rows[0] });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Message sending failed" });
  }
});

// ✅ Serve Uploaded Messages (Images/Videos)
router.use("/uploads/messages", express.static(uploadDir));

export default router;



// import express from "express";
// import db from "../db.js";
// import authenticate from "./authMiddleware.js";
// import multer from "multer";
// import path from "path";
// import fs from "fs";

// const router = express.Router();

// // Ensure the "uploads/messages" directory exists
// const uploadDir = "uploads/messages/";
// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir, { recursive: true });
// }

// // File Upload Configuration for Messages (Images & Videos)
// const messageStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, uploadDir);
//   },
//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname);
//     cb(null, Date.now() + ext);
//   }
// });

// // Allow only images and videos
// const messageFileFilter = (req, file, cb) => {
//   if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
//     cb(null, true);
//   } else {
//     req.fileValidationError = "Only images and videos are allowed!";
//     cb(null, false);
//   }
// };

// const uploadMessage = multer({
//   storage: messageStorage,
//   fileFilter: messageFileFilter
// });

// // ✅ Send a message (Text Only)
// router.post("/", authenticate, async (req, res) => {
//   const { receiver_id, content } = req.body;
//   const sender_id = req.user.id;

//   try {
//     if (!receiver_id || !content?.trim()) {
//       return res.status(400).json({ error: "Receiver ID and message content are required" });
//     }

//     if (sender_id === receiver_id) {
//       return res.status(400).json({ error: "You cannot message yourself" });
//     }

//     // Check if receiver exists
//     const userCheck = await db.query("SELECT id FROM users WHERE id = $1", [receiver_id]);
//     if (userCheck.rowCount === 0) {
//       return res.status(404).json({ error: "Receiver not found" });
//     }

//     const chat_id = sender_id < receiver_id ? `${sender_id}_${receiver_id}` : `${receiver_id}_${sender_id}`;

//     const result = await db.query(
//       `INSERT INTO messages (chat_id, sender_id, receiver_id, content, timestamp) 
//        VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
//       [chat_id, sender_id, receiver_id, content]
//     );

//     res.status(201).json({ message: "Message sent", data: result.rows[0] });
//   } catch (error) {
//     console.error("Error sending message:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// // ✅ Get chat messages
// router.get("/:chatId", authenticate, async (req, res) => {
//   const { chatId } = req.params;
//   const userId = req.user.id;

//   try {
//     const [user1, user2] = chatId.split("_").map(Number);

//     if (![user1, user2].includes(userId)) {
//       return res.status(403).json({ error: "Unauthorized access to chat" });
//     }

//     // Security: Ensure both users exist
//     const userExists = await db.query("SELECT id FROM users WHERE id IN ($1, $2)", [user1, user2]);
//     if (userExists.rowCount < 2) {
//       return res.status(404).json({ error: "Invalid chat participants" });
//     }

//     const result = await db.query(
//       "SELECT * FROM messages WHERE chat_id = $1 ORDER BY timestamp ASC",
//       [chatId]
//     );

//     res.status(200).json({ messages: result.rows });
//   } catch (error) {
//     console.error("Error fetching messages:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// // ✅ Send a message with text or media (File Upload)
// router.post("/send-message", authenticate, uploadMessage.single("file"), async (req, res) => {
//   const { receiver_id, content } = req.body;
//   const sender_id = req.user.id;
//   const filePath = req.file ? req.file.filename : null;

//   try {
//     if (req.fileValidationError) {
//       return res.status(400).json({ error: req.fileValidationError });
//     }

//     if (!receiver_id || (!content && !filePath)) {
//       return res.status(400).json({ error: "Message or file is required" });
//     }

//     const chat_id = sender_id < receiver_id ? `${sender_id}_${receiver_id}` : `${receiver_id}_${sender_id}`;

//     const result = await db.query(
//       `INSERT INTO messages (chat_id, sender_id, receiver_id, content, file_path, timestamp) 
//        VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
//       [chat_id, sender_id, receiver_id, content || null, filePath]
//     );

//     res.status(201).json({ success: true, message: result.rows[0] });
//   } catch (error) {
//     console.error("Error sending message:", error);
//     res.status(500).json({ error: "Message sending failed" });
//   }
// });


// // ✅ Serve Uploaded Messages (Images/Videos)

// router.use("/uploads/messages", express.static(uploadDir));

// export default router;
