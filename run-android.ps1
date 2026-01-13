# Quick script to set environment variables and run Android app
# Run this with: .\run-android.ps1

$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "C:\Users\lemue\AppData\Local\Android\Sdk"

Write-Host "Environment variables set:"
Write-Host "  JAVA_HOME: $env:JAVA_HOME"
Write-Host "  ANDROID_HOME: $env:ANDROID_HOME"
Write-Host ""

# Check if emulator is running
$devices = & "$env:ANDROID_HOME\platform-tools\adb.exe" devices
if ($devices -notmatch "device$") {
    Write-Host "No Android device/emulator detected. Starting emulator..."
    Start-Process -FilePath "$env:ANDROID_HOME\emulator\emulator.exe" -ArgumentList "-avd", "Medium_Phone_API_35"
    Write-Host "Waiting for emulator to boot..."
    Start-Sleep -Seconds 30
}

Write-Host "Running Android app..."
npm run android
