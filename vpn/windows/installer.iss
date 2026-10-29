; Monggols VPN installer (Inno Setup 6). Built by .github/workflows/monggols-windows.yml
; from the files in publish\ after `dotnet publish`.

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif

[Setup]
AppId={{6E3B7C52-4F1A-4D8E-9B57-6D2C1A0F9E31}
AppName=Monggols VPN
AppVersion={#AppVersion}
AppPublisher=Genest Jan Ramirez
DefaultDirName={autopf}\Monggols VPN
DefaultGroupName=Monggols VPN
DisableProgramGroupPage=yes
OutputDir=output
OutputBaseFilename=Monggols-VPN-Setup
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\MonggolsVPN.exe
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
Compression=lzma2
SolidCompression=yes
WizardStyle=modern

[Files]
Source: "publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\Monggols VPN"; Filename: "{app}\MonggolsVPN.exe"
Name: "{autodesktop}\Monggols VPN"; Filename: "{app}\MonggolsVPN.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Gamit ug icon sa desktop"; GroupDescription: "Dugang:"

[Run]
Filename: "{app}\MonggolsVPN.exe"; Description: "Ablihi ang Monggols VPN"; Flags: nowait postinstall skipifsilent shellexec

[UninstallRun]
; Stop and remove the tunnel service before the files go.
Filename: "{sys}\sc.exe"; Parameters: "stop ""WireGuardTunnel$Monggols-UK"""; Flags: runhidden; RunOnceId: "StopTunnel"
Filename: "{sys}\sc.exe"; Parameters: "delete ""WireGuardTunnel$Monggols-UK"""; Flags: runhidden; RunOnceId: "DeleteTunnel"
