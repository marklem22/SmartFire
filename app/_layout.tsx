import { useEffect } from 'react';
import { Stack } from "expo-router";
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Alert } from 'react-native';

// Import Tailwind CSS for web - Expo webpack will handle this
// @ts-ignore - CSS import for web platform
import './globals.css';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // iOS 15+: use banner/list instead of deprecated shouldShowAlert
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function requestNotificationPermission() {
  if (!Device.isDevice) {
    Alert.alert('Notifications', 'Use a real device for notifications');
    return;
  }

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }
}

async function notifyNow() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'It works! 🎉',
      body: 'Local notification fired successfully.',
    },
    trigger: null,
  });
}

export default function RootLayout() {
  useEffect(() => {
    const initNotifications = async () => {
      await requestNotificationPermission();
      // Fire test notification after permissions are requested
      await notifyNow();
    };
    initNotifications();
  }, []);

  return <Stack />;
}
