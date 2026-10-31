using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace MoneyHub
{
    // Hosts the shared Money Hub screen (money/web, copied next to the exe as ui\) in WebView2 and
    // answers its requests: Windows Hello unlock, saving files and PayPal calls. Same message
    // format as the Android app.
    public class MainForm : Form
    {
        private const string Host = "money.hub";
        private const string Origin = "https://" + Host;
        // PayPal, and Google Apps Script for bill reminders in Google Calendar (its redirect to
        // script.googleusercontent.com is followed by HttpClient itself).
        private static readonly HashSet<string> HttpHosts = new() { "api-m.paypal.com", "api-m.sandbox.paypal.com", "script.google.com" };
        private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(60) };

        private readonly WebView2 web = new() { Dock = DockStyle.Fill, DefaultBackgroundColor = ColorTranslator.FromHtml("#06080D") };

        public MainForm()
        {
            Text = "Money Hub";
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            ClientSize = new Size(1360, 860);
            MinimumSize = new Size(420, 640);
            BackColor = ColorTranslator.FromHtml("#06080D");
            StartPosition = FormStartPosition.CenterScreen;
            Controls.Add(web);
            Load += async (s, e) => await StartWeb();
            Activated += (s, e) => Emit("resume");
            Deactivate += (s, e) => Emit("pause");
            Resize += (s, e) => { if (WindowState == FormWindowState.Minimized) Emit("pause"); };
        }

        private async Task StartWeb()
        {
            var userData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MoneyHub", "WebView2");
            var env = await CoreWebView2Environment.CreateAsync(null, userData);
            await web.EnsureCoreWebView2Async(env);
            var core = web.CoreWebView2;
#if DEBUG
            core.Settings.AreDevToolsEnabled = true;
#else
            core.Settings.AreDevToolsEnabled = false;
#endif
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.IsPasswordAutosaveEnabled = false;
            core.Settings.IsGeneralAutofillEnabled = false;
            core.SetVirtualHostNameToFolderMapping(Host, Path.Combine(AppContext.BaseDirectory, "ui"), CoreWebView2HostResourceAccessKind.Deny);

            // Only Money Hub's own pages load inside the window; links open in the browser.
            core.NavigationStarting += (s, e) =>
            {
                if (e.Uri.StartsWith(Origin + "/", StringComparison.OrdinalIgnoreCase)) return;
                e.Cancel = true;
                OpenExternal(e.Uri);
            };
            core.NewWindowRequested += (s, e) => { e.Handled = true; OpenExternal(e.Uri); };
            core.WebMessageReceived += (s, e) =>
            {
                if (!e.Source.StartsWith(Origin + "/", StringComparison.OrdinalIgnoreCase)) return;
                _ = Handle(e.WebMessageAsJson);
            };
            core.Navigate(Origin + "/index.html");
        }

        private static void OpenExternal(string uri)
        {
            if (Uri.TryCreate(uri, UriKind.Absolute, out var u) && u.Scheme == Uri.UriSchemeHttps)
                Process.Start(new ProcessStartInfo(u.ToString()) { UseShellExecute = true });
        }

        // ---- messages from the screen ----

        private async Task Handle(string json)
        {
            int id = 0;
            try
            {
                var msg = JsonNode.Parse(json)!.AsObject();
                id = msg["id"]?.GetValue<int>() ?? 0;
                var p = msg["params"] as JsonObject ?? new JsonObject();
                switch (msg["method"]?.GetValue<string>())
                {
                    case "hello":
                    case "info":
                        Reply(id, new JsonObject { ["platform"] = "windows", ["version"] = Application.ProductVersion });
                        break;
                    case "bio.status":
                        Reply(id, new JsonObject { ["available"] = await Hello.Available(), ["enrolled"] = Hello.Enrolled, ["label"] = "Windows Hello" });
                        break;
                    case "bio.enroll":
                        await Hello.Enroll(p["secret"]!.GetValue<string>());
                        Reply(id, null);
                        break;
                    case "bio.unlock":
                        Reply(id, new JsonObject { ["secret"] = await Hello.Unlock() });
                        break;
                    case "bio.clear":
                        await Hello.Clear();
                        Reply(id, null);
                        break;
                    case "notify.status":
                    case "notify.permission":
                        Reply(id, new JsonObject { ["granted"] = Reminders.Allowed(), ["scheduled"] = Reminders.Count() });
                        break;
                    case "notify.schedule":
                        Reply(id, new JsonObject { ["scheduled"] = Reminders.Schedule(p["items"] as JsonArray ?? new JsonArray()) });
                        break;
                    case "notify.test":
                        Reminders.Test();
                        Reply(id, null);
                        break;
                    case "http":
                        Reply(id, await HttpCall(p));
                        break;
                    case "file.save":
                        Reply(id, new JsonObject { ["saved"] = SaveFile(p) });
                        break;
                    case "open":
                        OpenExternal(p["url"]!.GetValue<string>());
                        Reply(id, null);
                        break;
                    default:
                        if ((msg["method"]?.GetValue<string>() ?? "").StartsWith("capture."))
                            throw new InvalidOperationException("Phone capture runs in the Android app.");
                        throw new InvalidOperationException("Unknown request.");
                }
            }
            catch (Exception ex)
            {
                Fail(id, ex.Message);
            }
        }

        // PayPal and Apps Script do not accept calls from a web page, so the app makes them. Allowed hosts only.
        private static async Task<JsonObject> HttpCall(JsonObject p)
        {
            var url = new Uri(p["url"]!.GetValue<string>());
            if (url.Scheme != Uri.UriSchemeHttps || !HttpHosts.Contains(url.Host)) throw new InvalidOperationException("That address is not allowed.");
            using var req = new HttpRequestMessage(new HttpMethod(p["method"]?.GetValue<string>() ?? "GET"), url);
            string contentType = "application/json";
            if (p["headers"] is JsonObject headers)
            {
                foreach (var h in headers)
                {
                    var v = h.Value?.GetValue<string>() ?? "";
                    if (h.Key.Equals("Content-Type", StringComparison.OrdinalIgnoreCase)) contentType = v;
                    else req.Headers.TryAddWithoutValidation(h.Key, v);
                }
            }
            var body = p["body"]?.GetValue<string>();
            if (body != null) req.Content = new StringContent(body, Encoding.UTF8, contentType.Split(';')[0]);
            try
            {
                using var res = await Http.SendAsync(req);
                return new JsonObject { ["status"] = (int)res.StatusCode, ["body"] = await res.Content.ReadAsStringAsync() };
            }
            catch (HttpRequestException)
            {
                throw new InvalidOperationException("Could not connect. Check your internet connection.");
            }
        }

        private bool SaveFile(JsonObject p)
        {
            var name = p["name"]!.GetValue<string>();
            var data = p["data"]!.GetValue<string>();
            var bytes = p["encoding"]?.GetValue<string>() == "base64" ? Convert.FromBase64String(data) : Encoding.UTF8.GetBytes(data);
            var ext = Path.GetExtension(name);
            using var dlg = new SaveFileDialog
            {
                FileName = name,
                Filter = string.IsNullOrEmpty(ext) ? "All files|*.*" : $"{ext.TrimStart('.').ToUpperInvariant()} file|*{ext}|All files|*.*",
                InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
                OverwritePrompt = true,
            };
            if (dlg.ShowDialog(this) != DialogResult.OK) return false;
            File.WriteAllBytes(dlg.FileName, bytes);
            return true;
        }

        // ---- replies and events ----

        private void Reply(int id, JsonNode? result) => Send(new JsonObject { ["id"] = id, ["ok"] = true, ["result"] = result });

        private void Fail(int id, string error) => Send(new JsonObject { ["id"] = id, ["ok"] = false, ["error"] = error });

        private void Emit(string name) => Send(new JsonObject { ["event"] = name });

        private void Send(JsonObject message)
        {
            if (IsDisposed) return;
            if (InvokeRequired) { BeginInvoke(new Action(() => Send(message))); return; }
            web.CoreWebView2?.PostWebMessageAsJson(message.ToJsonString());
        }
    }
}
