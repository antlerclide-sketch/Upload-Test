# TikTok WebTool (OPEN-SOURCE)

Stop TikTok from ruining your video quality. This tool patches your MP4 files so TikTok thinks they are already high quality and leaves them alone.

**Everything happens in your browser. Nothing gets uploaded to any server.**

---

## What this does

When you Post a video, TikTok compresses it and makes it look bad (540p).

This tool tricks TikTok by editing the video's internal metadata. The video itself stays exactly the same. TikTok then says "oh this is already high quality" and gives you 1080p60/your video's resolution/fps.

---

## How to use (super simple okay)

### Step 1: Find your video

### Step 2: Open the web tool

Go to

### Step 3: Drop your video

Drag your MP4 file onto the page. Wait a few seconds.

### Step 4: Download the patched video

Click "Download patched video". You now have a file named something like `video_tiktok.mp4`.

### Step 5: Upload to TikTok

Upload that patched file to TikTok. It should now be your video's resolution (for example 1080p60) instead of blurry compressed 540p.

That's it. No apps to install. No Nothing

---

## Chrome Extension (coming soon MAYBE)

A Chrome extension is being made that will add a button right on TikTok's website so you can patch videos without going to the web tool. It is not ready yet.

**Auto-upload** (where it uploads directly to TikTok for you) is also not ready yet. For now you have to download the patched file and upload it yourself.

---

## What if it doesn't work?

- Make sure the file ends in `.mp4`
- Try downloading a fresh video from TikTok (not one you already edited)
- If you get an error message, tell me about it on GitHub or join my discord server: discord.gg/9hw9xJbFJ5

---

## Files in this project

```
tiktok-webtool/
  webtool/
    index.html          The web tool. Open this in your browser.
  extension/            //coming soon
    manifest.json       Tells Chrome what the extension does.
    content.js          The code that runs on TikTok pages.
    icon128.png         The icon for the extension.
```

---

## Made by

**paschafps** - github.com/paschafps

---

## License

Free to use, modify, and share (MIT License).

---

## Disclaimer

This is for learning purposes. Use it at your own risk. I am not responsible if TikTok does something about it.
