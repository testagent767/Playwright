import express from "express";
import { chromium } from "playwright";
import { exec } from "child_process";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json());

app.post("/render-video", async (req, res) => {
  const { url } = req.body;

  const framesDir = "./frames";

  if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir);
  }

  try {
    const browser = await chromium.launch({
      args: ["--no-sandbox"]
    });

    const page = await browser.newPage();

    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.renderReady === true);

    // 🎬 CAPTURE FRAMES
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(500);

      await page.screenshot({
        path: `${framesDir}/frame_${String(i).padStart(3, "0")}.png`
      });
    }

    await browser.close();

    // 🎥 CREATE VIDEO
    const outputVideo = "output.mp4";

    const ffmpegCmd = `
      ffmpeg -y -framerate 5 -i ${framesDir}/frame_%03d.png \
      -c:v libx264 -pix_fmt yuv420p ${outputVideo}
    `;

    exec(ffmpegCmd, (error) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ error: "FFmpeg failed" });
      }

      // send video
      res.download(outputVideo);
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log("Server running"));
