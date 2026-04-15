# 拼好歌 后端服务框架(Cloudflare Workers)

这是一个用 Cloudflare Workers + QuickJS（quickjs-ng.wasm）实现的 拼好歌 个人后台服务框架，支持**动态执行用户导入的脚本插件代码**，此后端服务不提供音乐内容和数据，仅提供脚本运行环境和能力，数据全部由用户自行导入的脚本提供，此项目参考洛雪音乐源码编写（抄来的），兼容洛雪音乐的第三方音源脚本（小部分不兼容）。本项目代码开源且免费，如你是付费使用本项目，建议申请仅退款。

## 关联项目

- **拼好歌小程序端** - [phg-music](https://github.com/erikjamesgz/phg-music)
- **Deno Deploy 平台后端服务器** - [dn-phg-music-server](https://github.com/erikjamesgz/dn-phg-music-server)

## 部署指南

> **重要说明**：本项目使用了 D1 数据库 + WASM 运行时 + nodejs\_compat 兼容标志，**无法通过 Cloudflare Dashboard 上传 zip 文件的方式部署**（这是 CF 平台限制）。
>
> 推荐使用以下两种方式部署，**方式一最简单**（全程网页操作，无需安装任何工具）：

***

### 方式一：Fork + Cloudflare 一键连接部署 ⭐ 推荐（纯网页操作）

#### 第 1 步：Fork 本项目

1. 打开 <https://github.com/erikjamesgz/cf_phg_music_server>
2. 点击右上角 **Fork** 按钮 → 确认创建

#### 第 2 步：登录 Cloudflare 并授权 GitHub

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/) → 登录
2. 左侧菜单 → **Workers 和 Pages**
3. 页面右上角点击 **创建应用程序**
4. 选择 “Connect GitHub”（不是"创建Worker"！）
5. 首次使用会提示授权 GitHub 账号 → 点击 **Connect GitHub** → 授权 Cloudflare 访问你的 GitHub
6. 授权后，选择 “Continue with GitHub”
7. 在仓库列表中选择你刚 **Fork** 的 `cf_phg_music_server` 仓库
8. 然后下一步 ，项目名字填“`cf-phg-music-server`”（不能有下划线）
9. 然后点击 **“部署”**

#### 第 4 步：创建 D1 数据库

1. Cloudflare 左侧菜单 → **存储和数据库** → **D1 SQL 数据库**
2. 页面右上角点击 **创建数据库**
3. 名称填：`cf-phg-music-db` → **创建**

#### 第 5 步：绑定 D1 数据库到 Worker

1. 进入你刚部署的 Worker 项目（Cloudflare 左侧菜单→计算→**Workers 和 Pages** → 点击项目`cf-phg-music-server`）
2. 页面左上角的菜单栏点击“绑定”
3. 找到 **绑定** 区域 → **D1 数据库** → **添加**
4. 变量名称填：`DB (要大写)`
5. 数据库选择：`cf-phg-music-db`
6. 点击“添加绑定”

#### 第 6 步：修改 API Key

默认 API Key 是 `c5cb88052fcfc21ee4a48ab7e3d3d964`。如需自定义：

1. 进入你刚部署的 Worker 项目（Cloudflare 左侧菜单 → 计算 → **Workers 和 Pages** → 点击项目`cf-phg-music-server`）
2. 页面左上角的菜单栏点击“设置”→ **变量和机密**
3. 编辑 `API_KEY` 变量为你想要的值，这是接口访问的秘钥非常重要

#### 第 7 步：获取项目访问链接

1. 进入你刚部署的 Worker 项目（Cloudflare 左侧菜单 → 计算 → **Workers 和 Pages** → 点击项目`cf-phg-music-server`）
2. 页面左上角的菜单栏点击“设置”→**域和路由**
3. 复制你**workers.dev 对应的值（值的格式为：“xxxx.workers.dev”）**
4. 复制第六步的`API_KEY 的值`**（值的格式为“**`c5cb88052fcfc21ee4a48ab7e3d3dxxxx`**”）**
5. 组成访问地址格式：

```
https://xxxx.workers.dev/你的API_KEY
```
#### 第 8 步：注册域名（如需国内访问）

Workers 默认域名（`*.workers.dev`）在中国大陆**无法访问**，需要绑定自定义域名才能正常使用。

**推荐免费域名注册平台：**

| 平台 | 特点 | 链接 |
|------|------|------|
| INDEVS.in | 免费域名，单用户限5个，1年有效期 | [注册入口](https://domain.stackryze.com/) |
| 其他免费域名 | 需选择支持 Cloudflare 托管的平台 | [整理列表](https://blog.zrf.me/p/Free-Domains/) |

**INDEVS.in 注册教程**：[视频教程](https://www.youtube.com/watch?v=7cZC4G7je1U)

#### 第 9 步：绑定自定义域名到 Worker

1. 进入 Worker 项目 → **设置** → **域和路由**
2. 点击 **添加** → 选择 **自定义域**
3. 输入你注册的域名（如 `phg-music.indevs.in`）→ 点击 **添加域**

**绑定完成后访问地址：**

```
https://你的域名/你的API_KEY
```

## 费用说明

> 以下为 Cloudflare 官方政策，可能随时变动，请以 [Cloudflare Workers 定价页面](https://developers.cloudflare.com/workers/platform/pricing) 为准

### 套餐对比

| 资源     | 免费版     | 付费版                         |
| ------ | ------- | --------------------------- |
| 请求次数   | 10万次/天  | 1000万次/月（≈33万次/天）           |
| CPU 时间 | 10ms/次  | 3000万ms/月                   |
| D1 读取  | 500万次/天 | 1亿次/月                       |
| D1 写入  | 10万次/天  | 1000万次/月                    |
| D1 存储  | 5GB     | 无限制                         |
| 超出费用   | -       | 请求 $0.30/百万次，CPU $0.02/百万ms |

**按每人每天3小时听歌估算（≈45次请求/天）：**

| 套餐  | 可支持人数       |
| --- | ----------- |
| 免费版 | **\~2000人/天** |
| 付费版 | **\~7000人/天** |

**结论**：免费版完全够用，即使几百人同时使用也绰绰有余。

**注意**：本项目使用 D1 数据库替代 KV，免费写入额度从 **1000次/天** 提升到 **10万次/天**，提升 **100倍**！

***

## 本地 D1 测试

本地开发时，Wrangler 会使用 `.wrangler/state` 目录下的 SQLite 数据库模拟 D1。

首次运行 `wrangler dev` 时会自动初始化 D1 数据。

***

## API 前缀说明

服务启动后会生成一个随机的 API Key（32位字符），所有接口需要在路径中包含此 Key。

- **管理接口**：需要 API Key，如 `/{apiKey}/api/scripts`

***

## API 文档

### 统一响应格式

所有接口返回统一的 JSON 格式：

```json
{
  "code": 200,
  "msg": "success",
  "data": { ... }
}
```

| 字段   | 类型          | 说明                                    |
| ---- | ----------- | ------------------------------------- |
| code | number      | 状态码：200=成功，400=参数错误，404=未找到，500=服务器错误 |
| msg  | string      | 响应消息                                  |
| data | object/null | 响应数据，失败时可能为 null                      |

***

## 一、脚本管理接口

### 1.1 获取服务信息

```http
GET /{apiKey}
```

**响应示例：**

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "status": "ok",
    "version": "1.0.0",
    "endpoints": [
      "POST /{key}/api/scripts/import/url - 导入脚本",
      "POST /{key}/api/music/url - 获取音乐URL",
      "GET /{key}/api/scripts/loaded - 已加载脚本列表",
      "POST /{key}/api/scripts/default - 设置默认脚本",
      "GET /{key}/api/scripts/default - 获取默认脚本",
      "POST /{key}/api/scripts/delete - 删除脚本",
      "GET /{key}/api/search?keyword=xxx - 搜索歌曲",
      "POST /{key}/api/songlist/detail - 歌单详情",
      "POST /{key}/api/songlist/detail/by-link - 链接解析歌单"
    ]
  }
}
```

### 1.2 获取已加载音源列表

```http
GET /{apiKey}/api/scripts/loaded
```

**响应示例：**

```json
{
  "code": 200,
  "msg": "success",
  "data": [
    {
      "id": "user_api_abc123",
      "name": "六音音源",
      "description": "多平台音乐源",
      "author": "作者名",
      "homepage": "https://example.com",
      "version": "1.0.0",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "supportedSources": ["kw", "kg", "tx", "wy", "mg"],
      "isDefault": true,
      "successRate": 0.92,
      "successCount": 100,
      "failCount": 8,
      "totalRequests": 108,
      "isCircuitBroken": false
    }
  ]
}
```

**响应字段说明：**

| 字段               | 类型        | 说明           |
| ---------------- | --------- | ------------ |
| id               | string    | 脚本唯一标识       |
| name             | string    | 音源名称         |
| description      | string    | 音源描述         |
| author           | string    | 作者           |
| homepage         | string    | 主页地址         |
| version          | string    | 版本号          |
| createdAt        | string    | 创建时间（ISO 格式） |
| supportedSources | string\[] | 支持的平台代码      |
| isDefault        | boolean   | 是否为默认音源      |
| successRate      | number    | 请求成功率（0-1）   |
| successCount     | number    | 成功次数         |
| failCount        | number    | 失败次数         |
| totalRequests    | number    | 总请求数         |
| isCircuitBroken  | boolean   | 是否触发熔断       |

### 1.3 从 URL 导入脚本

```http
POST /{apiKey}/api/scripts/import/url
Content-Type: application/json

{
  "url": "https://example.com/source.js"
}
```

**请求参数：**

| 字段  | 类型     | 必填 | 说明     |
| --- | ------ | -- | ------ |
| url | string | 是  | 脚本下载地址 |

**响应示例：**

```json
{
  "code": 200,
  "msg": "从URL导入成功",
  "data": {
    "success": true,
    "defaultSource": {
      "id": "user_api_abc123",
      "name": "六音音源",
      "supportedSources": ["kw", "kg", "tx", "wy", "mg"]
    },
    "scripts": [...]
  }
}
```

### 1.4 设置默认音源

```http
POST /{apiKey}/api/scripts/default
Content-Type: application/json

{
  "id": "user_api_abc123"
}
```

**请求参数：**

| 字段 | 类型     | 必填 | 说明   |
| -- | ------ | -- | ---- |
| id | string | 是  | 脚本ID |

**注意**：设置不存在的脚本ID会返回 500 错误

### 1.5 删除脚本

```http
POST /{apiKey}/api/scripts/delete
Content-Type: application/json

{
  "id": "user_api_abc123"
}
```

**请求参数：**

| 字段 | 类型     | 必填 | 说明       |
| -- | ------ | -- | -------- |
| id | string | 是  | 要删除的脚本ID |

**注意**：

- 删除不存在的脚本会返回 500 错误
- 如果删除的是默认音源，系统会自动将剩余的第一个音源设为默认

***

## 二、音乐播放接口

### 2.1 获取音乐播放URL

```http
POST /{apiKey}/api/music/url
Content-Type: application/json
```

**请求参数：**

| 字段                | 类型        | 必填 | 说明                                          |
| ----------------- | --------- | -- | ------------------------------------------- |
| source            | string    | 是  | 音乐平台代码：kw=酷我, kg=酷狗, tx=QQ音乐, wy=网易云, mg=咪咕 |
| quality           | string    | 是  | 音质：128k, 320k, flac, flac24bit              |
| songmid           | string    | 否  | 歌曲ID（通用字段）                                  |
| id                | string    | 否  | 歌曲ID（songmid的别名）                            |
| name              | string    | 否  | 歌曲名称（用于换源匹配）                                |
| singer            | string    | 否  | 歌手名称（用于换源匹配）                                |
| hash              | string    | 否  | 酷狗专用：歌曲hash                                 |
| songId            | string    | 否  | 酷狗/QQ/网易云专用：歌曲ID                            |
| copyrightId       | string    | 否  | 咪咕专用：版权ID                                   |
| interval          | string    | 否  | 歌曲时长（格式：mm:ss，用于换源匹配）                       |
| musicInfo         | object    | 否  | 完整歌曲信息对象（可替代上述字段）                           |
| allowToggleSource | boolean   | 否  | 是否允许换源，默认true                               |
| excludeSources    | string\[] | 否  | 换源时排除的平台列表                                  |

**请求示例：**

```json
{
  "source": "kw",
  "songmid": "MUSIC_12345678",
  "quality": "320k",
  "name": "演员",
  "singer": "薛之谦"
}
```

**响应示例：**

```json
{
  "code": 200,
  "msg": "获取成功",
  "data": {
    "url": "https://example.com/music.mp3",
    "type": "320k",
    "source": "kw",
    "quality": "320k",
    "cached": false,
    "fallback": {
      "toggled": false,
      "originalSource": "kw"
    },
    "scriptId": "user_api_abc123",
    "scriptName": "六音音源"
  }
}
```

**响应字段说明：**

| 字段                      | 类型      | 说明                       |
| ----------------------- | ------- | ------------------------ |
| url                     | string  | 播放地址                     |
| type                    | string  | 实际音质类型                   |
| source                  | string  | 实际获取成功的平台代码              |
| quality                 | string  | 请求的音质                    |
| cached                  | boolean | 是否来自缓存                   |
| fallback.toggled        | boolean | 是否发生了换源                  |
| fallback.originalSource | string  | 原始请求的平台                  |
| fallback.newSource      | string  | 换源后的平台（仅toggled=true时存在） |
| fallback.matchedSong    | object  | 换源匹配到的歌曲信息               |
| scriptId                | string  | 使用的脚本ID                  |
| scriptName              | string  | 使用的脚本名称                  |

### 2.2 获取歌词

```http
POST /{apiKey}/api/music/lyric
Content-Type: application/json
```

**请求参数：**

| 字段     | 类型     | 必填 | 说明            |
| ------ | ------ | -- | ------------- |
| source | string | 是  | 音乐平台代码        |
| songId | string | 是  | 歌曲ID          |
| name   | string | 否  | 歌曲名称（咪咕、酷狗需要） |
| singer | string | 否  | 歌手名称（咪咕需要）    |

**响应示例：**

```json
{
  "code": 200,
  "msg": "获取歌词成功",
  "data": {
    "lyric": "[00:00.00]歌词内容...",
    "tlyric": "[00:00.00]翻译歌词...",
    "rlyric": "[00:00.00]罗马音歌词...",
    "lxlyric": "[00:00.00]逐字歌词..."
  }
}
```

***

## 三、搜索接口

### 3.1 搜索歌曲

```http
GET /{apiKey}/api/search?keyword=演员&source=kw&page=1&limit=20
```

**请求参数（Query String）：**

| 字段      | 类型     | 必填 | 说明             |
| ------- | ------ | -- | -------------- |
| keyword | string | 是  | 搜索关键词          |
| source  | string | 否  | 指定平台，不传则搜索所有平台 |
| page    | number | 否  | 页码，默认1         |
| limit   | number | 否  | 每页数量，默认20      |

**响应示例：**

```json
{
  "code": 200,
  "msg": "success",
  "data": [
    {
      "platform": "kw",
      "name": "酷我音乐",
      "results": [
        {
          "id": "MUSIC_12345678",
          "name": "演员",
          "singer": "薛之谦",
          "album": "绅士",
          "source": "kw",
          "interval": 270,
          "musicInfo": {
            "id": "MUSIC_12345678",
            "name": "演员",
            "singer": "薛之谦",
            "songmid": "MUSIC_12345678"
          }
        }
      ]
    }
  ]
}
```

***

## 四、歌单接口

### 4.1 获取歌单详情

```http
POST /{apiKey}/api/songlist/detail
Content-Type: application/json
```

**请求参数：**

| 字段     | 类型     | 必填 | 说明                      |
| ------ | ------ | -- | ----------------------- |
| source | string | 是  | 平台代码：wy, tx, kg, kw, mg |
| id     | string | 是  | 歌单ID或歌单链接               |

**请求示例：**

```json
{
  "source": "wy",
  "id": "123456789"
}
```

**响应示例：**

```json
{
  "code": 200,
  "msg": "获取歌单详情成功",
  "data": {
    "list": [
      {
        "id": "123456",
        "name": "演员",
        "singer": "薛之谦",
        "albumName": "绅士",
        "interval": "04:30",
        "source": "wy",
        "songmid": "123456"
      }
    ],
    "page": 1,
    "limit": 100,
    "total": 50,
    "source": "wy",
    "info": {
      "name": "我的歌单",
      "img": "https://example.com/cover.jpg",
      "desc": "歌单描述",
      "author": "创建者"
    }
  }
}
```

### 4.2 通过短链接获取歌单详情

```http
POST /{apiKey}/api/songlist/detail/by-link
Content-Type: application/json

{
  "link": "https://music.163.com/#/playlist?id=123456789"
}
```

**支持的歌单链接格式：**

| 平台   | 支持的链接格式                                |
| ---- | -------------------------------------- |
| 网易云  | `music.163.com/playlist?id=xxx`        |
| QQ音乐 | `y.qq.com/n/yqq/playlist/xxx.html`     |
| 酷狗   | `kugou.com/yy/special/single/xxx.html` |
| 酷我   | `kuwo.cn/playlist_detail/xxx`          |
| 咪咕   | `music.migu.cn/v3/music/playlist/xxx`  |

***

## 五、平台代码对照表

| 代码 | 平台    | 说明                  |
| -- | ----- | ------------------- |
| kw | 酷我音乐  | Kuwo Music          |
| kg | 酷狗音乐  | Kugou Music         |
| tx | QQ音乐  | QQ Music            |
| wy | 网易云音乐 | NetEase Cloud Music |
| mg | 咪咕音乐  | Migu Music          |

***

## 六、音质代码对照表

| 代码        | 音质     | 说明          |
| --------- | ------ | ----------- |
| 128k      | 标准音质   | 128kbps MP3 |
| 320k      | 高品质    | 320kbps MP3 |
| flac      | 无损音质   | FLAC        |
| flac24bit | Hi-Res | 24bit FLAC  |

**注意**：实际可用音质取决于各平台和歌曲本身的支持情况。

***

## 七、curl 测试命令

### 7.1 获取服务信息

```bash
curl https://cf-phg-music-server.你的账户.workers.dev/你的API_KEY
```

### 7.2 获取已加载音源

```bash
curl https://cf-phg-music-server.你的账户.workers.dev/你的API_KEY/api/scripts/loaded
```

### 7.3 从URL导入音源脚本

```bash
curl -X POST https://cf-phg-music-server.你的账户.workers.dev/你的API_KEY/api/scripts/import/url \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://ghproxy.net/https://raw.githubusercontent.com/pdone/lx-music-source/main/sixyin/latest.js"}'
```

### 7.4 搜索歌曲

```bash
curl "https://cf-phg-music-server.你的账户.workers.dev/你的API_KEY/api/search?keyword=演员&source=kw&limit=10"
```

### 7.5 获取播放URL

```bash
curl -X POST https://cf-phg-music-server.你的账户.workers.dev/你的API_KEY/api/music/url \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "kw",
    "songmid": "MUSIC_12345678",
    "name": "演员",
    "singer": "薛之谦",
    "quality": "320k"
  }'
```

### 7.6 获取歌词

```bash
curl -X POST https://cf-phg-music-server.你的账户.workers.dev/你的API_KEY/api/music/lyric \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "kw",
    "songId": "MUSIC_12345678"
  }'
```

***

## 八、脚本开发指南

建议参考洛雪音乐的指引：<https://lxmusic.toside.cn/desktop/custom-source>

### 基本结构

```javascript
/**
 * @name 音源名称
 * @description 音源描述
 * @author 作者
 * @version 1.0.0
 */

lx.send('inited', {
  sources: {
    kw: {
      type: 'music',
      actions: ['musicUrl', 'lyric', 'pic'],
      qualitys: ['128k', '320k', 'flac'],
    },
  },
}).then(() => {
  console.log('初始化成功');
}).catch(err => {
  console.error('初始化失败:', err.message);
});

lx.on('request', async(data) => {
  const { source, action, info } = data;
  switch (action) {
    case 'musicUrl':
      return await getMusicUrl(info);
    case 'lyric':
      return await getLyric(info);
    case 'pic':
      return await getPic(info);
  }
});
```

### API 参考

#### lx.request(url, options, callback)

发送 HTTP 请求：

```javascript
lx.request('https://api.example.com/music', {
  method: 'GET',
  timeout: 10000,
  headers: {
    'User-Agent': 'LXMusic',
  },
}, (err, resp, body) => {
  if (err) {
    console.error('请求失败:', err.message);
    return;
  }
  console.log('响应:', body);
});
```

#### lx.utils.crypto

加密工具：

```javascript
const aesBuffer = lx.utils.crypto.aesEncrypt(buffer, 'aes-128-cbc', key, iv);
const rsaBuffer = lx.utils.crypto.rsaEncrypt(buffer, publicKey);
const randomBytes = lx.utils.crypto.randomBytes(16);
const md5Hash = lx.utils.crypto.md5('string');
```

***

## 九、项目结构

```
cf_phg_music_server/
├── src/
│   ├── index.ts              # 入口文件，路由处理
│   ├── script_runner.ts      # 脚本运行环境（QuickJS）
│   ├── storage.ts            # D1 存储封装
│   ├── pako.d.ts             # pako 类型声明
│   ├── wasm.d.ts             # WASM 类型声明
│   ├── services/
│   │   ├── lyric_service.ts  # 歌词服务
│   │   ├── search_service.ts # 搜索服务
│   │   ├── shortlink_service.ts # 短链接解析
│   │   └── songlist_service.ts  # 歌单服务
│   └── utils/
│       ├── aes.ts            # AES 加密
│       ├── crypto.ts         # 加密工具
│       └── md5.ts            # MD5 工具
├── quickjs-ng.wasm           # QuickJS WASM 文件
├── wrangler.toml             # Cloudflare Workers 配置
├── tsconfig.json             # TypeScript 配置
└── package.json              # 依赖配置
```

***

## 十、环境变量

| 变量名      | 说明              |
| -------- | --------------- |
| API\_KEY | API密钥，不设置则使用默认值 |

***

## 十一、项目协议

本项目基于 Apache License 2.0 许可证发行，以下协议是对于 Apache License 2.0 的补充，如有冲突，以以下协议为准。

词语约定：本协议中的"本项目"指拼好歌后端服务框架项目；"使用者"指签署本协议的使用者；"官方音乐平台"指对本项目内置的包括酷我、酷狗、咪咕等音乐源的官方平台统称；"版权数据"指包括但不限于图像、音频、名字等在内的他人拥有所属版权的数据。

### 一、数据来源

1.1 本项目的各官方平台在线数据来源全部由用户自行导入的第三方脚本提供，经过对数据简单地筛选与合并后进行展示，因此本项目不对数据的合法性、准确性负责。

1.2 本项目本身没有获取某个音频数据的能力，本项目使用的在线音频数据来源来自用户导入"源"返回的在线链接。例如播放某首歌，本项目所做的只是将希望播放的歌曲名、艺术家等信息传递给"源"，若"源"返回了一个链接，则本项目将认为这就是该歌曲的音频数据而进行使用，至于这是不是正确的音频数据本项目无法校验其准确性，所以使用本项目的过程中可能会出现希望播放的音频与实际播放的音频不对应或者无法播放的问题。

### 二、版权数据

2.1 使用本项目的过程中可能会产生版权数据。对于这些版权数据，本项目不拥有它们的所有权。为了避免侵权，使用者务必在 24 小时内 清除使用本项目的过程中所产生的版权数据。

### 三、资源使用

3.1 本项目内使用的部分包括但不限于字体、图片等资源来源于互联网。如果出现侵权可联系本项目移除。

### 四、免责声明

4.1 由于使用本项目产生的包括由于本协议或由于使用或无法使用本项目而引起的任何性质的任何直接、间接、特殊、偶然或结果性损害（包括但不限于因商誉损失、停工、计算机故障或故障引起的损害赔偿，或任何及所有其他商业损害或损失）由使用者负责。

### 五、使用限制

5.1 本项目完全免费，且开源发布于 GitHub 面向全世界人用作对技术的学习交流。本项目不对项目内的技术可能存在违反当地法律法规的行为作保证。

5.2 禁止在违反当地法律法规的情况下使用本项目。对于使用者在明知或不知当地法律法规不允许的情况下使用本项目所造成的任何违法违规行为由使用者承担，本项目不承担由此造成的任何直接、间接、特殊、偶然或结果性责任。

### 六、版权保护

6.1 音乐平台不易，请尊重版权，支持正版。

### 七、非商业性质

7.1 本项目仅用于对技术可行性的探索及研究，不接受任何商业（包括但不限于广告等）合作及捐赠。

### 八、接受协议

8.1 若你使用了本项目，即代表你接受本协议。

***

**参考项目**：[LX Music（洛雪音乐助手）](https://github.com/lyswhut/lx-music-desktop)
