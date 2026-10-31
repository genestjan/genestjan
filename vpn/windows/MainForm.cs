using System;
using System.Drawing;
using System.IO;
using System.Net.Http;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace MonggolsVpn
{
    // Hosts the shared Monggols VPN screen (vpn/ui) in WebView2 and does the
    // work the screen asks for: setting up from an invite link or .conf file,
    // and starting or stopping the tunnel service.
    public class MainForm : Form
    {
        // Only Administrators and SYSTEM can read this folder: the setup holds
        // the device's private key.
        private static readonly string DataDir =
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "MonggolsVPN");

        // The file name becomes the tunnel name.
        private static readonly string ConfigFile = Path.Combine(DataDir, "Monggols-UK.conf");

        private readonly WebView2 web = new WebView2 { Dock = DockStyle.Fill };
        private readonly Timer poll = new Timer { Interval = 2000 };
        private bool busy;

        public MainForm()
        {
            Text = "Monggols VPN";
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            ClientSize = new Size(440, 900);
            MinimumSize = new Size(380, 600);
            BackColor = ColorTranslator.FromHtml("#0B0B12");
            StartPosition = FormStartPosition.CenterScreen;
            Controls.Add(web);
            poll.Tick += (s, e) => SendState();
            Load += async (s, e) => await StartWeb();
        }

        private async Task StartWeb()
        {
            var userData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MonggolsVPN", "WebView2");
            var env = await CoreWebView2Environment.CreateAsync(null, userData);
            await web.EnsureCoreWebView2Async(env);
            var core = web.CoreWebView2;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.SetVirtualHostNameToFolderMapping("monggols.app",
                Path.Combine(AppContext.BaseDirectory, "ui"), CoreWebView2HostResourceAccessKind.Deny);
            core.WebMessageReceived += (s, e) => OnMessage(e.WebMessageAsJson);
            core.Navigate("https://monggols.app/index.html");
            poll.Start();
        }

        // ---- messages from the screen ----

        private async void OnMessage(string json)
        {
            using var doc = JsonDocument.Parse(json);
            var msg = doc.RootElement;
            switch (msg.GetProperty("type").GetString())
            {
                case "hello":
                    SendState(goHome: false);
                    break;
                case "connect":
                    await Run(() =>
                    {
                        File.Delete(Path.Combine(DataDir, "service-error.log"));
                        Tunnel.Service.Add(ConfigFile);
                    });
                    break;
                case "disconnect":
                    await Run(() => Tunnel.Service.Remove(ConfigFile, true));
                    break;
                case "setupLink":
                    await SetUpFromLink(msg.GetProperty("url").GetString() ?? "");
                    break;
                case "setupFile":
                    SetUpFromFile();
                    break;
                case "reset":
                    await Run(() =>
                    {
                        Tunnel.Service.Remove(ConfigFile, true);
                        File.Delete(ConfigFile);
                    });
                    break;
            }
        }

        private async Task Run(Action work)
        {
            if (busy) return;
            busy = true;
            SendState();
            try
            {
                await Task.Run(work);
            }
            catch (Exception ex)
            {
                var log = Path.Combine(DataDir, "service-error.log");
                var detail = File.Exists(log) ? File.ReadAllText(log).Split('\n')[0] : ex.Message;
                Toast("Wala ka-connect: " + detail);
            }
            busy = false;
            SendState();
        }

        private async Task SetUpFromLink(string url)
        {
            if (busy) return;
            busy = true;
            SendState();
            try
            {
                using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
                var text = await http.GetStringAsync(url);
                SaveConfig(text);
                busy = false;
                Toast("Andam na! Pindota ang KONEKTAHON.");
                SendState(goHome: true);
                return;
            }
            catch
            {
                Toast("Wala ni-gana ang link. Basin expired na o nagamit na. Pangayo ug bag-o.");
            }
            busy = false;
            SendState();
        }

        private void SetUpFromFile()
        {
            using var dialog = new OpenFileDialog { Filter = "WireGuard setup (*.conf)|*.conf|All files (*.*)|*.*" };
            if (dialog.ShowDialog(this) != DialogResult.OK) return;
            try
            {
                SaveConfig(File.ReadAllText(dialog.FileName));
                Toast("Andam na! Pindota ang KONEKTAHON.");
                SendState(goHome: true);
            }
            catch
            {
                Toast("Dili valid nga VPN setup kining file.");
            }
        }

        private static void SaveConfig(string text)
        {
            if (!text.Contains("[Interface]") || !text.Contains("[Peer]"))
                throw new InvalidDataException("Not a WireGuard setup");

            var dir = Directory.CreateDirectory(DataDir);
            var acl = new DirectorySecurity();
            acl.SetAccessRuleProtection(true, false);
            foreach (var sid in new[] { WellKnownSidType.BuiltinAdministratorsSid, WellKnownSidType.LocalSystemSid })
            {
                acl.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(sid, null), FileSystemRights.FullControl,
                    InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow));
            }
            dir.SetAccessControl(acl);
            File.WriteAllText(ConfigFile, text.Replace("\r\n", "\n"));
        }

        // ---- messages to the screen ----

        private void SendState(bool goHome = false)
        {
            if (web.CoreWebView2 == null) return;
            var state = Tunnel.Service.State(ConfigFile);
            var starting = state == Tunnel.Win32.ServiceState.StartPending || state == Tunnel.Win32.ServiceState.StopPending;
            Post(new
            {
                type = "state",
                up = state == Tunnel.Win32.ServiceState.Running,
                busy = busy || starting,
                hasSetup = File.Exists(ConfigFile),
                goHome
            });
        }

        private void Toast(string text) => Post(new { type = "toast", text });

        private void Post(object message)
        {
            if (InvokeRequired) { BeginInvoke(new Action(() => Post(message))); return; }
            web.CoreWebView2?.PostWebMessageAsJson(JsonSerializer.Serialize(message));
        }
    }
}
