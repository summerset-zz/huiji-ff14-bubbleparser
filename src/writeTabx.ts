import { UnifiedBalloon } from "./types/csvTypes";
import { TabxType } from "./types/tabxTypes";
import * as fs from "fs";
import chalk from "chalk";
import { ConsoleTablePrinter } from "./consoleTabler.js";

type CellLengthTracker = {
    [uid: string]: { lang: string; content: string }[];
};
// verboseChrSize是测试时的大致估算（即标识符和缩进等字符的大致占位）。可以通过实际输出情况进行调整。
const VERBOSE_CHR_SIZE = 300;
// TABX_INDENT_SIZE是tabx文件的缩进大小。会极大影响VERBOSE_CHR_SIZE的准确性。
const TABX_INDENT_SIZE = 0;
// 在文件开头定义分段汇总表（固定列宽，超出会省略号）。构造时会打印表头和分隔线。
const chunkSummaryTable = new ConsoleTablePrinter([
    { header: "chunk", width: 10 },
    { header: "size", width: 10 },
    { header: "entries", width: 8 },
    { header: "process time", width: 12 },
    { header: "stringify calls", width: 16 },
]);
type UnifiedBalloonTabxColumns = [
    string,
    string,
    number,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string
];
const buildTabxChunkBySize = (
    data: UnifiedBalloon[],
    chunkByteLimit = 1_800_000
): {
    chunks: TabxType<UnifiedBalloonTabxColumns>[];
    meta: { processTimeSec: number; stringifyCalls: number }[];
    cellLengthTracker: CellLengthTracker;
} => {
    console.log(
        chalk.blue(
            `开始按大小分割数据，单chunk限制为 ${chunkByteLimit} 字节...`
        )
    );
    chunkSummaryTable.printHeader();

    // 跟踪超过400字符的单元格
    const cellLengthTracker: CellLengthTracker = {};

    // 语言列表（与行的顺序对应）
    const languages = ["KO", "EN", "JA", "CHS", "FR", "DE", "TC"];

    // 将一个条目转为表行
    const toRow = (item: UnifiedBalloon): UnifiedBalloonTabxColumns => {
        const row: UnifiedBalloonTabxColumns = [
            item.data_type,
            item.uid,
            item.id,
            item.source,
            item.text_KO ?? "",
            item.text_EN ?? "",
            item.text_JA ?? "",
            item.text_CHS ?? "",
            item.text_FR ?? "",
            item.text_DE ?? "",
            item.text_TC ?? "",
        ];

        // 检查单元格长度
        for (let i = 4; i < row.length; i++) {
            if (typeof row[i] === "string" && (row[i] as string).length > 400) {
                const uid = row[1] as string;
                const langIndex = i - 4; // 从索引4开始
                const lang = languages[langIndex];
                const content = row[i] as string;

                if (!cellLengthTracker[uid]) {
                    cellLengthTracker[uid] = [];
                }
                cellLengthTracker[uid].push({ lang, content });
            }
        }

        return row;
    };

    // 构造 chunk 对象（包含schema）
    const makeChunk = (
        rows: UnifiedBalloonTabxColumns[]
    ): TabxType<UnifiedBalloonTabxColumns> => ({
        description: {
            zh: "统一的NPC对话气泡和喊话数据",
        },
        schema: {
            fields: [
                {
                    name: "data_type",
                    type: "string",
                    title: { en: "data_type", zh: "data_type" },
                },
                {
                    name: "uid",
                    type: "string",
                    title: { en: "uid", zh: "uid" },
                },
                { name: "id", type: "number", title: { en: "id", zh: "id" } },
                {
                    name: "source",
                    type: "string",
                    title: { en: "source", zh: "source" },
                },
                {
                    name: "text_KO",
                    type: "string",
                    title: { en: "text_KO", zh: "text_KO" },
                },
                {
                    name: "text_EN",
                    type: "string",
                    title: { en: "text_EN", zh: "text_EN" },
                },
                {
                    name: "text_JA",
                    type: "string",
                    title: { en: "text_JA", zh: "text_JA" },
                },
                {
                    name: "text_CHS",
                    type: "string",
                    title: { en: "text_CHS", zh: "text_CHS" },
                },
                {
                    name: "text_FR",
                    type: "string",
                    title: { en: "text_FR", zh: "text_FR" },
                },
                {
                    name: "text_DE",
                    type: "string",
                    title: { en: "text_DE", zh: "text_DE" },
                },
                {
                    name: "text_TC",
                    type: "string",
                    title: { en: "text_TC", zh: "text_TC" },
                },
            ],
        },
        data: rows,
    });

    // 计算按 UTF-8 实际字节大小，并统计 stringify 调用次数
    let globalStringifyCalls = 0;
    const computeSize = (rows: UnifiedBalloonTabxColumns[]) => {
        globalStringifyCalls++;
        const json = JSON.stringify(makeChunk(rows), null, TABX_INDENT_SIZE);
        return Buffer.byteLength(json, "utf8");
    };

    const chunks: TabxType<UnifiedBalloonTabxColumns>[] = [];
    const chunkMeta: { processTimeSec: number; stringifyCalls: number }[] = [];
    let currentRows: UnifiedBalloonTabxColumns[] = [];
    const BATCH_SIZE = 10;
    let batchRows: UnifiedBalloonTabxColumns[] = [];

    // 当前 chunk 的计时与计数起点
    let currentChunkStartNs: bigint | null = null;
    let currentChunkStartCalls = 0;

    const finalizeCurrentChunk = () => {
        if (currentRows.length > 0) {
            const finalSize = computeSize(currentRows);
            const currentIndex = chunks.length;
            const entriesCount = currentRows.length;
            chunks.push(makeChunk(currentRows));
            // 记录本 chunk 的耗时与 stringify 次数
            const elapsedNs = currentChunkStartNs
                ? process.hrtime.bigint() - currentChunkStartNs
                : 0n;
            const elapsedSec = Number(elapsedNs) / 1_000_000_000;
            const calls = globalStringifyCalls - currentChunkStartCalls;
            chunkMeta.push({
                processTimeSec: elapsedSec,
                stringifyCalls: calls,
            });
            // 立即输出一行表格
            chunkSummaryTable.push([
                `chunk_${currentIndex}`,
                String(finalSize),
                String(entriesCount),
                `${elapsedSec.toFixed(3)}s`,
                String(calls),
            ]);
            currentRows = [];
            currentChunkStartNs = null;
        }
    };

    const processBatch = () => {
        if (batchRows.length === 0) return;
        // 若当前 chunk 尚未开始，在检查前设置起点
        if (
            currentRows.length === 0 &&
            batchRows.length > 0 &&
            currentChunkStartNs === null
        ) {
            currentChunkStartNs = process.hrtime.bigint();
            currentChunkStartCalls = globalStringifyCalls;
        }
        const candidateRows = currentRows.length
            ? [...currentRows, ...batchRows]
            : [...batchRows];
        const candidateSize = computeSize(candidateRows);
        if (candidateSize > chunkByteLimit) {
            // 先写入当前chunk
            finalizeCurrentChunk();
            // 尝试将整个批次作为新chunk内容
            currentRows = [...batchRows];
            // 新 chunk 的起点
            currentChunkStartNs = process.hrtime.bigint();
            currentChunkStartCalls = globalStringifyCalls;
            if (computeSize(currentRows) > chunkByteLimit) {
                // 批次仍超限：回退为逐条添加
                currentRows = [];
                for (const row of batchRows) {
                    // 若逐条开启新 chunk，需设置起点
                    if (
                        currentRows.length === 0 &&
                        currentChunkStartNs === null
                    ) {
                        currentChunkStartNs = process.hrtime.bigint();
                        currentChunkStartCalls = globalStringifyCalls;
                    }
                    const candidateOne = currentRows.length
                        ? [...currentRows, row]
                        : [row];
                    if (computeSize(candidateOne) > chunkByteLimit) {
                        // 写入已有rows
                        finalizeCurrentChunk();
                        // 单条也可能超限：单独成块并告警
                        // 新 chunk 的起点（单条）
                        currentChunkStartNs = process.hrtime.bigint();
                        currentChunkStartCalls = globalStringifyCalls;
                        if (computeSize([row]) > chunkByteLimit) {
                            console.warn(
                                chalk.yellow(
                                    `单条目已超过限制，将单独成块：uid=${row[1]}`
                                )
                            );
                        }
                        chunks.push(makeChunk([row]));
                        currentRows = [];
                        // 该单条块已完成，重置起点
                        const elapsedNsSingle = currentChunkStartNs
                            ? process.hrtime.bigint() - currentChunkStartNs
                            : 0n;
                        const elapsedSecSingle =
                            Number(elapsedNsSingle) / 1_000_000_000;
                        const callsSingle =
                            globalStringifyCalls - currentChunkStartCalls;
                        chunkMeta.push({
                            processTimeSec: elapsedSecSingle,
                            stringifyCalls: callsSingle,
                        });
                        // 输出该单条块的信息
                        const sizeSingle = computeSize([row]);
                        const thisIndex = chunks.length - 1;
                        chunkSummaryTable.push([
                            `chunk_${thisIndex}`,
                            String(sizeSingle),
                            "1",
                            `${elapsedSecSingle.toFixed(3)}s`,
                            String(callsSingle),
                        ]);
                        currentChunkStartNs = null;
                    } else {
                        currentRows = candidateOne;
                    }
                }
            }
        } else {
            // 正常合并批次
            currentRows = candidateRows;
        }
        batchRows = [];
    };

    for (const entry of data) {
        batchRows.push(toRow(entry));
        if (batchRows.length >= BATCH_SIZE) {
            processBatch();
        }
    }
    // 处理剩余不足一个批次的条目
    processBatch();

    if (currentRows.length > 0) {
        finalizeCurrentChunk();
    }

    return { chunks, meta: chunkMeta, cellLengthTracker };
};

