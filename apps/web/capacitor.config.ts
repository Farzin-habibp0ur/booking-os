import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bookingos.staff',
  appName: 'Booking OS',
  webDir: 'out',
  server: {
    url: 'https://businesscommandcentre.com',
    cleartext: false,
  },
  plugins: {
    StatusBar: {
      backgroundColor: '#71907C',
    },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#FCFCFD',
      showSpinner: false,
      launchShowDuration: 2000,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
