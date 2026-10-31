plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

// Release signing comes from environment variables set by the GitHub workflow.
// Without them (a local build), the release is signed with the debug key.
val keystorePath: String? = System.getenv("GENDRIVE_KEYSTORE")
val buildNumber: Int = (System.getenv("GENDRIVE_VERSION_CODE") ?: "1").toInt()

android {
    namespace = "com.genestjanramirez.gendrive"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.genestjanramirez.gendrive"
        minSdk = 28
        // BYD's USB installer accepts targetSdk <= 33. 29 matches the open-source
        // BYD apps proven to reach the car's BYDAUTO services on DiLink 3 (Android 10).
        targetSdk = 29
        versionCode = buildNumber
        versionName = "0.1.$buildNumber"
    }

    signingConfigs {
        // minSdk 28 would normally drop the old v1 (JAR) signature, but BYD's
        // installer on DiLink 3 / Android 10 expects both, so sign with v1 and v2.
        getByName("debug") {
            enableV1Signing = true
            enableV2Signing = true
        }
        create("release") {
            if (keystorePath != null) {
                storeFile = file(keystorePath)
                storePassword = System.getenv("GENDRIVE_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("GENDRIVE_KEY_ALIAS") ?: "gendrive"
                keyPassword = System.getenv("GENDRIVE_KEY_PASSWORD") ?: System.getenv("GENDRIVE_KEYSTORE_PASSWORD")
            }
            enableV1Signing = true
            enableV2Signing = true
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName(if (keystorePath != null) "release" else "debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    lint {
        // targetSdk 29 is a deliberate choice for BYD head units, not an oversight.
        disable += setOf("ExpiredTargetSdkVersion", "OldTargetApi")
        abortOnError = false
        checkReleaseBuilds = false
    }

    packaging {
        resources {
            excludes += setOf("/META-INF/{AL2.0,LGPL2.1}", "/META-INF/versions/9/previous-compilation-data.bin")
        }
    }
}

dependencies {
    implementation("com.genestjanramirez.gendrive:core")

    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    // ADB client (Apache-2.0), the same one OverDrive uses, for one-tap setup and installs.
    implementation("dev.mobile:dadb:1.2.8") {
        exclude(group = "org.graalvm.buildtools")
        exclude(group = "org.jetbrains.kotlin", module = "kotlin-stdlib-jdk8")
    }
}
