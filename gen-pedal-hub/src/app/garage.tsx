import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BackTitle, Bar, Button, Card, Choices, Field, H2, P, Screen } from '@/components/ui';
import { confirm } from '@/lib/confirm';
import { bikeChecks, bikeKm } from '@/lib/stats';
import { fmtDate } from '@/lib/format';
import { addBike, addServiceEntry, deleteBike, markCheckDone, useStore } from '@/store';
import { space, useTheme } from '@/theme';

const KINDS = ['Road', 'Mountain', 'Gravel', 'Folding', 'City', 'Other'];

export default function Garage() {
  const t = useTheme();
  const bikes = useStore((s) => s.bikes);
  const rides = useStore((s) => s.rides);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('Road');
  const [km, setKm] = useState('');
  // Which bike's "add a repair" form is open, and what has been typed in it.
  const [logFor, setLogFor] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [cost, setCost] = useState('');

  const saveLog = (bikeId: string) => {
    if (!note.trim()) return;
    addServiceEntry(bikeId, note.trim(), Math.max(0, Number(cost) || 0));
    setLogFor(null);
    setNote('');
    setCost('');
  };

  const save = () => {
    addBike(name.trim() || `My ${kind.toLowerCase()} bike`, kind, Math.max(0, Number(km) || 0));
    setAdding(false);
    setName('');
    setKm('');
  };

  return (
    <Screen>
      <BackTitle title="My bikes" />
      <P muted>The app counts the distance on each bike and tells you when it needs care.</P>

      {bikes.map((b) => {
        const total = bikeKm(b, rides);
        return (
          <Card key={b.id}>
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <H2>{b.name}</H2>
                <Text style={{ color: t.muted, fontSize: 15 }}>
                  {b.kind} · {total.toFixed(0)} km ridden
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${b.name}`}
                hitSlop={12}
                onPress={async () => {
                  if (await confirm('Remove this bike?', `${b.name} will be removed. Your rides are kept.`, 'Remove', true)) deleteBike(b.id);
                }}>
                <Ionicons name="trash-outline" size={22} color={t.muted} />
              </Pressable>
            </View>

            {bikeChecks(b, rides).map((c) => (
              <View key={c.key} style={styles.check}>
                <View style={styles.checkTop}>
                  <Text style={{ color: t.text, fontSize: 16, fontWeight: '600', flex: 1 }}>{c.title}</Text>
                  <Text style={{ color: c.due ? t.warn : t.muted, fontSize: 14, fontWeight: c.due ? '800' : '500' }}>
                    {c.due ? 'Due now' : `in ${(c.everyKm - c.sinceKm).toFixed(0)} km`}
                  </Text>
                </View>
                <Bar fraction={c.sinceKm / c.everyKm} color={c.due ? t.warn : undefined} />
                {c.due ? <Button label="I did this" icon="checkmark" kind="plain" onPress={() => markCheckDone(b.id, c.key, total)} /> : null}
              </View>
            ))}

            <View style={[styles.logBox, { borderTopColor: t.line }]}>
              <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>Repairs and services</Text>
              {b.log.length === 0 ? (
                <Text style={{ color: t.muted, fontSize: 15 }}>Nothing written down yet.</Text>
              ) : (
                b.log.slice(0, 5).map((e) => (
                  <View key={e.id} style={styles.checkTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.text, fontSize: 15 }}>{e.note}</Text>
                      <Text style={{ color: t.muted, fontSize: 13 }}>{fmtDate(e.at)}</Text>
                    </View>
                    {e.cost > 0 ? <Text style={{ color: t.text, fontSize: 15, fontWeight: '700' }}>₱{e.cost.toLocaleString('en-GB')}</Text> : null}
                  </View>
                ))
              )}
              {logFor === b.id ? (
                <View style={{ gap: space.sm }}>
                  <Field label="What was done?" value={note} onChangeText={setNote} placeholder="For example: new brake pads" />
                  <Field label="Cost in pesos (leave empty if free)" value={cost} onChangeText={setCost} placeholder="0" keyboardType="numeric" />
                  <Button label="Save" icon="checkmark" onPress={() => saveLog(b.id)} disabled={!note.trim()} />
                  <Button label="Cancel" kind="plain" onPress={() => setLogFor(null)} />
                </View>
              ) : (
                <Button label="Write down a repair" icon="create-outline" kind="plain" onPress={() => { setLogFor(b.id); setNote(''); setCost(''); }} />
              )}
            </View>
          </Card>
        );
      })}

      {adding ? (
        <Card>
          <H2>Add a bike</H2>
          <Field label="Bike name" value={name} onChangeText={setName} placeholder="For example: Blue Trek" />
          <Choices options={KINDS} value={kind} onChange={setKind} />
          <Field label="Distance already ridden on it, in km (a guess is fine)" value={km} onChangeText={setKm} placeholder="0" keyboardType="numeric" />
          <View style={{ gap: space.sm }}>
            <Button label="Save bike" icon="checkmark" onPress={save} />
            <Button label="Cancel" kind="plain" onPress={() => setAdding(false)} />
          </View>
        </Card>
      ) : (
        <Button label="Add a bike" icon="add" kind="plain" onPress={() => setAdding(true)} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  check: { gap: space.sm },
  checkTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  logBox: { borderTopWidth: 1, paddingTop: space.md, gap: space.sm },
});
