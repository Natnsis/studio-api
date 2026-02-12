import express, { Request, Response } from "express";
import ytdlp from "yt-dlp-exec";

const app = express();
app.use(express.json());

const PORT = 3000;

app.post("/audio", async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url || !url.includes("youtube.com") && !url.includes("youtu.be")) {
      return res.status(400).json({ error: "Invalid YouTube URL" });
    }

    const info = await ytdlp(url, {
      dumpSingleJson: true,
      noWarnings: true
    });

    // Filter audio-only formats
    const audioFormats = info.formats.filter(
      (format: any) => format.acodec !== "none" && format.vcodec === "none"
    );

    if (audioFormats.length === 0) {
      return res.status(404).json({ error: "No audio formats found" });
    }

    // Get best quality audio
    const bestAudio = audioFormats.sort(
      (a: any, b: any) => b.abr - a.abr
    )[0];

    res.json({
      title: info.title,
      audioUrl: bestAudio.url,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to extract audio" });
  }
});

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
