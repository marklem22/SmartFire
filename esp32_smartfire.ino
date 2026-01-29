/*
 * SMARTFIRE LINK - ESP32 Arduino Code
 * IR Flame Sensor with GPS-Based Emergency Response
 * 
 * Hardware Requirements:
 * - ESP32 Development Board
 * - IR Flame Sensor (analog output connected to GPIO34)
 * - GPS Module (NEO-6M or similar, connected via Serial2)
 * - Wi-Fi connection
 * 
 * Functionality:
 * - Reads analog values from IR Flame Sensor
 * - Classifies fire severity (LOW/MODERATE/HIGH/EXTREME)
 * - Reads GPS coordinates
 * - Exposes HTTP endpoint /fire-alert
 * - Returns JSON with severity, time, latitude, longitude
 */

#include <WiFi.h>
#include <WebServer.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>

// ==================== CONFIGURATION ====================
// Wi-Fi Credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Hardware Pins
const int FLAME_SENSOR_PIN = 34;  // Analog pin for IR Flame Sensor
const int GPS_RX_PIN = 16;        // GPS RX pin
const int GPS_TX_PIN = 17;        // GPS TX pin

// Severity Thresholds (analog values 0-4095 for ESP32)
// Lower values = stronger flame detection
const int EXTREME_THRESHOLD = 500;   // Very strong flame
const int HIGH_THRESHOLD = 1000;      // Strong flame
const int MODERATE_THRESHOLD = 2000; // Moderate flame
const int LOW_THRESHOLD = 3000;      // Weak flame

// ==================== GLOBAL OBJECTS ====================
WebServer server(80);
TinyGPSPlus gps;
HardwareSerial GPS_Serial(2);  // Use Serial2 for GPS

// ==================== FIRE SEVERITY CLASSIFICATION ====================
/*
 * How IR Flame Sensor Determines Severity:
 * 
 * IR Flame Sensors detect infrared radiation emitted by flames.
 * The sensor outputs an analog voltage:
 * - LOW voltage (0-500) = Strong flame detected (EXTREME)
 * - MEDIUM voltage (500-1000) = Strong flame (HIGH)
 * - MEDIUM-HIGH voltage (1000-2000) = Moderate flame (MODERATE)
 * - HIGH voltage (2000-3000) = Weak flame (LOW)
 * - VERY HIGH voltage (>3000) = No flame detected
 * 
 * The sensor is more sensitive to stronger flames, hence lower values
 * indicate higher severity.
 */
String classifySeverity(int sensorValue) {
  if (sensorValue < EXTREME_THRESHOLD) {
    return "EXTREME";
  } else if (sensorValue < HIGH_THRESHOLD) {
    return "HIGH";
  } else if (sensorValue < MODERATE_THRESHOLD) {
    return "MODERATE";
  } else if (sensorValue < LOW_THRESHOLD) {
    return "LOW";
  } else {
    return "NONE";  // No flame detected
  }
}

// ==================== GPS DATA READING ====================
/*
 * How GPS Data is Obtained:
 * 
 * The GPS module (NEO-6M) communicates via UART (Serial).
 * It continuously receives satellite signals and calculates:
 * - Latitude (degrees, -90 to +90)
 * - Longitude (degrees, -180 to +180)
 * 
 * The TinyGPS++ library parses NMEA sentences from the GPS module
 * and extracts coordinate data. GPS needs clear sky view to work.
 */
void readGPS() {
  // Read GPS data from Serial2
  while (GPS_Serial.available() > 0) {
    gps.encode(GPS_Serial.read());
  }
}

bool isGPSValid() {
  return gps.location.isValid() && gps.location.age() < 2000;  // Data less than 2 seconds old
}

// ==================== TIMESTAMP GENERATION ====================
String getTimestamp() {
  // Get current time (you can use NTP for accurate time, or RTC module)
  // For simplicity, using millis() - adjust based on your needs
  unsigned long currentMillis = millis();
  unsigned long seconds = currentMillis / 1000;
  unsigned long minutes = seconds / 60;
  unsigned long hours = minutes / 60;
  
  // Format: YYYY-MM-DD HH:MM
  // Note: This is a simple implementation. For production, use NTP or RTC
  String timestamp = "2026-01-22 ";
  if (hours % 24 < 10) timestamp += "0";
  timestamp += String(hours % 24);
  timestamp += ":";
  if (minutes % 60 < 10) timestamp += "0";
  timestamp += String(minutes % 60);
  
  return timestamp;
}

// ==================== HTTP ENDPOINT HANDLER ====================
void handleFireAlert() {
  // Read flame sensor
  int sensorValue = analogRead(FLAME_SENSOR_PIN);
  String severity = classifySeverity(sensorValue);
  
  // Read GPS data
  readGPS();
  
  // Prepare JSON response
  String jsonResponse = "{";
  jsonResponse += "\"severity\":\"" + severity + "\",";
  
  // Add timestamp
  jsonResponse += "\"time\":\"" + getTimestamp() + "\",";
  
  // Add GPS coordinates (use default if GPS not ready)
  if (isGPSValid()) {
    jsonResponse += "\"latitude\":" + String(gps.location.lat(), 6) + ",";
    jsonResponse += "\"longitude\":" + String(gps.location.lng(), 6);
  } else {
    // Default coordinates (La Union, Philippines - adjust to your location)
    jsonResponse += "\"latitude\":16.615,";
    jsonResponse += "\"longitude\":120.316";
  }
  
  jsonResponse += "}";
  
  // Send JSON response
  server.send(200, "application/json", jsonResponse);
  
  // Debug output
  Serial.print("Fire Alert - Severity: ");
  Serial.print(severity);
  Serial.print(", Sensor Value: ");
  Serial.println(sensorValue);
}

// ==================== SETUP ====================
void setup() {
  // Initialize Serial for debugging
  Serial.begin(115200);
  delay(1000);
  
  // Initialize GPS Serial
  GPS_Serial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  
  // Initialize Flame Sensor pin
  pinMode(FLAME_SENSOR_PIN, INPUT);
  
  // Connect to Wi-Fi
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("");
  Serial.println("Wi-Fi connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
  
  // Setup HTTP endpoints
  server.on("/fire-alert", handleFireAlert);
  
  // Start web server
  server.begin();
  Serial.println("HTTP server started");
  Serial.println("Endpoint: http://" + WiFi.localIP().toString() + "/fire-alert");
}

// ==================== MAIN LOOP ====================
void loop() {
  // Handle HTTP requests
  server.handleClient();
  
  // Continuously read GPS data
  readGPS();
  
  // Small delay to prevent overwhelming the system
  delay(100);
}
