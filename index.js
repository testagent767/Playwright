import express from "express";
import { chromium } from "playwright";
import { exec } from "child_process";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json());

app.post("/render-video", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "Missing required field: url" });
  }

  const framesDir = "./frames";

  if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir);
  }

  let browser;
  try {
    console.log(`[render-video] Launching browser for: ${url}`);
    browser = await chromium.launch({
      args: ["--no-sandbox"]
    });

    const page = await browser.newPage();

    console.log(`[render-video] Navigating to ${url} (timeout: 60s, waitUntil: networkidle)`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

    // Give animations and dynamic content a moment to settle
    console.log("[render-video] Page loaded — waiting 2s for animations to settle");
    await page.waitForTimeout(2000);

    // 🎬 CAPTURE FRAMES
    console.log("[render-video] Capturing 20 frames...");
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(500);

      const framePath = `${framesDir}/frame_${String(i).padStart(3, "0")}.png`;
      await page.screenshot({ path: framePath });
      console.log(`[render-video] Captured frame ${i + 1}/20`);
    }

    await browser.close();
    browser = null;
    console.log("[render-video] Browser closed");

    // 🎥 CREATE VIDEO
    const outputVideo = "output.mp4";

    const ffmpegCmd = `ffmpeg -y -framerate 5 -i ${framesDir}/frame_%03d.png -c:v libx264 -pix_fmt yuv420p ${outputVideo}`;

    console.log(`[render-video] Running ffmpeg: ${ffmpegCmd}`);
    exec(ffmpegCmd, (error, stdout, stderr) => {
      if (error) {
        console.error("[render-video] FFmpeg error:", error.message);
        console.error("[render-video] FFmpeg stderr:", stderr);
        return res.status(500).json({ error: "FFmpeg failed", details: error.message });
      }

      console.log("[render-video] Video created successfully, sending response");
      res.download(outputVideo);
    });

  } catch (err) {
    console.error("[render-video] Unexpected error:", err.message);
    if (browser) {
      await browser.close().catch((closeErr) =>
        console.error("[render-video] Failed to close browser:", closeErr.message)
      );
    }
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log("Server running"));
