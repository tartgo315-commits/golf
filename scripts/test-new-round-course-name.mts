/**
 * Bug 5：球场名解析逻辑（与 NewRoundScreen resolvedCourseName 一致）
 *   npx tsx scripts/test-new-round-course-name.mts
 */

function resolveCourseName(input: {
  selectedName?: string;
  courseName: string;
  courseSearchQuery: string;
}): string {
  if (input.selectedName?.trim()) return input.selectedName.trim();
  const manual = input.courseName.trim();
  if (manual) return manual;
  return input.courseSearchQuery.trim();
}

let ok = 0;
let fail = 0;

function assert(name: string, cond: boolean) {
  if (cond) {
    console.log(`  ✓ ${name}`);
    ok += 1;
  } else {
    console.log(`  ✗ ${name}`);
    fail += 1;
  }
}

console.log('\n=== 球场名 resolvedCourseName ===\n');

assert(
  '仅搜索框有内容即可前进',
  resolveCourseName({ courseName: '', courseSearchQuery: '模拟测试球场' }) === '模拟测试球场',
);
assert(
  '选中球场优先',
  resolveCourseName({
    selectedName: '观澜湖',
    courseName: 'x',
    courseSearchQuery: 'y',
  }) === '观澜湖',
);
assert(
  '手动名优先于搜索框',
  resolveCourseName({ courseName: '自定义名', courseSearchQuery: '搜索词' }) === '自定义名',
);
assert('三者皆空不可前进', resolveCourseName({ courseName: '', courseSearchQuery: '' }) === '');

console.log(`\n结果：${ok} 通过，${fail} 失败\n`);
process.exit(fail > 0 ? 1 : 0);
