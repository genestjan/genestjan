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

## Part 1. Give GitHub Money Hub's signing key (5 minutes)

Android only installs an update if it is signed with the same key as the app already on the
phone. Claude made Money Hub's key for you and sent you three files:
`MONEY_KEYSTORE_BASE64.txt`, `MONEY_KEYSTORE_PASSWORD.txt` and `money-hub-signing.jks`.

1. On the laptop, open this page:
   https://github.com/genestjan/genestjan/settings/secrets/actions
2. Click the green button **New repository secret**.
3. In the **Name** box, type exactly: `MONEY_KEYSTORE_BASE64`
4. Open the file `MONEY_KEYSTORE_BASE64.txt` (double-click it; it opens in Notepad).
5. Press **Ctrl + A** (selects everything), then **Ctrl + C** (copies it).
6. Go back to GitHub, click inside the big **Secret** box, press **Ctrl + V**.
7. Click **Add secret**.
8. Click **New repository secret** again.
9. In **Name**, type exactly: `MONEY_KEYSTORE_PASSWORD`
10. Open `MONEY_KEYSTORE_PASSWORD.txt`, press **Ctrl + A**, **Ctrl + C**, then paste it into
    the **Secret** box with **Ctrl + V**.
11. Click **Add secret**.
12. Keep a backup: put all three files into a private folder in your Google Drive or your
    password manager. Then delete them from your Downloads folder.
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
18. In the **User Signups** box at the top, turn **Confirm email** OFF and leave **Allow new users
    to sign up** ON. Click **Save changes**. Do not open **Email** in the **Auth Providers** list
    below: it must stay **Enabled**, because it is how you sign in.

**Give the two connection values to GitHub (so the apps never ask for them):**

19. At the bottom left of Supabase, click **Project Settings** (the gear).
20. Click **Data API**. Next to **Project URL** (it looks like `https://abcdefghijk.supabase.co`),
    click the **copy** icon. (If what you copied has `/rest/v1/` on the end, that is fine: the app
    removes it.)
21. Open a new Chrome tab (**Ctrl + T**), paste this in the address bar and press **Enter**:
    https://github.com/genestjan/genestjan/settings/secrets/actions
22. Click the green **New repository secret** button. In **Name**, type exactly
    `MONEY_SUPABASE_URL`. Click inside **Secret** and press **Ctrl + V**. Click **Add secret**.
23. Go back to the Supabase tab. Click **API Keys**. Next to **Publishable key** (it starts with
    `sb_publishable_`), click the **copy** icon. Never copy the **Secret key**. (If you only see a
    key called **anon public**, starting with `eyJ`, copy that one.)
24. Go back to the GitHub tab. Click **New repository secret**. In **Name**, type exactly
    `MONEY_SUPABASE_KEY`. Click inside **Secret**, press **Ctrl + V**, click **Add secret**.
25. The list now shows four secrets: `MONEY_KEYSTORE_BASE64`, `MONEY_KEYSTORE_PASSWORD`,
    `MONEY_SUPABASE_URL` and `MONEY_SUPABASE_KEY`. The last two also keep your free cloud awake.

**Rebuild both apps so they know your cloud:**

26. Open https://github.com/genestjan/genestjan/actions/workflows/money-android.yml
27. Click the words of the **first line** in the list of runs.
28. At the top right of the page that opens, click **Re-run all jobs** (or **Re-run jobs**, then
    **Re-run all jobs**), then the green **Re-run jobs** in the box that pops up.
29. Wait about 2 minutes until the yellow circle becomes a **green tick**.
30. Do steps 26 to 29 again with this page for the laptop app:
    https://github.com/genestjan/genestjan/actions/workflows/money-windows.yml

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
6. Tap **Open**. (If you installed Money Hub before, this updates it. Your data is kept.)
7. Tap **Get started**.
8. Type your **email** and a **password** of at least 8 characters. Tap the eye to see what you
   typed. You only type this password once on each device; after that your fingerprint opens
   Money Hub. Keep it in your password manager too.
9. Tap **Create my account**.
10. **Your spare key appears.** Tap **Save it** and save the file somewhere safe (for example your
    Google Drive). If you ever forget your password, this key gets you back in. Nobody else can
    reset it for you.
