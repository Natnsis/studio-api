import express, { Request, Response } from "express";
import ytdlp from "yt-dlp-exec";
import { spawn, exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const app = express();
app.use(express.json());

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
        "User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language:en-US,en;q=0.9",
      ] as any,
      // IF THE BOT ERROR PERSISTS:
      // 1. Export cookies.txt from browser
      // 2. Upload to Render Secret Files
      // 3. Uncomment the line below:
      // cookie: './cookies.txt'
    });

    // Filter audio-only formats
    const audioFormats = info.formats.filter(
      (format: any) => format.acodec !== "none" && format.vcodec === "none",
    );

    if (audioFormats.length === 0) {
      return res.status(404).json({ error: "No audio formats found" });
    }

    // Get best quality audio
    const bestAudio = audioFormats.sort(
      (a: any, b: any) => (b.abr || 0) - (a.abr || 0),
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
      details: error.stderr?.includes("Sign in")
        ? "YouTube bot detection triggered"
        : "Internal Error",
    });
  }
});

app.get("/stream", (req: Request, res: Response) => {
  const url = req.query.url as string;

  if (!url || (!url.includes("youtube.com") && !url.includes("youtu.be"))) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  // Set the response headers for audio streaming
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Transfer-Encoding", "chunked");

  // Modern Chrome User-Agent
  const userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

  // Spawn yt-dlp with the specified flags to bypass blocks
  const ytDlp = spawn("yt-dlp", [
    "-4", // Force IPv4
    "--impersonate",
    "chrome", // Impersonate Chrome
    "--extractor-args",
    "youtube:player_client=android,web", // Mimic Android/Web clients
    "--user-agent",
    userAgent, // Modern Chrome User-Agent
    "-f",
    "bestaudio", // Best audio format
    "-o",
    "-", // Output to stdout
    "--no-playlist", // Ensure only one video is processed
    url,
  ]);

  // Pipe the audio stream directly to the response
  ytDlp.stdout.pipe(res);

  // Log stderr for debugging
  ytDlp.stderr.on("data", (data) => {
    console.error(`yt-dlp stderr: ${data}`);
  });

  // Handle process errors
  ytDlp.on("error", (err) => {
    console.error("Failed to start yt-dlp:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to start streaming process" });
    }
  });

  // Handle process exit
  ytDlp.on("close", (code) => {
    if (code !== 0) {
      console.error(`yt-dlp process exited with code ${code}`);
    }
    res.end();
  });

  // Cleanup: kill the process if the client disconnects
  req.on("close", () => {
    console.log("Client disconnected, killing yt-dlp process...");
    ytDlp.kill("SIGTERM");
  });
});

app.get("/health", async (req: Request, res: Response) => {
  const health: any = {
    status: "ok",
    dependencies: {
      ytdlp: { status: "unknown", version: null },
      ffmpeg: { status: "unknown", version: null },
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };

  // Check yt-dlp
  try {
    const { stdout } = await execAsync("yt-dlp --version");
    health.dependencies.ytdlp = { status: "ok", version: stdout.trim() };
  } catch (error) {
    health.status = "degraded";
    health.dependencies.ytdlp = { status: "error", error: "yt-dlp not found" };
  }

  // Check ffmpeg
  try {
    const { stdout } = await execAsync("ffmpeg -version");
    const firstLine = stdout.split("\n")[0];
    health.dependencies.ffmpeg = { status: "ok", version: firstLine };
  } catch (error) {
    health.status = "degraded";
    health.dependencies.ffmpeg = { status: "error", error: "ffmpeg not found" };
  }

  res.status(health.status === "ok" ? 200 : 503).json(health);
});

// 2. LISTEN ON 0.0.0.0: Required for Docker to communicate with the outside world
app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
