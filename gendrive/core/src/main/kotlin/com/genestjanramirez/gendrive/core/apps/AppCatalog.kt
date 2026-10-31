package com.genestjanramirez.gendrive.core.apps

enum class AppCategory(val label: String) {
    STORE("App stores"),
    MUSIC("Music and podcasts"),
    NAVIGATION("Maps and charging"),
    VIDEO("Video (picture in Park only)"),
}

/**
 * A recommended app. [getUrl] is where to download it: a market:// link opens
 * Aurora Store (or any installed store), an https link opens the browser.
 */
data class CatalogApp(
    val name: String,
    val packageName: String,
    val category: AppCategory,
    val getUrl: String,
    val note: String? = null,
)

object AppCatalog {
    private fun market(pkg: String) = "market://details?id=$pkg"

    val apps: List<CatalogApp> = listOf(
        CatalogApp(
            "Aurora Store", "com.aurora.store", AppCategory.STORE, "https://auroraoss.com",
            "Free and open source. Downloads Play Store apps without a Google account. Install this first.",
        ),
        CatalogApp("F-Droid", "org.fdroid.fdroid", AppCategory.STORE, "https://f-droid.org", "Free and open-source apps only."),
        CatalogApp("Spotify", "com.spotify.music", AppCategory.MUSIC, market("com.spotify.music"), "Lyrics show in GenDrive's Media screen."),
        CatalogApp(
            "YouTube Music", "com.google.android.apps.youtube.music", AppCategory.MUSIC,
            market("com.google.android.apps.youtube.music"), "Needs Google Play services to sign in.",
        ),
        CatalogApp("Pocket Casts", "au.com.shiftyjelly.pocketcasts", AppCategory.MUSIC, market("au.com.shiftyjelly.pocketcasts")),
        CatalogApp(
            "Google Maps", "com.google.android.apps.maps", AppCategory.NAVIGATION, market("com.google.android.apps.maps"),
            "Full Google Maps. Sign-in and some features need Google Play services.",
        ),
        CatalogApp("Waze", "com.waze", AppCategory.NAVIGATION, market("com.waze")),
        CatalogApp(
            "A Better Route Planner", "com.iternio.abrpapp", AppCategory.NAVIGATION, market("com.iternio.abrpapp"),
            "Plans charging stops for long EV trips.",
        ),
        CatalogApp("PlugShare", "com.xatori.Plugshare", AppCategory.NAVIGATION, market("com.xatori.Plugshare"), "Finds public chargers."),
        CatalogApp(
            "YouTube", "com.google.android.youtube", AppCategory.VIDEO, market("com.google.android.youtube"),
            "Needs Google Play services. While moving, GenDrive hides the picture and keeps the sound.",
        ),
        CatalogApp("Netflix", "com.netflix.mediaclient", AppCategory.VIDEO, market("com.netflix.mediaclient")),
        CatalogApp("Viu", "com.vuclip.viu", AppCategory.VIDEO, market("com.vuclip.viu")),
        CatalogApp("Prime Video", "com.amazon.avod.thirdpartyclient", AppCategory.VIDEO, market("com.amazon.avod.thirdpartyclient")),
        CatalogApp("Disney+", "com.disney.disneyplus", AppCategory.VIDEO, market("com.disney.disneyplus")),
        CatalogApp("VLC", "org.videolan.vlc", AppCategory.VIDEO, market("org.videolan.vlc"), "Plays videos from a USB stick."),
    )

    fun byCategory(): Map<AppCategory, List<CatalogApp>> = apps.groupBy { it.category }
}
