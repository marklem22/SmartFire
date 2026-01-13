import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Dimensions, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function SmartFireApp() {
  const [activeTab, setActiveTab] = useState('home');
  const [alerts, setAlerts] = useState([
    {
      id: 1,
      severity: 'extreme',
      location: 'Bacnotan Central Plaza, Ilocos',
      coordinates: { lat: 16.7258, lng: 120.3642 },
      time: new Date(Date.now() - 5 * 60000),
      status: 'active'
    },
    {
      id: 2,
      severity: 'high',
      location: 'San Fernando Market Area',
      coordinates: { lat: 16.6197, lng: 120.3197 },
      time: new Date(Date.now() - 15 * 60000),
      status: 'active'
    },
    {
      id: 3,
      severity: 'moderate',
      location: 'Residential Area, La Union',
      coordinates: { lat: 16.6542, lng: 120.3456 },
      time: new Date(Date.now() - 30 * 60000),
      status: 'resolved'
    }
  ]);
  const [showAlert, setShowAlert] = useState<any>(null);
  const [selectedAlertForMap, setSelectedAlertForMap] = useState<any>(null);

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
          <Text style={styles.pageTitle}>Fire Alert Map (Satellite View)</Text>
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
            <Text style={styles.mapLegendTitle}>Alert Locations</Text>
            {alerts.map(alert => {
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
            })}
          </View>
        </View>
      );
    }

    // For native platforms, show fallback since react-native-maps requires development build
    // The require() call causes errors in Expo Go, so we'll use a web-compatible solution
    // or show the fallback UI with clickable links to Google Maps
    return (
      <View style={styles.pageContainer}>
        <Text style={styles.pageTitle}>Fire Alert Map</Text>
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
        
        {/* Show Google Maps link for the selected alert or all alerts */}
        <View style={styles.mapContainer}>
          <View style={styles.mapPlaceholder}>
            <MaterialIcons name="map" size={64} color="#9ca3af" />
            <Text style={styles.mapPlaceholderTitle}>Interactive Map</Text>
            <Text style={styles.mapPlaceholderText}>
              {selectedAlertForMap 
                ? `View ${selectedAlertForMap.location} on Google Maps`
                : 'Tap an alert below to view it on Google Maps'}
            </Text>
            {selectedAlertForMap && (
              <Pressable
                style={styles.mapButton}
                onPress={() => {
                  const url = `https://www.google.com/maps?q=${selectedAlertForMap.coordinates.lat},${selectedAlertForMap.coordinates.lng}&t=k&z=16`;
                  Linking.openURL(url);
                }}
              >
                <MaterialIcons name="open-in-new" size={20} color="white" />
                <Text style={styles.mapButtonText}>Open in Google Maps</Text>
              </Pressable>
            )}
          </View>
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
          <Text style={styles.mapLegendTitle}>Alert Locations</Text>
          {alerts.map(alert => {
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
          })}
        </View>
      </View>
    );
  };

  const SettingsPage = () => (
    <View style={styles.pageContainer}>
      <Text style={styles.pageTitle}>Settings</Text>
      
      <View style={styles.settingsSection}>
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
        </View>

        <View style={styles.settingsCard}>
          <Text style={styles.settingsCardTitle}>Alert Preferences</Text>
          <View style={styles.settingsList}>
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Low Severity</Text>
              <View style={styles.switchPlaceholder} />
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Moderate Severity</Text>
              <View style={styles.switchPlaceholder} />
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>High Severity</Text>
              <View style={styles.switchPlaceholder} />
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Extreme Severity</Text>
              <View style={styles.switchPlaceholder} />
            </View>
          </View>
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
    width: '100%',
    minHeight: 400,
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
});
