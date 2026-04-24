import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@gca_amend_unlock_rounds_v1';

let mem: Set<string> | null = null;

export async function hydrateAmendmentUnlocks(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    mem = new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    mem = new Set();
  }
}

export function isRoundAmendmentUnlockedSync(roundId: string): boolean {
  return mem?.has(roundId) ?? false;
}

export async function markRoundAmendmentUnlocked(roundId: string): Promise<void> {
  if (!mem) await hydrateAmendmentUnlocks();
  mem!.add(roundId);
  await AsyncStorage.setItem(KEY, JSON.stringify([...mem!]));
}

export async function clearRoundAmendmentUnlock(roundId: string): Promise<void> {
  if (!mem) await hydrateAmendmentUnlocks();
  mem!.delete(roundId);
  await AsyncStorage.setItem(KEY, JSON.stringify([...mem!]));
}
