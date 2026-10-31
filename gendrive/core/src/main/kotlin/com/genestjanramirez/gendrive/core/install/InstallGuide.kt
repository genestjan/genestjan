package com.genestjanramirez.gendrive.core.install

/**
 * How BYD's own USB installer (AftermarketInstallTool) behaves per country,
 * from the public research at github.com/wheregoes/byd-dolphin-hacking
 * (docs/sideloading-internals.md). The country code is the car's
 * sys.byd.countrycode system property.
 */
enum class InstallMode {
    /** "Third Party Apps <code>" folder plus the DiLink 3 installer password. */
    PASSWORD,

    /** "Application Installation <code>" folder, checked online by BYD. */
    ONLINE_CHECK,

    /** Only a short list of approved apps installs. */
    WHITELIST_ONLY,

    /** Not documented for this country yet. */
    UNKNOWN,
}

data class InstallAdvice(
    val countryCode: String?,
    val mode: InstallMode,
    val folderNames: List<String>,
    val note: String,
)

object InstallGuide {
    private val passwordCountries = setOf("55", "52", "62", "66", "966", "971", "998")
    private val whitelistCountries = mapOf(
        "997" to "Kazakhstan units only accept a short approved list (Yandex, Telegram, WhatsApp, Zoom and a few more).",
        "91" to "Indian units only accept the Mappls navigation app.",
    )

    fun advise(countryCode: String?): InstallAdvice {
        val code = countryCode?.trim()?.takeIf { it.isNotEmpty() && it.all(Char::isDigit) }
        if (code == null) {
            return InstallAdvice(
                null, InstallMode.UNKNOWN, emptyList(),
                "GenDrive could not read your car's country code. This is normal on a phone.",
            )
        }
        whitelistCountries[code]?.let {
            return InstallAdvice(code, InstallMode.WHITELIST_ONLY, listOf("Third Party Apps $code"), it)
        }
        if (code in passwordCountries) {
            return InstallAdvice(
                code, InstallMode.PASSWORD, listOf("Third Party Apps $code"),
                "Copy APK files into this folder on a USB stick, plug it in, and enter the installer password when asked.",
            )
        }
        return InstallAdvice(
            code, InstallMode.UNKNOWN, listOf("Third Party Apps $code", "Application Installation $code"),
            "Your country is not documented yet. Try the first folder name; if no install window appears, try the second.",
        )
    }

    /** A rough guess shown on the Setup screen. BYD does not publish a reliable mapping. */
    fun dilinkGuess(sdkInt: Int): String = when {
        sdkInt == 29 -> "Android 10, most likely DiLink 3"
        sdkInt >= 33 -> "Android ${androidVersion(sdkInt)}, most likely DiLink 5"
        else -> "Android ${androidVersion(sdkInt)}"
    }

    private fun androidVersion(sdkInt: Int): String = when (sdkInt) {
        28 -> "9"
        29 -> "10"
        30 -> "11"
        31, 32 -> "12"
        33 -> "13"
        34 -> "14"
        35 -> "15"
        36 -> "16"
        else -> "API $sdkInt"
    }
}
