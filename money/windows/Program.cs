using System;
using System.Threading;
using System.Windows.Forms;

namespace MoneyHub
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            // One window at a time, so two copies never sync over each other.
            using var single = new Mutex(true, @"Local\MoneyHub.GenestJanRamirez", out bool first);
            if (!first) return;

            Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }
}
