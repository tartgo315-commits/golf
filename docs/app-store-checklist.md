# App Store 审核合规检查清单（GolfMate）

在提交审核前逐项确认（可复制到 PR 描述中勾选）。

- [ ] `bundleIdentifier` / `android.package` 已设置且与 Apple Developer / Google Play 控制台一致、全局唯一
- [ ] 所有 `NS*UsageDescription`（及 Android 同类说明）已填写；**申请了什么系统权限，就必须有对应用途说明**
- [ ] 未使用私有 API 或未文档化的系统调用
- [ ] 隐私政策、用户协议等**外链在审核地区可访问**（HTTPS、无登录墙）
- [ ] 应用内提供**账号删除 / 全部数据删除**入口（Apple 2022 年起对含账号体系的应用常见要求）；本应用见「设置 → 删除账号与全部数据」
- [ ] 若仅使用自建邮箱登录：当前无强制 Sign in with Apple；若后续加入 Google 等第三方登录，需按规则评估 **Sign in with Apple**
- [ ] 启动图/闪屏背景**非纯白色**（已配置 `#0d1b11`）
- [ ] 应用核心能力不依赖单一国家/地区网络（后端使用全球 CDN 如 Vercel 可满足说明）
- [ ] 差点与球场 CR/SR 等说明中含**免责声明**（不构成官方 WHS 认证；数据以官方为准）— 见用户协议与商店描述
- [ ] 推送通知用途在 plist / 产品界面中有**明确说明**（训练提醒、好友相关通知）
- [ ] `ITSAppUsesNonExemptEncryption` / `usesNonExemptEncryption: false` 已与实际加密出口合规情况一致
- [ ] `docs/app-store-metadata.md` 中英文描述、关键词、副标题已与 App Store Connect 填写内容同步
