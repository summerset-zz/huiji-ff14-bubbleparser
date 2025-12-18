import { UnifiedBalloon } from "./types/csvTypes";
import { TabxType } from "./types/tabxTypes";
import * as fs from "fs";
import chalk from "chalk";
// verboseChrSize是测试时的大致估算（即标识符和缩进等字符的大致占位）。可以通过实际输出情况进行调整。
const VERBOSE_CHR_SIZE = 300;
// TABX_INDENT_SIZE是tabx文件的缩进大小。会极大影响VERBOSE_CHR_SIZE的准确性。
const TABX_INDENT_SIZE = 2;
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
    chunkSize = 1800000
): TabxType<UnifiedBalloonTabxColumns>[] => {
    const getEntrySize = (entry: UnifiedBalloon) => {
        return (
            (entry.text_EN?.length ?? 0) +
            (entry.text_JA?.length ?? 0) +
            (entry.text_CHS?.length ?? 0) +
            (entry.text_FR?.length ?? 0) +
            (entry.text_DE?.length ?? 0) +
            (entry.text_KO?.length ?? 0) +
            (entry.text_TC?.length ?? 0) +
            VERBOSE_CHR_SIZE
        );
    };
    const chunks: TabxType<UnifiedBalloonTabxColumns>[] = [];
    let currentChunk: UnifiedBalloon[] = [];
    let currentChunkSize = 0;
    for (const entry of data) {
        const entrySize = getEntrySize(entry);
        if (currentChunkSize + entrySize > chunkSize) {
            console.log(
                `当前chunk的大小为${currentChunkSize}，将写入一个新的chunk。`
            );
            chunks.push({
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
                        {
                            name: "id",
                            type: "number",
                            title: { en: "id", zh: "id" },
                        },
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
                data: currentChunk.map((item) => {
                    return [
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
                }),
            });
            currentChunk = [];
            currentChunkSize = 0;
        }
        currentChunk.push(entry);
        currentChunkSize += entrySize;
    }
    if (currentChunk.length > 0) {
        chunks.push({
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
                    {
                        name: "id",
                        type: "number",
                        title: { en: "id", zh: "id" },
                    },
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
            data: currentChunk.map((item) => {
                return [
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
            }),
        });
    }
    return chunks;
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

    const chunks = buildTabxChunkBySize(data);

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
    }
})();
