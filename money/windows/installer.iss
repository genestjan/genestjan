; Money Hub installer (Inno Setup 6). Built by .github/workflows/money-windows.yml from the files
; in publish\ after `dotnet publish`. Installs for the current user only: no administrator needed.

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif

[Setup]
AppId={{3B1F6D2A-8C4E-4E7B-9A51-2F6C0D9E7A44}
AppName=Money Hub
AppVersion={#AppVersion}
AppPublisher=Genest Jan Ramirez
AppPublisherURL=https://genestjanramirez.com
DefaultDirName={localappdata}\Programs\Money Hub
DefaultGroupName=Money Hub
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=output
OutputBaseFilename=Money-Hub-Setup
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\MoneyHub.exe
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes

[Files]
Source: "publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\Money Hub"; Filename: "{app}\MoneyHub.exe"
Name: "{autodesktop}\Money Hub"; Filename: "{app}\MoneyHub.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Put a Money Hub icon on the desktop"; GroupDescription: "Extra:"

[Run]
Filename: "{app}\MoneyHub.exe"; Description: "Open Money Hub"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; The app's own settings. Your data stays in your cloud; delete this folder by hand to remove the local copy.
Type: files; Name: "{localappdata}\MoneyHub\hello.bin"
