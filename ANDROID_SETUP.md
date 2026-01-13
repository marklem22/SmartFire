# Android Setup Guide

## Quick Start Options

### Option 1: Use Expo Go (Quick Testing - Limited)
**Note:** Your app has `newArchEnabled: true`, so Expo Go won't work. You'll need to temporarily disable it.

1. Temporarily set `"newArchEnabled": false` in `app.json`
2. Run: `npm run android:go` or `npx expo start --android`
3. Scan QR code with Expo Go app on your Android device

### Option 2: Set Up Android Emulator (Recommended for Development)

#### Step 1: Install Android Studio
1. Download from: https://developer.android.com/studio
2. Install Android Studio
3. During installation, make sure to install:
   - Android SDK
   - Android SDK Platform
   - Android Virtual Device (AVD)

#### Step 2: Set Environment Variables
Add these to your Windows environment variables:

1. Open System Properties → Environment Variables
2. Add new System Variables:
   - Variable: `ANDROID_HOME`
     - Value: `C:\Users\<YourUsername>\AppData\Local\Android\Sdk` (or your SDK location)
   - Variable: `JAVA_HOME`
     - Value: `C:\Program Files\Android\Android Studio\jbr` (Android Studio's bundled JDK)
3. Add to Path:
   - `%ANDROID_HOME%\platform-tools`
   - `%ANDROID_HOME%\tools`
   - `%ANDROID_HOME%\tools\bin`
   - `%JAVA_HOME%\bin`

#### Step 3: Create an Android Virtual Device (AVD)
1. Open Android Studio
2. Go to Tools → Device Manager
3. Click "Create Device"
4. Select a device (e.g., Pixel 5)
5. Select a system image (e.g., API 33 or 34)
6. Click "Finish"

#### Step 4: Start the Emulator
1. In Android Studio Device Manager, click the Play button next to your AVD
2. Or run from command line: `emulator -avd <AVD_NAME>`

#### Step 5: Run Your App
```bash
npm run android
```

### Option 3: Use Physical Android Device

1. Enable Developer Options on your Android device:
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times
2. Enable USB Debugging:
   - Settings → Developer Options → USB Debugging
3. Connect device via USB
4. Verify connection: `adb devices`
5. Run: `npm run android`

## Troubleshooting

- **"adb: command not found"**: Make sure Android SDK platform-tools is in your PATH
- **"No devices found"**: Make sure emulator is running or device is connected with USB debugging enabled
- **Build errors**: Try `npx expo prebuild --clean` to regenerate native code
