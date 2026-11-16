/**
 * Reminders that still reach the rider when the phone is locked.
 * Android only for now: a web page cannot do this reliably, so on the web
 * every function here quietly does nothing.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const native = Platform.OS !== 'web';
const CHANNEL = 'reminders';
const DRINK_ID = 'gph-drink';
const REST_KEY = 'gph:restIds';

if (native) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function allowed(): Promise<boolean> {
  if (!native) return false;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Ride reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 400, 200, 400],
      });
    }
    const now = await Notifications.getPermissionsAsync();
    if (now.granted) return true;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** A drink reminder every `everyMin` minutes until stopped. */
export async function startDrinkReminders(everyMin: number) {
  await stopDrinkReminders();
  if (everyMin <= 0 || !(await allowed())) return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: DRINK_ID,
      content: { title: 'Time for a drink', body: 'Take a few sips of water, then carry on.' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(60, everyMin * 60),
        repeats: true,
        channelId: CHANNEL,
      },
    });
  } catch {
    // The banner on the ride screen still works.
  }
}

export async function stopDrinkReminders() {
  if (!native) return;
  await Notifications.cancelScheduledNotificationAsync(DRINK_ID).catch(() => {});
}

/** One reminder at 7 in the morning on each of the given days (start-of-day times). */
export async function setRestDayReminders(days: number[]) {
  if (!native) return;
  try {
    const old: string[] = JSON.parse((await AsyncStorage.getItem(REST_KEY)) ?? '[]');
    await Promise.all(old.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
    const ids: string[] = [];
    if (days.length > 0 && (await allowed())) {
      for (const day of days.slice(0, 20)) {
        const when = new Date(day);
        when.setHours(7, 0, 0, 0);
        if (when.getTime() <= Date.now()) continue;
        ids.push(
          await Notifications.scheduleNotificationAsync({
            content: { title: 'Rest day today', body: 'No ride planned. Resting is how your legs get stronger.' },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL },
          })
        );
      }
    }
    await AsyncStorage.setItem(REST_KEY, JSON.stringify(ids));
  } catch {
    // Reminders are a nice extra; never let them break the app.
  }
}
