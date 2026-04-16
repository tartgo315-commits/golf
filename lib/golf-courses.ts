/**
 * 中国大陆球场库（data/courses.json）— 记分卡模板与元数据
 */

import coursesJson from '@/data/courses.json';

export type LibraryHole = {
  hole: number;
  par: number;
  yards: number;
  hcp: number;
};

export type LibraryCourse = {
  id: string;
  nameCn: string;
  nameEn: string;
  location?: { lat: number; lng: number };
  address?: string;
  province?: string;
  architect?: string;
  yearBuilt?: number;
  totalPar: number;
  totalYards: number;
  rating?: number;
  slope?: number;
  notes?: string;
  source?: string;
  sourceUrl?: string;
  scorecard: LibraryHole[];
};

type CoursesFile = {
  courses: LibraryCourse[];
  pending: { nameCn: string; nameEn: string; golfPassUrl: string; province?: string; architect?: string }[];
};

const data = coursesJson as CoursesFile;

export function getLibraryCoursesWithScorecard(): LibraryCourse[] {
  return data.courses.filter((c) => Array.isArray(c.scorecard) && c.scorecard.length === 18);
}

export function getLibraryCourseById(id: string): LibraryCourse | undefined {
  return data.courses.find((c) => c.id === id);
}

export function getLibraryPending() {
  return data.pending;
}
