# Get feedback by email (about 10 minutes, once)

Every piece of feedback already shows in the app: **More > Feedback inbox**, and **Home > Needs your attention** says "1 new feedback about the app". This adds an email to your Gmail each time someone sends feedback. It uses your own Google account (free, no extra service) and keeps working after you hand the club over.

## 1. The email script (Google Apps Script)
1. Open **script.google.com** with the Google account that should receive the emails. **New project**. Name it "Rangers feedback email".
2. Delete what is in the editor. Paste everything from `app/supabase/feedback-email/apps-script.gs`.
3. On the line `const KEY = '...'`, replace `change-me-to-a-long-made-up-word` with your own long made-up word (letters and numbers, at least 20, for example two random words and a number). Keep it private.
4. **Save**. Then **Deploy > New deployment**. Click the gear next to "Select type" and choose **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone** (Supabase has no Google account; the key stops strangers)
5. **Deploy**, then **Authorize access** and allow it (Google warns because you wrote the script yourself; choose Advanced > Go to project).
6. Copy the **Web app URL** (it ends in `/exec`).

## 2. Tell Supabase to call it for each new feedback
1. Supabase dashboard, your project: **Database > Webhooks** (Integrations > Database Webhooks on newer screens). If asked, click **Enable webhooks**.
2. **Create a new hook**:
   - Name: `feedback-email`
   - Table: `feedback`
   - Events: **Insert** only
   - Type: **HTTP Request**, Method **POST**
   - URL: the Web app URL, then `?key=` and your word. Example: `https://script.google.com/macros/s/AKfy.../exec?key=yourlongword`
   - Leave headers and timeout as they are. **Create webhook**.

## 3. Test it
Open the app, **More > Send feedback about the app**, write "Test", **Send feedback**. The email arrives within a minute. Then mark the test **Done** in the Feedback inbox.

## Good to know
- The email shows the sender's name, whether they are a parent or coach, and the message. The app asks people not to write children's health details in feedback.
- To stop the emails: delete the webhook in Supabase (the inbox in the app keeps working).
- Gmail sends up to 100 of these a day on a normal account (1,500 on Google Workspace); each person can send at most 20 a day.
