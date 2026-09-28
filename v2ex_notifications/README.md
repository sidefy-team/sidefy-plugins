# V2EX Notifications Plugin

获取 V2EX 的未读消息并显示在时间线中。支持区分回复、点赞(感谢)、打赏、提及和收藏。

## 配置

1. 登录 V2EX。
2. 进入 [通知页面](https://www.v2ex.com/notifications)。
3. 在页面右侧或底部找到 **Atom Feed for Notifications** 下面的 RSS 链接。
4. 复制该链接中的 Token 部分(即 `.xml` 之前的长字符串,例如 `your-private-token-here`)。
5. 将 Token 填入插件配置的 `token` 中。

## 功能

- **每日增量缓存**: 每天使用独立的缓存 key,自动累积当天的所有通知,。
- **智能缓存**: 缓存有效期至当天结束,第二天自动刷新。
- **类型区分**:
  - [回复] 青色
  - [感谢] 金色
  - [打赏] 紫色
  - [提及] 红色
  - [收藏] 橙色
- **打赏识别**: 当通知 `title` 和 `content` 为空，且 `href` 形如 `https://www.v2ex.com<token>`（域名后没有 `/`）时，判定为打赏。
- **详情查看**: 点击事件可直接跳转到对应的回复或主题。

## Changelog

### v1.1.3

- 补齐 i18n：通知标题与错误提示改用 `sidefy.i18n()`，覆盖 `zh` / `en` / `ja` / `ko`
- 修复 `en` / `ja` / `ko` 环境下标题仍显示中文（如「有人 感谢了你的回复」）的问题
- 日志文案统一为英文
- 清理 `detectType()` 中从未被读取的 `label` 字段，并移除不可达的兜底分支（原 `i18nNewMessageTitle`）
