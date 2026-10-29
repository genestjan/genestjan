using System;
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
                return Tunnel.Service.Run(args[1]) ? 0 : 1;

            Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
            return 0;
        }
    }
}
