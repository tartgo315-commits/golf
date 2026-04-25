import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import {
  HANDICAP_RECORDS_KEY,
  buildHandicapTrend,
  normalizeHandicapRecords,
  type HandicapRecord,
} from '@/lib/handicap';
import { parseJsonArray } from '@/lib/local-storage';
import { TRAINING_ITEMS_KEY } from '@/utils/trainingPlan';

export type UserDataExport = {
  exportedAt: string;
  appVersion: string;
  rounds: HandicapRecord[];
  handicapHistory: { date: string; index: number | null }[];
  trainingItems: unknown[];
};

async function loadRoundsForExport(): Promise<HandicapRecord[]> {
  if (Platform.OS === 'web') {
    const { loadHandicapRecords } = await import('@/lib/handicap');
    return loadHandicapRecords();
  }
  const raw = await AsyncStorage.getItem(HANDICAP_RECORDS_KEY);
  return normalizeHandicapRecords(parseJsonArray<unknown>(raw));
}

async function loadTrainingForExport(): Promise<unknown[]> {
  const raw = await AsyncStorage.getItem(TRAINING_ITEMS_KEY);
  return parseJsonArray<unknown>(raw);
}

export async function buildUserDataExport(): Promise<UserDataExport> {
  const rounds = await loadRoundsForExport();
  const handicapHistory = buildHandicapTrend(rounds).map((p) => ({
    date: p.date,
    index: p.index,
  }));
  const trainingItems = await loadTrainingForExport();
  const appVersion =
    (typeof Constants.expoConfig?.version === 'string' && Constants.expoConfig.version) || '1.0.0';
  return {
    exportedAt: new Date().toISOString(),
    appVersion,
    rounds,
    handicapHistory,
    trainingItems,
  };
}

export function hasExportableData(payload: UserDataExport): boolean {
  return payload.rounds.length > 0 || payload.trainingItems.length > 0;
}

/** Web：触发浏览器下载 JSON */
export function downloadJsonOnWeb(filename: string, json: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * 生成 JSON 并分享（iOS/Android 用系统分享；Web 用下载）。
 * @returns true 表示已发起分享/下载
 */
export async function exportUserDataJson(): Promise<{ ok: boolean; empty?: boolean }> {
  const payload = await buildUserDataExport();
  if (!hasExportableData(payload)) {
    return { ok: false, empty: true };
  }
  const json = JSON.stringify(payload, null, 2);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `golfmate-export-${stamp}.json`;

  if (Platform.OS === 'web') {
    downloadJsonOnWeb(filename, json);
    return { ok: true };
  }

  const base = FileSystem.cacheDirectory;
  if (!base) return { ok: false };
  const uri = `${base}${filename}`;
  await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
  const can = await Sharing.isAvailableAsync();
  if (!can) return { ok: false };
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: '导出 GolfMate 数据',
  });
  return { ok: true };
}
