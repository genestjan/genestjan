/* SPDX-License-Identifier: MIT
 *
 * Adapted from wireguard-windows embeddable-dll-service/csharp/TunnelDll/Service.cs
 * Copyright (C) 2019-2026 WireGuard LLC. All Rights Reserved.
 */

using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

namespace Tunnel
{
    // Runs the tunnel as a Windows service that loads tunnel.dll. The service
    // keeps running when the Monggols VPN window is closed, like the official app.
    static class Service
    {
        private const string LongName = "Monggols VPN";
        private const string Description = "Monggols VPN tunnel to the London server";

        [DllImport("tunnel.dll", EntryPoint = "WireGuardTunnelService", CallingConvention = CallingConvention.Cdecl)]
        public static extern bool Run([MarshalAs(UnmanagedType.LPWStr)] string configFile);

        private static string ServiceName(string configFile) =>
            "WireGuardTunnel$" + Path.GetFileNameWithoutExtension(configFile);

        public static void Add(string configFile)
        {
            var exeName = Process.GetCurrentProcess().MainModule!.FileName;
            var pathAndArgs = $"\"{exeName}\" /service \"{configFile}\"";

            var scm = Win32.OpenSCManager(null, null, Win32.ScmAccessRights.AllAccess);
            if (scm == IntPtr.Zero)
                throw new Win32Exception(Marshal.GetLastWin32Error());
            try
            {
                var service = Win32.OpenService(scm, ServiceName(configFile), Win32.ServiceAccessRights.AllAccess);
                if (service != IntPtr.Zero)
                {
                    Win32.CloseServiceHandle(service);
                    Remove(configFile, true);
                }
                service = Win32.CreateService(scm, ServiceName(configFile), LongName, Win32.ServiceAccessRights.AllAccess,
                    Win32.ServiceType.Win32OwnProcess, Win32.ServiceStartType.Demand, Win32.ServiceError.Normal,
                    pathAndArgs, null, IntPtr.Zero, "Nsi\0TcpIp\0", null, null);
                if (service == IntPtr.Zero)
                    throw new Win32Exception(Marshal.GetLastWin32Error());
                try
                {
                    var sidType = Win32.ServiceSidType.Unrestricted;
                    if (!Win32.ChangeServiceConfig2(service, Win32.ServiceConfigType.SidInfo, ref sidType))
                        throw new Win32Exception(Marshal.GetLastWin32Error());

                    var description = new Win32.ServiceDescription { lpDescription = Description };
                    if (!Win32.ChangeServiceConfig2(service, Win32.ServiceConfigType.Description, ref description))
                        throw new Win32Exception(Marshal.GetLastWin32Error());

                    if (!Win32.StartService(service, 0, null))
                        throw new Win32Exception(Marshal.GetLastWin32Error());
                }
                finally
                {
                    Win32.CloseServiceHandle(service);
                }
            }
            finally
            {
                Win32.CloseServiceHandle(scm);
            }
        }

        public static void Remove(string configFile, bool waitForStop)
        {
            var scm = Win32.OpenSCManager(null, null, Win32.ScmAccessRights.AllAccess);
            if (scm == IntPtr.Zero)
                throw new Win32Exception(Marshal.GetLastWin32Error());
            try
            {
                var service = Win32.OpenService(scm, ServiceName(configFile), Win32.ServiceAccessRights.AllAccess);
                if (service == IntPtr.Zero)
                    return;
                try
                {
                    var serviceStatus = new Win32.ServiceStatus();
                    Win32.ControlService(service, Win32.ServiceControl.Stop, serviceStatus);

                    for (int i = 0; waitForStop && i < 180 && Win32.QueryServiceStatus(service, serviceStatus) && serviceStatus.dwCurrentState != Win32.ServiceState.Stopped; ++i)
                        Thread.Sleep(1000);

                    if (!Win32.DeleteService(service) && Marshal.GetLastWin32Error() != 0x00000430)
                        throw new Win32Exception(Marshal.GetLastWin32Error());
                }
                finally
                {
                    Win32.CloseServiceHandle(service);
                }
            }
            finally
            {
                Win32.CloseServiceHandle(scm);
            }
        }

        public static Win32.ServiceState State(string configFile)
        {
            var scm = Win32.OpenSCManager(null, null, Win32.ScmAccessRights.Connect);
            if (scm == IntPtr.Zero)
                return Win32.ServiceState.Unknown;
            try
            {
                var service = Win32.OpenService(scm, ServiceName(configFile), Win32.ServiceAccessRights.QueryStatus);
                if (service == IntPtr.Zero)
                    return Win32.ServiceState.NotFound;
                try
                {
                    var status = new Win32.ServiceStatus();
                    return Win32.QueryServiceStatus(service, status) ? status.dwCurrentState : Win32.ServiceState.Unknown;
                }
                finally
                {
                    Win32.CloseServiceHandle(service);
                }
            }
            finally
            {
                Win32.CloseServiceHandle(scm);
            }
        }
    }
}
