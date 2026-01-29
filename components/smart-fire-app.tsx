import { MaterialIcons } from '@expo/vector-icons';
import React, { ReactNode, useState, useEffect, useRef } from 'react';
import { Button, Dimensions, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MapView, Marker } from './map-imports';

let WebView: any = null;
try {
  WebView = require('react-native-webview').WebView;
} catch (e) {
  // WebView not available
}

// Interface for ESP32 fire alert response
interface ESP32FireAlert {
  severity: string;
  time: string;
  latitude: number;
  longitude: number;
}

// Interface for app alert
interface FireAlert {
  id: number;
  severity: string;
  location: string;
  coordinates: { lat: number; lng: number };
  time: Date;
  status: 'active' | 'resolved';
}

export default function SmartFireApp(): ReactNode {
  const [activeTab, setActiveTab] = useState('home');
  const [alerts, setAlerts] = useState<FireAlert[]>([]);
  const [showAlert, setShowAlert] = useState<any>(null);
  const [selectedAlertForMap, setSelectedAlertForMap] = useState<any>(null);
  const [esp32IpAddress, setEsp32IpAddress] = useState<string>('192.168.1.100'); // Default ESP32 IP
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [lastAlertHash, setLastAlertHash] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simulationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Test fire locations (Philippines coordinates around Mindanao region)
  const testLocations = [
    { lat: 16.6542, lng: 120.3456, name: 'Bacolod City' },
    { lat: 16.8850, lng: 120.2726, name: 'Negros Occidental' },
    { lat: 16.4247, lng: 120.5988, name: 'Antique Province' },
    { lat: 16.9974, lng: 120.6821, name: 'Aklan Province' },
    { lat: 16.5952, lng: 120.1949, name: 'Silay City' },
    { lat: 16.7471, lng: 120.4097, name: 'Cadiz City' },
    { lat: 16.5453, lng: 120.6236, name: 'Iloilo City' },
  ];

  /**
   * Generates a fake fire alert for testing
   */
  const generateTestFireAlert = () => {
    const location = testLocations[Math.floor(Math.random() * testLocations.length)];
    const severities: Array<'low' | 'moderate' | 'high' | 'extreme'> = ['low', 'moderate', 'high', 'extreme'];
    const severity = severities[Math.floor(Math.random() * severities.length)];
    
    const newAlert: FireAlert = {
      id: Date.now(),
      severity: severity,
      location: `${location.name} (SIM)`,
      coordinates: {
        lat: location.lat + (Math.random() - 0.5) * 0.02, // Random variation within ~1km
        lng: location.lng + (Math.random() - 0.5) * 0.02,
      },
      time: new Date(),
      status: 'active',
    };

    setAlerts(prevAlerts => [newAlert, ...prevAlerts]);
    setShowAlert(newAlert);
    triggerFireAlertNotification(newAlert);
  };

  /**
   * Starts simulation mode - generates random fire alerts
   */
  const startSimulation = () => {
    setIsSimulating(true);
    // Generate first alert immediately
    generateTestFireAlert();
    
    // Then generate new alerts every 5-10 seconds
    simulationIntervalRef.current = setInterval(() => {
      generateTestFireAlert();
    }, 5000 + Math.random() * 5000);
  };

  /**
   * Stops simulation mode
   */
  const stopSimulation = () => {
    setIsSimulating(false);
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
  };

  const notifyNow = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'It works! 🎉',
        body: 'Local notification fired successfully.',
      },
      trigger: null,
    });
  };

  // Removed unused delayed notification function to satisfy typings

  // ==================== ESP32 POLLING FUNCTIONS ====================
  
  /**
   * Polls ESP32 endpoint every second to check for fire alerts
   * This function runs continuously when the app is active
   */
  const pollESP32Endpoint = async () => {
    if (!esp32IpAddress || Platform.OS === 'web') {
      return; // Skip polling on web or if no IP configured
    }

    try {
      const url = `http://${esp32IpAddress}/fire-alert`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        // Timeout after 2 seconds
        signal: AbortSignal.timeout(2000),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ESP32FireAlert = await response.json();
      
      // Check if fire is detected (severity is not "NONE")
      if (data.severity && data.severity !== 'NONE') {
        // Create hash to detect new alerts
        const alertHash = `${data.severity}-${data.latitude}-${data.longitude}-${data.time}`;
        
        // Only process if this is a new alert
        if (alertHash !== lastAlertHash) {
          setLastAlertHash(alertHash);
          
          // Parse timestamp from ESP32
          const alertTime = parseESP32Timestamp(data.time);
          
          // Create new alert object
          const newAlert: FireAlert = {
            id: Date.now(), // Use timestamp as unique ID
            severity: data.severity.toLowerCase(),
            location: `GPS: ${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`,
            coordinates: {
              lat: data.latitude,
              lng: data.longitude,
            },
            time: alertTime,
            status: 'active',
          };

          // Add alert to state
          setAlerts(prevAlerts => {
            // Check if alert already exists (same coordinates within 10 meters)
            const exists = prevAlerts.some(alert => 
              Math.abs(alert.coordinates.lat - newAlert.coordinates.lat) < 0.0001 &&
              Math.abs(alert.coordinates.lng - newAlert.coordinates.lng) < 0.0001 &&
              alert.status === 'active'
            );
            
            if (!exists) {
              // Trigger notification
              triggerFireAlertNotification(newAlert);
              
              // Show popup alert
              setShowAlert(newAlert);
              
              // Return new alerts array with new alert at the beginning
              return [newAlert, ...prevAlerts];
            }
            return prevAlerts;
          });
        }
      }
    } catch (error: any) {
      // Silently handle errors (network issues, ESP32 offline, etc.)
      // Uncomment for debugging:
      // console.log('ESP32 polling error:', error.message);
    }
  };

  /**
   * Triggers a local notification based on fire severity
   * Different severity levels have different notification styles
   */
  const triggerFireAlertNotification = async (alert: FireAlert) => {
    const severityConfig = {
      low: {
        title: 'Fire Alert - LOW 🔥',
        body: `Weak flame detected at ${alert.location}`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      },
      moderate: {
        title: 'Fire Alert - MODERATE 🔥',
        body: `Moderate flame detected at ${alert.location}`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      high: {
        title: 'Fire Alert - HIGH 🔥',
        body: `Strong flame detected at ${alert.location}`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      extreme: {
        title: 'EMERGENCY - EXTREME FIRE ALERT 🔥',
        body: `CRITICAL: Extreme flame detected at ${alert.location}`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
    };

    const config = severityConfig[alert.severity as keyof typeof severityConfig] || severityConfig.low;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: config.title,
        body: config.body,
        sound: config.sound,
        data: {
          alertId: alert.id,
          severity: alert.severity,
          coordinates: alert.coordinates,
        },
      },
      trigger: null, // Fire immediately
    });
  };

  /**
   * Parses timestamp from ESP32 format "YYYY-MM-DD HH:MM" to Date object
   */
  const parseESP32Timestamp = (timestamp: string): Date => {
    try {
      // ESP32 format: "2026-01-22 21:35"
      const [datePart, timePart] = timestamp.split(' ');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes] = timePart.split(':').map(Number);
      
      return new Date(year, month - 1, day, hours, minutes);
    } catch (error) {
      // If parsing fails, return current time
      return new Date();
    }
  };

  /**
   * Starts polling ESP32 endpoint every second
   */
  const startPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    setIsPolling(true);
    // Poll immediately, then every second
    pollESP32Endpoint();
    pollingIntervalRef.current = setInterval(pollESP32Endpoint, 1000);
  };

  /**
   * Stops polling ESP32 endpoint
   */
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
  };

  /**
   * Saves ESP32 IP address to AsyncStorage
   */
  const saveESP32IP = async (ip: string) => {
    try {
      await AsyncStorage.setItem('esp32_ip_address', ip);
      setEsp32IpAddress(ip);
      Alert.alert('Success', 'ESP32 IP address saved!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save IP address');
    }
  };

  /**
   * Loads ESP32 IP address from AsyncStorage on app start
   */
  useEffect(() => {
    const loadESP32IP = async () => {
      try {
        const savedIP = await AsyncStorage.getItem('esp32_ip_address');
        if (savedIP) {
          setEsp32IpAddress(savedIP);
        }
      } catch (error) {
        console.log('Error loading ESP32 IP:', error);
      }
    };
    
    loadESP32IP();
  }, []);

  /**
   * Start/stop polling when IP address changes or component mounts
   */
  useEffect(() => {
    if (esp32IpAddress && Platform.OS !== 'web') {
      startPolling();
    }
    
    // Cleanup on unmount
    return () => {
      stopPolling();
    };
  }, [esp32IpAddress]);

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      low: 'bg-yellow-500',
      moderate: 'bg-orange-500',
      high: 'bg-red-500',
      extreme: 'bg-purple-600'
    };
    return colors[severity] || 'bg-gray-500';
  };

  const getSeverityMarkerColor = (severity: string) => {
    const colors: Record<string, string> = {
      low: '#eab308',
      moderate: '#f97316',
      high: '#ef4444',
      extreme: '#9333ea'
    };
    return colors[severity] || '#6b7280';
  };

  // Calculate region to show all alerts or focus on selected alert
  const getMapRegion = (focusAlert?: any) => {
    // If there's a selected alert to focus on, center on that
    if (focusAlert) {
      return {
        latitude: focusAlert.coordinates.lat,
        longitude: focusAlert.coordinates.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    if (alerts.length === 0) {
      return {
        latitude: 16.6542,
        longitude: 120.3456,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };
    }

    const lats = alerts.map(a => a.coordinates.lat);
    const lngs = alerts.map(a => a.coordinates.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latDelta = (maxLat - minLat) * 1.5 || 0.1;
    const lngDelta = (maxLng - minLng) * 1.5 || 0.1;

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(latDelta, 0.05),
      longitudeDelta: Math.max(lngDelta, 0.05),
    };
  };

  const getSeverityBg = (severity: string) => {
    const colors: Record<string, string> = {
      low: 'bg-yellow-50 border-yellow-200',
      moderate: 'bg-orange-50 border-orange-200',
      high: 'bg-red-50 border-red-200',
      extreme: 'bg-purple-50 border-purple-200'
    };
    return colors[severity] || 'bg-gray-50 border-gray-200';
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const handleViewOnMap = (alert: any) => {
    setSelectedAlertForMap(alert);
    setActiveTab('map');
    setShowAlert(null);
  };

  const AlertPopup = ({ alert, onClose }: { alert: any; onClose: () => void }) => (
    <View style={styles.alertOverlay}>
      <View style={[styles.alertContainer, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
        <View style={styles.alertHeader}>
          <View style={styles.alertHeaderLeft}>
            <View style={[styles.alertIconContainer, { backgroundColor: '#dc2626' }]}>
              <MaterialIcons name="local-fire-department" size={24} color="white" />
            </View>
            <View>
              <Text style={styles.alertTitle}>Fire Detected!</Text>
              <View style={[styles.severityBadge, { backgroundColor: '#dc2626' }]}>
                <Text style={styles.severityBadgeText}>{alert.severity}</Text>
              </View>
            </View>
          </View>
          <Pressable onPress={onClose}>
            <Text style={styles.closeButton}>×</Text>
          </Pressable>
        </View>

        <View style={styles.alertContent}>
          <View style={styles.alertRow}>
            <MaterialIcons name="place" size={20} color="#dc2626" />
            <View style={styles.alertRowContent}>
              <Text style={styles.alertLabel}>Location</Text>
              <Text style={styles.alertValue}>{alert.location}</Text>
              <Text style={styles.alertSubtext}>
                {alert.coordinates.lat.toFixed(4)}, {alert.coordinates.lng.toFixed(4)}
              </Text>
            </View>
          </View>

          <View style={styles.alertRow}>
            <MaterialIcons name="access-time" size={20} color="#6b7280" />
            <View style={styles.alertRowContent}>
              <Text style={styles.alertLabel}>Time Detected</Text>
              <Text style={styles.alertValue}>{alert.time.toLocaleTimeString()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.alertActions}>
          <Pressable 
            style={[styles.alertButton, styles.primaryButton]}
            onPress={() => handleViewOnMap(alert)}
          >
            <Text style={styles.primaryButtonText}>View on Map</Text>
          </Pressable>
          <Pressable onPress={onClose} style={[styles.alertButton, styles.secondaryButton]}>
            <Text style={styles.secondaryButtonText}>Dismiss</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  const HomePage = () => (
    <View style={styles.pageContainer}>
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View>
            <Text style={styles.heroTitle}>SmartFire Link</Text>
            <Text style={styles.heroSubtitle}>Real-time Fire Detection</Text>
          </View>
          <MaterialIcons name="local-fire-department" size={48} color="white" />
        </View>
        <View style={styles.statsCard}>
          <View style={styles.statsContent}>
            <Text style={styles.statsLabel}>Active Alerts</Text>
            <Text style={styles.statsValue}>{alerts.filter(a => a.status === 'active').length}</Text>
          </View>
          <MaterialIcons name="notifications" size={32} color="white" />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Alerts</Text>
        <View style={styles.alertsList}>
          {alerts.filter(a => a.status === 'active').map(alert => (
            <Pressable
              key={alert.id}
              onPress={() => setShowAlert(alert)}
              style={[styles.alertCard, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}
            >
              <View style={styles.alertCardHeader}>
                <View style={styles.alertCardLeft}>
                  <View style={[styles.alertCardIcon, { backgroundColor: '#dc2626' }]}>
                    <MaterialIcons name="local-fire-department" size={20} color="white" />
                  </View>
                  <View style={[styles.severityBadge, { backgroundColor: '#dc2626' }]}>
                    <Text style={styles.severityBadgeText}>{alert.severity}</Text>
                  </View>
                </View>
                <Text style={styles.alertTime}>{formatTime(alert.time)}</Text>
              </View>

              <View style={styles.alertCardBody}>
                <View style={styles.alertCardRow}>
                  <MaterialIcons name="place" size={16} color="#6b7280" />
                  <Text style={styles.alertCardText}>{alert.location}</Text>
                </View>
                <View style={styles.alertCardRow}>
                  <MaterialIcons name="access-time" size={16} color="#6b7280" />
                  <Text style={styles.alertCardSubtext}>{alert.time.toLocaleString()}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      {alerts.filter(a => a.status === 'active').length === 0 && (
        <View style={styles.emptyState}>
          <View style={styles.emptyStateIcon}>
            <MaterialIcons name="local-fire-department" size={40} color="#16a34a" />
          </View>
          <Text style={styles.emptyStateText}>No active fire alerts</Text>
          <Text style={styles.emptyStateSubtext}>All systems operational</Text>
        </View>
      )}
    </View>
  );

  const HistoryPage = () => (
    <View style={styles.pageContainer}>
      <Text style={styles.pageTitle}>Alert History</Text>
      <View style={styles.alertsList}>
        {alerts.map(alert => (
          <View
            key={alert.id}
            style={[
              styles.alertCard,
              alert.status === 'active' 
                ? { backgroundColor: '#fef2f2', borderColor: '#fecaca' }
                : { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }
            ]}
          >
            <View style={styles.alertCardHeader}>
              <View style={styles.alertCardLeft}>
                  <View style={[
                  styles.alertCardIcon,
                  { backgroundColor: alert.status === 'active' ? '#dc2626' : '#9ca3af' }
                ]}>
                  <MaterialIcons name="local-fire-department" size={20} color="white" />
                </View>
                <View>
                  <View style={[
                    styles.severityBadge,
                    { backgroundColor: alert.status === 'active' ? '#dc2626' : '#9ca3af' }
                  ]}>
                    <Text style={styles.severityBadgeText}>{alert.severity}</Text>
                  </View>
                  {alert.status === 'resolved' && (
                    <View style={[styles.statusBadge, { backgroundColor: '#22c55e' }]}>
                      <Text style={styles.statusBadgeText}>Resolved</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={styles.alertTime}>{formatTime(alert.time)}</Text>
            </View>

            <View style={styles.alertCardBody}>
              <Text style={styles.alertCardText}>{alert.location}</Text>
              <Text style={styles.alertCardSubtext}>{alert.time.toLocaleString()}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  const MapPage = () => {
    const region = getMapRegion(selectedAlertForMap);
    const { width, height } = Dimensions.get('window');
    const mapHeight = height - 200; // Account for nav bar and padding

    // For web, show interactive map with links to Google Maps
    if (Platform.OS === 'web') {
      // Create Google Maps URL with all markers
      const markers = alerts.map(alert => {
        const color = getSeverityMarkerColor(alert.severity).replace('#', '');
        return `color:0x${color}|label:${alert.severity.charAt(0).toUpperCase()}|${alert.coordinates.lat},${alert.coordinates.lng}`;
      }).join('&markers=');
      
      const center = `${region.latitude},${region.longitude}`;
      // Use higher zoom if focusing on a specific alert
      const baseZoom = selectedAlertForMap ? 16 : Math.round(14 - Math.log(region.latitudeDelta) / Math.LN2);
      const mapUrl = `https://www.google.com/maps?q=${center}&z=${baseZoom}&t=k&output=embed`;

      return (
        <View style={styles.pageContainer}>
          <View style={styles.mapHeader}>
            <Text style={styles.pageTitle}>Fire Alert Map (Satellite View)</Text>
            <View style={styles.mapStatusBadge}>
              <View style={[styles.statusDot, { backgroundColor: isPolling ? '#22c55e' : '#ef4444' }]} />
              <Text style={styles.mapStatusText}>
                {isPolling ? 'Monitoring Active' : 'Monitoring Inactive'}
              </Text>
            </View>
          </View>
          {selectedAlertForMap && (
            <View style={styles.selectedAlertBanner}>
              <MaterialIcons name="place" size={20} color="#dc2626" />
              <Text style={styles.selectedAlertText}>
                Viewing: {selectedAlertForMap.location}
              </Text>
              <Pressable onPress={() => setSelectedAlertForMap(null)}>
                <MaterialIcons name="close" size={20} color="#6b7280" />
              </Pressable>
            </View>
          )}
          <View style={styles.mapContainer}>
            <iframe
              width="100%"
              height={mapHeight}
              style={{ border: 0, borderRadius: 12 }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              src={mapUrl}
            />
          </View>
          <View style={styles.mapLegend}>
            <Text style={styles.mapLegendTitle}>Legend</Text>
            <View style={styles.mapLegendItems}>
              <View style={styles.mapLegendItem}>
                <View style={[styles.mapLegendDot, { backgroundColor: '#9333ea' }]} />
                <Text style={styles.mapLegendText}>Extreme</Text>
              </View>
              <View style={styles.mapLegendItem}>
                <View style={[styles.mapLegendDot, { backgroundColor: '#ef4444' }]} />
                <Text style={styles.mapLegendText}>High</Text>
              </View>
              <View style={styles.mapLegendItem}>
                <View style={[styles.mapLegendDot, { backgroundColor: '#f97316' }]} />
                <Text style={styles.mapLegendText}>Moderate</Text>
              </View>
              <View style={styles.mapLegendItem}>
                <View style={[styles.mapLegendDot, { backgroundColor: '#eab308' }]} />
                <Text style={styles.mapLegendText}>Low</Text>
              </View>
            </View>
          </View>
          {selectedAlertForMap && (
            <View style={styles.selectedAlertBanner}>
              <MaterialIcons name="place" size={20} color="#dc2626" />
              <Text style={styles.selectedAlertText}>
                Viewing: {selectedAlertForMap.location}
              </Text>
              <Pressable onPress={() => setSelectedAlertForMap(null)}>
                <MaterialIcons name="close" size={20} color="#6b7280" />
              </Pressable>
            </View>
          )}
          <View style={styles.alertListOnMap}>
            <Text style={styles.mapLegendTitle}>Fire Alert Locations</Text>
            {alerts.length === 0 ? (
              <View style={styles.noAlertsContainer}>
                <MaterialIcons name="check-circle" size={24} color="#22c55e" />
                <Text style={styles.noAlertsText}>No fire detected</Text>
                <Text style={styles.noAlertsSubtext}>
                  Markers will appear here when IR flame sensor detects fire
                </Text>
              </View>
            ) : (
              alerts.map(alert => {
                const googleMapsUrl = `https://www.google.com/maps?q=${alert.coordinates.lat},${alert.coordinates.lng}&t=k`;
                const isSelected = selectedAlertForMap?.id === alert.id;
                return (
                  <Pressable
                    key={alert.id}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedAlertForMap(null);
                      } else {
                        setSelectedAlertForMap(alert);
                      }
                    }}
                    style={[
                      styles.mapAlertItem,
                      isSelected && styles.mapAlertItemSelected
                    ]}
                  >
                    <View style={[styles.mapAlertDot, { backgroundColor: getSeverityMarkerColor(alert.severity) }]} />
                    <View style={styles.mapAlertContent}>
                      <Text style={styles.mapAlertLocation}>{alert.location}</Text>
                      <Text style={styles.mapAlertSeverity}>
                        {alert.severity.toUpperCase()} • {alert.coordinates.lat.toFixed(4)}, {alert.coordinates.lng.toFixed(4)}
                      </Text>
                    </View>
                    <Pressable onPress={() => Linking.openURL(googleMapsUrl)}>
                      <MaterialIcons name="open-in-new" size={20} color="#6b7280" />
                    </Pressable>
                  </Pressable>
                );
              })
            )}
          </View>
        </View>
      );
    }

    // For native platforms, use react-native-maps if available, otherwise show web-based map
    if (!MapView || !Marker) {
      // Fallback: use web-based map view for native platforms
      return (
        <View style={styles.pageContainer}>
          <View style={styles.mapHeader}>
            <Text style={styles.pageTitle}>Fire Alert Map (Satellite View)</Text>
            <View style={styles.mapStatusBadge}>
              <View style={[styles.statusDot, { backgroundColor: isPolling ? '#22c55e' : '#ef4444' }]} />
              <Text style={styles.mapStatusText}>
                {isPolling ? 'Monitoring Active' : 'Monitoring Inactive'}
              </Text>
            </View>
          </View>
          {selectedAlertForMap && (
            <View style={styles.selectedAlertBanner}>
              <MaterialIcons name="place" size={20} color="#dc2626" />
              <Text style={styles.selectedAlertText}>
                Viewing: {selectedAlertForMap.location}
              </Text>
              <Pressable onPress={() => setSelectedAlertForMap(null)}>
                <MaterialIcons name="close" size={20} color="#6b7280" />
              </Pressable>
            </View>
          )}
          <View style={styles.mapContainer}>
            <WebView
              source={{ uri: `https://www.google.com/maps?q=${region.latitude},${region.longitude}&z=14&t=k&output=embed` }}
              style={{ width: '100%', height: mapHeight }}
              scalesPageToFit
            />
          </View>
          <View style={styles.mapLegend}>
            <Text style={styles.mapLegendTitle}>Legend</Text>
            <View style={styles.mapLegendItems}>
              <View style={styles.mapLegendItem}>
                <View style={[styles.mapLegendDot, { backgroundColor: '#9333ea' }]} />
                <Text style={styles.mapLegendText}>Extreme</Text>
              </View>
              <View style={styles.mapLegendItem}>
                <View style={[styles.mapLegendDot, { backgroundColor: '#ef4444' }]} />
                <Text style={styles.mapLegendText}>High</Text>
              </View>
              <View style={styles.mapLegendItem}>
                <View style={[styles.mapLegendDot, { backgroundColor: '#f97316' }]} />
                <Text style={styles.mapLegendText}>Moderate</Text>
              </View>
              <View style={styles.mapLegendItem}>
                <View style={[styles.mapLegendDot, { backgroundColor: '#eab308' }]} />
                <Text style={styles.mapLegendText}>Low</Text>
              </View>
            </View>
          </View>
          <View style={styles.alertListOnMap}>
            <Text style={styles.mapLegendTitle}>Fire Alert Locations</Text>
            {alerts.length === 0 ? (
              <View style={styles.noAlertsContainer}>
                <MaterialIcons name="check-circle" size={24} color="#22c55e" />
                <Text style={styles.noAlertsText}>No fire detected</Text>
                <Text style={styles.noAlertsSubtext}>
                  Markers will appear here when IR flame sensor detects fire
                </Text>
              </View>
            ) : (
              alerts.map(alert => {
                const googleMapsUrl = `https://www.google.com/maps?q=${alert.coordinates.lat},${alert.coordinates.lng}&t=k&z=16`;
                const isSelected = selectedAlertForMap?.id === alert.id;
                return (
                  <Pressable
                    key={alert.id}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedAlertForMap(null);
                      } else {
                        setSelectedAlertForMap(alert);
                      }
                    }}
                    style={[
                      styles.mapAlertItem,
                      isSelected && styles.mapAlertItemSelected
                    ]}
                  >
                    <View style={[styles.mapAlertDot, { backgroundColor: getSeverityMarkerColor(alert.severity) }]} />
                    <View style={styles.mapAlertContent}>
                      <Text style={styles.mapAlertLocation}>{alert.location}</Text>
                      <Text style={styles.mapAlertSeverity}>
                        {alert.severity.toUpperCase()} • {alert.coordinates.lat.toFixed(4)}, {alert.coordinates.lng.toFixed(4)}
                      </Text>
                    </View>
                    <Pressable onPress={() => Linking.openURL(googleMapsUrl)}>
                      <MaterialIcons name="open-in-new" size={20} color="#6b7280" />
                    </Pressable>
                  </Pressable>
                );
              })
            )}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.pageContainer}>
        <View style={styles.mapHeader}>
          <Text style={styles.pageTitle}>Fire Alert Map (Satellite View)</Text>
          <View style={styles.mapStatusBadge}>
            <View style={[styles.statusDot, { backgroundColor: isPolling ? '#22c55e' : '#ef4444' }]} />
            <Text style={styles.mapStatusText}>
              {isPolling ? 'Monitoring Active' : 'Monitoring Inactive'}
            </Text>
          </View>
        </View>
        {selectedAlertForMap && (
          <View style={styles.selectedAlertBanner}>
            <MaterialIcons name="place" size={20} color="#dc2626" />
            <Text style={styles.selectedAlertText}>
              Viewing: {selectedAlertForMap.location}
            </Text>
            <Pressable onPress={() => setSelectedAlertForMap(null)}>
              <MaterialIcons name="close" size={20} color="#6b7280" />
            </Pressable>
          </View>
        )}
        
        <View style={[styles.mapContainer, { height: mapHeight }]}>
          <MapView
            key={selectedAlertForMap?.id || 'all-alerts'}
            style={styles.map}
            region={region}
            mapType="satellite"
            showsUserLocation={true}
            showsMyLocationButton={true}
          >
            {alerts.map(alert => (
              <Marker
                key={alert.id}
                coordinate={{
                  latitude: alert.coordinates.lat,
                  longitude: alert.coordinates.lng,
                }}
                pinColor={getSeverityMarkerColor(alert.severity)}
                title={alert.location}
                description={`${alert.severity.toUpperCase()} • ${formatTime(alert.time)}`}
                onPress={() => setSelectedAlertForMap(alert)}
              />
            ))}
          </MapView>
        </View>
        <View style={styles.mapLegend}>
          <Text style={styles.mapLegendTitle}>Legend</Text>
          <View style={styles.mapLegendItems}>
            <View style={styles.mapLegendItem}>
              <View style={[styles.mapLegendDot, { backgroundColor: '#9333ea' }]} />
              <Text style={styles.mapLegendText}>Extreme</Text>
            </View>
            <View style={styles.mapLegendItem}>
              <View style={[styles.mapLegendDot, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.mapLegendText}>High</Text>
            </View>
            <View style={styles.mapLegendItem}>
              <View style={[styles.mapLegendDot, { backgroundColor: '#f97316' }]} />
              <Text style={styles.mapLegendText}>Moderate</Text>
            </View>
            <View style={styles.mapLegendItem}>
              <View style={[styles.mapLegendDot, { backgroundColor: '#eab308' }]} />
              <Text style={styles.mapLegendText}>Low</Text>
            </View>
          </View>
        </View>
        <View style={styles.alertListOnMap}>
          <Text style={styles.mapLegendTitle}>Fire Alert Locations</Text>
          {alerts.length === 0 ? (
            <View style={styles.noAlertsContainer}>
              <MaterialIcons name="check-circle" size={24} color="#22c55e" />
              <Text style={styles.noAlertsText}>No fire detected</Text>
              <Text style={styles.noAlertsSubtext}>
                Markers will appear here when IR flame sensor detects fire
              </Text>
            </View>
          ) : (
            alerts.map(alert => {
              const googleMapsUrl = `https://www.google.com/maps?q=${alert.coordinates.lat},${alert.coordinates.lng}&t=k&z=16`;
              const isSelected = selectedAlertForMap?.id === alert.id;
              return (
                <Pressable
                  key={alert.id}
                  onPress={() => {
                    if (isSelected) {
                      setSelectedAlertForMap(null);
                    } else {
                      setSelectedAlertForMap(alert);
                    }
                  }}
                  style={[
                    styles.mapAlertItem,
                    isSelected && styles.mapAlertItemSelected
                  ]}
                >
                  <View style={[styles.mapAlertDot, { backgroundColor: getSeverityMarkerColor(alert.severity) }]} />
                  <View style={styles.mapAlertContent}>
                    <Text style={styles.mapAlertLocation}>{alert.location}</Text>
                    <Text style={styles.mapAlertSeverity}>
                      {alert.severity.toUpperCase()} • {alert.coordinates.lat.toFixed(4)}, {alert.coordinates.lng.toFixed(4)}
                    </Text>
                  </View>
                <Pressable onPress={() => Linking.openURL(googleMapsUrl)}>
                  <MaterialIcons name="open-in-new" size={20} color="#6b7280" />
                </Pressable>
              </Pressable>
            );
          })
          )}
        </View>
      </View>
    );
  };

  const SettingsPage = () => {
    const [ipInput, setIpInput] = useState(esp32IpAddress);
    
    return (
      <View style={styles.pageContainer}>
        <Text style={styles.pageTitle}>Settings</Text>
        
        <View style={styles.settingsSection}>
          <View style={styles.settingsCard}>
            <Text style={styles.settingsCardTitle}>ESP32 Configuration</Text>
            <View style={styles.settingsList}>
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>ESP32 IP Address</Text>
              </View>
              <TextInput
                style={styles.ipInput}
                value={ipInput}
                onChangeText={setIpInput}
                placeholder="192.168.1.100"
                keyboardType="numeric"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.buttonContainer}>
                <Button 
                  title="Save IP Address" 
                  onPress={() => saveESP32IP(ipInput)} 
                />
              </View>
              <View style={styles.statusContainer}>
                <Text style={styles.statusText}>
                  Status: {isPolling ? '🟢 Polling Active' : '🔴 Polling Stopped'}
                </Text>
                <Text style={styles.statusSubtext}>
                  Current IP: {esp32IpAddress}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.settingsCard}>
            <Text style={styles.settingsCardTitle}>Notifications</Text>
            <View style={styles.settingsList}>
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <View style={styles.switchPlaceholder} />
              </View>
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Sound Alerts</Text>
                <View style={styles.switchPlaceholder} />
              </View>
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Vibration</Text>
                <View style={styles.switchPlaceholder} />
              </View>
            </View>
            <Button title="Test Notification" onPress={notifyNow} />
          </View>

          <View style={styles.settingsCard}>
            <Text style={styles.settingsCardTitle}>Fire Detection Simulator</Text>
            <Text style={styles.settingsCardDescription}>
              Test the app with simulated fire alerts at different locations
            </Text>
            <View style={styles.buttonContainer}>
              <Button 
                title={isSimulating ? 'Stop Simulation' : 'Start Simulation'} 
                onPress={() => {
                  if (isSimulating) {
                    stopSimulation();
                  } else {
                    startSimulation();
                  }
                }}
                color={isSimulating ? '#ef4444' : '#22c55e'}
              />
            </View>
            {isSimulating && (
              <View style={styles.statusContainer}>
                <Text style={styles.statusText}>
                  🔥 Simulation Active
                </Text>
                <Text style={styles.statusSubtext}>
                  Generating random fire alerts every 5-10 seconds
                </Text>
              </View>
            )}
            <Button 
              title="Generate Single Alert" 
              onPress={generateTestFireAlert}
            />
          </View>

          <View style={styles.settingsCard}>
            <Text style={styles.settingsCardTitle}>Data Management</Text>
            <Text style={styles.settingsCardDescription}>
              Clear all alert history and test data
            </Text>
            <Pressable 
              style={[styles.buttonContainer, styles.clearButtonWrapper]}
              onPress={() => {
                Alert.alert(
                  'Clear Alert History',
                  'Are you sure you want to delete all alerts? This action cannot be undone.',
                  [
                    {
                      text: 'Cancel',
                      onPress: () => {},
                      style: 'cancel',
                    },
                    {
                      text: 'Clear All',
                      onPress: () => {
                        setAlerts([]);
                        setShowAlert(null);
                        setSelectedAlertForMap(null);
                        Alert.alert('Success', 'All alert history has been cleared');
                      },
                      style: 'destructive',
                    },
                  ]
                );
              }}
            >
              <Text style={styles.clearButtonText}>Clear Alert History</Text>
            </Pressable>
            {alerts.length > 0 && (
              <Text style={styles.alertCountText}>
                {alerts.length} alert(s) in history
              </Text>
            )}
          </View>

        <View style={styles.settingsCard}>
          <Text style={styles.settingsCardTitle}>About</Text>
          <View style={styles.aboutContent}>
            <Text style={styles.aboutText}>SmartFire Link v1.0</Text>
            <Text style={styles.aboutText}>GPS-Based Fire Detection System</Text>
            <Text style={styles.aboutText}>© 2026 All Rights Reserved</Text>
          </View>
        </View>
      </View>
    </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {activeTab === 'home' && <HomePage />}
          {activeTab === 'map' && <MapPage />}
          {activeTab === 'history' && <HistoryPage />}
          {activeTab === 'settings' && <SettingsPage />}
        </View>
      </ScrollView>

      <View style={styles.navBar}>
        <Pressable
          onPress={() => setActiveTab('home')}
          style={styles.navButton}
        >
          <MaterialIcons name="home" size={24} color={activeTab === 'home' ? '#dc2626' : '#9ca3af'} />
          <Text style={[
            styles.navButtonText,
            activeTab === 'home' && styles.navButtonTextActive
          ]}>Home</Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('map')}
          style={styles.navButton}
        >
          <MaterialIcons name="map" size={24} color={activeTab === 'map' ? '#dc2626' : '#9ca3af'} />
          <Text style={[
            styles.navButtonText,
            activeTab === 'map' && styles.navButtonTextActive
          ]}>Map</Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('history')}
          style={styles.navButton}
        >
          <MaterialIcons name="history" size={24} color={activeTab === 'history' ? '#dc2626' : '#9ca3af'} />
          <Text style={[
            styles.navButtonText,
            activeTab === 'history' && styles.navButtonTextActive
          ]}>History</Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('settings')}
          style={styles.navButton}
        >
          <MaterialIcons name="settings" size={24} color={activeTab === 'settings' ? '#dc2626' : '#9ca3af'} />
          <Text style={[
            styles.navButtonText,
            activeTab === 'settings' && styles.navButtonTextActive
          ]}>Settings</Text>
        </Pressable>
      </View>

      {showAlert && <AlertPopup alert={showAlert} onClose={() => setShowAlert(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  content: {
    padding: 24,
    maxWidth: 448,
    width: '100%',
    alignSelf: 'center',
  },
  pageContainer: {
    gap: 16,
  },
  heroCard: {
    backgroundColor: '#ef4444',
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#fecaca',
    marginTop: 4,
  },
  statsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsContent: {
    gap: 4,
  },
  statsLabel: {
    fontSize: 14,
    color: '#fecaca',
  },
  statsValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  alertsList: {
    gap: 12,
  },
  alertCard: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  alertCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  alertCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertCardIcon: {
    padding: 8,
    borderRadius: 8,
  },
  alertCardBody: {
    marginLeft: 44,
    gap: 4,
  },
  alertCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertCardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  alertCardSubtext: {
    fontSize: 12,
    color: '#6b7280',
  },
  alertTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  severityBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
    textTransform: 'uppercase',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    color: 'white',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 16,
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
  },
  settingsSection: {
    gap: 16,
  },
  settingsCard: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  settingsCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  settingsCardDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
  },
  settingsList: {
    gap: 12,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 14,
    color: '#374151',
  },
  switchPlaceholder: {
    width: 20,
    height: 20,
    backgroundColor: '#d1d5db',
    borderRadius: 4,
  },
  aboutContent: {
    gap: 8,
  },
  aboutText: {
    fontSize: 14,
    color: '#6b7280',
  },
  navBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 64,
    maxWidth: 448,
    alignSelf: 'center',
    width: '100%',
  },
  navButton: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  navButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9ca3af',
  },
  navButtonTextActive: {
    color: '#dc2626',
  },
  alertOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 50,
  },
  alertContainer: {
    width: '100%',
    maxWidth: 448,
    borderRadius: 16,
    borderWidth: 2,
    padding: 24,
    gap: 16,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  alertHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  alertIconContainer: {
    padding: 12,
    borderRadius: 999,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeButton: {
    fontSize: 24,
    color: '#6b7280',
  },
  alertContent: {
    gap: 12,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  alertRowContent: {
    flex: 1,
    gap: 4,
  },
  alertLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  alertValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  alertSubtext: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  alertActions: {
    gap: 8,
  },
  alertButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#dc2626',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  secondaryButton: {
    backgroundColor: '#e5e7eb',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    marginTop: 8,
  },
  map: {
    flex: 1,
    width: '100%',
  },
  mapLegend: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 16,
  },
  mapLegendTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  mapLegendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  mapLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapLegendDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  mapLegendText: {
    fontSize: 14,
    color: '#374151',
    textTransform: 'capitalize',
  },
  mapUnavailableContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  mapUnavailableTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  mapUnavailableText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  alertListOnMap: {
    marginTop: 16,
    gap: 8,
  },
  mapAlertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  mapAlertDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  mapAlertContent: {
    flex: 1,
    gap: 4,
  },
  mapAlertLocation: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  mapAlertSeverity: {
    fontSize: 12,
    color: '#6b7280',
  },
  selectedAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 2,
    borderColor: '#dc2626',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  selectedAlertText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  mapAlertItemSelected: {
    backgroundColor: '#fef2f2',
    borderColor: '#dc2626',
    borderWidth: 2,
  },
  mapHeader: {
    gap: 8,
    marginBottom: 8,
  },
  mapStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mapStatusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  noAlertsContainer: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  noAlertsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#16a34a',
  },
  noAlertsSubtext: {
    fontSize: 13,
    color: '#15803d',
    textAlign: 'center',
  },
  mapPlaceholder: {
    width: '100%',
    height: '100%',
    minHeight: 400,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 24,
  },
  mapPlaceholderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  mapPlaceholderText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    maxWidth: 300,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#dc2626',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  mapButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  ipInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
    marginTop: 8,
    marginBottom: 8,
  },
  buttonContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  statusContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    gap: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  statusSubtext: {
    fontSize: 12,
    color: '#6b7280',
  },
  clearButtonWrapper: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    overflow: 'hidden',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
    textAlign: 'center',
    paddingVertical: 12,
  },
  alertCountText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
});
