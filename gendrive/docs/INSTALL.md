# How to put GenDrive on your BYD

Follow the steps in order. Each step is one small thing. Take your time.

**Before you start**

- The car must be **parked**, in **P**, with the screen **on**.
- You need: a **USB stick** (any size), and a **phone or computer** with internet.
- Installing apps that BYD did not approve may affect the warranty of the screen
  (the infotainment). GenDrive only *reads* car information. It never changes how
  the car drives, brakes or steers.

---

## Part 1: Download GenDrive

1. On your phone or computer, open this link:
   `https://github.com/genestjan/genestjan/releases/download/gendrive-android/GenDrive.apk`
2. If GitHub asks you to sign in, sign in with your GitHub account.
3. A file called **GenDrive.apk** downloads. That file *is* the app.

## Part 2: Put GenDrive on the USB stick

1. Plug the USB stick into your computer.
2. Open the USB stick (on Windows: open **This PC**, then double-click the USB stick).
3. Make a new folder on the stick:
   - Windows: right-click an empty space, click **New**, then **Folder**.
   - Mac: right-click an empty space, click **New Folder**.
4. Name the folder exactly like this, with the spaces:

   **`Third Party Apps 63`**

   (63 is the Philippines. Other countries use their phone code, for example
   `Third Party Apps 66` for Thailand.)
5. Copy **GenDrive.apk** into that folder.
6. Eject the stick safely (Windows: right-click the stick, click **Eject**).

## Part 3: Install it in the car

1. Sit in the car. Press the brake and switch the car on. Keep it in **P**.
2. Plug the USB stick into the car's USB port. Use the port that plays music,
   usually in the front centre console.
3. Wait about 10 seconds.
4. A box asks for a **password**. Type: **`BYD6125F`**
   (capital letters, then tap **OK**).
5. A list appears. Tap **GenDrive.apk**.
6. Tap **Install**.
7. When it says **App installed**, tap **Open**.

**Nothing popped up?** Try these, one at a time:

- Unplug the stick, wait 5 seconds, plug it in again.
- Rename the folder to **`Application Installation 63`** and try again.
  (Some countries use this name instead. BYD then checks the app online, so the
  car needs internet.)
- Still nothing: your car's software may block USB installs. See **Part 7**.

> Where the folder name and password come from: public research on BYD's own
> installer (github.com/wheregoes/byd-dolphin-hacking). They work on DiLink 3 cars
> sold outside China. The Philippines is not documented yet, so tell us which name
> worked for you.

## Part 4: First-time setup (10 minutes, once)

GenDrive opens. On the left (on your side) there is a bar with big buttons.

1. Tap **Settings** (the gear, near the bottom of the left bar).
2. At the top you see the **Setup checklist**. Each line has a green tick
   (done) or an orange mark (not done).
3. For each orange line, tap **Allow**. Android's own settings page opens:
   - Find **GenDrive** in the list.
   - Switch it **on**.
   - Press the car's **Back** button to return to GenDrive.
4. The microphone line asks with a small window: tap **Allow**.
5. If a settings page does not open (BYD hides some of them), skip it.
   Part 6 fixes those with one button.
6. If you see **Let GenDrive start with the car**, tap **Allow**. BYD's own
   *autostart* list opens. Find **GenDrive** and switch it **on**. Now the
   greeting and the trip log start by themselves every time you start the car.

Now tell GenDrive about you:

7. **Your name**: type your first name. The assistant greets you with it.
8. **Car**: tap **Change** and pick your car, for example
   *eMAX 7 / M6 Standard (55.4 kWh)*.
9. **Money**: type your electricity price per kWh (look at your Meralco or
   co-op bill) and the petrol price per litre. GenDrive uses these to show
   what each trip cost and how much you saved against petrol.

## Part 5: Meet the voice assistant

1. Still in **Settings**, find **Voice assistant**.
2. Tap **Hear a sample**. The assistant says hello.
3. Don't like the voice? Tap **Choose voice** and pick another. British English
   voices sound the most like a calm butler.
4. Talk to it: tap the round **purple button** at the bottom of the left bar,
   then speak. Try:
   - "Take me home"
   - "Find a charging station"
   - "Next song"
   - "Battery status"

**Want real conversations? Add a free Gemini key (optional)**

1. On your phone, open **aistudio.google.com/apikey**.
2. Sign in with your Google account.
3. Tap **Create API key**. Copy the long code it shows.
4. In GenDrive: **Settings**, **Voice assistant**, tap the box
   **Gemini API key** and paste or type the code.
5. Tap the purple button and ask anything, for example
   "How far can I go on this battery?" or "Find a coffee shop near me".

Good to know: your voice clip and the car status go to Google to get the answer.
On Google's free tier, Google may use them to improve its products.

## Part 6: One-tap setup with ADB (for the hidden settings)

Some BYD cars hide the settings GenDrive needs. ADB is the car's developer
connection, and it lets GenDrive switch them on for itself.

1. Wireless ADB must be switched on in the car's hidden developer menu.
   This needs a code made from your car's IMEI number. Follow the steps in
   github.com/wheregoes/byd-dolphin-hacking/blob/master/docs/sideloading-guide.md
   (Method 2, Step 1). Do this parked.
2. In GenDrive: **Settings**, **Setup checklist**, tap **Fix everything with ADB**.
3. The car asks **Allow USB debugging?** Tick **Always allow from this computer**
   and tap **Allow**.
4. GenDrive shows "Done". All the lines in the checklist turn green within a
   couple of seconds.

## Part 7: If the USB stick method is blocked

Newer BYD software can block installs from USB. Then:

1. Switch on Wireless ADB (Part 6, step 1).
2. On a laptop, install Android's free **platform-tools** from
   developer.android.com/tools/releases/platform-tools.
3. Connect the laptop to the car's Wi-Fi hotspot.
4. Open a terminal (Windows: PowerShell) in the platform-tools folder and type:

   ```
   adb connect 192.168.10.10:5555
   ```

5. On the car screen, tap **Allow**.
6. Type:

   ```
   adb install GenDrive.apk
   ```

7. It says **Success**. GenDrive is on the car.

## Part 8: Updating GenDrive

1. Download the newest **GenDrive.apk** from the same link as Part 1.
2. Do Part 2 and Part 3 again. Your trips and settings stay.

## Part 9: Removing GenDrive

1. If you switched on **Use GenDrive as the home screen**, switch it **off** first
   (Settings, Units and display).
2. Open the car's **Settings**, then **Apps**, tap **GenDrive**, tap **Uninstall**.

## Questions

**The greeting didn't play when I started the car.**
BYD stops apps from starting by themselves until you allow it. Do Part 4, step 6
(the autostart list), or open GenDrive once after starting the car. Setting
GenDrive as the home screen (Settings, Units and display) also starts it with the car.

**Can GenDrive cause an accident or stop the car?**
No. GenDrive only reads information. Braking, steering and the motor are run by
separate computers that GenDrive cannot send commands to. If GenDrive closed
unexpectedly, the car's own screens keep working.

**Why does YouTube show "Audio only while moving"?**
Watching video while driving is the most dangerous thing a driver can do with a
screen. GenDrive keeps the sound playing (great for podcasts and music videos)
and shows the picture again the moment you shift to **P**.

**Does GenDrive send my data anywhere?**
No. Trips and settings stay in the car. The only things that go online are
lyrics lookups (song title and artist, to LRCLIB) and, if you add a Gemini key,
your spoken question (to Google).
