# SMARTFIRE LINK - System Documentation

## System Overview

SMARTFIRE LINK is a Mobile-Connected Flame Detection System with GPS-Based Emergency Response. The system consists of:

1. **ESP32 Hardware Module** - Detects fires using IR Flame Sensor and provides GPS coordinates
2. **Mobile Application** - Receives alerts and displays fire location on map

---

## Hardware Components

### ESP32 Development Board
- Wi-Fi capable microcontroller
- Analog input pins for sensor reading
- Serial communication for GPS module

### IR Flame Sensor
- Detects infrared radiation from flames
- Outputs analog voltage (0-3.3V)
- More sensitive to stronger flames

### GPS Module (NEO-6M)
- Provides latitude and longitude coordinates
- Requires clear view of sky for satellite signals
- Communicates via UART/Serial

---

## How IR Flame Sensor Determines Severity

### Working Principle

IR Flame Sensors detect infrared radiation (wavelength 700nm - 1000nm) emitted by flames. The sensor contains:

1. **IR Receiver** - Detects IR radiation
2. **Amplifier Circuit** - Converts IR signal to voltage
3. **Analog Output** - Voltage level indicates flame intensity

### Severity Classification

The ESP32 reads analog values (0-4095) from the sensor:

| Sensor Value | Severity Level | Meaning |
|-------------|---------------|---------|
| 0 - 500 | EXTREME | Very strong flame detected |
| 500 - 1000 | HIGH | Strong flame detected |
| 1000 - 2000 | MODERATE | Moderate flame detected |
| 2000 - 3000 | LOW | Weak flame detected |
| > 3000 | NONE | No flame detected |

**Why lower values = higher severity?**

Stronger flames emit more IR radiation, causing the sensor to output lower voltage. The sensor is inversely proportional - stronger detection = lower analog reading.

### Calibration

Thresholds can be adjusted based on:
- Sensor model and sensitivity
- Distance from flame source
- Environmental conditions
- Testing with controlled fire sources

---

## How GPS Data is Obtained

### GPS Module Operation

1. **Satellite Reception**: GPS module receives signals from multiple satellites (minimum 4 for accurate positioning)

2. **NMEA Sentences**: Module outputs standard NMEA (National Marine Electronics Association) sentences containing:
   - Latitude (degrees, -90 to +90)
   - Longitude (degrees, -180 to +180)
   - Altitude
   - Time
   - Satellite count

3. **UART Communication**: GPS module communicates via Serial/UART at 9600 baud rate

4. **TinyGPS++ Library**: Parses NMEA sentences and extracts coordinate data

### GPS Accuracy

- **Outdoor**: 3-5 meter accuracy (clear sky view)
- **Indoor**: May not work (requires satellite signals)
- **Cold Start**: First fix takes 30-60 seconds
- **Warm Start**: Subsequent fixes are faster (5-10 seconds)

### Code Implementation

```cpp
// GPS reads continuously from Serial2
while (GPS_Serial.available() > 0) {
  gps.encode(GPS_Serial.read());
}

// Check if GPS data is valid and recent
if (gps.location.isValid() && gps.location.age() < 2000) {
  // Use GPS coordinates
  latitude = gps.location.lat();
  longitude = gps.location.lng();
}
```

---

## Communication Architecture

### Wi-Fi + HTTP REST API

**Why HTTP instead of MQTT/WebSocket?**

1. **Simplicity**: HTTP is easier to implement and debug
2. **No Broker Required**: Direct communication between ESP32 and mobile app
3. **Standard Protocol**: Works with any HTTP client
4. **Thesis-Friendly**: Straightforward to document and explain

### Network Flow

```
ESP32 (Wi-Fi Server)          Mobile App (HTTP Client)
     |                                |
     |<-- HTTP GET /fire-alert --------|
     |                                |
     |--- JSON Response ------------->|
     |  {                             |
     |    "severity": "HIGH",         |
     |    "time": "2026-01-22 21:35", |
     |    "latitude": 16.615,         |
     |    "longitude": 120.316        |
     |  }                             |
```

### ESP32 as Web Server

- ESP32 creates a local Wi-Fi web server
- Mobile app connects to same Wi-Fi network
- App polls `/fire-alert` endpoint every second
- ESP32 responds with current fire status

---

## Mobile Application Architecture

### React Native with Expo

**Why Expo?**

1. **Rapid Development**: Pre-configured build tools
2. **Cross-Platform**: Single codebase for Android/iOS
3. **Native Modules**: Access to device features (GPS, notifications)
4. **Easy Deployment**: Simplified build process

### Why Expo Go Cannot Be Used

**Expo Go Limitations:**

1. **Native Modules**: Expo Go doesn't support custom native modules like `react-native-maps`
2. **Limited APIs**: Some native features are restricted
3. **Development Only**: Not suitable for production deployment
4. **No Custom Native Code**: Can't add ESP32-specific integrations

**Our Requirements:**

- `react-native-maps` - Native module for map display
- `expo-notifications` - Local notifications (works in Expo Go, but we need full control)
- Custom HTTP polling - Better performance in production build

