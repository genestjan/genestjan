import { StyleSheet, Text, View } from 'react-native';

import { space, useTheme } from '@/theme';

const MAX_LABELS = 6;
const VALUE_SPACE = 22;
const STUB = 3;

/** Which bars get a label underneath: about MAX_LABELS evenly spaced, always the first and last. */
function labelSet(n: number): Set<number> {
  const show = new Set<number>();
  if (n === 0) return show;
  const step = Math.max(1, Math.ceil((n - 1) / (MAX_LABELS - 1)));
  for (let i = 0; i < n; i += step) show.add(i);
  // Drop a label that would sit too close to the last one.
  for (const i of show) if (i !== 0 && i !== n - 1 && n - 1 - i < step) show.delete(i);
  show.add(n - 1);
  return show;
}

export function BarChart(props: { values: number[]; labels: string[]; format: (v: number) => string; height?: number }) {
  const { values, labels, format, height = 160 } = props;
  const t = useTheme();
  const n = values.length;
  const last = n - 1;
  const max = values.reduce((m, v) => Math.max(m, v), 0);
  const maxIdx = max > 0 ? values.indexOf(max) : -1;
  const barArea = height - VALUE_SPACE;
  const shown = labelSet(n);
  // With narrow bars, two value labels side by side would overlap.
  const showMaxValue = maxIdx >= 0 && maxIdx !== last && (n <= 8 || last - maxIdx >= 2);
  const latest = n > 0 ? `${labels[last] ?? ''}: ${format(values[last])}` : 'No data yet';

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Bar chart. Latest, ${latest}.`}>
      <View style={[styles.bars, { height }]}>
        {values.map((v, i) => {
          const isLast = i === last;
          const h = max > 0 && v > 0 ? Math.max(STUB, (v / max) * barArea) : STUB;
          return (
            <View key={i} style={styles.col}>
              {isLast || (i === maxIdx && showMaxValue) ? (
                <Text numberOfLines={1} style={[styles.value, { color: isLast ? t.text : t.muted }]}>
                  {format(v)}
                </Text>
              ) : null}
              <View
                style={[
                  styles.bar,
                  { height: h, backgroundColor: isLast ? t.accent : t.muted, opacity: isLast ? 1 : 0.35 },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={[styles.axis, { backgroundColor: t.line }]} />
      <View style={styles.labels}>
        {labels.slice(0, n).map((l, i) => (
          <View key={i} style={styles.labelCell}>
            {shown.has(i) ? (
              <Text numberOfLines={1} style={[styles.label, { color: i === last ? t.text : t.muted }]}>
                {l}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs, paddingHorizontal: space.sm },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '100%', maxWidth: 44, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  value: { width: 80, textAlign: 'center', fontSize: 12, fontWeight: '700', marginBottom: 4, fontVariant: ['tabular-nums'] },
  axis: { height: 1 },
  labels: { flexDirection: 'row', gap: space.xs, paddingHorizontal: space.sm, marginTop: space.xs },
  labelCell: { flex: 1, alignItems: 'center' },
  label: { width: 56, textAlign: 'center', fontSize: 12 },
});
