import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.waybilla.app',
  appName: 'Waybilla',
  webDir: 'dist',
  server: {
    url: 'https://trackpack.onrender.com',
    cleartext: false,
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    appendUserAgent: 'Waybilla-Android-Native'
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    BackgroundGeolocation: {
      locationAuthorizationRequest: 'Always',
      desiredAccuracy: 'Navigation',
      stationaryRadius: 25,
      distanceFilter: 10,
      stopTimeout: 5,
      debug: false,
      logLevel: 0,
      stopOnTerminate: false,
      startOnBoot: true,
      foregroundService: true,
      notification: {
        title: 'Waybilla Fleet',
        text: 'Tracking your location for active deliveries'
      }
    }
  }
};

export default config;
