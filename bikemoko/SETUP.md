# Bikemoko setup guide

Do these in order. Each part tells you every click. Take your time.

---

## Part 1. Add the Android signing key to GitHub (10 minutes, do this first)

This makes the Android app "official", so future updates install over the old one.

You need the 3 files Claude sent you: `bikemoko.keystore`, `keystore-base64.txt`, `passwords.txt`.
First, save all 3 in Google Drive (make a folder called "Bikemoko keys"). Never share them.

1. On a computer, open **github.com/genestjan/genestjan** and sign in.
2. Click **Settings** (the gear tab near the top right of the repository page).
3. In the left menu, click **Secrets and variables**, then click **Actions**.
4. Make sure the **Secrets** tab is selected. Click the green **New repository secret** button.
5. In **Name**, type exactly: `BIKEMOKO_KEYSTORE_BASE64`
6. Open `keystore-base64.txt`, select everything (Ctrl + A), copy (Ctrl + C), and paste it into **Secret**.
7. Click **Add secret**.
8. Click **New repository secret** again. Name: `BIKEMOKO_KEYSTORE_PASSWORD`. Secret: the text after `BIKEMOKO_KEYSTORE_PASSWORD=` in `passwords.txt` (not the name, just the long password). Click **Add secret**.
9. Click **New repository secret**. Name: `BIKEMOKO_KEY_ALIAS`. Secret: `bikemoko`. Click **Add secret**.
10. Click **New repository secret**. Name: `BIKEMOKO_KEY_PASSWORD`. Secret: the same long password again. Click **Add secret**.
11. Tell Claude "keys added". Claude will rebuild the app. The file will then be called `Bikemoko.apk` instead of `Bikemoko-unsigned-test.apk`.

Important: do not install the "unsigned-test" APK on the shop phones. Wait for `Bikemoko.apk`.

---

## Part 2. Create the shared database on Supabase (20 minutes, free)

This lets the counter PC and every phone see the same stock and jobs.

1. Open **supabase.com** and click **Sign in** (use the same account as your Fetch app).
2. Click **New project**.
3. **Name**: `bikemoko`. **Database password**: click **Generate a password**, then copy it into your "Bikemoko keys" folder in Google Drive. **Region**: choose **Southeast Asia (Singapore)**. Click **Create new project**. Wait about 2 minutes.
4. In the left menu, click **SQL Editor** (the icon that looks like a page with `>_`).
5. Click **New query**.
6. Open this link in another tab: **github.com/genestjan/genestjan/blob/claude/vigilant-archimedes-hs65fw/bikemoko/supabase/schema.sql**. Click the **copy** icon (two squares) at the top right of the file.
7. Go back to Supabase, click inside the big empty box, paste (Ctrl + V), and click **Run** (bottom right). It should say **Success. No rows returned**.
8. In the left menu, click **Authentication**, then **Users**, then **Add user**, then **Create new user**.
9. Type the owner's email and a password. Tick **Auto Confirm User**. Click **Create user**. Write the email and password in your Google Drive folder.
10. Repeat step 8 and 9 for each device (for example: counter PC, mechanic phone, warehouse phone). One login per device is fine.
11. In the left menu, click **Project Settings** (the gear at the bottom), then **API** (or **Data API**).
12. Copy the **Project URL** (looks like `https://abcd.supabase.co`). Keep this tab open.

Now tell GitHub about the database:

13. Go back to **github.com/genestjan/genestjan**, click **Settings**, then **Secrets and variables**, then **Actions**.
14. Click the **Variables** tab (next to Secrets). Click **New repository variable**.
15. Name: `BIKEMOKO_SUPABASE_URL`. Value: the Project URL you copied. Click **Add variable**.
16. Back in Supabase on the same API page, copy the **anon public** key (a long text starting with `eyJ`).
17. In GitHub click **New repository variable**. Name: `BIKEMOKO_SUPABASE_ANON_KEY`. Value: paste the anon key. Click **Add variable**.
18. Tell Claude "Supabase added". Claude will rebuild the app with the database switched on.

---

## Part 3. Put the real shop data in (one time, on the counter PC)

1. Install the Windows app (Part 4) on the counter PC.
2. Open Bikemoko. Tap the **Owner** tile and type the PIN **1234**.
3. Go to **Settings**, then the **Data** tab. Click **Start fresh**, then **Yes, start fresh**. This removes the sample products, suppliers and customers but keeps your shop details and the labour price list.
4. In the same tab, use **Import products from CSV** and choose your product list. A ready template is in the repo at `bikemoko/products-template.csv`: open it in Google Sheets, fill one row per product, then **File, Download, Comma-separated values (.csv)**.
5. Go to **Settings**, then **Staff**. Add every real staff member with their own 4-digit PIN. Change the Owner PIN from 1234.
6. Go to **Settings**, then **Shop**. Fill in the shop phone and a **Device code**, for example `PC1`.
7. Go to **Settings**, then the **Cloud** tab. Sign in with the owner email and password from Part 2.
8. Click **This device is the first one: upload its data**, read the warning, and confirm. You are now the owner in the cloud.

On every other device (phones):

1. Install the app, open **Settings**, then **Cloud**, and sign in with that device's email and password.
2. Under **Link this login to a staff member**, pick the person who uses this phone, type their PIN, and press **Link**.
3. Go to **Settings**, then **Shop**, and give this device its own code, for example `PH1`, `PH2`.

---

## Part 4. Install the apps

**Windows (counter PC)**
1. Open **github.com/genestjan/genestjan/releases/download/bikemoko-windows/Bikemoko-Setup.exe**. The file downloads.
2. Double-click it. If a blue box says **Windows protected your PC**, click **More info**, then **Run anyway**. (This appears because the app is new, not because something is wrong.)
3. Click **Next** until it finishes. Bikemoko appears on the desktop.

**Android (staff phones)**
1. On the phone, open **github.com/genestjan/genestjan/releases/tag/bikemoko-android** in Chrome.
2. Tap **Bikemoko.apk** to download it.
3. Tap the downloaded file. If the phone says installs from this source are blocked, tap **Settings**, switch on **Allow from this source**, then tap back and **Install**.
4. Open Bikemoko and allow the camera when it asks (for barcode scanning).

---

## Part 5. Before the first real sale

- Ask Bikemoko's accountant if the printed receipt needs BIR registration. Until then every receipt says "This is not an official receipt / BIR invoice."
- Do a test day: run 3 sales and 1 repair from estimate to billing, then check the stock counts.
