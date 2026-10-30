using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Threading.Tasks;
using System.Windows.Forms;
using Windows.Security.Credentials;
using Windows.Security.Cryptography;

namespace MoneyHub
{
    // Windows Hello unlock. A Hello key (kept by Windows, often in the laptop's TPM chip) signs a
    // fixed random challenge; the signature only comes back after your PIN, face or fingerprint,
    // and its hash is the key that unlocks the stored vault key.
    static class Hello
    {
        private const string Name = "MoneyHub";
        private static readonly string Store = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MoneyHub", "hello.bin");

        public static async Task<bool> Available()
        {
            try { return await KeyCredentialManager.IsSupportedAsync(); }
            catch { return false; }
        }

        public static bool Enrolled => File.Exists(Store);

        public static async Task Enroll(string secretB64)
        {
            var challenge = RandomNumberGenerator.GetBytes(32);
            FocusPromptSoon();
            var created = await KeyCredentialManager.RequestCreateAsync(Name, KeyCredentialCreationOption.ReplaceExisting);
            if (created.Status != KeyCredentialStatus.Success) throw Cancelled(created.Status);
            var key = await Sign(created.Credential, challenge);
            var secret = Convert.FromBase64String(secretB64);
            var nonce = RandomNumberGenerator.GetBytes(12);
            var ct = new byte[secret.Length];
            var tag = new byte[16];
            using (var gcm = new AesGcm(key, 16)) gcm.Encrypt(nonce, secret, ct, tag);
            Directory.CreateDirectory(Path.GetDirectoryName(Store)!);
            using var w = new BinaryWriter(File.Create(Store));
            w.Write((byte)1);
            w.Write(challenge);
            w.Write(nonce);
            w.Write(tag);
            w.Write(ct.Length);
            w.Write(ct);
        }

        public static async Task<string> Unlock()
        {
            if (!Enrolled) throw new InvalidOperationException("Windows Hello unlock is not set up on this laptop.");
            byte[] challenge, nonce, tag, ct;
            using (var r = new BinaryReader(File.OpenRead(Store)))
            {
                if (r.ReadByte() != 1) throw new InvalidOperationException("Set up Windows Hello unlock again in Settings.");
                challenge = r.ReadBytes(32);
                nonce = r.ReadBytes(12);
                tag = r.ReadBytes(16);
                ct = r.ReadBytes(r.ReadInt32());
            }
            FocusPromptSoon();
            var opened = await KeyCredentialManager.OpenAsync(Name);
            if (opened.Status != KeyCredentialStatus.Success) throw Cancelled(opened.Status);
            var key = await Sign(opened.Credential, challenge);
            var secret = new byte[ct.Length];
            try
            {
                using var gcm = new AesGcm(key, 16);
                gcm.Decrypt(nonce, ct, tag, secret);
            }
            catch (CryptographicException)
            {
                throw new InvalidOperationException("Windows Hello changed on this laptop. Unlock with your password, then turn Windows Hello unlock on again.");
            }
            return Convert.ToBase64String(secret);
        }

        public static async Task Clear()
        {
            try { File.Delete(Store); } catch { /* already gone */ }
            try { await KeyCredentialManager.DeleteAsync(Name); } catch { /* no key */ }
        }

        private static async Task<byte[]> Sign(KeyCredential credential, byte[] challenge)
        {
            FocusPromptSoon();
            var signed = await credential.RequestSignAsync(CryptographicBuffer.CreateFromByteArray(challenge));
            if (signed.Status != KeyCredentialStatus.Success) throw Cancelled(signed.Status);
            CryptographicBuffer.CopyToByteArray(signed.Result, out byte[] signature);
            return SHA256.HashData(signature);
        }

        private static Exception Cancelled(KeyCredentialStatus s) =>
            new InvalidOperationException(s == KeyCredentialStatus.UserCanceled ? "cancelled" : $"Windows Hello did not work ({s}).");

        // The Hello prompt can open behind the app window; bring it to the front when it appears.
        private static void FocusPromptSoon()
        {
            var timer = new System.Windows.Forms.Timer { Interval = 150 };
            int tries = 0;
            timer.Tick += (s, e) =>
            {
                var h = FindWindow("Credential Dialog Xaml Host", null);
                if (h != IntPtr.Zero) { SetForegroundWindow(h); timer.Stop(); timer.Dispose(); }
                else if (++tries > 30) { timer.Stop(); timer.Dispose(); }
            };
            timer.Start();
        }

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern IntPtr FindWindow(string lpClassName, string? lpWindowName);

        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);
    }
}