### Why APK Must Be Rebuilt

**Development Build vs Production APK:**

1. **Development Build**:
   - Includes Expo development tools
   - Larger file size
   - Debugging overhead
   - Not optimized

2. **Production APK**:
   - Optimized and minified code
   - Smaller file size
   - Better performance
   - No development tools
   - Ready for distribution

**Rebuild Process:**

```bash
# Build production APK
npx expo build:android

# Or using EAS Build
eas build --platform android --profile production
```

The rebuild includes:
- All native modules compiled
- Optimized JavaScript bundle
- App icons and splash screens
- Production-ready configuration

---

## System Workflow

### 1. Fire Detection

```
IR Flame Sensor → Analog Reading → Severity Classification
                                      ↓
                                 LOW/MODERATE/HIGH/EXTREME
```

### 2. Data Collection

```
GPS Module → NMEA Sentences → Latitude/Longitude
ESP32 Clock → Timestamp Generation
```

### 3. HTTP Endpoint

```
Mobile App → GET /fire-alert → ESP32
ESP32 → JSON Response → Mobile App
```

### 4. Alert Processing

```
Mobile App receives JSON → Check severity → Trigger notification
                                 ↓
                    Display popup + Show on map
```

---

## Severity-Based UI Behavior

### LOW Severity (Yellow Warning)
- **Color**: Yellow (#eab308)
- **Icon**: Warning symbol
- **Sound**: Soft alert tone
- **Vibration**: Single pulse

### MODERATE Severity (Orange Alert)
- **Color**: Orange (#f97316)
- **Icon**: Alert symbol
- **Sound**: Medium alert tone
- **Vibration**: Double pulse

### HIGH Severity (Red Alert)
- **Color**: Red (#ef4444)
- **Icon**: Fire symbol
- **Sound**: Loud alert tone
- **Vibration**: Continuous pulse

### EXTREME Severity (Emergency Style)
- **Color**: Purple/Red (#9333ea)
- **Icon**: Emergency symbol
- **Sound**: Emergency siren
- **Vibration**: Rapid continuous
- **Visual**: Flashing red background
- **Priority**: Highest notification priority

---

## API Endpoint Specification

### GET /fire-alert

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
- `latitude`: Float - GPS latitude coordinate (6 decimal places)
- `longitude`: Float - GPS longitude coordinate (6 decimal places)

**Status Codes:**
- `200 OK`: Successful response with fire alert data
- `500 Internal Server Error`: ESP32 error (rare)

---

## Testing and Calibration

### Flame Sensor Calibration

1. **No Flame**: Record sensor value (should be > 3000)
2. **Weak Flame**: Hold lighter 1 meter away, record value
3. **Moderate Flame**: Hold lighter 50cm away, record value
4. **Strong Flame**: Hold lighter 20cm away, record value
5. **Adjust Thresholds**: Modify threshold constants based on readings

### GPS Testing

1. **Outdoor Test**: Place GPS module with clear sky view
2. **Wait for Fix**: Allow 30-60 seconds for first satellite lock
3. **Verify Coordinates**: Check if coordinates match actual location
4. **Test Movement**: Move device and verify coordinates update

### End-to-End Testing

1. **Connect ESP32 to Wi-Fi**: Verify IP address
2. **Open Mobile App**: Connect to same Wi-Fi network
3. **Trigger Fire**: Use lighter/flame near sensor
4. **Verify Alert**: Check if notification appears
5. **Check Map**: Verify location is displayed correctly

---

## Troubleshooting

### ESP32 Not Connecting to Wi-Fi
- Check SSID and password
- Verify Wi-Fi signal strength
- Check ESP32 Wi-Fi antenna

### GPS Not Getting Fix
- Ensure clear view of sky
- Wait longer for first fix (up to 60 seconds)
- Check GPS module connections
- Verify GPS module power supply

### Mobile App Not Receiving Alerts
- Verify same Wi-Fi network
- Check ESP32 IP address
- Test endpoint in browser first
- Verify HTTP polling is working

### Map Not Displaying
- Check internet connection (for map tiles)
- Verify GPS coordinates are valid
- Check map API key (if using Google Maps)
- Ensure react-native-maps is properly installed

---

## Future Enhancements

1. **Push Notifications**: Cloud-based alerts when app is closed
2. **Multiple Sensors**: Support multiple ESP32 devices
3. **Historical Data**: Store alert history in database
4. **User Authentication**: Secure access to alerts
5. **Alert Sharing**: Share alerts with emergency services
6. **Battery Monitoring**: Track ESP32 battery level
7. **Sensor Calibration UI**: Adjust thresholds from mobile app

---

## Conclusion

SMARTFIRE LINK provides a complete solution for fire detection and emergency response using:

- **Hardware**: ESP32 + IR Flame Sensor + GPS Module
- **Communication**: Wi-Fi HTTP REST API
- **Mobile App**: React Native with Expo
- **Features**: Real-time alerts, map display, severity classification

The system is designed for thesis/capstone documentation with clear explanations and beginner-friendly code structure.