11. Tap **Continue and use my fingerprint**, then touch the fingerprint sensor.
12. If the phone asks whether Money Hub may send notifications, tap **Allow** (for bill reminders).

If an error appears at any step, take a screenshot and send it (see **Sending a screenshot or the
exact error**, near the end of this guide).

**Now lock the cloud's front door:**

13. On the laptop, in Supabase, click **Authentication > Sign In / Providers**.
14. In the **User Signups** box at the top, turn **Allow new users to sign up** OFF. Click **Save
    changes**. Nobody else can make an account on your cloud now. Leave **Email** in the **Auth
    Providers** list **Enabled**: it is how you sign in.

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
5. Click **Sign in**.
6. Type the same email and password as on the phone, and click **Sign in**. Your data appears.
7. Windows asks to use **Windows Hello** (your PIN, face or fingerprint). Confirm it. From now on
   that opens Money Hub, without the password.

If the window stays blank, install the free **Microsoft Edge WebView2 Runtime** from
https://developer.microsoft.com/microsoft-edge/webview2/ (click **Download**, then
**Evergreen Bootstrapper**), and open Money Hub again.

---

## Part 6. Keep the free cloud awake

Nothing to do: the `MONEY_SUPABASE_URL` and `MONEY_SUPABASE_KEY` secrets from Part 2 also run a
small daily job that stops Supabase pausing your free project. It starts once Money Hub is merged
into the main branch of the website repo.

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

## Part 10. Bill reminders: phone, laptop and Google Calendar (10 minutes)

Money Hub reminds you **5 days before each bill is due, at 9:00 AM** (you can change both in
**Settings > Bill reminders > When**). Paid bills are skipped.

**On the phone:**

1. In Money Hub, tap **More > Settings & security**, scroll to **Bill reminders**.
2. Next to **Notifications on this phone**, tap **Turn on**, then **Allow**.
3. Tap **Test**. A notification should appear at the top of the screen.
4. If nothing appears: open **Settings > Apps > Money Hub > Notifications** and turn
   **Allow notifications** on.

The reminders arrive even when Money Hub is closed, and come back by themselves after the phone
restarts. On the lock screen they only say "A bill is due soon"; the details show once unlocked.

**On the laptop (optional):** in Money Hub on the laptop, **Settings > Bill reminders >
Notifications on this laptop > Turn on**, then **Test**. If nothing appears, open Windows
**Settings > System > Notifications** and turn Money Hub on. (This only works when Money Hub was
installed with the installer.) It starts off, so you are not reminded twice.

**In Google Calendar (an all-day event on the reminder day):**

1. On the laptop, in Money Hub: **Settings > Bill reminders > Google Calendar > Set up**.
2. Click **Copy the script**. (Your private secret is already inside it.)
3. Click the **script.google.com** link in the same box. Check the picture at the top right is the
   Google account whose calendar you use.
4. In the editor you see a few lines starting with `function myFunction`. Press **Ctrl + A**, then
   **Ctrl + V**, so the script replaces them.
5. Click **Untitled project** at the top, type `Money Hub reminders`, click **Rename**.
6. Click the **save** icon (the floppy disk).
7. In the toolbar, open the list next to **Debug**, choose **setup**, then click **Run**.
8. A box says **Authorisation required**. Click **Review permissions**, choose your account. When
   it says **Google hasn't verified this app**, click **Advanced**, then
   **Go to Money Hub reminders (unsafe)**, then **Allow**. (Google shows this for every personal
   script. It is your own.)
9. Wait until the bottom says **Execution completed**.
10. Click the blue **Deploy** button (top right), then **New deployment**.
11. Click the **gear** next to **Select type**, then **Web app**.
12. **Execute as**: **Me**. **Who has access**: **Anyone**. Click **Deploy**.
    - If **Anyone** is not in the list (some work accounts block it), do steps 3 to 13 with your
      personal Gmail account instead.
13. Click **Copy** under **Web app URL**.
14. Back in Money Hub, paste it into **Web app URL** and click **Connect and send**.
15. Open Google Calendar. On the left there is a new calendar, **Money Hub bills**, with an
    all-day event 5 days before each bill. Only you can see it.

**If you paste the script again later:** Google keeps running the old copy until you deploy again.
Click **Deploy**, then **New deployment**, then **Deploy**, click **Copy** under **Web app URL**,
and paste the new address into Money Hub. You do not need to run **setup** again.

