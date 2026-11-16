import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, space, useTheme } from '@/theme';

export type IconName = keyof typeof Ionicons.glyphMap;

/** A scrolling page with the standard margins. */
export function Screen({ children, title, right }: { children: ReactNode; title?: string; right?: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={[styles.screen, { paddingTop: insets.top + space.lg, paddingBottom: space.xxl }]}
      keyboardShouldPersistTaps="handled">
      {title ? (
        <View style={styles.titleRow}>
          <Text accessibilityRole="header" style={[styles.h1, { color: t.text }]}>
            {title}
          </Text>
          {right}
        </View>
      ) : null}
      {children}
    </ScrollView>
  );
}

/** Title row with a back button, for pages that are not one of the main tabs. */
export function BackTitle({ title, right }: { title: string; right?: ReactNode }) {
  const t = useTheme();
  const router = useRouter();
  return (
    <View style={styles.backRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={10}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={[styles.backButton, { backgroundColor: t.card, borderColor: t.line }]}>
        <Ionicons name="chevron-back" size={24} color={t.text} />
      </Pressable>
      <Text accessibilityRole="header" style={[styles.h1b, { color: t.text }]} numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.card, borderColor: t.line }, style]}>{children}</View>;
}

export function H2({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <Text accessibilityRole="header" style={[styles.h2, { color: t.text }]}>
      {children}
    </Text>
  );
}

export function P({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: object }) {
  const t = useTheme();
  return <Text style={[styles.p, { color: muted ? t.muted : t.text }, style]}>{children}</Text>;
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  kind?: 'primary' | 'accent' | 'plain' | 'danger';
  big?: boolean;
  disabled?: boolean;
};

export function Button({ label, onPress, icon, kind = 'primary', big, disabled }: ButtonProps) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.brand : kind === 'accent' ? t.accent : 'transparent';
  const fg =
    kind === 'primary' ? t.onBrand : kind === 'accent' ? t.onAccent : kind === 'danger' ? t.danger : t.text;
  const border = kind === 'plain' ? t.line : kind === 'danger' ? t.danger : bg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        big && styles.buttonBig,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
      ]}>
      {icon ? <Ionicons name={icon} size={big ? 26 : 20} color={fg} /> : null}
      <Text style={[styles.buttonText, big && styles.buttonTextBig, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** One number with its label underneath. */
export function Stat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  const t = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: t.text }]}>
        {value}
        {unit ? <Text style={[styles.statUnit, { color: t.muted }]}> {unit}</Text> : null}
      </Text>
      <Text style={[styles.statLabel, { color: t.muted }]}>{label}</Text>
    </View>
  );
}

/** A row of choices where one is picked. */
export function Choices({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.choices}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={o}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o)}
            style={[styles.choice, { backgroundColor: on ? t.brand : t.card, borderColor: on ? t.brand : t.line }]}>
            <Text style={[styles.choiceText, { color: on ? t.onBrand : t.text }]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={t.muted}
        {...props}
        style={[styles.input, { color: t.text, backgroundColor: t.card, borderColor: t.line }]}
      />
    </View>
  );
}

export function Bar({ fraction, color }: { fraction: number; color?: string }) {
  const t = useTheme();
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <View style={[styles.barTrack, { backgroundColor: t.soft }]}>
      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color ?? t.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: space.lg, gap: space.lg, width: '100%', maxWidth: 560, alignSelf: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  h2: { fontSize: 19, fontWeight: '700' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  backButton: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  h1b: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, flex: 1 },
  p: { fontSize: 16, lineHeight: 23 },
  card: { borderRadius: radius.md, borderWidth: 1, padding: space.lg, gap: space.md },
  button: {
    minHeight: 52,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonBig: { minHeight: 68 },
  buttonText: { fontSize: 17, fontWeight: '700' },
  buttonTextBig: { fontSize: 21 },
  stat: { flex: 1, gap: 2 },
  statValue: { fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statUnit: { fontSize: 14, fontWeight: '600' },
  statLabel: { fontSize: 14 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  choice: { minHeight: 46, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1.5, justifyContent: 'center' },
  choiceText: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '600' },
  input: { minHeight: 52, borderRadius: radius.sm, borderWidth: 1.5, paddingHorizontal: space.lg, fontSize: 17 },
  barTrack: { height: 10, borderRadius: radius.pill, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: radius.pill },
});
