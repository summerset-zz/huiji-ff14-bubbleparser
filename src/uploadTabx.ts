import { HuijiWiki } from "huijiwiki-api";
import * as fs from "fs";
import chalk from "chalk";
import { config } from "dotenv";
import { ConsoleTablePrinter } from "./consoleTabler.js";
config();
// Dry-run support: use --dry-run or -n or env DRY_RUN=1
const DRY_RUN =
    process.argv.includes("--dry-run") ||
    process.argv.includes("-n") ||
    process.env.DRY_RUN === "1";
const LIMIT_BYTES = 1_800_000; // safe limit per file
const WIKI_USERNAME = process.env.WIKI_USERNAME;
const WIKI_PASSWORD = process.env.WIKI_PASSWORD;
const WIKI_API_AUTH_KEY = process.env.WIKI_API_AUTH_KEY;
if (!DRY_RUN && (!WIKI_USERNAME || !WIKI_PASSWORD || !WIKI_API_AUTH_KEY)) {
    console.error(
        chalk.red(
            "请设置环境变量WIKI_USERNAME, WIKI_PASSWORD, WIKI_API_AUTH_KEY"
        )
    );
    process.exit(1);
}
(async () => {
    let wiki: HuijiWiki | null = null;
    let csrfToken: string | null = null;
    if (!DRY_RUN) {
        console.log(`正在以${WIKI_USERNAME}的身份登录到灰机wiki...`);
        wiki = new HuijiWiki("ff14", WIKI_API_AUTH_KEY!);
        if (!(await wiki.apiLogin(WIKI_USERNAME!, WIKI_PASSWORD!))) {
            console.error(chalk.red("登录失败。"));
            process.exit(1);
        }
        console.log(chalk.green("登录成功。"));
        csrfToken = await wiki.apiQueryCsrfToken();
    }

    const chunkFileNames: string[] = [];
    // find all files starts with 'unified_npc_balloon_chunk' in ./output, and save them to chunkFileNames.
    fs.readdirSync("./output").forEach((file) => {
        if (
            file.startsWith("unified_npc_balloon_chunk") &&
            file.endsWith(".json")
        ) {
            chunkFileNames.push(file);
        }
    });

    // the filenames are like 'unified_npc_balloon_chunk_0.json', 'unified_npc_balloon_chunk_1.json', etc. sort them by the number after 'chunk_' in the filename.
    chunkFileNames.sort((a, b) => {
        const aNum = parseInt(a.split("_")[4].split(".")[0]);
        const bNum = parseInt(b.split("_")[4].split(".")[0]);
        return aNum - bNum;
    });
    console.log(
        `共有${chunkFileNames.length}个分段。${
            DRY_RUN ? "Dry-run：仅输出文件大小和是否超限" : "即将开始上传"
        }`
    );

    if (DRY_RUN) {
        let exceedCount = 0;
        for (let i = 0; i < chunkFileNames.length; i++) {
            const fileName = chunkFileNames[i];
            const fullPath = `./output/${fileName}`;
            const size = fs.statSync(fullPath).size; // bytes
            const status =
                size > LIMIT_BYTES ? chalk.red("EXCEEDS") : chalk.green("OK");
            if (size > LIMIT_BYTES) exceedCount++;
            console.log(
                `- ${fileName}: ${size} bytes (${(size / 1024 / 1024).toFixed(
                    3
                )} MB) -> ${status}`
            );
        }
        if (exceedCount > 0) {
            console.log(
                chalk.red(
                    `共有 ${exceedCount} 个文件超过 ${LIMIT_BYTES} 字节上限（约 ${(
                        LIMIT_BYTES /
                        1024 /
                        1024
                    ).toFixed(2)} MB）`
                )
            );
        } else {
            console.log(chalk.green("所有文件均未超过大小上限。"));
        }
        return; // dry-run结束
    }

    const stats = {
        success: 0,
        failed: 0,
    };
    // Set up the task table (任务 | 页面 | 大小 | 耗时 | 状态)
    // Precompute widths from expected upload page titles and sizes
    const uploadPages = chunkFileNames.map((f) => `Data:${f.replace('.json','')}.tabx`);
    const uploadSizesStr = chunkFileNames.map((f) => String(fs.statSync(`./output/${f}`).size));
    // Also include potential delete titles in width computation up front
    const MAX_CHUNK_COUNT = 20; // 最高检查到chunk_19
    const localMaxIndex =
        chunkFileNames.length > 0
            ? parseInt(
                  chunkFileNames[chunkFileNames.length - 1]
                      .split("_")[4]
                      .split(".")[0]
              )
            : -1;
    const potentialDeletePages: string[] = [];
    for (let i = localMaxIndex + 1; i < MAX_CHUNK_COUNT; i++) {
        potentialDeletePages.push(`Data:unified_npc_balloon_chunk_${i}.tabx`);
    }
    const pageW = Math.max(
        "页面".length,
        ...uploadPages.map((s) => s.length),
        ...potentialDeletePages.map((s) => s.length)
    );
    const sizeW = Math.max("大小".length, ...uploadSizesStr.map((s) => s.length));
    const taskW = Math.max("任务".length, "删除".length); // 任务栏宽度
    const timeW = Math.max("耗时".length, "0.000s".length);
    const statusW = Math.max("状态".length, "失败".length);
    const table = ConsoleTablePrinter.create([
        { header: "任务", width: taskW },
        { header: "页面", width: pageW },
        { header: "大小", width: sizeW },
        { header: "耗时", width: timeW },
        { header: "状态", width: statusW },
    ]).printHeader();
    for (let i = 0; i < chunkFileNames.length; i++) {
        const fileName = chunkFileNames[i];
        const fileContent = fs.readFileSync(`./output/${fileName}`, "utf-8");
        const pageTitle = `Data:${fileName.replace(".json", "")}.tabx`;
        const sizeBytes = Buffer.byteLength(fileContent, "utf8");
        const t0 = process.hrtime.bigint();

        const result = await wiki!.request({
            action: "edit",
            title: `Data:${fileName.replace(".json", "")}.tabx`,
            text: fileContent,
            summary: "使用HUIJI-FF14-BUBBLEPARSER上传",
            bot: true,
            token: csrfToken!,
        });
        const t1 = process.hrtime.bigint();
        const elapsedSec = Number(t1 - t0) / 1_000_000_000;
        if (!result.error) {
            stats.success++;
            table.push(["上传", pageTitle, String(sizeBytes), `${elapsedSec.toFixed(3)}s`, "成功"]);
        } else {
            stats.failed++;
            table.push(["上传", pageTitle, String(sizeBytes), `${elapsedSec.toFixed(3)}s`, "失败"]);
        }
    }
    // After uploads, detect and delete extra remote chunk pages synchronously
    if (!DRY_RUN) {
        if (potentialDeletePages.length > 0) {
            const titles = potentialDeletePages.join("|");
            try {
                const queryResp: any = await wiki!.request({
                    action: "query",
                    format: "json",
                    prop: "info",
                    titles,
                    utf8: 1,
                });
                const pages = queryResp?.query?.pages ?? {} as Record<string, any>;
                const existingPages: { pageid: number; title: string }[] = [];
                for (const [key, page] of Object.entries(pages)) {
                    const pid = parseInt(key, 10);
                    if (!Number.isNaN(pid) && pid >= 0) {
                        const title = (page as any).title as string;
                        existingPages.push({ pageid: pid, title });
                    }
                }
                for (const p of existingPages) {
                    const t0 = process.hrtime.bigint();
                    const delResp: any = await wiki!.request({
                        action: "delete",
                        format: "json",
                        pageid: String(p.pageid),
                        token: csrfToken!,
                        utf8: 1,
                    });
                    const t1 = process.hrtime.bigint();
                    const elapsedSec = Number(t1 - t0) / 1_000_000_000;
                    if (!delResp?.error) {
                        table.push(["删除", p.title, "", `${elapsedSec.toFixed(3)}s`, "成功"]);
                    } else {
                        table.push(["删除", p.title, "", `${elapsedSec.toFixed(3)}s`, "失败"]);
                    }
                }
            } catch (e) {
                console.error(chalk.red(`查询站点分段失败：${(e as Error).message}`));
            }
        }
    }

    console.log(chalk.green("所有任务完成。"));
    console.log(`成功上传${stats.success}个分段，失败${stats.failed}个分段。`);
})();