(async () => {
    const filePath = "./output/unified_npc_balloon_allentries.json";
    if (!fs.existsSync(filePath)) {
        console.error("File not exists");
        return;
    }
    console.log(chalk.yellow("删除已存在的分段文件..."));
    fs.readdirSync("./output").forEach((file) => {
        if (
            file.startsWith("unified_npc_balloon_chunk") &&
            file.endsWith(".json")
        ) {
            fs.unlinkSync(`./output/${file}`);
        }
    });
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const data: UnifiedBalloon[] = JSON.parse(fileContent);

    const { chunks, meta, cellLengthTracker } = buildTabxChunkBySize(data);
    for (const [index, chunk] of chunks.entries()) {
        fs.writeFileSync(
            `./output/unified_npc_balloon_chunk_${index}.json`,
            JSON.stringify(chunk, null, TABX_INDENT_SIZE)
        );
        // get the file size
        const stats = fs.statSync(
            `./output/unified_npc_balloon_chunk_${index}.json`
        );
        console.log(
            `./output/unified_npc_balloon_chunk_${index}.json 写入成功。文件大小为${stats.size}字节，条目数${chunk.data.length}。`
        );
        // 此处不再输出表格行，表格已在分chunk时输出
    }

    // 输出超过400字符的单元格检查结果
    if (Object.keys(cellLengthTracker).length > 0) {
        console.log(
            chalk.yellow(
                `\n检测到 ${
                    Object.keys(cellLengthTracker).length
                } 个条目的单元格长度超过400字符：`
            )
        );
        for (const [uid, items] of Object.entries(cellLengthTracker)) {
            console.log(chalk.yellow(`  UID: ${uid}`));
            items.forEach(({ lang, content }) => {
                console.log(`    ${lang}: ${content.length} 字符`);
            });
        }
    } else {
        console.log(chalk.green("\n所有单元格长度均不超过400字符。"));
    }
})();
