/**
 * 统一球场目录类型（日本离线 JSON + 服务端 KV + 中国大陆 library 映射）
 */

export type CatalogHoleDetail = {
  hole: number;
  par: 3 | 4 | 5;
  handicapIndex: number;
  yards: number | null;
};

export type CatalogCourseLayout = {
  layout: string;
  holes: 9 | 18;
  courseRating: number | null;
  slopeRating: number | null;
  par: number;
  holeDetails: CatalogHoleDetail[];
};

export type CatalogCourse = {
  id: string;
  name: string;
  nameEn: string;
  country: string;
  prefecture: string;
  city: string;
  holes: CatalogCourseLayout[];
  verified: boolean;
  updatedAt: string;
  /** 球场大致坐标（如 data/courses-jp.json），用于天气等 */
  lat?: number;
  lng?: number;
};

/** 搜索列表项（不含 holeDetails） */
export type CatalogCourseSearchHit = {
  id: string;
  name: string;
  nameEn: string;
  country: string;
  prefecture: string;
  city: string;
  verified: boolean;
  updatedAt: string;
  /** 各 layout 的 CR/SR 摘要，便于二级选择 */
  layouts: {
    layout: string;
    holes: 9 | 18;
    courseRating: number | null;
    slopeRating: number | null;
    par: number;
  }[];
};

export type CourseSuggestBody = {
  name: string;
  courseRating?: number | null;
  slopeRating?: number | null;
  par?: number | null;
  source?: string;
};
