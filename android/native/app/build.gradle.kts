plugins {
    id("com.android.application") version "8.11.1"
    id("org.jetbrains.kotlin.android") version "2.2.0"
    id("org.jetbrains.kotlin.plugin.compose") version "2.2.0"
}

android {
    namespace = "app.leadgenerator.fitness.nativeapp"
    compileSdk = 36

    defaultConfig {
        applicationId = "app.leadgenerator.fitness"
        minSdk = 23
        targetSdk = 36
        versionCode = 11
        versionName = "1.3.0"
        manifestPlaceholders["appLabel"] = "Vibe-trainer"
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".nativepreview"
            versionNameSuffix = "-native-preview"
            manifestPlaceholders["appLabel"] = "Vibe-trainer Kotlin"
        }
    }

    buildFeatures { compose = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }
}

kotlin { jvmToolchain(17) }

dependencies {
    implementation(platform("androidx.compose:compose-bom:2025.06.01"))
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.9.1")
    implementation("androidx.work:work-runtime-ktx:2.10.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
    testImplementation("junit:junit:4.13.2")
}
