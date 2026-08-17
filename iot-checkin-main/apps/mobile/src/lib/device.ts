import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_UUID_KEY = '@iot_checkin_device_uuid';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function getDeviceUuid(): Promise<string> {
  try {
    let uuid = await AsyncStorage.getItem(DEVICE_UUID_KEY);
    if (!uuid) {
      uuid = generateUUID();
      await AsyncStorage.setItem(DEVICE_UUID_KEY, uuid);
    }
    return uuid;
  } catch (error) {
    console.error('Failed to get/set device UUID', error);
    return 'fallback-uuid-' + Date.now();
  }
}
