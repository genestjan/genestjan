using System;
using System.IO;
using System.Windows.Forms;

namespace MonggolsVpn
{
    static class Program
    {
        [STAThread]
        static int Main(string[] args)
        {
            // Started by Windows as the tunnel service: hand over to tunnel.dll.
            if (args.Length == 2 && args[0] == "/service")
            {
                try
                {
                    return Tunnel.Service.Run(args[1]) ? 0 : 1;
                }
                catch (Exception ex)
                {
                    // Shown by the app when connecting fails.
                    File.WriteAllText(Path.Combine(Path.GetDirectoryName(args[1])!, "service-error.log"), ex.ToString());
                    return 1;
                }
            }

            Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
            return 0;
        }
    }
}