**To get a Google Calendar notification as well:** in Google Calendar, point at **Money Hub
bills** on the left, click the three dots, **Settings and sharing**. Under
**All-day event notifications**, click **Add notification** and choose **On the day at 9am**.

When you mark a bill as paid, its calendar event disappears within a minute, from whichever device
you used. The phone's own notification for that bill is cancelled the next time Money Hub opens on
the phone.

---

## Sending a screenshot or the exact error (when you need help)

Every error box in Money Hub shows the problem in plain words, then a line of small text with the
exact technical error, and a **Copy the details** link. Send either a screenshot or the copied
text, and whoever helps you can see exactly what went wrong.

**Take a screenshot on the phone (Samsung Galaxy S24 Ultra):**

1. Make the problem show on the screen.
2. Find the two buttons on the right edge of the phone: the long **Volume** button at the top and
   the **Side button** under it.
3. Press the **Side button** and the bottom end of the **Volume** button (**Volume down**) at the
   same time, then let go straight away. The screen flashes and a small bar appears at the bottom:
   the screenshot is saved.
   - If that is hard: open **Settings > Advanced features > Motions and gestures**, turn on
     **Palm swipe to capture**. From then on, slide the side of your hand across the screen.
4. Your screenshots are in the **Gallery** app, under **Albums > Screenshots**. Attach one to your
   message the same way you attach any photo.

If the screen shows your money, tap the **eye** next to **Total balance** on Home first. The
amounts turn into dots, and stay hidden until you tap the eye again.

**Copy the exact error instead of a screenshot:**

1. Under the error, tap **Copy the details**. It changes to **Copied. Paste it into your message.**
2. Go to your message, press and hold inside the message box, then tap **Paste**.

**Copy everything that went wrong lately:**

1. In Money Hub, tap **More** (bottom right), then **Settings & security**.
2. Scroll to the bottom, to **Problems on this device**.
3. Tap **Copy the problem report**, then paste it into your message. It holds the app version,
   phone model and error messages, never your amounts, names or passwords.

**Take a screenshot on the laptop:** press the **Windows key**, **Shift** and **S** together. The
screen goes grey. Drag a box around the problem with the mouse. Click inside your message box and
press **Ctrl + V**.

Screenshots of Money Hub are allowed so you can do this. To block them again later, open
**Settings & security > Security** and untick **Allow screenshots**. The recent apps list on the
phone always shows a blank card instead of your balances.

---

## If something goes wrong

| What you see | What to do |
|---|---|
| "Email signups are disabled" or "Email sign-in is switched off" | In Supabase, click **Authentication > Sign In / Providers**. In the **Auth Providers** list, click **Email**, turn on **Enable Email provider** (the first switch) and click **Save**. |
| "Invalid path specified in request URL" when creating your account | That build had the wrong cloud address. Install the latest APK (Part 9); it fixes the address itself. |
| "App not installed" on the phone | The APK was signed with a different key (before Part 1). Uninstall Money Hub, install the new one, sign in. Your data comes back from the cloud. |
| Nothing is captured | Redo Part 4. Check notification access is on, battery is Unrestricted, and the bank app's notifications are on. |
| A capture waits in **To review** | Usually a card you have not added yet. Add the account (with its last 4 digits) and tap **Add it**. |
| "Sync problem" | Open supabase.com. If the project says **Paused**, click **Restore project**, wait two minutes, then tap **Sync** in Money Hub. |
| Forgot your password | On the lock screen tap **Forgot password?** and use your spare key. |
| No bill reminder arrived | Check Part 10: notifications allowed, Money Hub battery set to Unrestricted, and the bill has a due day. |
| "The script in your Google account has a different secret" | In Money Hub, open the Google Calendar panel and tap **Copy the script**. In Apps Script, select everything, paste, save, then **Deploy > New deployment > Deploy**. Paste the new Web app URL into Money Hub and click **Connect and send**. |
| Google Calendar shows a problem | Open Settings > Bill reminders > Google Calendar > Manage, click Copy the script, paste it over the old one at script.google.com, save, then Deploy > Manage deployments > edit > New version > Deploy. |
| Lost phone | On the laptop: **Settings > Security > Change password**. The lost phone cannot open your data without your password or fingerprint, and a new password locks it out of the cloud. |
