import express from "express";
import path from "path";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";
import QRCode from "qrcode";
import { createServer as createViteServer } from "vite";
import fs from "fs";

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer setup for temporary storage
const upload = multer({ dest: "uploads/" });

// --- CONFIG --- (These should be in .env)
const INSTANCE_ID = process.env.GREEN_API_INSTANCE_ID;
const API_TOKEN = process.env.GREEN_API_TOKEN;
const UPI_ID = process.env.UPI_ID || "example@okicici";
const UPI_NAME = process.env.UPI_NAME || "Aaradhya Library";

const BASE_URL = `https://api.green-api.com/waInstance${INSTANCE_ID}`;

// --- HELPERS ---

/**
 * Sends a file via Green API using the file upload method
 */
async function sendFile(chatId: string, filePath: string, fileName: string) {
  const url = `${BASE_URL}/sendFileByUpload/${API_TOKEN}`;
  const form = new FormData();
  form.append("chatId", chatId);
  form.append("file", fs.createReadStream(filePath), fileName);

  try {
    const response = await axios.post(url, form, {
      headers: { ...form.getHeaders() },
    });
    return response.data;
  } catch (error: any) {
    console.error("Error sending file:", error.response?.data || error.message);
    throw error;
  }
}

/**
 * Sends a text message
 */
async function sendText(chatId: string, message: string) {
  const url = `${BASE_URL}/sendMessage/${API_TOKEN}`;
  try {
    const response = await axios.post(url, { chatId, message });
    return response.data;
  } catch (error: any) {
    console.error("Error sending text:", error.response?.data || error.message);
    throw error;
  }
}

// --- API ROUTES ---

app.post("/api/send-message", upload.single("photo"), async (req, res) => {
  const { phone, message, sendQR, amount, studentName, upiId, upiName } = req.body;
  const photo = req.file;

  if (!phone) return res.status(400).json({ error: "Phone is required" });

  const cleanPhone = phone.replace(/\D/g, "");
  const chatId = cleanPhone.length === 10 ? `91${cleanPhone}@c.us` : `${cleanPhone}@c.us`;

  // Use passed config or fallback to env vars
  const currentUPI = upiId || UPI_ID;
  const currentName = upiName || UPI_NAME;

  try {
    const results = [];

    // 1. Send Main Message
    if (message) {
      results.push(await sendText(chatId, message));
    }

    // 2. Send Photo (if uploaded)
    if (photo) {
      results.push(await sendFile(chatId, photo.path, photo.originalname));
      // Cleanup
      fs.unlinkSync(photo.path);
    }

    // 3. Send QR Code (if requested)
    if (sendQR === "true" && amount) {
      const upiLink = `upi://pay?pa=${currentUPI}&pn=${encodeURIComponent(currentName)}&am=${amount}&cu=INR&tn=${encodeURIComponent("Fee for " + (studentName || "Student"))}`;
      const qrPath = path.join(process.cwd(), "uploads", `qr_${Date.now()}.png`);
      await QRCode.toFile(qrPath, upiLink, { width: 400 });
      
      results.push(await sendFile(chatId, qrPath, "Payment_QR.png"));
      // Cleanup
      fs.unlinkSync(qrPath);
    }

    res.json({ success: true, results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- VITE SETUP ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Create uploads dir if not exists
  if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
