import express from "express";
import bcrypt from "bcryptjs";
import pool from "../db.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";

import authenticate from "./authMiddleware.js"; // Ensure correct path

dotenv.config();
const router = express.Router();
const saltRounds = 10;

// File Upload Configuration (Only Accept Images)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, Date.now() + ext);
    }
});
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
        cb(null, true);
    } else {
        cb(new Error("Only image files are allowed!"), false);
    }
};
const upload = multer({ storage, fileFilter });

// User Registration with Profile Picture Upload
router.post("/register", upload.single("profilepic"), async (req, res) => {
    console.log("Received file:", req.file);
    console.log("Received body:", req.body);
    const { name, email, password } = req.body;
    const profilePicPath = req.file ? req.file.filename : null;

    try {
        if (!name || !email || !password || !profilePicPath) {
            return res.status(400).json({ error: "All fields are required" });
        }

        // Check if user already exists
        const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ error: "Email already registered" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert user into DB
        const result = await pool.query(
            `INSERT INTO users (name, email, password, profile_pic, created_at) 
             VALUES ($1, $2, $3, $4, NOW()) RETURNING id, name, email, profile_pic`,
            [name, email, hashedPassword, profilePicPath]
        );

        res.status(201).json({ message: "User registered successfully", user: result.rows[0] });
    } catch (error) {
        console.error("Error inserting user:", error);
        res.status(500).json({ error: "Registration failed" });
    }
});

// Login User
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        // Fetch user from DB
        const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (rows.length === 0) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const user = rows[0];

        // Compare hashed passwords
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        // Set cookie with security best practices
        res.cookie("token", token, {
              httpOnly: true,
              secure: true,  
              sameSite: "None",
              maxAge: 7 * 24 * 60 * 60 * 1000, // Keep cookie for 7 days
        });


        res.status(200).json({
            message: "Login successful",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                profile_pic: user.profile_pic,
            },
            token,
        });
    } catch (error) {
        console.error("Error logging in user:", error);
        res.status(500).json({ error: "Login failed" });
    }
});

// Logout User
router.post("/logout", (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: true,
        sameSite: "None",
    });
    res.status(200).json({ message: "Logged out successfully" });
});

// Get Authenticated User
router.get("/me", (req, res) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        pool.query("SELECT id, name, email, profile_pic FROM users WHERE id = $1", [decoded.id])
            .then((result) => {
                if (result.rows.length === 0) {
                    return res.status(401).json({ error: "User not found" });
                }
                res.json({ ...result.rows[0], token });
            })
            .catch((err) => {
                console.error("Error fetching user info:", err);
                res.status(500).json({ error: "Failed to fetch user data" });
            });
    } catch (error) {
        res.status(401).json({ error: "Invalid token" });
    }
});


