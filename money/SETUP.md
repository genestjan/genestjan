# Money Hub: setting it up

Follow the parts in order. Each step is one small action. Doing them all takes about 45 minutes,
once. After that the phone and laptop look after themselves.

What you need: your laptop, your Samsung phone, your GitHub login, about 45 minutes.

---

## Part 0. Lock your Google Sheet first (5 minutes)

Your budget sheet is shared as "anyone with the link can **edit**". Anyone who gets the link can
read and change your family's finances.

1. Open the budget sheet in Chrome on the laptop.
2. Make sure you are logged in as the Google account that owns it (ayakent@gmail.com). If you
   are not, click your picture at the top right and switch account.
3. Click the **Share** button at the top right.
4. Find the part called **General access**. It says **Anyone with the link**.
5. Click **Anyone with the link** and choose **Restricted**.
6. Click **Done**.

Now only people you add by name can open it.

---

## Part 1. Give GitHub the app's signing key (5 minutes)

Android only installs an update if it is signed with the same key as the app already on the
phone. Claude made a key for you and sent you two small text files:
`MONGGOLS_KEYSTORE_BASE64.txt` and `MONGGOLS_KEYSTORE_PASSWORD.txt`.
(The same key also fixes the Monggols VPN Android build.)

1. On the laptop, open this page:
   https://github.com/genestjan/genestjan/settings/secrets/actions
2. Click the green button **New repository secret**.
3. In the **Name** box, type exactly: `MONGGOLS_KEYSTORE_BASE64`
4. Open the file `MONGGOLS_KEYSTORE_BASE64.txt` (double-click it; it opens in Notepad).
5. Press **Ctrl + A** (selects everything), then **Ctrl + C** (copies it).
6. Go back to GitHub, click inside the big **Secret** box, press **Ctrl + V**.
7. Click **Add secret**.
8. Click **New repository secret** again.
9. In **Name**, type exactly: `MONGGOLS_KEYSTORE_PASSWORD`
10. Open `MONGGOLS_KEYSTORE_PASSWORD.txt`, press **Ctrl + A**, **Ctrl + C**, then paste it into
    the **Secret** box with **Ctrl + V**.
11. Click **Add secret**.
12. Keep a backup: put both text files (and `android-signing.jks`) into a private folder in your
    Google Drive or your password manager. Then delete them from your Downloads folder.
13. Rebuild the app with the key. Open
    https://github.com/genestjan/genestjan/actions/workflows/money-android.yml
14. Click **Run workflow** (grey button on the right), choose the branch
    `claude/dreamy-clarke-iht8hw` (or `main` once merged), then click the green **Run workflow**.
15. Wait about 10 minutes until the new run at the top has a green tick.

---

## Part 2. Make your private cloud (10 minutes, free)

This is what keeps the phone and laptop in step. Everything sent there is locked on your devices
first: Supabase only ever sees scrambled data.

1. On the laptop, open https://supabase.com and click **Start your project**.
2. Click **Continue with GitHub**, then **Authorize**.
3. If it asks you to make an organisation: Name `Jan`, Type **Personal**, Plan **Free**, then
   **Create organisation**.
4. Click **New project**.
5. **Project name**: `money-hub`.
6. **Database password**: click **Generate a password**, then **Copy**, and save it in your
   password manager. (You will almost never need it.)
7. **Region**: choose **Southeast Asia (Singapore)**. It is the closest to General Santos.
8. Click **Create new project**. Wait 1 to 2 minutes until the page says the project is ready.

**Put in the tables and lock them:**

9. On the left edge, click **SQL Editor** (the icon looks like `>_`).
10. Click **+ New query** (it may say **New SQL snippet**).
11. In a new tab, open this file:
    https://raw.githubusercontent.com/genestjan/genestjan/claude/dreamy-clarke-iht8hw/money/supabase/schema.sql
12. Press **Ctrl + A**, then **Ctrl + C**.
13. Go back to the Supabase tab, click inside the big empty box, press **Ctrl + V**.
14. Click the green **Run** button at the bottom right.
15. If a box asks about "destructive operations", click **Run this query**. (The script only
    replaces its own rules.)
16. You should see **Success. No rows returned**.

**Let your account work straight away:**

