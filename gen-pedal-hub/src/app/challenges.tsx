import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { MenuRow } from '@/components/menu-row';
import { BackTitle, Bar, Card, P, Screen } from '@/components/ui';
import { daysLeftInMonth, monthChallenges, monthName } from '@/lib/challenges';
import { useStore } from '@/store';
import { space, useTheme } from '@/theme';

export default function Challenges() {
  const t = useTheme();
  const rides = useStore((s) => s.rides);
  const goal = useStore((s) => s.profile.monthlyGoalKm);
  const now = Date.now();
  const list = monthChallenges(rides, goal, now);
  const left = daysLeftInMonth(now);
  const done = list.filter((c) => c.done).length;

  return (
    <Screen>
      <BackTitle title={`${monthName(now)} challenges`} />
      <P muted>
        {done === list.length
          ? 'All done this month. Brilliant.'
          : `${done} of ${list.length} done. ${left} day${left === 1 ? '' : 's'} left this month.`}
      </P>

      {list.map((c) => (
        <Card key={c.key} style={c.done ? { borderColor: t.accent } : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Ionicons name={c.done ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={c.done ? t.accentText : t.muted} />
            <Text style={{ color: t.text, fontSize: 18, fontWeight: '700', flex: 1 }}>{c.title}</Text>
          </View>
          <Bar fraction={c.value / c.target} />
          <Text style={{ color: t.muted, fontSize: 15 }}>
            {c.done ? 'Done' : `${c.unit === 'rides' ? Math.round(c.value) : c.value.toFixed(c.unit === 'm' ? 0 : 1)} of ${c.target.toLocaleString('en-GB')} ${c.unit}`}
          </Text>
        </Card>
      ))}

      <P muted style={{ fontSize: 14 }}>
        These are sized from your monthly goal. Change the goal under Training plan.
      </P>
      <MenuRow icon="trophy" title="Challenges with other riders" hint="Join shared challenges and competitions" to="/community" />
    </Screen>
  );
}
