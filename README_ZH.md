# Sidefy 插件贡献指南

[English](README.md) | [中文](README_ZH.md)

>[!WARNING] 
>免责声明：社区插件由第三方提供，Sidefy不对其安全性承担责任，请用户自行校验与甄别。

## 📁 文件结构

```
//目录名称，同时也是客户端唯一插件id
your-plugin-name/
    ├── main.js # 插件代码
    ├── info.json # 插件基础信息
    └── README.md # 说明文档
```

## info.json

```json
{
  "name": "Bilibili 用户视频",
  "description": "追踪指定B站UP主的最新视频投稿，实时显示视频标题、播放量、发布时间等信息",
  //插件版本，更新后客户端会显示更新提醒
  "version": "0.1.0",
  "author": "sha2kyou",
  //限制最低适配的 Sidefy 版本，比该版本低的客户端无法下载该插件
  "min_support_app_version": "2025.3.0",
  "tags": ["bilibili", "哔哩哔哩", "视频", "UP主", "动态", "社交媒体"],
  "category": "社交媒体",
  //配置参数在插件下载后会被自动映射到对应的输入框
  "config_options": {
    "mid": {
      "type": "string",
      "default": "",
      "description": "B站用户ID（mid参数）"
    },
    "pageSize": {
      "type": "number",
      "default": 10,
      "description": "每次获取的视频数量"
    }
  },
  //如果不申请正确的权限，则无法进行对应的操作。不配置默认都是 false
  "requirements": {
    //网络权限：限制单次请求超时30秒
    "network": true,
    //存储权限：最大限制存储16k数据，最大存储5条数据
    "storage": true,
    //AI 权限：使用用户配置的通用 AI 服务（nunc.ai.chat），受服务端限制和插件执行超时约束
    "ai": false,
    // AI 决策权限：允许调用 nunc.ai.decide
    "ai_decision": false
  }
}
```

## main.js

必须包含 fetchEvents 函数（可参考 [bilibili_user_videos](https://github.com/sha2kyou/sidefy-plugins/tree/main/bilibili_user_videos)）：

```javascript
function fetchEvents(config) {
  var events = [];

  try {
    // 你的业务逻辑
    events.push({
      title: "事件标题",
      startDate: "2024-01-01T10:00:00Z", // 必需，ISO8601格式
      endDate: "2024-01-01T11:00:00Z", // 必需，ISO8601格式
      color: "#FF5733", // 必需，十六进制颜色
      notes: "详细描述", // 可选
      icon: "https://example.com/icon.png", // 可选
      isAllDay: false, // 必需
      isPointInTime: true, // 必需
      href: "https://example.com", // 可选，点击跳转。支持 http/https/popup(自定义协议，跳转会弹出macOS文本框显示文本)
    });
  } catch (err) {
  }

  return events;
}
```

## AI 决策 API

`nunc.ai.decide(input, decision)`（兼容 `sidefy.ai.decide`）使用应用的 **AI 决策**服务，需要独立的 `ai_decision` 权限（`ai` 仅授权 `ai.chat`）。AI 决策与通用 AI 分别配置。

```javascript
var text = "Xcode 更新：苹果开发工具发布新版本。";

var probability = sidefy.ai.decide(text, { match: "与苹果开发有关" });
var category = sidefy.ai.decide(text, { choice: { news: "新闻", other: "其他" } });
var importance = sidefy.ai.decide(text, { score: ["一般", "重要", "紧急"] });
```

input 支持非空文本、JSON 对象或数组；数组作为共同上下文，不代表逐项批量判断。decision 必须且只能包含一个判断字段。match 返回 0～1 概率；choice 返回选项键；score 返回等级加权值（上例为 0～2，可为小数）。choice 至少包含两个具名选项及非空描述；score 至少包含两个非空等级描述，按从低到高排列。

同步调用，成功响应自动缓存。参数错误抛出 TypeError；权限、配置或服务失败返回 null，并记录原因。应用阈值前先判断 `probability !== null`，0 是有效结果。未命中缓存的请求可能产生费用，并受服务端限制和插件执行超时约束。

## 国际化（i18n）

插件中所有面向用户的文案必须使用 `sidefy.i18n()`。

### 支持语言

**仅**支持以下 4 种语言代码，不得添加 `de`、`es`、`fr`、`pt`、`ru` 等：

| 代码 | 语言 |
|------|------|
| `zh` | 中文 |
| `en` | 英语 |
| `ja` | 日语 |
| `ko` | 韩语 |

中文 i18n 键名使用 **`zh`**（与 `sidefy.app.language()` 一致）。勿使用 `zh-Hans`、`zh-Hant`、`zh-CN`、`zh-TW` 等作为键名。

### 代码组织

1. 所有 i18n 文案集中在 `main.js` **文件最底部**（用 `// --- i18n ---` 标记）。
2. 使用语义化变量名，如 `I18N_UPDATED_LABEL`、`I18N_ERROR_NETWORK`。
3. **静态文案**：声明 `I18N_*` 对象常量，业务逻辑中调用 `sidefy.i18n(I18N_XXX)`；不要在 `fetchEvents` 或 i18n 区块上方的函数里内联语言对象。
4. **含动态插值**：在底部声明 `i18nXxx(...)` 辅助函数，函数内 `return sidefy.i18n({ zh: ..., en: ..., ja: ..., ko: ... })`。
5. 业务逻辑与工具函数写在 i18n 区块**上方**。

### 示例

```javascript
function fetchEvents(config) {
    var notes = sidefy.i18n(I18N_UPDATED_LABEL) + timeStr;
    // ...
    return events;
}

// --- i18n ---

var I18N_UPDATED_LABEL = {
    zh: "更新时间：",
    en: "Updated: ",
    ja: "更新: ",
    ko: "업데이트: "
};

function i18nCountdownFuture(eventName, days) {
    return sidefy.i18n({
        zh: "距离 " + eventName + " 还有 " + days + " 天",
        en: days + " days until " + eventName,
        ja: eventName + "まであと" + days + "日",
        ko: eventName + "까지 " + days + "일 남음"
    });
}
```

`sidefy.i18n()` 按 Sidefy App 当前语言匹配；未命中时回退到 `en`，再回退到第一个可用值。每条文案均需填写完整的四种语言。

## 提交步骤

1. Fork 本仓库
2. 在 Sidefy 自定义插件代码编辑器编辑代码
3. 在 Sidefy 测试插件功能
4. 在仓库目录创建插件文件夹和文件
5. 提交 Pull Request

>[!WARNING] 
>更多 API 说明请查看 Sidefy 应用内的自定义插件编辑器文档页面

## 检查清单

- 插件在 Sidefy 中测试通过
- 包含完整的错误处理
- 提交插件目录结构正确
- info.json 信息完整准确
- README.md 使用说明清晰
- 代码注释适当
- 面向用户的文案使用 `sidefy.i18n()`，且包含全部 4 种语言（`zh`、`en`、`ja`、`ko`）
- i18n 常量与辅助函数声明在 `main.js` 文件底部

## 许可证

Copyright (C) 2025 Nunc.

本项目采用 Apache License 2.0，完整条款见 [LICENSE](LICENSE)。