17. On the left, click **Authentication**, then **Sign In / Providers**.
18. Click **Email**. Turn **Confirm email** OFF. Click **Save**.

**Copy the two values the app needs:**

19. At the bottom left, click **Project Settings** (the gear).
20. Click **Data API**. Copy the **Project URL** (it looks like `https://abcdefghijk.supabase.co`).
21. Click **API Keys**. Copy the **Publishable key** (it starts with `sb_publishable_`).
    Never copy the **Secret key**. If you only see a key called **anon public** (it starts with
    `eyJ`), use that one.
22. Email both values to yourself, so you can paste them on your phone. They are not secret on
    their own: they only open the door, and your data behind it is locked.

---

## Part 3. Install Money Hub on your Samsung Galaxy S24 Ultra (10 minutes)

1. On the phone, open **Chrome** and go to:
   https://github.com/genestjan/genestjan/releases/download/money-android/MoneyHub.apk
2. If Chrome says the file might be harmful, tap **Download anyway**.
3. When it finishes, tap **Open** (or pull down the notification bar and tap **MoneyHub.apk**).
4. If the phone says it is not allowed to install unknown apps from Chrome: tap **Settings**,
   turn on **Allow from this source**, then tap the back arrow.
5. Tap **Install**.
   - If **Auto Blocker** stops it: open **Settings > Security and privacy > Auto Blocker**, turn
     it off, install, then turn it back on.
   - If **Play Protect** warns you: tap **More details**, then **Install anyway**. (It warns about
     every app that is not from the Play Store.)
6. Tap **Open**.
7. Tap **Get started**.
8. Paste the **Project URL** and **Publishable key** from Part 2, step 22. Tap **Connect**.
9. Type your email and a password of at least 12 characters. This one password opens Money Hub
   on every device, so make it strong and keep it in your password manager.
10. Tick the box that says you understand, and tap **Create vault**.
11. **Your recovery key appears. This is important.** Tap **Save as file** and also copy it into
    your password manager. If you ever forget your password, this key is the only way back in.
    Nobody can reset it for you, not Supabase, not Claude.
12. Tick **I have saved my recovery key**, then tap **Continue and turn on fingerprint unlock**,
    and touch the fingerprint sensor.

**Now lock the cloud's front door:**

13. On the laptop, in Supabase, click **Authentication > Sign In / Providers**.
14. Turn **Allow new users to sign up** OFF. Click **Save**. Nobody else can make an account on
    your cloud now.

---

## Part 4. Let the phone capture your transactions (5 minutes)

This is the automatic part. Money Hub reads the notifications from GCash, Maya, BPI, BDO,
UnionBank, PayPal and Wise, and bank text messages, and turns them into transactions.

1. In Money Hub, tap **More > Captured**.
2. Tap **Turn on notification access**.
3. In the list, tap **Money Hub** and turn it on, then tap **Allow**.
   - If it says **Restricted setting**: tap **OK**. Open **Settings > Apps > Money Hub**, tap the
     three dots at the top right, tap **Allow restricted settings**, and confirm with your
     fingerprint. Then go back to Money Hub and do steps 2 and 3 again.
4. Back in Money Hub, tap **Samsung: let Money Hub run in the background**, then **Allow**.
   Also check: **Settings > Apps > Money Hub > Battery** is set to **Unrestricted**.
5. Under **Apps to listen to**, keep ticked the apps you use. If an app you use is missing from
   the list, it appears there after it sends its first notification. Tap **Save app list**.
6. Make sure your bank and wallet apps are allowed to show notifications
   (**Settings > Notifications > App notifications**: GCash, BPI, UnionBank, BDO and so on ON),
   and that your bank still sends you transaction texts.

What it will never keep: one-time PINs, promos, declined payments, and texts from people. Those
are dropped on the phone and never stored.

---

## Part 5. Install Money Hub on your Windows laptop (5 minutes)

1. On the laptop, open:
   https://github.com/genestjan/genestjan/releases/download/money-windows/Money-Hub-Setup.exe
2. Open the downloaded file.
3. If Windows says **Windows protected your PC**: click **More info**, then **Run anyway**.
   (Windows shows this for any program without a paid signing certificate.)
