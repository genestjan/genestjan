import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  addComment,
  addPost,
  deletePost,
  findRiders,
  loadComments,
  loadFeed,
  photoUrl,
  setLike,
  uploadPhoto,
  useSession,
  type Comment,
  type FeedPost,
} from '@/backend';
import { AsyncBox } from '@/components/async-box';
import { Button, Card, Field, P } from '@/components/ui';
import { confirm } from '@/lib/confirm';
import { fmtAgo, fmtDist, fmtHours } from '@/lib/format';
import { useAsync } from '@/lib/use-async';
import { useStore } from '@/store';
import { radius, space, useTheme } from '@/theme';

function PostCard({ post, onChanged }: { post: FeedPost; onChanged: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const session = useSession();
  const units = useStore((s) => s.profile.units);
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.likes);
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [count, setCount] = useState(post.comments);
  const [text, setText] = useState('');

  const like = () => {
    const on = !liked;
    setLiked(on);
    setLikes((n) => n + (on ? 1 : -1));
    setLike(post.id, on).catch(() => {
      setLiked(!on);
      setLikes((n) => n + (on ? -1 : 1));
    });
  };

  const toggleComments = () => {
    setOpen((v) => !v);
    if (!comments) loadComments(post.id).then(setComments).catch(() => setComments([]));
  };

  const send = async () => {
    if (!text.trim()) return;
    await addComment(post.id, text).catch(() => {});
    setText('');
    setCount((n) => n + 1);
    setComments(await loadComments(post.id).catch(() => comments ?? []));
  };

  return (
    <Card>
      <View style={styles.head}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${post.name}'s page`} onPress={() => router.push(`/rider/${post.user_id}`)} style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }}>{post.name}</Text>
          <Text style={{ color: t.muted, fontSize: 14 }}>{fmtAgo(post.created_at)}</Text>
        </Pressable>
        {post.user_id === session.userId ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete my post"
            hitSlop={12}
            onPress={async () => {
              if (await confirm('Delete this post?', 'This cannot be undone.', 'Delete', true)) {
                await deletePost(post.id).catch(() => {});
                onChanged();
              }
            }}>
            <Ionicons name="trash-outline" size={20} color={t.muted} />
          </Pressable>
        ) : null}
      </View>

      {post.body ? <Text style={{ color: t.text, fontSize: 16, lineHeight: 23 }}>{post.body}</Text> : null}

      {post.ride_distance_m != null ? (
        <View style={[styles.ride, { backgroundColor: t.soft }]}>
          <Ionicons name="bicycle" size={22} color={t.accentText} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>{post.ride_title ?? 'Ride'}</Text>
            <Text style={{ color: t.muted, fontSize: 14 }}>
              {fmtDist(post.ride_distance_m, units)} {units} · {fmtHours((post.ride_moving_s ?? 0) * 1000)} · {Math.round(post.ride_elev_gain_m ?? 0)} m climbing
            </Text>
          </View>
        </View>
      ) : null}

      {post.photo_path ? <Image source={{ uri: photoUrl(post.photo_path) }} accessibilityLabel={`Photo from ${post.name}`} style={styles.photo} resizeMode="cover" /> : null}

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel={liked ? 'Remove my like' : 'Like'} accessibilityState={{ selected: liked }} onPress={like} style={styles.action}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? t.danger : t.muted} />
          <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>{likes}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Comments" onPress={toggleComments} style={styles.action}>
          <Ionicons name="chatbubble-outline" size={20} color={t.muted} />
          <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>{count}</Text>
        </Pressable>
      </View>

      {open ? (
        <View style={{ gap: space.sm }}>
          {comments === null ? (
            <P muted>Loading…</P>
          ) : (
            comments.map((c) => (
              <Text key={c.id} style={{ color: t.text, fontSize: 15, lineHeight: 21 }}>
                <Text style={{ fontWeight: '700' }}>{c.author?.name ?? 'Rider'} </Text>
                {c.body}
              </Text>
            ))
          )}
          <Field label="Write a comment" value={text} onChangeText={setText} placeholder="Say something nice" maxLength={500} onSubmitEditing={send} />
          <Button label="Send" kind="plain" disabled={!text.trim()} onPress={send} />
        </View>
      ) : null}
    </Card>
  );
}

export function Feed() {
  const t = useTheme();
  const router = useRouter();
  const rides = useStore((s) => s.rides);
  const feed = useAsync(() => loadFeed(), []);
  const [body, setBody] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; mime: string } | null>(null);
  const [withRide, setWithRide] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [found, setFound] = useState<{ id: string; name: string; city: string }[] | null>(null);
  const latest = rides[0];

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    const a = res.canceled ? null : res.assets[0];
    if (a) setPhoto({ uri: a.uri, mime: a.mimeType ?? 'image/jpeg' });
  };

  const post = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const path = photo ? await uploadPhoto(photo.uri, photo.mime) : null;
      await addPost(body, path, withRide && latest ? latest.id : null);
      setBody('');
      setPhoto(null);
      setWithRide(false);
      feed.reload();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not share your post.');
    } finally {
      setBusy(false);
    }
  };

  const canPost = !busy && (body.trim().length > 0 || photo !== null || (withRide && !!latest));

  return (
    <View style={{ gap: space.lg }}>
      <Card>
        <Field label="Share something with other riders" value={body} onChangeText={setBody} placeholder="How was your ride?" multiline maxLength={1000} />
        {photo ? <Image source={{ uri: photo.uri }} accessibilityLabel="The photo you picked" style={styles.photo} resizeMode="cover" /> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Button label={photo ? 'Remove photo' : 'Add a photo'} icon="image-outline" kind="plain" onPress={photo ? () => setPhoto(null) : pick} />
          {latest ? (
            <Button label={withRide ? 'Ride added' : 'Add my last ride'} icon={withRide ? 'checkmark' : 'bicycle'} kind="plain" onPress={() => setWithRide((v) => !v)} />
          ) : null}
        </View>
        {problem ? (
          <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 15 }}>
            {problem}
          </Text>
        ) : null}
        <Button label={busy ? 'Sharing…' : 'Share'} icon="send" disabled={!canPost} onPress={post} />
      </Card>

      <Card>
        <Field
          label="Find a rider to follow"
          value={search}
          onChangeText={setSearch}
          placeholder="Type a name"
          onSubmitEditing={() => findRiders(search).then(setFound).catch(() => setFound([]))}
        />
        <Button label="Search" icon="search" kind="plain" disabled={search.trim().length < 2} onPress={() => findRiders(search).then(setFound).catch(() => setFound([]))} />
        {found?.length === 0 ? <P muted>Nobody found with that name.</P> : null}
        {found?.map((r) => (
          <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`Open ${r.name}'s page`} onPress={() => router.push(`/rider/${r.id}`)} style={[styles.found, { borderColor: t.line }]}>
            <Ionicons name="person-circle-outline" size={26} color={t.muted} />
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '600', flex: 1 }}>
              {r.name}
              {r.city ? <Text style={{ color: t.muted, fontWeight: '400' }}> · {r.city}</Text> : null}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={t.muted} />
          </Pressable>
        ))}
      </Card>

      <AsyncBox state={feed} empty="Nothing here yet. Be the first to share a ride.">
        {(posts) => posts.map((p) => <PostCard key={p.id} post={p} onChanged={feed.reload} />)}
      </AsyncBox>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  ride: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.sm },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.sm, backgroundColor: '#00000010' },
  actions: { flexDirection: 'row', gap: space.xl },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 46, minWidth: 56 },
  found: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 50, borderTopWidth: 1, paddingTop: space.sm },
});
