import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { confirm, notify } from '@/lib/confirm';
import { fmtClock, fmtDist, fmtSpeed, speedUnit } from '@/lib/format';
import { discardRide, elapsedMs, finishRide, pauseRide, resumeRide, startRide, useRecorder } from '@/recorder';
import { useStore } from '@/store';
import { rideTheme as c } from '@/theme';
import type { IconName } from '@/components/ui';

function gpsLabel(acc: number | null, recording: boolean): { text: string; color: string } {
  if (!recording) return { text: 'GPS off', color: c.muted };
  if (acc == null) return { text: 'Finding GPS…', color: c.warn };
  if (acc <= 12) return { text: 'GPS strong', color: c.accent };
  if (acc <= 35) return { text: 'GPS fair', color: c.warn };
  return { text: 'GPS weak', color: c.danger };
}

function BigButton({ label, icon, color, textColor, onPress }: { label: string; icon: IconName; color: string; textColor: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.bigButton, { backgroundColor: color, opacity: pressed ? 0.8 : 1 }]}>
      <Ionicons name={icon} size={30} color={textColor} />
      <Text style={[styles.bigButtonText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

function Metric({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
        {unit ? <Text style={styles.metricUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

export default function Record() {
  // Keep the screen on during a ride. Some browsers refuse; the ride still records.
  useEffect(() => {
    activateKeepAwakeAsync('ride').catch(() => {});
    return () => {
      deactivateKeepAwake('ride').catch(() => {});
    };
  }, []);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const rec = useRecorder();
  const profile = useStore((s) => s.profile);
  const units = profile.units;
  const tr = rec.track;
  const gps = gpsLabel(tr.accuracyM, rec.status === 'recording');
  const avgMs = tr.movingMs > 0 ? tr.distanceM / (tr.movingMs / 1000) : 0;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const finish = async () => {
    if (tr.distanceM < 20) {
      if (await confirm('Stop without saving?', 'This ride is too short to save.', 'Stop', true)) {
        await discardRide();
        close();
      }
      return;
    }
    if (!(await confirm('Finish this ride?', 'Your ride will be saved.', 'Finish'))) return;
    const ride = await finishRide();
    if (ride) router.replace(`/ride/${ride.id}?done=1`);
    else close();
  };

  const sos = () => {
    if (!profile.emergencyPhone) {
      notify('No emergency contact yet', 'Open the Me tab and add an emergency contact first.');
      return;
    }
    const where = tr.last ?? tr.points[tr.points.length - 1];
    const link = where ? ` I am here: https://maps.google.com/?q=${where.lat.toFixed(5)},${where.lon.toFixed(5)}` : '';
    const body = encodeURIComponent(`I need help on my bike ride.${link}`);
    Linking.openURL(`sms:${profile.emergencyPhone}${Platform.OS === 'ios' ? '&' : '?'}body=${body}`).catch(() =>
      notify('Could not open messages', `Call ${profile.emergencyName || 'your contact'} on ${profile.emergencyPhone}.`)
    );
  };

  return (
    <View style={[styles.page, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <StatusBar style="light" />

      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to home" hitSlop={12} onPress={close} style={styles.topButton}>
          <Ionicons name="chevron-down" size={26} color={c.text} />
        </Pressable>
        <View style={styles.gps}>
          <View style={[styles.dot, { backgroundColor: gps.color }]} />
          <Text style={{ color: c.text, fontSize: 15, fontWeight: '600' }}>{gps.text}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="SOS. Text my emergency contact" onPress={sos} style={styles.sos}>
          <Text style={styles.sosText}>SOS</Text>
        </Pressable>
      </View>

      {rec.error ? (
        <View style={styles.notice}>
          <Ionicons name="warning" size={20} color={c.warn} />
          <Text style={styles.noticeText}>{rec.error}</Text>
        </View>
      ) : rec.restored ? (
        <View style={styles.notice}>
          <Ionicons name="information-circle" size={20} color={c.accent} />
          <Text style={styles.noticeText}>We kept your unfinished ride. Press Resume to carry on, or Finish to save it.</Text>
        </View>
      ) : null}

      <View style={styles.speedBox}>
        <Text style={styles.metricLabel}>{rec.status === 'paused' ? 'PAUSED' : 'SPEED'}</Text>
        <Text style={styles.speed} numberOfLines={1} adjustsFontSizeToFit>
          {fmtSpeed(rec.status === 'recording' ? tr.speedMs : 0, units)}
        </Text>
        <Text style={styles.speedUnit}>{speedUnit(units)}</Text>
      </View>

      <View style={styles.grid}>
        <Metric label="DISTANCE" value={fmtDist(tr.distanceM, units)} unit={units} />
        <Metric label="TIME" value={fmtClock(elapsedMs(rec))} />
        <Metric label="AVERAGE" value={fmtSpeed(avgMs, units)} unit={speedUnit(units)} />
        <Metric label="CLIMBED" value={tr.elevGainM.toFixed(0)} unit="m" />
      </View>

      <View style={styles.actions}>
        {rec.status === 'idle' ? (
          <BigButton label="Start" icon="play" color={c.accent} textColor={c.onAccent} onPress={startRide} />
        ) : rec.status === 'recording' ? (
          <BigButton label="Pause" icon="pause" color={c.panel} textColor={c.text} onPress={pauseRide} />
        ) : (
          <>
            <BigButton label="Resume" icon="play" color={c.accent} textColor={c.onAccent} onPress={resumeRide} />
            <BigButton label="Finish" icon="flag" color={c.danger} textColor="#FFFFFF" onPress={finish} />
          </>
        )}
      </View>
      <Text style={styles.hint}>
        {rec.status === 'idle'
          ? 'Press Start when you are ready to ride.'
          : rec.status === 'recording'
            ? Platform.OS === 'web'
              ? 'Keep this screen open while you ride.'
              : 'You can lock your phone. The ride keeps recording.'
            : 'Press Resume to carry on, or Finish to save.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 16, gap: 14, width: '100%', maxWidth: 560, alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.panel, alignItems: 'center', justifyContent: 'center' },
  gps: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.panel, paddingHorizontal: 14, height: 40, borderRadius: 20 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  sos: { minWidth: 64, height: 48, borderRadius: 24, borderWidth: 2, borderColor: c.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  sosText: { color: c.danger, fontSize: 17, fontWeight: '800', letterSpacing: 1 },
  notice: { flexDirection: 'row', gap: 10, backgroundColor: c.panel, borderRadius: 14, padding: 14, alignItems: 'flex-start' },
  noticeText: { color: c.text, fontSize: 15, lineHeight: 21, flex: 1 },
  speedBox: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 150 },
  speed: { color: c.text, fontSize: 124, fontWeight: '800', letterSpacing: -4, fontVariant: ['tabular-nums'], lineHeight: 132 },
  speedUnit: { color: c.muted, fontSize: 20, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { width: '48.5%', flexGrow: 1, backgroundColor: c.panel, borderRadius: 16, padding: 14, gap: 2 },
  metricLabel: { color: c.muted, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  metricValue: { color: c.text, fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  metricUnit: { color: c.muted, fontSize: 16, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10 },
  bigButton: { flex: 1, height: 84, borderRadius: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  bigButtonText: { fontSize: 24, fontWeight: '800' },
  hint: { color: c.muted, fontSize: 15, textAlign: 'center' },
});
