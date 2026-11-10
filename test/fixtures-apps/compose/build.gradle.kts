// Versions are pinned: Kotlin 2.3.21 (Compose Multiplatform 1.12.2 is built with Kotlin 2.3.20),
// Compose Multiplatform 1.12.2, Material3 1.9.0. Gradle 8.14.6 comes from the wrapper.
import org.jetbrains.kotlin.gradle.ExperimentalWasmDsl

plugins {
    kotlin("multiplatform") version "2.3.21"
    id("org.jetbrains.kotlin.plugin.compose") version "2.3.21"
    id("org.jetbrains.compose") version "1.12.2"
}

kotlin {
    @OptIn(ExperimentalWasmDsl::class)
    wasmJs {
        outputModuleName.set("fixture")
        browser {
            commonWebpackConfig { outputFileName = "fixture.js" }
        }
        binaries.executable()
    }
    sourceSets {
        wasmJsMain.dependencies {
            implementation("org.jetbrains.compose.runtime:runtime:1.12.2")
            implementation("org.jetbrains.compose.foundation:foundation:1.12.2")
            implementation("org.jetbrains.compose.ui:ui:1.12.2")
            implementation("org.jetbrains.compose.material3:material3:1.9.0")
        }
    }
}
