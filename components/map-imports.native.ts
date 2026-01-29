import Constants from 'expo-constants';

let MapView: any = null;
let Marker: any = null;

try {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
} catch (error) {
  console.warn('react-native-maps not available:', error);
}

export { MapView, Marker };
