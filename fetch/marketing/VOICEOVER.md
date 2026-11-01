# Video sound: music, sound effects and George's voice

## What is already in the videos

- **Music:** an original 120 BPM electronic track in A minor, made in code by `audio.py`. No
  samples and no licence needed, so it is safe for Facebook, TikTok and YouTube.
- **Sound effects:**
  - a riser, an impact and a shimmer on the logo reveal (timed to the headlight flash)
  - a whoosh on every scene change
  - a tap pop on every tap, typing ticks while text is typed
  - a chime when a booking is accepted or arrives

## Adding George's voice (one-time setup, about 5 minutes)

George is the ElevenLabs stock voice "George" (a warm British male voice). The words he says
are already written and timed to the videos, in `tracks/*-voice.json`. A GitHub workflow sends
them to ElevenLabs, lowers the music under his voice and publishes the finished videos.

Cost: the three videos use about 4,600 characters. The ElevenLabs free plan gives 10,000 a
month, but its terms require credit to ElevenLabs and do not allow commercial use. For ads, use
the Starter plan (about US$5 a month), which allows commercial use.

### Step 1. Get your ElevenLabs key

1. Open https://elevenlabs.io and click **Sign up**. Sign up with your Google account.
2. (For ads) Click your name at the bottom left, then **Subscription**, then choose **Starter**.
3. Click your name at the bottom left again, then **API Keys**.
4. Click **Create API Key**. Name it `fetch-gensan`. Click **Create**.
5. Click **Copy**. Keep this tab open.

### Step 2. Put the key in GitHub

1. Open https://github.com/genestjan/genestjan/settings/secrets/actions
2. Click the green **New repository secret** button.
3. In **Name**, type exactly: `ELEVENLABS_API_KEY`
4. In **Secret**, paste the key (Ctrl+V on Windows, Cmd+V on Mac).
5. Click **Add secret**.

### Step 3. Make the videos

1. Open https://github.com/genestjan/genestjan/actions/workflows/fetch-videos.yml
2. Click **Run workflow** (grey button on the right). In **Use workflow from**, pick the branch
   `claude/eager-albattani-r8obaq` (or `main` after merging). Click the green **Run workflow**.
3. Wait about 5 minutes until the circle turns into a green tick.
4. Download the finished videos:
   - https://github.com/genestjan/genestjan/releases/download/fetch-videos/FetchGenSan-marketing.mp4
   - https://github.com/genestjan/genestjan/releases/download/fetch-videos/FetchGenSan-customer-tutorial.mp4
   - https://github.com/genestjan/genestjan/releases/download/fetch-videos/FetchGenSan-driver-tutorial.mp4

### Changing what George says

Open `fetch/marketing/tracks/marketing-voice.json` (or the customer or driver file) on GitHub,
click the pencil icon, change the `text` of any line, and click **Commit changes**. The videos
are rebuilt automatically, and you only pay for the lines you changed. Keep each line about the
same length, or George will speak a little faster to fit.

Spelling tips: write words the way they should sound, e.g. "Gen San", "G Cash", "A P K".
