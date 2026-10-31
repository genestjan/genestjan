using System;
using System.Linq;
using System.Security.Cryptography;
using System.Security;
using System.Text;
using System.Text.Json.Nodes;
using Windows.Data.Xml.Dom;
using Windows.UI.Notifications;

namespace MoneyHub
{
    // Bill reminders as Windows notifications. They are handed to Windows' own schedule, so they
    // appear even when Money Hub is closed. Windows only shows notifications for a program with
    // a Start menu shortcut carrying its app ID, which the installer creates.
    static class Reminders
    {
        public const string AppId = "GenestJanRamirez.MoneyHub";
        private const string Group = "bills";

        private static ToastNotifier Notifier() => ToastNotificationManager.CreateToastNotifier(AppId);

        public static bool Allowed()
        {
            try { return Notifier().Setting == NotificationSetting.Enabled; }
            catch { return false; }
        }

        public static int Count()
        {
            try { return Notifier().GetScheduledToastNotifications().Count(t => t.Group == Group); }
            catch { return 0; }
        }

        public static int Schedule(JsonArray items)
        {
            ToastNotifier notifier;
            try { notifier = Notifier(); }
            catch { throw new InvalidOperationException("Install Money Hub with its installer to get reminders on this laptop."); }
            foreach (var old in notifier.GetScheduledToastNotifications().Where(t => t.Group == Group).ToList())
                notifier.RemoveFromSchedule(old);
            int n = 0;
            foreach (var node in items)
            {
                if (node is not JsonObject o) continue;
                var at = DateTimeOffset.FromUnixTimeMilliseconds(o["at"]!.GetValue<long>());
                if (at <= DateTimeOffset.Now.AddSeconds(30)) continue;
                var toast = new ScheduledToastNotification(Content(o["title"]?.GetValue<string>() ?? "", o["body"]?.GetValue<string>() ?? ""), at)
                {
                    Group = Group,
                    Tag = ShortId(o["id"]?.GetValue<string>() ?? n.ToString()),
                };
                notifier.AddToSchedule(toast);
                n++;
            }
            return n;
        }

        public static void Test()
        {
            Notifier().Show(new ToastNotification(Content("Money Hub reminders are on", "You will get a note like this before each bill is due.")));
        }

        private static XmlDocument Content(string title, string body)
        {
            var xml = new XmlDocument();
            xml.LoadXml($"<toast><visual><binding template=\"ToastGeneric\"><text>{SecurityElement.Escape(title)}</text><text>{SecurityElement.Escape(body)}</text></binding></visual></toast>");
            return xml;
        }

        // Windows keeps tags short (16 characters).
        private static string ShortId(string id) =>
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(id)))[..16];
    }
}
