# FF14维基 - 整合化NPC发言项目 - Node脚本部分

本项目用于将Balloon、InstanceContentTextData、NpcYell的多语言CSV文件整合为符合FF14维基要求的tabx格式JSON文件，同时提供了上传到Wiki的脚本。

## 项目结构


```
input/                  -- 文件输入目录（多语言CSV）
output/                 -- 文件输出目录（中间结果与分段tabx）
src/                    -- 代码根目录
    consoleTabler.ts    -- 控制台表格渲染工具
    types/              -- Typescript类型定义
    readCsv.ts          -- 读取CSV，生成allentries.json
    writeTabx.ts        -- 按字节大小分段并输出tabx
    uploadTabx.ts       -- 支持dry-run的上传脚本
    importWiki.ts       -- 从维基导入已有tabx（可选）
    getSmwResults.ts    -- (临时)获取SMW查询结果并输出smwResults.json
    getRedirects.ts     -- (临时)获取重定向并输出redirects.json
tools/                  -- 辅助脚本/工具
.env                    -- 敏感环境变量（不入库）
.env.sample             -- 环境变量模板
smwResults.json         -- (临时)SMW结果缓存
redirects.json          -- (临时)重定向结果缓存
package.json            -- 项目及依赖定义
tsconfig.json           -- TS配置文件
README.md               -- 说明文档（本文档）
```

## 使用方法

### 环境准备
1. 安装 [Node.js](https://nodejs.org/)（建议使用最新 LTS 版本）。
2. 安装 Yarn：在命令行运行 `corepack enable`，然后运行 `corepack prepare yarn@stable --activate`。
3. 在项目根目录运行 `yarn` 安装依赖。

---
下面为各脚本的使用说明：
### 关于UID
UID是通过数据类型和其原始来源表中的ID（key）生成的新唯一ID。格式为`{类型缩写}-{原始ID}`。

类型缩写分别为`BA`、`IC`、`NY`，分别对应下一节提到的三种类型。

### 1. 读取CSV文件
将CSV文件放在input目录中。文件名格式应当符合`{类型}{版本}{语言}.csv`的规范。其中：
* 类型为`['Balloon','InstanceContentTextData','NpcYell']`
* 版本为`['7.15','7.05']`
* 语言为`['KO', 'EN', 'JA', 'CHS', 'FR', 'DE']`

例如：`InstanceContentTextData7.15EN.csv`

如希望扩展版本和语言，可在readCsv中进行配置。其中版本是有先后顺序的，读取文件时将优先取用新版本文件。

此外还可以通过该文件头部的`SKIP-UIDS`配置需要强行跳过的条目UID，也可以通过配置`MANUAL_REPLACER`强行覆盖指定条目的指定语言数据。

运行NPM脚本中的`read`指令可开始处理。完成后，output目录中将生成以下三个文件：
* `unified_npc_balloon_allentries.json` 所有条目
* `oversizedEntries.json` 某一语言数据超过400字的条目（tabx格式限制）
* `tags.json` 出现的所有tag，用于后续进行替换。

### 2. 数据分段
在完成第一步后，运行`generate`指令。脚本会按 UTF-8 实际字节大小分chunk（默认上限约 1_800_000 字节以适配 20MB 页面限制），并输出表格（chunk/size/entries/process time/stringify calls）展示每个分段的尺寸与耗时，然后将tabx格式内容写入`unified_npc_balloon_chunk_{n}.json`。
* 2025-1219更新：优化了分段逻辑，现在chunk的内容会更紧密，chunk数量也会越少。

如需调整分段大小，可以在`buildTabxChunkBySize`调用中修改字节上限参数；缩进已设为0以节省体积。

### 3. 上传
上传前，请先配置灰机的用户信息。在根目录下创建文件`.env`，并按照`.env.sample`中的格式填写相关信息。
* WIKI_USERNAME、WIKI_PASSWORD：你的灰机用户名和密码
* WIKI_API_AUTH_KEY：灰机API的key，请向灰机管理组申请。

>   ***以上信息切勿提交到repo***

配置完成后，运行`upload`指令即可。chunk文件将会上传到FF14维基同名（但不同后缀名）的、Data命名空间下的tabx文件中。


