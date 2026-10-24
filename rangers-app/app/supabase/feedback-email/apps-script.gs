// Rangers App: emails you every new piece of feedback, from your own Gmail. Free, no API keys.
// 1. script.google.com > New project > paste this file > change KEY below to your own long made-up word.
// 2. Deploy > New deployment > type Web app > Execute as: Me > Who has access: Anyone > Deploy > allow access.
// 3. Copy the Web app URL. In Supabase: Database > Webhooks > Create a new hook (see docs/feedback-email.md).
// The key keeps strangers from sending you mail through this script. Never put the key in the app or in GitHub.
const KEY = 'change-me-to-a-long-made-up-word';
const INBOX = 'https://rangersfc.net/app/#/feedback/inbox';
const KIND = { idea: 'An idea', problem: 'Something is wrong', praise: 'Something I like', other: 'Feedback' };
const RATING = { 1: 'Not good', 2: 'Okay', 3: 'Great' };

function doPost(e) {
  if (!e || !e.parameter || e.parameter.key !== KEY) return ContentService.createTextOutput('no');
  const r = (JSON.parse(e.postData.contents) || {}).record || {};
  if (!r.message) return ContentService.createTextOutput('empty');
  const subject = 'Rangers App feedback: ' + (KIND[r.kind] || 'Feedback') + (r.rating ? ' (' + RATING[r.rating] + ')' : '');
  const body = [
    'From: ' + (r.name || 'Someone') + ' (' + (r.role || 'signed in') + ')',
    r.page ? 'Sent from: ' + r.page : '',
    '',
    r.message,
    '',
    'Mark it read or done in the app: ' + INBOX,
  ].filter(function (l, i) { return l !== '' || i > 1; }).join('\n');
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), subject, body);
  return ContentService.createTextOutput('ok');
}
