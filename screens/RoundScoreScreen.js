import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';

import { ScreenHeader } from '@/components/ScreenHeader';
import { GOLF } from '@/constants/golfTheme';
import { THEME } from '@/constants/theme';
import { loadCoursePins, saveCoursePin } from '@/lib/coursePinsApi';
import { loadRoundMessages, subscribeRoundMessages } from '@/lib/roundChatApi';
import { supabase } from '@/lib/supabase';
import {
  getAuthedUserId,
  getRoundBundle,
  listBetsForRound,
  patchBetEvents,
  patchBetWolfDecisions,
  setRoundStatus,
  upsertScoreCell,
} from '@/lib/scorecardApi';
import {
  mergeEventPayoutsIntoBase,
  defaultEventConfig,
} from '@/utils/matchEventModifiers';
import { wolfIndexForHole, cumulativeWolfPayouts } from '@/utils/wolfScoring';

const ACCENT = THEME.accent;
const TEXT_MAIN = THEME.text2;
const TEXT_SEC = THEME.text2;
const TEXT_MUTED = THEME.text3;
const ON_ACCENT = THEME.textOnAccent;
const DIVIDER = THEME.border;
const CHIP_MUTED = GOLF.inputBg;
const CHIP_ACCENT_BG = THEME.accentBg;
const WARN = '#e89b3a';

function formatLeaderToPar(v) {
  if (v == null) return '—';
  if (v === 0) return 'E';
  return v > 0 ? `+${v}` : `${v}`;
}

function formatChatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function safeInt(x, fallback) {
  const n = Number(String(x ?? '').trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.round(n));
}

function keyOf(roundId, userId, hole) {
  return `${roundId}:${userId}:${hole}`;
}

function puttsKeyOf(roundId, userId, hole) {
  return `${roundId}:${userId}:${hole}:putts`;
}

function haversineYards(a, b) {
  if (!a || !b) return null;
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const meters = R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return Math.round(meters * 1.09361);
}

/** 挂花按钮（不含 par_train，后期自动检测） */
const FLOWERS = [
  { ev: 'birdie', label: '🐦 小鸟', earn: true },
  { ev: 'eagle', label: '🦅 老鹰', earn: true },
  { ev: 'albatross', label: '🪶 信天翁', earn: true },
  { ev: 'sand_save', label: '🏖 沙救', earn: true },
  { ev: 'water_hazard', label: '💧 下水', earn: false },
  { ev: 'out_of_bounds', label: '🚫 出界', earn: false },
];