4. Click **Next**, **Install**, then **Finish**. Money Hub opens.
5. Click **Sign in**. If it asks for the cloud first, paste the same **Project URL** and
   **Publishable key**, and click **Connect**.
6. Type the same email and password as on the phone. Your data appears.
7. Go to **Settings > Security** and turn on **Windows Hello unlock**, then confirm with your PIN,
   face or fingerprint.

If the window stays blank, install the free **Microsoft Edge WebView2 Runtime** from
https://developer.microsoft.com/microsoft-edge/webview2/ (click **Download**, then
**Evergreen Bootstrapper**), and open Money Hub again.

---

## Part 6. Keep the free cloud awake (3 minutes)

Supabase pauses a free project after a week of no use (for example, a holiday). A small job on
GitHub pokes it once a day so that never happens.

1. Open https://github.com/genestjan/genestjan/settings/secrets/actions
2. Click **New repository secret**. Name: `MONEY_SUPABASE_URL`. Secret: your **Project URL**.
   Click **Add secret**.
3. Click **New repository secret**. Name: `MONEY_SUPABASE_KEY`. Secret: your
   **Publishable key**. Click **Add secret**.

The daily job starts once Money Hub is merged into the main branch of the website repo.

---

## Part 7. Bring in what you already have (15 minutes)

1. **Accounts.** On the laptop, click **Accounts > Add account** for each one: GCash, BPI, each
   credit card (type **Credit card**, with its **last 4 digits**), Wise, PayPal, cash, and each
   loan (car, Home Credit, Pag-IBIG). Type today's balance, or what you owe. The last 4 digits
   are how a card's notifications find the right card.
2. **Bills.** Open your budget sheet, click the **Budgeting** tab, then
   **File > Download > Comma-separated values (.csv)**. In Money Hub, click
   **Debts & bills > Import from Google Sheet** and choose that file. Each row becomes a bill
   with its monthly amounts and due day; the Visa rows become credit cards.
3. **Budgets.** Click **Budgets > Set budgets** and give each category a monthly limit.
4. **History (optional).** For older transactions, download statements as CSV (GCash, BPI,
   PayPal, Wise) and use **Transactions > Import statement**. Importing the same file twice is
   safe: repeats are skipped.

---

## Part 8. Connect PayPal directly (optional, 10 minutes)

PayPal is the one service on your list that lets you link your own account. It needs a
**PayPal Business** account (free to upgrade at paypal.com).

1. Open https://developer.paypal.com and log in with your PayPal Business account.
2. Click **Apps & Credentials**, switch the toggle at the top to **Live**, click **Create App**.
3. Name it `Money Hub`, click **Create App**.
4. Scroll to **Features** (it may say **Live App settings**), tick **Transaction search**,
   click **Save**.
5. Copy the **Client ID** and the **Secret**.
6. In Money Hub: **Settings > Connected accounts > PayPal API > Connect**. Paste both, choose
   your PayPal account and the bank your withdrawals land in, then click **Save and sync**.

PayPal can take up to 9 hours to switch on Transaction search, and up to 3 hours to show a new
payment. Phone capture still catches PayPal straight away in the meantime.

---

## Part 9. Updating the apps

Every time the app is improved, a new build appears at the same two links.

- **Phone:** open the APK link from Part 3 and install it over the old one. Your data stays.
- **Laptop:** run the installer from Part 5 again. Your data stays.

---

## If something goes wrong

| What you see | What to do |
|---|---|
| "App not installed" on the phone | The APK was signed with a different key (before Part 1). Uninstall Money Hub, install the new one, sign in. Your data comes back from the cloud. |
| Nothing is captured | Redo Part 4. Check notification access is on, battery is Unrestricted, and the bank app's notifications are on. |
| A capture waits in **To review** | Usually a card you have not added yet. Add the account (with its last 4 digits) and tap **Add it**. |
| "Sync problem" | Open supabase.com. If the project says **Paused**, click **Restore project**, wait two minutes, then tap **Sync** in Money Hub. |
| Forgot your password | On the lock screen tap **Forgot password?** and use your recovery key. |
| Lost phone | On the laptop: **Settings > Security > Change password**. The lost phone cannot open your data without your password or fingerprint, and a new password locks it out of the cloud. |
