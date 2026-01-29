# SMARTFIRE LINK - Complete System Implementation

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [Hardware Setup](#hardware-setup)
3. [ESP32 Code](#esp32-code)
4. [Mobile App Setup](#mobile-app-setup)
5. [How It Works](#how-it-works)
6. [Installation Guide](#installation-guide)
7. [Usage Instructions](#usage-instructions)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 System Overview

**SMARTFIRE LINK** is a Mobile-Connected Flame Detection System with GPS-Based Emergency Response. The system consists of:

- **ESP32 Hardware Module** - Detects fires using IR Flame Sensor and provides GPS coordinates
- **React Native Mobile App** - Receives alerts and displays fire location on map

### Key Features
- ✅ Real-time fire detection with 4 severity levels
- ✅ GPS-based location tracking
- ✅ Local notifications with severity-based alerts
- ✅ Interactive map display
- ✅ Wi-Fi HTTP communication (no cloud required)

---

## 🔧 Hardware Setup

### Required Components

1. **ESP32 Development Board**
   - Wi-Fi capable
   - Analog input pins
   - Serial communication

2. **IR Flame Sensor**
   - Analog output
   - Connected to GPIO34 (configurable)

3. **GPS Module (NEO-6M)**
   - UART communication
   - Connected to Serial2 (GPIO16/17)

### Wiring Diagram

```
ESP32          IR Flame Sensor
GPIO34  ----->  Analog Output
3.3V    ----->  VCC
GND     ----->  GND

ESP32          GPS Module (NEO-6M)
GPIO16  ----->  RX (GPS TX)
GPIO17  ----->  TX (GPS RX)
3.3V    ----->  VCC
GND     ----->  GND
```

---

## 💻 ESP32 Code

### File: `esp32_smartfire.ino`

The ESP32 code performs the following:

1. **Fire Detection**
   - Reads analog values from IR Flame Sensor
   - Classifies severity: LOW, MODERATE, HIGH, EXTREME

2. **GPS Reading**
   - Continuously reads GPS coordinates
   - Validates GPS data

3. **HTTP Server**
   - Creates Wi-Fi web server
   - Exposes `/fire-alert` endpoint
   - Returns JSON with fire data

### Configuration

Before uploading, update these values in `esp32_smartfire.ino`:

```cpp
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
```

### Upload Instructions

1. Open Arduino IDE
2. Install ESP32 board support (if not already installed)
3. Install required libraries:
   - `TinyGPS++` (for GPS parsing)
   - ESP32 WiFi libraries (included with ESP32 board package)
4. Select board: **ESP32 Dev Module**
5. Select port: Your ESP32 COM port
6. Upload code
7. Open Serial Monitor (115200 baud) to see IP address

---

## 📱 Mobile App Setup

### Prerequisites

- Node.js installed
- Expo CLI installed (`npm install -g expo-cli`)
- Android Studio (for Android builds)
- Physical Android device or emulator

### Installation Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Install Required Packages**
   ```bash
   npx expo install expo-notifications
   npx expo install expo-device
   npx expo install @react-native-async-storage/async-storage
   npx expo install react-native-maps
   ```

3. **Configure ESP32 IP Address**
   - Open the app
   - Go to Settings tab
   - Enter ESP32 IP address (shown in Serial Monitor)
   - Tap "Save IP Address"

### Building APK

**Why rebuild APK?**
- Expo Go doesn't support custom native modules like `react-native-maps`
- Production APK is optimized and smaller
- Better performance

**Build Commands:**

```bash
# Using EAS Build (recommended)
eas build --platform android --profile production

# Or using Expo Build (legacy)
npx expo build:android
```

---

## 🔄 How It Works

### 1. Fire Detection Process

```
IR Flame Sensor → Analog Reading (0-4095)
                    ↓
            Severity Classification
                    ↓
         LOW / MODERATE / HIGH / EXTREME
```

**Severity Thresholds:**
- **EXTREME**: Sensor value < 500 (very strong flame)
- **HIGH**: Sensor value < 1000 (strong flame)
- **MODERATE**: Sensor value < 2000 (moderate flame)
- **LOW**: Sensor value < 3000 (weak flame)
- **NONE**: Sensor value > 3000 (no flame)

### 2. GPS Data Collection

```
GPS Module → NMEA Sentences → TinyGPS++ Library
                                ↓
                    Latitude & Longitude
```

**GPS Requirements:**
- Clear view of sky
- First fix: 30-60 seconds
- Accuracy: 3-5 meters (outdoor)

### 3. HTTP Communication

```
Mobile App (Client)          ESP32 (Server)
     |                            |
     |-- GET /fire-alert -------->|
     |                            |
     |<-- JSON Response ----------|
     |  {                         |
     |    "severity": "HIGH",     |
     |    "time": "2026-01-22 21:35",
     |    "latitude": 16.615,    |
     |    "longitude": 120.316   |
     |  }                         |
```

### 4. Alert Processing

```
Mobile App receives JSON
        ↓
Check if severity != "NONE"
        ↓
Trigger Local Notification
        ↓
Display Popup Alert
        ↓
Add to Alerts List
        ↓
Show on Map
```

---

## 📖 Usage Instructions

### ESP32 Setup

1. **Connect Hardware**
   - Wire IR Flame Sensor to GPIO34
   - Wire GPS module to Serial2 (GPIO16/17)
   - Power ESP32 via USB or external power

2. **Configure Wi-Fi**
   - Update SSID and password in code
   - Upload code to ESP32
   - Check Serial Monitor for IP address

3. **Test Endpoint**
   - Open browser: `http://ESP32_IP/fire-alert`
   - Should see JSON response

### Mobile App Usage

1. **Initial Setup**
   - Install APK on Android device
   - Connect to same Wi-Fi as ESP32
   - Open app → Settings → Enter ESP32 IP
   - Tap "Save IP Address"

2. **Monitoring**
   - App automatically polls ESP32 every second
   - When fire detected:
     - Notification appears
     - Popup alert shows
     - Alert added to Home page
     - Location shown on Map

3. **Viewing Alerts**
   - **Home Tab**: List of active alerts
   - **Map Tab**: Visual map with markers
   - **History Tab**: All alerts (active + resolved)
   - **Settings Tab**: Configure ESP32 IP

---

## 🐛 Troubleshooting

### ESP32 Issues

**Problem: ESP32 not connecting to Wi-Fi**
- ✅ Check SSID and password
- ✅ Verify Wi-Fi signal strength
- ✅ Check Serial Monitor for error messages

**Problem: GPS not getting fix**
- ✅ Ensure clear view of sky
- ✅ Wait 30-60 seconds for first fix
- ✅ Check GPS module connections
- ✅ Verify GPS module power (3.3V)

**Problem: HTTP endpoint not responding**
- ✅ Check ESP32 IP address in Serial Monitor
- ✅ Verify mobile app and ESP32 on same Wi-Fi network
- ✅ Test endpoint in browser first

### Mobile App Issues

**Problem: Not receiving alerts**
- ✅ Verify ESP32 IP address in Settings
- ✅ Check if polling status shows "🟢 Polling Active"
- ✅ Ensure same Wi-Fi network
- ✅ Test ESP32 endpoint in browser

**Problem: Map not displaying**
- ✅ Check internet connection (for map tiles)
- ✅ Verify GPS coordinates are valid
- ✅ Ensure app is built with native modules (not Expo Go)

**Problem: Notifications not working**
- ✅ Check notification permissions
- ✅ Verify device is real device (not emulator)
- ✅ Test notification button in Settings

---

## 📚 Technical Details

### Why Expo Go Cannot Be Used

1. **Native Modules**: Expo Go doesn't support custom native modules
2. **react-native-maps**: Requires native compilation
3. **Limited APIs**: Some features restricted in Expo Go
4. **Production Ready**: APK is optimized for production

### Why APK Must Be Rebuilt

1. **Native Compilation**: Includes compiled native code
2. **Optimization**: Smaller file size, better performance
3. **Production Ready**: No development tools included
4. **Custom Modules**: Supports all native modules

### IR Flame Sensor Severity Detection

**How it works:**
- IR sensors detect infrared radiation (700-1000nm wavelength)
- Stronger flames emit more IR radiation
- Sensor outputs lower voltage for stronger flames
- ESP32 reads analog value (0-4095)
- Lower values = higher severity

**Calibration:**
- Test with controlled flame sources
- Adjust thresholds based on sensor model
- Consider distance and environment

### GPS Data Acquisition

**How it works:**
- GPS module receives signals from satellites
- Minimum 4 satellites needed for fix
- NMEA sentences contain coordinate data
- TinyGPS++ library parses data
- Coordinates extracted: latitude, longitude

**Accuracy:**
- Outdoor: 3-5 meters
- Indoor: May not work
- Cold start: 30-60 seconds
- Warm start: 5-10 seconds

---

## 🎨 Severity-Based UI Behavior

### LOW Severity (Yellow)
- Color: `#eab308` (Yellow)
- Notification: Standard priority
- Sound: Soft alert tone

### MODERATE Severity (Orange)
- Color: `#f97316` (Orange)
- Notification: High priority
- Sound: Medium alert tone

### HIGH Severity (Red)
- Color: `#ef4444` (Red)
- Notification: High priority
- Sound: Loud alert tone

### EXTREME Severity (Purple/Red)
- Color: `#9333ea` (Purple)
- Notification: Maximum priority
- Sound: Emergency siren
- Visual: Flashing red background

---

## 📝 API Documentation

### Endpoint: GET /fire-alert

**Request:**
```
GET http://ESP32_IP_ADDRESS/fire-alert
```

**Response:**
```json
{
  "severity": "HIGH",
  "time": "2026-01-22 21:35",
  "latitude": 16.615,
  "longitude": 120.316
}
```

**Response Fields:**
- `severity`: String - "LOW", "MODERATE", "HIGH", "EXTREME", or "NONE"
- `time`: String - Timestamp in format "YYYY-MM-DD HH:MM"
- `latitude`: Float - GPS latitude (6 decimal places)
- `longitude`: Float - GPS longitude (6 decimal places)

**Status Codes:**
- `200 OK`: Successful response
- `500 Internal Server Error`: ESP32 error

---

## 🚀 Future Enhancements

1. **Push Notifications**: Cloud-based alerts when app is closed
2. **Multiple Sensors**: Support multiple ESP32 devices
3. **Historical Data**: Store alert history in database
4. **User Authentication**: Secure access to alerts
5. **Alert Sharing**: Share alerts with emergency services
6. **Battery Monitoring**: Track ESP32 battery level
7. **Sensor Calibration UI**: Adjust thresholds from mobile app

---

## 📄 License

© 2026 All Rights Reserved

---

## 👥 Support

For issues or questions:
1. Check Troubleshooting section
2. Review Serial Monitor output
3. Verify network connectivity
4. Test ESP32 endpoint in browser

---

**System Architecture:**
- **Hardware**: ESP32 + IR Flame Sensor + GPS Module
- **Communication**: Wi-Fi HTTP REST API
- **Mobile App**: React Native with Expo
- **Platform**: Android (APK)

**Perfect for:**
- Thesis/Capstone projects
- Fire detection systems
- Emergency response applications
- IoT sensor networks
