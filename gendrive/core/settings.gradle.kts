// GenDrive core: plain Kotlin (no Android) so it builds and tests anywhere.
// The Android app pulls it in with includeBuild("../core").
pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositories {
        mavenCentral()
    }
}

rootProject.name = "core"
