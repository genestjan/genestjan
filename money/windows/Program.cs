using System;
using System.Runtime.InteropServices;
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

            // The same app ID as the installer's Start menu shortcut, so Windows shows our reminders.
            SetCurrentProcessExplicitAppUserModelID(Reminders.AppId);
            Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }

        [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
        private static extern int SetCurrentProcessExplicitAppUserModelID(string appId);
    }
}