router.get("/search", authenticate, async (req, res) => {
    const { query } = req.query;
    const userId = req.user.id;

    if (!query) {
        return res.status(400).json({ error: "Search query is required" });
    }

    try {
        const result = await pool.query(
            `SELECT id, name, profile_pic 
             FROM users 
             WHERE name ILIKE $1 AND id != $2`,
            [`%${query}%`, userId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Error searching users:", error);
        res.status(500).json({ error: "Failed to search users" });
    }
});

// Get Users Who Have Had Conversations with Logged-in User
router.get("/users", authenticate, async (req, res) => {
    const userId = req.user.id;

    try {
        const result = await pool.query(
            `SELECT DISTINCT u.id, u.name, u.profile_pic 
             FROM users u
             JOIN messages m 
             ON u.id = m.sender_id OR u.id = m.receiver_id
             WHERE u.id != $1 AND (m.sender_id = $1 OR m.receiver_id = $1)`,
            [userId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// Update User Profile
router.post("/update-profile", authenticate, upload.single("profile_pic"), async (req, res) => {
    const { name } = req.body;
    const userId = req.user.id; // Retrieved from authentication middleware
    const profilePicPath = req.file ? req.file.filename : null;

    try {
        if (!name && !profilePicPath) {
            return res.status(400).json({ error: "No changes provided" });
        }

        // Update only the provided fields
        const updateFields = [];
        const values = [];
        
        if (name) {
            updateFields.push("name = $1");
            values.push(name);
        }
        if (profilePicPath) {
            updateFields.push("profile_pic = $" + (values.length + 1));
            values.push(profilePicPath);
        }

        values.push(userId);

        const query = `UPDATE users SET ${updateFields.join(", ")} WHERE id = $${values.length} RETURNING id, name, email, profile_pic`;
        const result = await pool.query(query, values);

        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ error: "Profile update failed" });
    }
});

// Serve Uploaded Files
router.use("/uploads", express.static("uploads"));

export default router;




// import express from "express";
// import bcrypt from "bcrypt";
// import db from "../db.js";
// import jwt from "jsonwebtoken";
// import dotenv from "dotenv";
// import multer from "multer";
// import path from "path";
// import fs from "fs";
// import authenticate from "./authMiddleware.js"; // Ensure correct path


// dotenv.config();
// const router = express.Router();
// const saltRounds = 10;

// // Ensure uploads directory exists
// const uploadDir = "uploads";
// if (!fs.existsSync(uploadDir)) {
//     fs.mkdirSync(uploadDir);
// }

// // File Upload Configuration (Only Accept Images)
// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, "uploads/");
//     },
//     filename: (req, file, cb) => {
//         const ext = path.extname(file.originalname);
//         cb(null, Date.now() + ext);
//     }
// });
// const fileFilter = (req, file, cb) => {
//     if (file.mimetype.startsWith("image/")) {
//         cb(null, true);
//     } else {
//         cb(new Error("Only image files are allowed!"), false);
//     }
// };
// const upload = multer({ storage, fileFilter });

// // User Registration with Profile Picture Upload
// router.post("/register", upload.single("profilepic"), async (req, res) => {
//     console.log("Received file:", req.file);
//     console.log("Received body:", req.body);
//     const { name, email, password } = req.body;
//     const profilePicPath = req.file ? req.file.filename : null;

//     try {
//         if (!name || !email || !password || !profilePicPath) {
//             return res.status(400).json({ error: "All fields are required" });
//         }

//         // Check if user already exists
//         const userCheck = await db.query("SELECT * FROM users WHERE email = $1", [email]);
//         if (userCheck.rows.length > 0) {
//             return res.status(400).json({ error: "Email already registered" });
//         }

//         // Hash password
//         const hashedPassword = await bcrypt.hash(password, saltRounds);

//         // Insert user into DB
//         const result = await db.query(
//             `INSERT INTO users (name, email, password, profile_pic, created_at) 
//              VALUES ($1, $2, $3, $4, NOW()) RETURNING id, name, email, profile_pic`,
//             [name, email, hashedPassword, profilePicPath]
//         );

//         res.status(201).json({ message: "User registered successfully", user: result.rows[0] });
//     } catch (error) {
//         console.error("Error inserting user:", error);
//         res.status(500).json({ error: "Registration failed" });
//     }
// });

// // Login User
// router.post("/login", async (req, res) => {
//     const { email, password } = req.body;

//     try {
//         if (!email || !password) {
//             return res.status(400).json({ error: "Email and password are required" });
//         }

//         const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
//         if (result.rows.length === 0) {
//             return res.status(401).json({ error: "Invalid email or password" });
//         }

//         const user = result.rows[0];
//         const isMatch = await bcrypt.compare(password, user.password);
//         if (!isMatch) {
//             return res.status(401).json({ error: "Invalid email or password" });
//         }

//         const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "7d" });
//         res.cookie("token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" });

//         res.status(200).json({
//             message: "Login successful",
//             user: { id: user.id, name: user.name, email: user.email, profile_pic: user.profile_pic },
//             token
//         });
//     } catch (error) {
//         console.error("Error logging in user:", error);
//         res.status(500).json({ error: "Login failed" });
//     }
// });

// // Logout User
// router.post("/logout", (req, res) => {
//     res.clearCookie("token");
//     res.json({ message: "Logged out successfully" });
// });

// // Get User Info from Token
// router.get("/me", (req, res) => {
//     const token = req.cookies.token;

//     if (!token) {
//         return res.status(401).json({ error: "Unauthorized" });
//     }

//     try {
//         const decoded = jwt.verify(token, process.env.JWT_SECRET);
//         db.query("SELECT id, name, email, profile_pic FROM users WHERE id = $1", [decoded.id])
//             .then((result) => {
//                 if (result.rows.length === 0) {
//                     return res.status(401).json({ error: "User not found" });
//                 }
//                 res.json({ ...result.rows[0], token });
//             })
//             .catch((err) => {
//                 console.error("Error fetching user info:", err);
//                 res.status(500).json({ error: "Failed to fetch user data" });
//             });
//     } catch (error) {
//         res.status(401).json({ error: "Invalid token" });
//     }
// });
// // Search Users by Name
// router.get("/search", authenticate, async (req, res) => {
//     const { query } = req.query;
//     const userId = req.user.id;

//     if (!query) {
//         return res.status(400).json({ error: "Search query is required" });
//     }

//     try {
//         const result = await db.query(
//             `SELECT id, name, profile_pic 
//              FROM users 
//              WHERE name ILIKE $1 AND id != $2`,
//             [`%${query}%`, userId]
//         );

//         res.json(result.rows);
//     } catch (error) {
//         console.error("Error searching users:", error);
//         res.status(500).json({ error: "Failed to search users" });
//     }
// });


// // Get All Users (For Chat App)
// // Get Users Who Have Had Conversations with Logged-in User
// router.get("/users", authenticate, async (req, res) => {
//     const userId = req.user.id;

//     try {
//         const result = await db.query(
//             `SELECT DISTINCT u.id, u.name, u.profile_pic 
//              FROM users u
//              JOIN messages m 
//              ON u.id = m.sender_id OR u.id = m.receiver_id
//              WHERE u.id != $1 AND (m.sender_id = $1 OR m.receiver_id = $1)`,
//             [userId]
//         );

//         res.json(result.rows);
//     } catch (error) {
//         console.error("Error fetching users:", error);
//         res.status(500).json({ error: "Failed to fetch users" });
//     }
// });

// // Update User Profile
// router.post("/update-profile", authenticate, upload.single("profile_pic"), async (req, res) => {
//     const { name } = req.body;
//     const userId = req.user.id; // Retrieved from authentication middleware
//     const profilePicPath = req.file ? req.file.filename : null;

//     try {
//         if (!name && !profilePicPath) {
//             return res.status(400).json({ error: "No changes provided" });
//         }

//         // Update only the provided fields
//         const updateFields = [];
//         const values = [];
        
//         if (name) {
//             updateFields.push("name = $1");
//             values.push(name);
//         }
//         if (profilePicPath) {
//             updateFields.push("profile_pic = $" + (values.length + 1));
//             values.push(profilePicPath);
//         }

//         values.push(userId);

//         const query = `UPDATE users SET ${updateFields.join(", ")} WHERE id = $${values.length} RETURNING id, name, email, profile_pic`;
//         const result = await db.query(query, values);

//         res.json({ success: true, user: result.rows[0] });
//     } catch (error) {
//         console.error("Error updating profile:", error);
//         res.status(500).json({ error: "Profile update failed" });
//     }
// });



// // Serve Uploaded Files
// router.use("/uploads", express.static("uploads"));

// export default router;
