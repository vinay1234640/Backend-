const express = require("express");
const multer = require("multer");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

require("dotenv").config();

const app = express();
const upload = multer({ dest: "uploads/" });
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function callGemini(base64Content) {
  const body = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: "image/png",
              data: base64Content,
            },
          },
        ],
      },
    ],
  };

  const response = await axios.post(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=" + GEMINI_API_KEY,
    body,
    {
      headers: { "Content-Type": "application/json" },
    }
  );

  return response.data.candidates[0].content.parts[0].text;
}

async function pdfToImages(pdfPath) {
  return new Promise((resolve, reject) => {
    // Use pdftoppm (from poppler-utils) to convert each PDF page to PNG
    exec(`pdftoppm -png "${pdfPath}" uploads/page`, (error, stdout, stderr) => {
      if (error) return reject(error);
      fs.readdir("uploads", (err, files) => {
        if (err) return reject(err);
        const images = files
          .filter((f) => f.endsWith(".png"))
          .map((f) => path.join("uploads", f));
        resolve(images);
      });
    });
  });
}

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).send("No file uploaded");

    let results = [];

    if (file.mimetype === "application/pdf") {
      // Convert PDF → PNG pages
      const images = await pdfToImages(file.path);
      for (const imgPath of images) {
        const base64 = fs.readFileSync(imgPath).toString("base64");
        const result = await callGemini(base64);
        results.push(result);
      }
    } else {
      // Directly send image as base64
      const base64 = fs.readFileSync(file.path).toString("base64");
      const result = await callGemini(base64);
      results.push(result);
    }

    res.json({ text: results.join("\n\n") });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Optional health check on GET /
app.get("/", (req, res) => {
  res.send("AI backend is working.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