export default function RoundScoreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const roundId = String(params.id ?? '');

  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(null);
  const [players, setPlayers] = useState([]); // { userId, username }
  const [parByHole, setParByHole] = useState({}); // hole -> par
  const [strokes, setStrokes] = useState({}); // key -> string
  const [putts, setPutts] = useState({}); // key -> string
  const [gir, setGir] = useState({}); // key -> true | false | undefined
  const [fir, setFir] = useState({}); // key -> 'hit' | 'left' | 'right' | undefined
  const [sand, setSand] = useState({}); // key -> true | false | undefined
  const [penalty, setPenalty] = useState({}); // key -> 'water' | 'ob' | undefined
  const [completing, setCompleting] = useState(false);
  const [bets, setBets] = useState([]);
  const [betsOpen, setBetsOpen] = useState(false);
  const [currentPos, setCurrentPos] = useState(null);
  const [pinPos, setPinPos] = useState({});
  const [savedPins, setSavedPins] = useState(() => new Map());
  const [locallyMarkedHoles, setLocallyMarkedHoles] = useState(() => new Set());
  const [locationPerm, setLocationPerm] = useState(null);
  const locationSubRef = useRef(null);
  /** key: betId → events for that bet (mirrors bets[].events) */
  const [flowerEvents, setFlowerEvents] = useState({});
  /** key: betId → wolf decisions */
  const [wolfDecisions, setWolfDecisions] = useState({});
  /** 只渲染当前洞，避免 20 人 × 18 洞撑爆 Web DOM */
  const [viewHole, setViewHole] = useState(null);
  const [boardOpen, setBoardOpen] = useState(true);
  const [myUserId, setMyUserId] = useState(null);
  const [displayName, setDisplayName] = useState('球友');
  const [roundMessages, setRoundMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [chatSending, setChatSending] = useState(false);

  const timersRef = useRef(new Map());
  const chatScrollRef = useRef(null);

  const holesCount = round?.holes === 9 ? 9 : 18;

  const holeNums = useMemo(
    () => Array.from({ length: holesCount }, (_, i) => (round?.starting_hole ?? 1) + i),
    [holesCount, round?.starting_hole],
  );

  useEffect(() => {
    setPinPos({});
    setSavedPins(new Map());
    setLocallyMarkedHoles(new Set());
    setViewHole(null);
  }, [roundId]);

  const activeHole = viewHole ?? holeNums[0] ?? 1;
  const activeHoleIdx = holeNums.indexOf(activeHole);

  const isParticipant = useMemo(() => {
    if (!myUserId || !round) return false;
    if (round.created_by === myUserId) return true;
    return players.some((p) => !p.isGuest && p.userId === myUserId);
  }, [myUserId, round, players]);

  const myGroup = useMemo(() => {
    if (!myUserId) return 1;
    const me = players.find((p) => p.userId === myUserId);
    return me?.groupNumber ?? 1;
  }, [myUserId, players]);

  const myGroupPlayers = useMemo(
    () => players.filter((p) => (p.groupNumber ?? 1) === myGroup),
    [players, myGroup],
  );

  const canEditPlayerRow = useCallback(
    (p) => {
      if (!isParticipant || !p) return false;
      return (p.groupNumber ?? 1) === myGroup;
    },
    [isParticipant, myGroup],
  );

  const canEditUser = useCallback(
    (userId) => {
      const p = players.find((x) => x.userId === userId);
      return canEditPlayerRow(p);
    },
    [players, canEditPlayerRow],
  );

  const computeTotals = useMemo(() => {
    const totals = new Map();
    const toPar = new Map();
    players.forEach((p) => {
      let t = 0;
      let tp = 0;
      holeNums.forEach((h) => {
        const k = keyOf(roundId, p.userId, h);
        const s = safeInt(strokes[k], 0);
        const par = safeInt(parByHole[h], 4);
        if (s > 0) {
          t += s;
          tp += s - par;
        }
      });
      totals.set(p.userId, t > 0 ? t : null);
      toPar.set(p.userId, t > 0 ? tp : null);
    });
    return { totals, toPar };
  }, [players, holeNums, strokes, parByHole, roundId]);

  const leaderboardRows = useMemo(() => {
    const rows = players.map((p) => {
      let totalStrokes = 0;
      let relPar = 0;
      let holesPlayed = 0;
      holeNums.forEach((h) => {
        const k = keyOf(roundId, p.userId, h);
        const s = safeInt(strokes[k], 0);
        if (s > 0) {
          const par = safeInt(parByHole[h], 4);
          totalStrokes += s;
          relPar += s - par;
          holesPlayed += 1;
        }
      });
      return {
        userId: p.userId,
        name: (p.username || '').trim() || '球友',
        groupNumber: p.groupNumber ?? 1,
        totalStrokes,
        toPar: holesPlayed > 0 ? relPar : null,
        holesPlayed,
      };
    });
    return rows.sort((a, b) => {
      if (a.holesPlayed === 0 && b.holesPlayed === 0) return 0;
      if (a.holesPlayed === 0) return 1;
      if (b.holesPlayed === 0) return -1;
      if (a.toPar !== b.toPar) return a.toPar - b.toPar;
      return a.totalStrokes - b.totalStrokes;
    });
  }, [players, holeNums, strokes, parByHole, roundId]);

  useEffect(() => {
    if (!myUserId) return;
    const me = players.find((p) => !p.isGuest && p.userId === myUserId);
    if (me?.username?.trim()) {
      setDisplayName(me.username.trim());
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', myUserId)
          .maybeSingle();
        if (!cancelled) {
          setDisplayName((data?.username || '').trim() || '球友');
        }
      } catch {
        if (!cancelled) setDisplayName('球友');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [myUserId, players]);

  useEffect(() => {
    if (!roundId) return;
    let cancelled = false;
    void loadRoundMessages(roundId)
      .then((rows) => {
        if (!cancelled) setRoundMessages(rows);
      })
      .catch(() => {
        if (!cancelled) setRoundMessages([]);
      });

    const channel = subscribeRoundMessages(roundId, (msg) => {
      setRoundMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        const withoutOptimistic = prev.filter(
          (m) => !String(m.id).startsWith('tmp-') || m.content !== msg.content,
        );
        return [...withoutOptimistic, msg];
      });
    });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [roundId]);

  useEffect(() => {
    if (roundMessages.length === 0) return;
    const t = setTimeout(() => chatScrollRef.current?.scrollToEnd?.({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [roundMessages.length]);

  async function sendChatMessage() {
    const content = chatText.trim();
    if (!content || !myUserId || chatSending) return;
    const baseName = displayName.trim() || '球友';
    const nameLabel = isParticipant ? baseName : `${baseName} · 旁观者`;

    const optimisticMsg = {
      id: `tmp-${Date.now()}`,
      roundId,
      userId: myUserId,
      displayName: nameLabel,
      content,
      createdAt: new Date().toISOString(),
    };

    setChatText('');
    setRoundMessages((prev) => [...prev, optimisticMsg]);
    setChatSending(true);

    const { error } = await supabase.from('round_messages').insert({
      round_id: roundId,
      user_id: myUserId,
      display_name: nameLabel,
      content,
    });

    if (error) {
      setRoundMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setChatText(content);
      console.error('sendChatMessage error:', error);
      Alert.alert('球局讨论', error.message || '发送失败');
    }
    setChatSending(false);
  }

  function markPin(hole) {
    if (!isParticipant) return;
    if (!currentPos) return;
    setPinPos((prev) => ({
      ...prev,
      [hole]: { latitude: currentPos.latitude, longitude: currentPos.longitude },
    }));
    setLocallyMarkedHoles((prev) => new Set(prev).add(hole));
    if (round?.course_name && currentPos) {
      saveCoursePin(round.course_name, hole, currentPos.latitude, currentPos.longitude).catch(() => {});
    }
  }

  function locallyMarked(hole) {
    return locallyMarkedHoles.has(hole);
  }

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          if (Platform.OS !== 'web') {
            try {
              const { status } = await Location.requestForegroundPermissionsAsync();
              if (!alive) return;
              setLocationPerm(status);
              if (status === 'granted') {
                const sub = await Location.watchPositionAsync(
                  { accuracy: Location.Accuracy.High, distanceInterval: 2 },
                  (loc) => {
                    if (alive) setCurrentPos(loc.coords);
                  },
                );
                if (!alive) {
                  sub.remove();
                  return;
                }
                locationSubRef.current = sub;
              }
            } catch {
              if (alive) setLocationPerm('denied');
            }
          } else if (alive) {
            setLocationPerm(null);
          }

          setBusy(true);
          const b = await getRoundBundle(roundId);
          if (!alive) return;
          setRound(b.round);
          setPlayers(b.players);
          const startH = b.round?.starting_hole ?? 1;
          const count = b.round?.holes === 9 ? 9 : 18;
          const firstHole = startH;
          setViewHole(firstHole);
          try {
            const uid = await getAuthedUserId();
            if (alive) setMyUserId(uid);
          } catch {
            if (alive) setMyUserId(null);
          }
          if (b.round?.course_name) {
            loadCoursePins(b.round.course_name)
              .then((pins) => {
                if (!alive) return;
                setSavedPins(pins);
                setPinPos((prev) => {
                  const next = { ...prev };
                  pins.forEach((pin, holeNum) => {
                    if (!next[holeNum]) {
                      next[holeNum] = { latitude: pin.lat, longitude: pin.lng };
                    }
                  });
                  return next;
                });
              })
              .catch(() => {});
          }
          const betList = await listBetsForRound(roundId).catch(() => []);
          if (alive) {
            setBets(betList);
            const initFlowers = {};
            const initWolf = {};
            for (const bet of betList) {
              initFlowers[bet.id] = Array.isArray(bet.events) ? [...bet.events] : [];
              if (bet.bet_type === 'wolf') {
                initWolf[bet.id] = Array.isArray(bet.wolf_decisions) ? [...bet.wolf_decisions] : [];
              }
            }
            setFlowerEvents(initFlowers);
            setWolfDecisions(initWolf);
          }

          const nextPar = {};
          const nextStrokes = {};
          const nextPutts = {};
          const nextGir = {};
          const nextFir = {};
          const nextSand = {};
          const nextPenalty = {};
          (b.scores ?? []).forEach((s) => {
            const cellKey = keyOf(roundId, s.user_id, s.hole_number);
            nextPar[s.hole_number] = String(s.par ?? 4);
            nextStrokes[cellKey] = String(s.strokes ?? '');
            if (s.putts != null && s.putts !== '') {
              nextPutts[puttsKeyOf(roundId, s.user_id, s.hole_number)] = String(s.putts);
            }
            if (typeof s.gir === 'boolean') nextGir[cellKey] = s.gir;
            if (s.fir === 'hit' || s.fir === 'left' || s.fir === 'right') nextFir[cellKey] = s.fir;
            if (typeof s.sand === 'boolean') nextSand[cellKey] = s.sand;
            if (s.penalty === 'water' || s.penalty === 'ob') nextPenalty[cellKey] = s.penalty;
          });
          // ensure defaults
          for (let h = 1; h <= (b.round.holes === 9 ? 9 : 18); h += 1) {
            if (nextPar[h] == null) nextPar[h] = '4';
          }
          setParByHole(nextPar);
          setStrokes(nextStrokes);
          setPutts(nextPutts);
          setGir(nextGir);
          setFir(nextFir);
          setSand(nextSand);
          setPenalty(nextPenalty);
        } catch (e) {
          Alert.alert('记分', e instanceof Error ? e.message : '加载失败，请重试');
        } finally {
          if (alive) setBusy(false);
        }
      })();
      return () => {
        alive = false;
        locationSubRef.current?.remove();
        locationSubRef.current = null;
      };
    }, [roundId]),
  );

  const betStandings = useMemo(() => {
    const n = players.length;
    if (n < 2 || bets.length === 0) return [];
    const holeMax = round?.holes === 9 ? 9 : 18;
    const startH = round?.starting_hole ?? 1;
    const holeNums = Array.from({ length: holeMax }, (_, i) => startH + i);

    const scoreFor = (userId, hole) => {
      const v = strokes[keyOf(roundId, userId, hole)];
      const s = safeInt(v, 0);
      return s > 0 ? s : null;
    };
    const parFor = (hole) => {
      const p = safeInt(parByHole[hole], 4);
      return p > 0 ? p : 4;
    };

    const calcMatchPlayHole = (unit, hole) => {
      const vals = players.map((p) => scoreFor(p.userId, hole));
      if (vals.some((x) => x == null)) return null;
      const nums = vals.map((x) => x);
      const min = Math.min(...nums);
      const winners = nums
        .map((x, i) => ({ x, i }))
        .filter((r) => r.x === min)
        .map((r) => r.i);
      if (winners.length !== 1) return Array.from({ length: n }, () => 0);
      const w = winners[0];
      const out = Array.from({ length: n }, () => -unit);
      out[w] = unit * (n - 1);
      return out;
    };

    const calcStrokePlayHole = (unit, hole) => {
      const vals = players.map((p) => scoreFor(p.userId, hole));
      if (vals.some((x) => x == null)) return null;
      const nums = vals;
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      return nums.map((s) => Math.round((mean - s) * unit));
    };

    return bets.map((b) => {
      if (b.bet_type === 'wolf') {
        const decisions = wolfDecisions[b.id] ?? b.wolf_decisions ?? [];
        const tieRule = b.tie_rule === 'carry' || b.tie_rule === 'double' ? b.tie_rule : 'void';
        const getNets = (hole) =>
          players.map((p) => {
            const k = keyOf(roundId, p.userId, hole);
            const s = safeInt(strokes[k], 0);
            const par = safeInt(parByHole[hole], 4);
            if (s <= 0) return null;
            return s - par;
          });
        const wolfTotals = cumulativeWolfPayouts(
          decisions,
          getNets,
          holesCount,
          b.unit_amount,
          tieRule,
        );
        const rows = players.map((p, i) => ({
          userId: p.userId,
          username: p.username,
          net: wolfTotals[i] ?? 0,
        }));
        return { bet: b, supported: true, rows };
      }

      const supported = b.bet_type === 'match_play' || b.bet_type === 'stroke_play';
      const byUser = new Map(players.map((p) => [p.userId, 0]));
      const perHole = [];

      if (supported) {
        for (const h of holeNums) {
          const pay =
            b.bet_type === 'match_play'
              ? calcMatchPlayHole(b.unit_amount, h)
              : calcStrokePlayHole(b.unit_amount, h);
          if (!pay) continue;
          perHole.push({ hole: h, payouts: pay });
          pay.forEach((amt, idx) => {
            const uid = players[idx].userId;
            byUser.set(uid, (byUser.get(uid) ?? 0) + (amt ?? 0));
          });
        }
      }

      const baseNets = players.map((_, i) => Math.round(byUser.get(players[i].userId) ?? 0));
      const eventsForBet = flowerEvents[b.id] ?? b.events ?? [];
      const cfg = b.event_config ?? defaultEventConfig(b.unit_amount);
      const lastHole = Math.max(...perHole.map((ph) => ph.hole), 0);
      const merged = mergeEventPayoutsIntoBase(
        baseNets,
        eventsForBet,
        lastHole || holesCount,
        n,
        cfg,
      );
      const rows = players.map((p, i) => ({
        userId: p.userId,
        username: p.username,
        net: merged[i] ?? 0,
      }));

      return {
        bet: b,
        supported,
        rows,
      };
    });
  }, [bets, flowerEvents, holesCount, parByHole, players, round?.holes, round?.starting_hole, roundId, strokes, wolfDecisions]);

  function scheduleUpsert(cell) {
    const k = keyOf(roundId, cell.userId, cell.holeNumber);
    const existing = timersRef.current.get(k);
    if (existing) clearTimeout(existing);

    const t = setTimeout(async () => {
      timersRef.current.delete(k);
      try {
        await upsertScoreCell(cell);
      } catch {
        // silent retry once
        setTimeout(() => {
          void upsertScoreCell(cell).catch(() => {});
        }, 1200);
      }
    }, 350);
    timersRef.current.set(k, t);
  }

  function buildStatsPayload(userId, hole, patch) {
    const k = keyOf(roundId, userId, hole);
    const pk = puttsKeyOf(roundId, userId, hole);
    const has = (key) => Object.prototype.hasOwnProperty.call(patch, key);
    const girVal = has('gir') ? patch.gir : gir[k];
    const firVal = has('fir') ? patch.fir : fir[k];
    const sandVal = has('sand') ? patch.sand : sand[k];
    const penaltyVal = has('penalty') ? patch.penalty : penalty[k];
    return {
      gir: typeof girVal === 'boolean' ? girVal : null,
      fir: firVal === 'hit' || firVal === 'left' || firVal === 'right' ? firVal : null,
      sand: typeof sandVal === 'boolean' ? sandVal : null,
      penalty: penaltyVal === 'water' || penaltyVal === 'ob' ? penaltyVal : null,
    };
  }

  function persistAfterStatsChange(userId, hole, patch = {}) {
    const k = keyOf(roundId, userId, hole);
    const pk = puttsKeyOf(roundId, userId, hole);
    const s = safeInt(strokes[k], 0);
    if (s <= 0) return;
    const par = safeInt(parByHole[hole], 4);
    const p = safeInt(putts[pk], 0);
    const stats = buildStatsPayload(userId, hole, patch);
    scheduleUpsert({
      roundId,
      userId,
      holeNumber: hole,
      strokes: s,
      par,
      putts: p > 0 ? p : null,
      ...stats,
    });
  }

  function onChangeStroke(userId, hole, v) {
    if (!canEditUser(userId)) return;
    const k = keyOf(roundId, userId, hole);
    setStrokes((prev) => ({ ...prev, [k]: v }));
    const s = safeInt(v, 0);
    const par = safeInt(parByHole[hole], 4);
    if (s > 0) {
      const pk = puttsKeyOf(roundId, userId, hole);
      const p = safeInt(putts[pk], 0);
      const stats = buildStatsPayload(userId, hole, {});
      scheduleUpsert({
        roundId,
        userId,
        holeNumber: hole,
        strokes: s,
        par,
        putts: p > 0 ? p : null,
        ...stats,
      });
    }
  }

  function onChangePutts(userId, hole, v) {
    if (!canEditUser(userId)) return;
    const pk = puttsKeyOf(roundId, userId, hole);
    setPutts((prev) => ({ ...prev, [pk]: v }));
    const s = safeInt(strokes[keyOf(roundId, userId, hole)], 0);
    const par = safeInt(parByHole[hole], 4);
    const p = safeInt(v, 0);
    if (s > 0) {
      const stats = buildStatsPayload(userId, hole, {});
      scheduleUpsert({
        roundId,
        userId,
        holeNumber: hole,
        strokes: s,
        par,
        putts: p > 0 ? p : null,
        ...stats,
      });
    }
  }

  function onToggleGir(userId, hole, mode) {
    if (!canEditUser(userId)) return;
    const k = keyOf(roundId, userId, hole);
    const cur = gir[k];
    let next;
    if (mode === 'yes') {
      next = cur === true ? undefined : true;
    } else {
      next = cur === false ? undefined : false;
    }
    setGir((prev) => ({ ...prev, [k]: next }));
    persistAfterStatsChange(userId, hole, { gir: next });
  }

  function onToggleFir(userId, hole, val) {
    if (!canEditUser(userId)) return;
    const k = keyOf(roundId, userId, hole);
    const cur = fir[k];
    const next = cur === val ? undefined : val;
    setFir((prev) => ({ ...prev, [k]: next }));
    persistAfterStatsChange(userId, hole, { fir: next });
  }

  function onToggleSand(userId, hole, val) {
    if (!canEditUser(userId)) return;
    const k = keyOf(roundId, userId, hole);
    const cur = sand[k];
    const next = cur === val ? undefined : val;
    setSand((prev) => ({ ...prev, [k]: next }));
    persistAfterStatsChange(userId, hole, { sand: next });
  }

  function onTogglePenalty(userId, hole, val) {
    if (!canEditUser(userId)) return;
    const k = keyOf(roundId, userId, hole);
    const cur = penalty[k];
    let next;
    if (val == null) {
      next = undefined;
    } else if (cur === val) {
      next = undefined;
    } else {
      next = val;
    }
    setPenalty((prev) => ({ ...prev, [k]: next }));
    persistAfterStatsChange(userId, hole, { penalty: next });
  }

  function onToggleFlower(playerIdx, hole, event) {
    const row = players[playerIdx];
    if (!canEditPlayerRow(row) || bets.length === 0) return;
    setFlowerEvents((prev) => {
      const next = { ...prev };
      for (const b of bets) {
        const existing = [...(prev[b.id] ?? [])];
        const idx = existing.findIndex(
          (e) => e.hole === hole && e.playerIndex === playerIdx && e.event === event,
        );
        if (idx >= 0) {
          existing.splice(idx, 1);
        } else {
          existing.push({ hole, playerIndex: playerIdx, event });
        }
        next[b.id] = existing;
      }
      return next;
    });
    const tKey = `flower:${hole}:${playerIdx}:${event}`;
    const existing2 = timersRef.current.get(tKey);
    if (existing2) clearTimeout(existing2);
    const tmr = setTimeout(() => {
      timersRef.current.delete(tKey);
      setFlowerEvents((snap) => {
        for (const b of bets) {
          void patchBetEvents(b.id, snap[b.id] ?? []).catch(() => {});
        }
        return snap;
      });
    }, 600);
    timersRef.current.set(tKey, tmr);
  }

  function onWolfDecide(betId, hole, wolfIdx, partnerIndex) {
    if (!isParticipant) return;
    setWolfDecisions((prev) => {
      const existing = [...(prev[betId] ?? [])];
      const newDec = { hole, wolfIndex: wolfIdx, partnerIndex };
      const idx = existing.findIndex((d) => d.hole === hole);
      if (idx >= 0) existing[idx] = newDec;
      else existing.push(newDec);
      return { ...prev, [betId]: existing };
    });
    // 按 bet 防抖，避免多洞连续操作时用过期的 decision 列表覆盖 Supabase
    const tKey = `wolf:${betId}`;
    const old = timersRef.current.get(tKey);
    if (old) clearTimeout(old);
    const tmr = setTimeout(() => {
      timersRef.current.delete(tKey);
      setWolfDecisions((snap) => {
        void patchBetWolfDecisions(betId, snap[betId] ?? []).catch(() => {});
        return snap;
      });
    }, 600);
    timersRef.current.set(tKey, tmr);
  }

  async function onComplete() {
    if (!isParticipant || !round) return;
    try {
      const emptyHoles = holeNums.filter((h) =>
        players.every((p) => safeInt(strokes[keyOf(roundId, p.userId, h)], 0) === 0),
      );
      if (emptyHoles.length > 0) {
        await new Promise((resolve) => {
          Alert.alert(
            '还有洞未填写',
            `第 ${emptyHoles.join('、')} 洞尚无成绩，确认提交？`,
            [
              { text: '继续填写', style: 'cancel', onPress: () => resolve(false) },
              { text: '确认完成', style: 'destructive', onPress: () => resolve(true) },
            ],
          );
        }).then((confirmed) => {
          if (!confirmed) throw new Error('__user_cancel__');
        });
      }

      setCompleting(true);
      // flush 所有待写 timer，等 upsert 全部落库
      for (const [, tmr] of timersRef.current) clearTimeout(tmr);
      timersRef.current.clear();
      // 等最后一批 upsert（给一个小窗口）
      await new Promise((r) => setTimeout(r, 400));

      await setRoundStatus(round.id, 'completed');
      router.replace(`/rounds/${round.id}/summary`);
    } catch (e) {
      if (e instanceof Error && e.message === '__user_cancel__') return;
      Alert.alert('完成记分', e instanceof Error ? e.message : '操作失败，请重试');
    } finally {
      setCompleting(false);
    }
  }

  if (busy || !round) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={GOLF.accent} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        variant="stack"
        title={round.course_name || '记分'}
        subtitle={`${round.played_at} · ${round.tee_color} · ${round.holes} 洞`}
        onBack={() => router.back()}
      />
      {!isParticipant ? (
        <Text
          style={{
            fontSize: 11,
            color: GOLF.muted,
            textAlign: 'center',
            paddingVertical: 4,
          }}
        >
          👁 旁观模式 · 仅查看
        </Text>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {bets.length > 0 ? (
          <View style={styles.betPanel}>
            <Pressable onPress={() => setBetsOpen((x) => !x)} style={styles.betPanelHead}>
              <Text style={styles.betPanelTitle}>{t('scoring.bet_panel')}</Text>
              <Text style={styles.betPanelHint}>{betsOpen ? t('scoring.bet_collapse') : t('scoring.bet_expand')}</Text>
            </Pressable>
            {betsOpen ? (
              <View style={{ marginTop: 10 }}>
                {betStandings.map((x) => (
                  <View key={x.bet.id} style={styles.betBlock}>
                    <View style={styles.betRowHead}>
                      <Text style={styles.betName}>
                        {x.bet.bet_type === 'match_play'
                          ? '比洞'
                          : x.bet.bet_type === 'stroke_play'
                            ? '比杆'
                            : x.bet.bet_type === 'wolf'
                              ? '🐺 Wolf'
                              : '即将上线'}
                        {'  '}
                        {x.bet.unit_amount}/{x.bet.bet_type === 'stroke_play' ? '洞' : '洞'}
                      </Text>
                      <Text style={styles.betMeta}>
                        {x.bet.settlement_timing === 'end_total' ? '打完一起算' : '一洞一算'}
                      </Text>
                    </View>
                    {!x.supported ? (
                      <Text style={styles.betSoon}>{t('scoring.bet_soon')}</Text>
                    ) : (
                      x.rows.map((r) => (
                        <View key={r.userId} style={styles.betLine}>
                          <Text style={styles.betUser} numberOfLines={1}>
                            {r.username}
                          </Text>
                          <Text
                            style={[
                              styles.betAmt,
                              r.net > 0 ? styles.good : r.net < 0 ? styles.bad : null,
                            ]}
                          >
                            {r.net > 0 ? `+${r.net}` : String(r.net)}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <Pressable
          onPress={() => setBoardOpen((v) => !v)}
          style={styles.boardToggle}
          accessibilityRole="button"
          accessibilityLabel="计分板"
        >
          <Text style={styles.boardToggleTxt}>
            📊 计分板  {boardOpen ? '▲' : '▼'}
          </Text>
        </Pressable>

        {boardOpen ? (
          <View style={styles.leaderBoard}>
            {leaderboardRows.map((row, idx) => {
              const rel = row.toPar;
              const scoreColor =
                rel == null ? TEXT_MUTED : rel < 0 ? ACCENT : rel > 0 ? WARN : TEXT_MAIN;
              const sameGroup = row.groupNumber === myGroup;
              return (
                <View key={row.userId} style={styles.leaderBoardRow}>
                  <Text style={styles.leaderRank}>{idx + 1}</Text>
                  <Text style={styles.leaderName} numberOfLines={1}>
                    <Text
                      style={[
                        styles.leaderGroupTag,
                        { color: sameGroup ? ACCENT : TEXT_MUTED },
                      ]}
                    >
                      G{row.groupNumber}{' '}
                    </Text>
                    {row.name}
                  </Text>
                  <Text style={[styles.leaderScore, { color: scoreColor }]}>
                    {formatLeaderToPar(rel)}
                  </Text>
                  <Text style={styles.leaderHoles}>{row.holesPlayed}洞</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.holeNav}>
          <Pressable
            onPress={() => {
              if (activeHoleIdx > 0) setViewHole(holeNums[activeHoleIdx - 1]);
            }}
            disabled={activeHoleIdx <= 0}
            style={[styles.holeNavBtn, activeHoleIdx <= 0 && styles.holeNavBtnDisabled]}
          >
            <Text style={styles.holeNavBtnTxt}>‹ 上一洞</Text>
          </Pressable>
          <Text style={styles.holeNavMid}>
            第 {activeHole} 洞 · {activeHoleIdx + 1}/{holeNums.length}
          </Text>
          <Pressable
            onPress={() => {
              if (activeHoleIdx < holeNums.length - 1) setViewHole(holeNums[activeHoleIdx + 1]);
            }}
            disabled={activeHoleIdx >= holeNums.length - 1}
            style={[
              styles.holeNavBtn,
              activeHoleIdx >= holeNums.length - 1 && styles.holeNavBtnDisabled,
            ]}
          >
            <Text style={styles.holeNavBtnTxt}>下一洞 ›</Text>
          </Pressable>
        </View>

        {isParticipant ? (
          <Text style={styles.myGroupHint}>
            第 {myGroup} 组 · 记录 {myGroupPlayers.length} 人
          </Text>
        ) : null}

        {[activeHole].map((h) => (
          <View key={h} style={styles.holeCard}>
            <View style={styles.holeTop}>
              <Text style={styles.holeTitle}>{t('scoring.hole', { n: h })}</Text>
              <View style={styles.parRow}>
                <Text style={styles.parLabel}>{t('scoring.par')}</Text>
                <TextInput
                  style={styles.parDisplay}
                  value={String(parByHole[h] ?? '4')}
                  editable={false}
                  pointerEvents="none"
                />
              </View>
            </View>

            {Platform.OS === 'web' ? (
              <View style={styles.gpsRow}>
                <Text style={styles.gpsText}>{t('scoring.gps_web')}</Text>
              </View>
            ) : (
              (() => {
                const pin = pinPos[h];
                const dist = haversineYards(currentPos, pin);
                const isFromCloud = savedPins.has(h) && !locallyMarked(h);
                return (
                  <View style={styles.gpsRow}>
                    <Text style={styles.gpsText}>
                      {dist != null
                        ? `${t('scoring.gps_yards', { n: dist })}${isFromCloud ? ' 📡' : ''}`
                        : pin
                          ? t('scoring.gps_locating')
                          : locationPerm === 'denied'
                            ? t('scoring.gps_no_perm')
                            : t('scoring.gps_not_marked')}
                    </Text>
                    <Pressable
                      onPress={() => markPin(h)}
                      disabled={!isParticipant || !currentPos}
                      style={[styles.gpsBtn, (!isParticipant || !currentPos) && { opacity: 0.4 }]}
                    >
                      <Text style={styles.gpsBtnTxt}>{t('scoring.gps_mark_pin')}</Text>
                    </Pressable>
                  </View>
                );
              })()
            )}

            {myGroupPlayers.map((p, sortedIdx) => {
              const playerIdx = players.findIndex((x) => x.userId === p.userId);
              const rowEditable = canEditPlayerRow(p);
              const k = keyOf(roundId, p.userId, h);
              const pk = puttsKeyOf(roundId, p.userId, h);
              const total = computeTotals.totals.get(p.userId);
              const delta = computeTotals.toPar.get(p.userId);
              const parH = safeInt(parByHole[h], 4);
              const girYes = gir[k] === true;
              const girNo = gir[k] === false;
              const firLeft = fir[k] === 'left';
              const firHit = fir[k] === 'hit';
              const firRight = fir[k] === 'right';
              const sandNo = sand[k] === false;
              const sandYes = sand[k] === true;
              const penNone = penalty[k] == null;
              const penWater = penalty[k] === 'water';
              const penOb = penalty[k] === 'ob';
              const eventsThisPlayerHole = Object.values(flowerEvents)
                .flat()
                .filter((e) => e.hole === h && e.playerIndex === playerIdx);
              const hasEvent = (ev) => eventsThisPlayerHole.some((e) => e.event === ev);
              return (
                <View key={`${p.userId}-${h}`}>
                  <View
                    style={[
                      styles.playerBlock,
                      sortedIdx === 0 && styles.playerBlockFirst,
                    ]}
                  >
                  <View style={styles.row}>
                    <Text style={styles.name} numberOfLines={1}>
                      {p.username}
                    </Text>
                    <TextInput
                      style={styles.strokeInput}
                      value={strokes[k] ?? ''}
                      onChangeText={(v) => onChangeStroke(p.userId, h, v)}
                      keyboardType="number-pad"
                      placeholder="—"
                      placeholderTextColor={GOLF.muted}
                      editable={rowEditable}
                    />
                    <TextInput
                      style={styles.puttInput}
                      value={putts[pk] ?? ''}
                      onChangeText={(v) => onChangePutts(p.userId, h, v)}
                      keyboardType="number-pad"
                      placeholder={t('scoring.putts_placeholder')}
                      placeholderTextColor={GOLF.muted}
                      editable={rowEditable}
                    />
                    <Text style={styles.miniMeta}>
                      {typeof total === 'number' ? t('scoring.total', { n: total }) : '总—'}{' '}
                      {typeof delta === 'number'
                        ? delta === 0
                          ? 'E'
                          : delta > 0
                            ? `+${delta}`
                            : `${delta}`
                        : ''}
                    </Text>
                  </View>

                  <View style={styles.statsWrap}>
                    <View style={styles.statRow}>
                      <Pressable
                        disabled={!rowEditable}
                        onPress={rowEditable ? () => onToggleGir(p.userId, h, 'yes') : undefined}
                        style={[styles.statChip, girYes && styles.statChipOn]}
                      >
                        <Text style={[styles.statChipTxt, girYes && styles.statChipTxtOn]}>{t('scoring.gir_yes')}</Text>
                      </Pressable>
                      <Pressable
                        disabled={!rowEditable}
                        onPress={rowEditable ? () => onToggleGir(p.userId, h, 'no') : undefined}
                        style={[styles.statChip, girNo && styles.statChipOn]}
                      >
                        <Text style={[styles.statChipTxt, girNo && styles.statChipTxtOn]}>{t('scoring.gir_no')}</Text>
                      </Pressable>
                    </View>

                    {parH >= 4 ? (
                      <View style={styles.statRow}>
                        <Pressable
                          disabled={!rowEditable}
                          onPress={rowEditable ? () => onToggleFir(p.userId, h, 'left') : undefined}
                          style={[styles.statChip, firLeft && styles.statChipOn]}
                        >
                          <Text style={[styles.statChipTxt, firLeft && styles.statChipTxtOn]}>{t('scoring.fir_left')}</Text>
                        </Pressable>
                        <Pressable
                          disabled={!rowEditable}
                          onPress={rowEditable ? () => onToggleFir(p.userId, h, 'hit') : undefined}
                          style={[styles.statChip, firHit && styles.statChipOn]}
                        >
                          <Text style={[styles.statChipTxt, firHit && styles.statChipTxtOn]}>{t('scoring.fir_hit')}</Text>
                        </Pressable>
                        <Pressable
                          disabled={!rowEditable}
                          onPress={rowEditable ? () => onToggleFir(p.userId, h, 'right') : undefined}
                          style={[styles.statChip, firRight && styles.statChipOn]}
                        >
                          <Text style={[styles.statChipTxt, firRight && styles.statChipTxtOn]}>{t('scoring.fir_right')}</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Text style={styles.firNa}>{t('scoring.fir_na')}</Text>
                    )}

                    <View style={styles.statRow}>
                      <Pressable
                        disabled={!rowEditable}
                        onPress={rowEditable ? () => onToggleSand(p.userId, h, false) : undefined}
                        style={[styles.statChip, sandNo && styles.statChipOn]}
                      >
                        <Text style={[styles.statChipTxt, sandNo && styles.statChipTxtOn]}>{t('scoring.sand_no')}</Text>
                      </Pressable>
                      <Pressable
                        disabled={!rowEditable}
                        onPress={rowEditable ? () => onToggleSand(p.userId, h, true) : undefined}
                        style={[styles.statChip, sandYes && styles.statChipOn]}
                      >
                        <Text style={[styles.statChipTxt, sandYes && styles.statChipTxtOn]}>{t('scoring.sand_yes')}</Text>
                      </Pressable>
                    </View>

                    <View style={styles.statRow}>
                      <Pressable
                        disabled={!rowEditable}
                        onPress={rowEditable ? () => onTogglePenalty(p.userId, h, null) : undefined}
                        style={[styles.statChip, penNone && styles.statChipOn]}
                      >
                        <Text style={[styles.statChipTxt, penNone && styles.statChipTxtOn]}>{t('scoring.penalty_none')}</Text>
                      </Pressable>
                      <Pressable
                        disabled={!rowEditable}
                        onPress={rowEditable ? () => onTogglePenalty(p.userId, h, 'water') : undefined}
                        style={[styles.statChip, penWater && styles.statChipOn]}
                      >
                        <Text style={[styles.statChipTxt, penWater && styles.statChipTxtOn]}>{t('scoring.penalty_water')}</Text>
                      </Pressable>
                      <Pressable
                        disabled={!rowEditable}
                        onPress={rowEditable ? () => onTogglePenalty(p.userId, h, 'ob') : undefined}
                        style={[styles.statChip, penOb && styles.statChipOn]}
                      >
                        <Text style={[styles.statChipTxt, penOb && styles.statChipTxtOn]}>{t('scoring.penalty_ob')}</Text>
                      </Pressable>
                    </View>

                    {bets.length > 0 ? (
                      <View style={styles.flowerWrap}>
                        <Text style={styles.flowerLabel}>挂花</Text>
                        <View style={styles.flowerRow}>
                          {FLOWERS.map(({ ev, label, earn }) => {
                            const on = hasEvent(ev);
                            return (
                              <Pressable
                                key={ev}
                                disabled={!rowEditable}
                                onPress={rowEditable ? () => onToggleFlower(playerIdx, h, ev) : undefined}
                                style={[
                                  styles.flowerChip,
                                  on && (earn ? styles.flowerChipEarn : styles.flowerChipPay),
                                ]}
                              >
                                <Text style={[styles.flowerChipTxt, on && styles.flowerChipTxtOn]}>{label}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    ) : null}

                    {bets
                      .filter((wb) => wb.bet_type === 'wolf')
                      .map((wolfBet) => {
                        const wolfIdx = wolfIndexForHole(h);
                        const wolfName = players[wolfIdx]?.username ?? `P${wolfIdx + 1}`;
                        const decisions = wolfDecisions[wolfBet.id] ?? [];
                        const dec = decisions.find((d) => d.hole === h);
                        const loneSelected = dec != null && dec.partnerIndex === null;

                        return (
                          <View key={wolfBet.id} style={styles.wolfWrap}>
                            <Text style={styles.wolfLabel}>🐺 Wolf: {wolfName}</Text>
                            <View style={styles.wolfRow}>
                              {players.map((pp, pIdx) => {
                                if (pIdx === wolfIdx) return null;
                                const on = dec?.partnerIndex === pIdx;
                                return (
                                  <Pressable
                                    key={pIdx}
                                    disabled={!isParticipant}
                                    onPress={
                                      isParticipant
                                        ? () => onWolfDecide(wolfBet.id, h, wolfIdx, pIdx)
                                        : undefined
                                    }
                                    style={[styles.wolfChip, on && styles.wolfChipOn]}
                                  >
                                    <Text style={[styles.wolfChipTxt, on && styles.wolfChipTxtOn]}>
                                      +{pp.username}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                              <Pressable
                                disabled={!isParticipant}
                                onPress={
                                  isParticipant
                                    ? () => onWolfDecide(wolfBet.id, h, wolfIdx, null)
                                    : undefined
                                }
                                style={[
                                  styles.wolfChip,
                                  styles.wolfChipSolo,
                                  loneSelected && styles.wolfChipSoloOn,
                                ]}
                              >
                                <Text style={[styles.wolfChipTxt, loneSelected && styles.wolfChipTxtOn]}>
                                  🐺 单挑
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        );
                      })}
                  </View>
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        {isParticipant && round?.status === 'in_progress' ? (
          <Pressable
            style={[styles.primary, completing && styles.disabled]}
            onPress={onComplete}
            disabled={completing}
          >
            <Text style={styles.primaryTxt}>{completing ? t('scoring.completing') : t('scoring.complete')}</Text>
          </Pressable>
        ) : null}

        <View style={styles.chatSection}>
          <Text style={styles.chatTitle}>💬 球局讨论</Text>
          <ScrollView
            ref={chatScrollRef}
            style={styles.chatList}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {roundMessages.length === 0 ? (
              <Text style={styles.chatEmpty}>暂无消息，来聊两句吧</Text>
            ) : (
              roundMessages.map((msg) => {
                const mine = msg.userId === myUserId;
                return (
                  <View
                    key={msg.id}
                    style={[styles.chatBubble, mine && styles.chatBubbleMine]}
                  >
                    <Text style={styles.chatUser}>{msg.displayName}</Text>
                    <Text style={styles.chatContent}>{msg.content}</Text>
                    <Text style={styles.chatTime}>{formatChatTime(msg.createdAt)}</Text>
                  </View>
                );
              })
            )}
          </ScrollView>
          {myUserId ? (
            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                value={chatText}
                onChangeText={setChatText}
                placeholder="说点什么..."
                placeholderTextColor={TEXT_MUTED}
                multiline={false}
                returnKeyType="send"
                onSubmitEditing={() => void sendChatMessage()}
                editable={!chatSending}
              />
              <Pressable
                style={[styles.chatSendBtn, (!chatText.trim() || chatSending) && styles.disabled]}
                onPress={() => void sendChatMessage()}
                disabled={!chatText.trim() || chatSending}
              >
                <Text style={styles.chatSendTxt}>{chatSending ? '…' : '发送'}</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.chatLoginHint}>登录后可参与讨论</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GOLF.bg },
  center: { flex: 1, backgroundColor: GOLF.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 40 },
  boardToggle: { marginBottom: 8 },
  boardToggleTxt: { color: ACCENT, fontSize: 14, fontWeight: '800' },
  leaderBoard: {
    backgroundColor: THEME.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 2,
  },
  leaderBoardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  leaderRank: { width: 20, fontSize: 13, fontWeight: '800', color: ACCENT },
  leaderName: { flex: 1, fontSize: 13, color: TEXT_MAIN },
  leaderScore: { fontSize: 14, fontWeight: '800', minWidth: 36, textAlign: 'right' },
  leaderHoles: { fontSize: 11, color: TEXT_MUTED, marginLeft: 8, minWidth: 32, textAlign: 'right' },
  leaderGroupTag: { fontWeight: '700', fontSize: 11 },
  myGroupHint: {
    fontSize: 11,
    color: TEXT_MUTED,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  spectatorBanner: {
    backgroundColor: 'rgba(201,255,74,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(201,255,74,0.25)',
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  spectatorTxt: { color: GOLF.accent, fontWeight: '800', fontSize: 14 },
  spectatorChatBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GOLF.accent,
  },
  spectatorChatTxt: { color: GOLF.accent, fontWeight: '800', fontSize: 13 },
  holeNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  holeNavMid: { color: GOLF.text, fontWeight: '900', fontSize: 15, flex: 1, textAlign: 'center' },
  holeNavBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GOLF.border,
    backgroundColor: GOLF.bgCard,
  },
  holeNavBtnDisabled: { opacity: 0.35 },
  holeNavBtnTxt: { color: GOLF.accent, fontWeight: '800', fontSize: 13 },
  betPanel: {
    backgroundColor: GOLF.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GOLF.border,
    padding: 12,
    marginBottom: 12,
  },
  betPanelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  betPanelTitle: { color: GOLF.text, fontWeight: '900' },
  betPanelHint: { color: GOLF.muted, fontWeight: '900' },
  betBlock: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  betRowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  betName: { color: GOLF.text, fontWeight: '900' },
  betMeta: { color: GOLF.muted, fontWeight: '800' },
  betSoon: { color: GOLF.muted, marginTop: 6, fontWeight: '800' },
  betLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 10 },
  betUser: { color: GOLF.text, fontWeight: '800', flex: 1 },
  betAmt: { color: GOLF.muted, fontWeight: '900' },
  good: { color: GOLF.accent },
  bad: { color: '#f87171' },
  holeCard: {
    backgroundColor: GOLF.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GOLF.border,
    padding: 12,
    marginBottom: 12,
  },
  holeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  holeTitle: { color: GOLF.text, fontWeight: '900' },
  parRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  parLabel: { color: GOLF.muted, fontWeight: '800' },
  parDisplay: {
    width: 54,
    textAlign: 'center',
    paddingVertical: 8,
    color: GOLF.text,
    fontWeight: '900',
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  playerBlock: { marginTop: 12 },
  playerBlockFirst: { marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { color: GOLF.text, flex: 1, fontWeight: '800' },
  statsWrap: { marginTop: 8, gap: 6 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  statChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a4a40',
    backgroundColor: 'transparent',
  },
  statChipOn: {
    backgroundColor: '#1e3a26',
    borderColor: '#c9ff4a',
  },
  statChipTxt: { color: '#6a7a70', fontSize: 13, fontWeight: '700' },
  statChipTxtOn: { color: '#c9ff4a', fontSize: 13, fontWeight: '700' },
  firNa: { color: '#6a7a70', fontSize: 13, fontWeight: '600', marginLeft: 2 },
  strokeInput: {
    width: 64,
    textAlign: 'center',
    backgroundColor: GOLF.inputBg,
    borderWidth: 1,
    borderColor: GOLF.border,
    borderRadius: 10,
    paddingVertical: 10,
    color: GOLF.text,
    fontWeight: '900',
  },
  puttInput: {
    width: 64,
    textAlign: 'center',
    backgroundColor: GOLF.inputBg,
    borderWidth: 1,
    borderColor: GOLF.border,
    borderRadius: 10,
    paddingVertical: 10,
    color: GOLF.text,
    fontWeight: '900',
  },
  miniMeta: { color: GOLF.muted, width: 88, textAlign: 'right', fontWeight: '700' },
  primary: {
    backgroundColor: GOLF.gold,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 6,
  },
  primaryTxt: { color: '#1a2e22', fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.6 },
  chatSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: DIVIDER,
  },
  chatTitle: { fontSize: 14, fontWeight: '700', color: TEXT_SEC, marginBottom: 10 },
  chatList: { maxHeight: 200, marginBottom: 10 },
  chatEmpty: { fontSize: 12, color: TEXT_MUTED, textAlign: 'center', paddingVertical: 12 },
  chatBubble: {
    backgroundColor: CHIP_MUTED,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  chatBubbleMine: { backgroundColor: CHIP_ACCENT_BG, alignSelf: 'flex-end' },
  chatUser: { fontSize: 11, color: TEXT_MUTED, fontWeight: '600', marginBottom: 2 },
  chatContent: { fontSize: 13, color: TEXT_MAIN },
  chatTime: { fontSize: 10, color: TEXT_MUTED, marginTop: 2, textAlign: 'right' },
  chatInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  chatInput: {
    flex: 1,
    backgroundColor: CHIP_MUTED,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: TEXT_MAIN,
  },
  chatSendBtn: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chatSendTxt: { fontSize: 13, fontWeight: '800', color: ON_ACCENT },
  chatLoginHint: { fontSize: 12, color: TEXT_MUTED, textAlign: 'center', paddingVertical: 8 },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 8,
  },
  gpsText: { color: GOLF.accent, fontWeight: '800', fontSize: 14 },
  gpsBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: GOLF.accent,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  gpsBtnTxt: { color: GOLF.accent, fontSize: 12, fontWeight: '700' },
  flowerWrap: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  flowerLabel: { color: GOLF.muted, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  flowerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  flowerChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a4a40',
    backgroundColor: 'transparent',
  },
  flowerChipEarn: { borderColor: '#c9ff4a', backgroundColor: '#1a3020' },
  flowerChipPay: { borderColor: '#f87171', backgroundColor: '#3a1a1a' },
  flowerChipTxt: { color: '#6a7a70', fontSize: 12, fontWeight: '700' },
  flowerChipTxtOn: { color: GOLF.text, fontWeight: '800' },
  wolfWrap: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  wolfLabel: { color: '#c9ff4a', fontSize: 12, fontWeight: '800', marginBottom: 6 },
  wolfRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  wolfChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a4a40',
    backgroundColor: 'transparent',
  },
  wolfChipOn: { borderColor: '#c9ff4a', backgroundColor: '#1a3020' },
  wolfChipSolo: { borderColor: '#f59e0b' },
  wolfChipSoloOn: { borderColor: '#f59e0b', backgroundColor: '#3a2800' },
  wolfChipTxt: { color: '#6a7a70', fontSize: 12, fontWeight: '700' },
  wolfChipTxtOn: { color: GOLF.text, fontWeight: '800' },
});

