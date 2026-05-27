import express from "express";
import path from "path";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";
import QRCode from "qrcode";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import PDFDocument from "pdfkit";

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

/**
 * Generates a super polished, premium, professional corporate-style A4 PDF Invoice/Receipt
 */
function createInvoicePDF(outputPath: string, data: any): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 40 });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Color Palette
      const primaryColor = "#0f172a"; // slate-900 (deep dark blue-gray)
      const accentColor = "#16a34a"; // green-600 (rich dark green for branding/paid status)
      const grayLight = "#f8fafc";   // slate-50 (super light gray for table headers and panels)
      const borderGray = "#cbd5e1";  // slate-300 (subtle separator colors)
      const grayText = "#64748b";    // slate-500 (readable body text contrast)

      // Header - Brand Name & Verified Tag
      doc.fillColor(primaryColor).fontSize(22).font('Helvetica-Bold').text(data.libraryName.toUpperCase(), 40, 45);
      doc.fillColor(accentColor).fontSize(10).font('Helvetica-Bold').text("OFFICIAL RECEIPT // VERIFIED STATUS", 40, 72);

      // Invoice Meta (Receipt Top Right)
      doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text(`Invoice No: ${data.invoiceNo}`, 380, 45, { align: 'right' });
      doc.fillColor(grayText).fontSize(9).font('Helvetica').text(`Date: ${data.date}`, 380, 60, { align: 'right' });
      doc.fillColor(grayText).fontSize(9).font('Helvetica').text(`UPI ID: ${data.upiId}`, 380, 75, { align: 'right' });

      // Dotted Separator line
      doc.strokeColor(borderGray).lineWidth(1).moveTo(40, 100).lineTo(555, 100).stroke();

      // Section: Tax Invoice / Bill of Supply
      doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text("TAX INVOICE / BILL OF SUPPLY", 40, 120, { align: 'center', width: 515 });

      // SOLD BY (PROVIDER) Details Box
      doc.roundedRect(40, 150, 245, 110, 8).fillAndStroke(grayLight, borderGray);
      doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text("SOLD BY (PROVIDER)", 53, 162);
      doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text(data.libraryName, 53, 178);
      doc.fillColor(grayText).fontSize(9).font('Helvetica').text("Self-Study Digital Zone", 53, 195);
      doc.fillColor(grayText).fontSize(9).font('Helvetica').text("Hariharpur, India", 53, 210);

      // BILLED TO (RECEIVER) Details Box
      doc.roundedRect(310, 150, 245, 110, 8).fillAndStroke(grayLight, borderGray);
      doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text("BILLED TO (RECEIVER)", 323, 162);
      doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold').text(data.studentName, 323, 178);
      doc.fillColor(grayText).fontSize(9).font('Helvetica').text(`Phone: +91 ${data.phone}`, 323, 195);
      doc.fillColor("#2563eb").fontSize(9).font('Helvetica-Bold').text(`Assigned Desk: ${data.seat || 'Unassigned'}`, 323, 210);

      // Description table details
      // Draw table header
      doc.roundedRect(40, 285, 515, 25, 4).fillAndStroke("#f1f5f9", "#cbd5e1");
      doc.fillColor(grayText).fontSize(9).font('Helvetica-Bold').text("DESCRIPTION OF STUDY ACCESS SERVICE", 53, 293);
      doc.fillColor(grayText).fontSize(9).font('Helvetica-Bold').text("DESK", 330, 293, { width: 50, align: 'center' });
      doc.fillColor(grayText).fontSize(9).font('Helvetica-Bold').text("DURATION", 390, 293, { width: 80, align: 'center' });
      doc.fillColor(grayText).fontSize(9).font('Helvetica-Bold').text("NET AMOUNT", 480, 293, { width: 65, align: 'right' });

      // Table Content Line
      doc.strokeColor(borderGray).lineWidth(1).moveTo(40, 320).lineTo(555, 320).stroke();
      doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text("Aaradhya Library Study Slot Reserved Access", 53, 335);
      doc.fillColor(grayText).fontSize(8).font('Helvetica').text("Includes high speed Wi-Fi, fully responsive cooling, secure power outlets, and a tranquil clean cabin space.", 53, 350);
      
      const safeDeskNum = data.seat.replace('#', '').replace('Desk', '').trim();
      doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text(`Desk #${safeDeskNum}`, 330, 335, { width: 50, align: 'center' });
      doc.fillColor(primaryColor).fontSize(10).font('Helvetica').text(`${data.duration} Month(s)`, 390, 335, { width: 80, align: 'center' });
      doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text(`INR ${data.amount}.00`, 480, 335, { width: 65, align: 'right' });

      // Table divider line at bottom
      doc.strokeColor(primaryColor).lineWidth(1.2).moveTo(40, 380).lineTo(555, 380).stroke();

      // Bottom Left Card: Validity block
      doc.roundedRect(40, 405, 245, 95, 8).fillAndStroke("#ecfdf5", "#a7f3d0");
      doc.fillColor(accentColor).fontSize(10).font('Helvetica-Bold').text("STUDY VALIDITY PERIOD", 52, 417);
      doc.fillColor(accentColor).fontSize(12).font('Helvetica-Bold').text(`Valid Till: ${data.validTill}`, 52, 435);
      doc.fillColor(grayText).fontSize(8).font('Helvetica').text("Your continuous validity remains active till the above date. Please clear dues in advance to avoid seat eviction.", 52, 455, { width: 220 });

      // Bottom Right Card: Amount summary block
      doc.roundedRect(310, 405, 245, 95, 8).stroke(borderGray);
      doc.fillColor(grayText).fontSize(9).font('Helvetica').text("Subtotal amount:", 320, 417);
      doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text(`INR ${data.amount}.00`, 460, 417, { align: 'right', width: 85 });
      
      doc.fillColor(grayText).fontSize(9).font('Helvetica').text("Total Discount:", 320, 432);
      doc.fillColor(accentColor).fontSize(9).font('Helvetica-Bold').text(`INR 0.00 (Promo Off)`, 430, 432, { align: 'right', width: 115 });

      doc.strokeColor("#e2e8f0").lineWidth(1).moveTo(310, 450).lineTo(555, 450).stroke();

      doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text("Grand Net Total Paid:", 320, 458);
      doc.fillColor("#2563eb").fontSize(12).font('Helvetica-Bold').text(`INR ${data.amount}.00`, 460, 458, { align: 'right', width: 85 });

      // Draw Paid Stamp Badge (dotted green outline box with slanted green text "PAID STAMP")
      doc.strokeColor(accentColor).lineWidth(1.5).rect(360, 477, 150, 16).stroke();
      doc.fillColor(accentColor).fontSize(8).font('Helvetica-Bold').text("** PAID STAMP AUTHORIZED **", 360, 481, { align: 'center', width: 150 });

      // Clean footer info
      doc.strokeColor(borderGray).lineWidth(0.5).moveTo(40, 520).lineTo(555, 520).stroke();
      doc.fillColor(grayText).fontSize(8).font('Helvetica').text(`This is a computer-generated transaction receipt representing official seat acquisition registry in ${data.libraryName}. No signature is required.`, 40, 530, { align: 'center', width: 515 });

      doc.end();

      stream.on('finish', () => resolve());
      stream.on('error', (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

// --- API ROUTES ---

app.post("/api/send-message", upload.single("photo"), async (req, res) => {
  const { 
    phone, 
    message, 
    sendQR, 
    amount, 
    studentName, 
    upiId, 
    upiName,
    sendPDF,
    invoiceNo,
    date,
    duration,
    seat,
    validTill,
    libraryName
  } = req.body;
  const photo = req.file;

  if (!INSTANCE_ID || !API_TOKEN) {
    if (photo) {
      try { fs.unlinkSync(photo.path); } catch (e) {}
    }
    return res.status(400).json({ 
      error: "WhatsApp API credentials are not configured. Please supply GREEN_API_INSTANCE_ID and GREEN_API_TOKEN in your Google AI Studio Settings." 
    });
  }

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

    // 4. Send PDF Invoice (if requested)
    if (sendPDF === "true") {
      const cleanInvoiceNo = (invoiceNo || `INV-${Date.now().toString().substring(6)}`).replace(/\s+/g, '_');
      const pdfPath = path.join(process.cwd(), "uploads", `Invoice_${cleanInvoiceNo}.pdf`);
      
      // Generate corporate PDF invoice using pdfkit
      await createInvoicePDF(pdfPath, {
        invoiceNo: invoiceNo || `INV-${Date.now().toString().substring(6)}`,
        date: date || new Date().toLocaleDateString('en-IN'),
        upiId: currentUPI,
        studentName: studentName || "Student",
        phone: phone,
        seat: seat || "Unassigned",
        duration: duration || "1",
        amount: amount || "0",
        validTill: validTill || "N/A",
        libraryName: libraryName || currentName || "Aaradhya Digital Library"
      });

      const pdfName = `Invoice_${invoiceNo || "Receipt"}.pdf`;
      results.push(await sendFile(chatId, pdfPath, pdfName));
      
      // Cleanup
      try { fs.unlinkSync(pdfPath); } catch (e) {}
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
