package com.genestjanramirez.gendrive.apps

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.core.graphics.drawable.toBitmap
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.Locale

data class InstalledApp(val packageName: String, val label: String, val icon: ImageBitmap?)

/** Lists launchable apps, launches them, and installs APK files. */
class AppsRepository(private val context: Context, private val scope: CoroutineScope) {
    private val _apps = MutableStateFlow<List<InstalledApp>>(emptyList())
    val apps: StateFlow<List<InstalledApp>> = _apps.asStateFlow()

    private val _message = MutableStateFlow<String?>(null)
    /** Latest install result, shown on the Apps screen. */
    val message: StateFlow<String?> = _message.asStateFlow()

    fun refresh() {
        scope.launch(Dispatchers.IO) {
            val pm = context.packageManager
            val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
            val list = pm.queryIntentActivities(launcher, 0)
                .asSequence()
                .filter { it.activityInfo.packageName != context.packageName }
                .distinctBy { it.activityInfo.packageName }
                .map { ri ->
                    val icon = try {
                        ri.loadIcon(pm).toBitmap(112, 112).asImageBitmap()
                    } catch (e: Exception) {
                        null
                    }
                    InstalledApp(ri.activityInfo.packageName, ri.loadLabel(pm).toString(), icon)
                }
                .sortedBy { it.label.lowercase(Locale.ROOT) }
                .toList()
            _apps.value = list
        }
    }

    fun isInstalled(pkg: String): Boolean = context.packageManager.getLaunchIntentForPackage(pkg) != null

    fun launch(pkg: String): Boolean {
        val intent = context.packageManager.getLaunchIntentForPackage(pkg) ?: return false
        return try {
            context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            true
        } catch (e: Exception) {
            false
        }
    }

    /** Finds an installed app by spoken or typed name ("spotify", "google maps"). */
    fun findByName(name: String): InstalledApp? {
        val wanted = name.lowercase(Locale.ROOT).trim()
        val list = _apps.value
        return list.firstOrNull { it.label.lowercase(Locale.ROOT) == wanted }
            ?: list.firstOrNull { it.label.lowercase(Locale.ROOT).startsWith(wanted) }
            ?: list.firstOrNull { it.label.lowercase(Locale.ROOT).contains(wanted) }
    }

    fun canInstallDirectly(): Boolean = context.packageManager.canRequestPackageInstalls()

    fun postMessage(text: String?) {
        _message.value = text
    }

    /**
     * Installs an APK through Android's own installer. Android shows its confirm screen;
     * BYD firmware that blocks third-party installers will refuse here, in which case
     * the ADB route on the Apps screen is the way.
     */
    suspend fun installWithAndroid(uri: Uri): Boolean = withContext(Dispatchers.IO) {
        try {
            val installer = context.packageManager.packageInstaller
            val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
            val sessionId = installer.createSession(params)
            installer.openSession(sessionId).use { session ->
                val input = context.contentResolver.openInputStream(uri) ?: error("Can't read that file")
                input.use { src ->
                    session.openWrite("base.apk", 0, -1).use { out ->
                        src.copyTo(out)
                        session.fsync(out)
                    }
                }
                val intent = Intent(context, InstallResultReceiver::class.java).setAction(InstallResultReceiver.ACTION)
                val pending = PendingIntent.getBroadcast(context, sessionId, intent, PendingIntent.FLAG_UPDATE_CURRENT)
                session.commit(pending.intentSender)
            }
            postMessage("Installing… confirm on the screen if Android asks.")
            true
        } catch (e: Exception) {
            postMessage("Android's installer refused: ${e.message}. Try “Install with ADB”.")
            false
        }
    }

    /** Copies a picked file to app storage so it can be sent over ADB. */
    suspend fun copyToCache(uri: Uri): File? = withContext(Dispatchers.IO) {
        try {
            val out = File(context.cacheDir, "install.apk")
            context.contentResolver.openInputStream(uri)?.use { src -> out.outputStream().use { src.copyTo(it) } } ?: return@withContext null
            out
        } catch (e: Exception) {
            null
        }
    }
}

/** Receives the result of an install started by [AppsRepository.installWithAndroid]. */
class InstallResultReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val apps = (context.applicationContext as com.genestjanramirez.gendrive.GenDriveApp).graph.apps
        when (intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                @Suppress("DEPRECATION")
                val confirm = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)
                if (confirm != null) {
                    try {
                        context.startActivity(confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    } catch (e: Exception) {
                        apps.postMessage("Android could not show its install screen. Try “Install with ADB”.")
                    }
                }
            }
            PackageInstaller.STATUS_SUCCESS -> {
                apps.postMessage("Installed.")
                apps.refresh()
            }
            else -> apps.postMessage(
                "Install failed: " + (intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: "unknown reason"),
            )
        }
    }

    companion object {
        const val ACTION = "com.genestjanramirez.gendrive.INSTALL_RESULT"
    }
}
