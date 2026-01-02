# ReelView - Capacitor Edition

Mobile app for Android (iOS ready).

**minSdkVersion**: 29 (Android 10+)

## Requirements

- Node.js 18+
- Android SDK 29+
- Java 17+
- Gradle 8.7+

## Building

```bash
npm install
npm run sync:spa        # Populate www/ with latest SPA
npm run build:android   # Build APK
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`

## Install on Device

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```
