# Runs on Kaggle's free GPU (T4). AI-upscales /kaggle/input/<dataset>/in.mp4 with Real-ESRGAN (movies)
# or realesr-animevideov3 (anime), via spandrel. Writes out_1080.mp4 (1080x1920) and out_4k.mp4 (2160x3840)
# to /kaggle/working. Settings come from settings.json next to the video.
import glob, json, os, subprocess, sys, time
subprocess.run([sys.executable, "-m", "pip", "install", "-q", "spandrel"], check=True)
import numpy as np, torch
from spandrel import ModelLoader

src = glob.glob("/kaggle/input/**/in.mp4", recursive=True)[0]
cfg = json.load(open(os.path.join(os.path.dirname(src), "settings.json")))
URLS = {
    "movie": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
    "anime": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-animevideov3.pth",
}
w = "/kaggle/working/model.pth"
subprocess.run(["wget", "-q", "-O", w, URLS[cfg.get("model", "movie")]], check=True)
model = ModelLoader().load_from_file(w).cuda().eval().half()

probe = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate", "-of", "json", src], capture_output=True, text=True).stdout)["streams"][0]
W, H, fps = probe["width"], probe["height"], probe["r_frame_rate"]
S = model.scale
print(f"input {W}x{H} @ {fps}, model {cfg.get('model')} x{S}", flush=True)

dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", src, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
def enc(path, w2, h2, crf, rate):
    return subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W*S}x{H*S}", "-r", fps, "-i", "-",
        "-i", src, "-map", "0:v", "-map", "1:a?", "-vf", f"scale={w2}:{h2}:flags=lanczos,format=yuv420p",
        "-c:v", "libx264", "-profile:v", "high", "-preset", "medium", "-crf", str(crf), "-maxrate", rate, "-bufsize", rate,
        "-c:a", "copy", "-movflags", "+faststart", "-shortest", path], stdin=subprocess.PIPE)
tw, th = (1080, 1920) if H > W else (1920, 1080)
outs = [enc("/kaggle/working/out_1080.mp4", tw, th, 18, "5M"), enc("/kaggle/working/out_4k.mp4", tw * 2, th * 2, 18, "16M")]
n, t0, fb = 0, time.time(), W * H * 3
with torch.inference_mode():
    while True:
        buf = dec.stdout.read(fb)
        if len(buf) < fb: break
        x = torch.from_numpy(np.frombuffer(buf, np.uint8).reshape(H, W, 3).copy()).cuda().permute(2, 0, 1).unsqueeze(0).half() / 255
        y = (model(x).clamp(0, 1) * 255).round().byte().squeeze(0).permute(1, 2, 0).contiguous().cpu().numpy().tobytes()
        for o in outs: o.stdin.write(y)
        n += 1
        if n % 100 == 0: print(f"{n} frames, {n / (time.time() - t0):.1f} fps", flush=True)
for o in outs: o.stdin.close(); o.wait()
os.remove(w)
print(f"done: {n} frames in {time.time() - t0:.0f}s", flush=True)
