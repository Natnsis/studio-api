import express, { Request, Response } from "express";
import ytdlp from "yt-dlp-exec";

const app = express();
app.use(express.json());

// 1. DYNAMIC PORT: Render provides the port via environment variables
const PORT = process.env.PORT || 3000;

app.post("/audio", async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url || (!url.includes("youtube.com") && !url.includes("youtu.be"))) {
      return res.status(400).json({ error: "Invalid YouTube URL" });
    }

    const info = await ytdlp(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificate: true, // Helps with some network-level blocks
      preferFreeFormats: true,
      addHeader: [
        'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language:en-US,en;q=0.9'
      ] as any,
      // IF THE BOT ERROR PERSISTS: 
      // 1. Export cookies.txt from browser
      // 2. Upload to Render Secret Files
      // 3. Uncomment the line below:
      // cookie: './cookies.txt' 
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
      (a: any, b: any) => (b.abr || 0) - (a.abr || 0)
    )[0];

    res.json({
      title: info.title,
      thumbnail: info.thumbnail,
      audioUrl: bestAudio.url,
    });

  } catch (error: any) {
    console.error("YT-DLP Error:", error.stderr || error.message);
    res.status(500).json({
      error: "Failed to extract audio",
      details: error.stderr?.includes("Sign in") ? "YouTube bot detection triggered" : "Internal Error"
    });
  }
});

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// 2. LISTEN ON 0.0.0.0: Required for Docker to communicate with the outside world
app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
