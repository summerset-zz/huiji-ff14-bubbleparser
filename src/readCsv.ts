import * as fs from "fs";
import type {
    UnifiedBalloon,
    UnifiedLanguageText,
    Languages,
} from "./types/csvTypes";
import csv from "csv-parser";
import chalk from "chalk";

// 版本列表。请按照从新到旧的顺序排列。
const versions: string[] = [
    "7.40",
    "7.31",
    "7.30",
    "7.25",
    "7.21",
    "7.20",
    "7.15",
    "7.11",
    "7.1",
    "7.05",
    "7.00",
];
// 语言列表
const languages = ["KO", "EN", "JA", "CHS", "FR", "DE", "TC"] as Languages[];

// 收集各语言的最新版本文件，用于统一排序与输出
type LatestFile = {
    lang: Languages;
    version: string;
    prefix: string;
    filename: string;
};
const latestFiles: LatestFile[] = [];

// 需要全局跳过的UID。这些UID将不会入库。
const SKIP_UIDS = [
    "BA-2983",
    "BA-3140",
    "IC-8900",
    "IC-18729",
    "IC-18730",
    "IC-23700",
    "YE-2450",
    "YE-2454",
    "YE-2473",
    "YE-2487",
    "YE-2593",
    "YE-4085",
    "YE-4186",
];

// 需要人工替换的文本。key为UID，value为需要替换的文本。该文本将“合并”到原有数据中。
const MANUAL_REPLACER: Record<string, Partial<UnifiedLanguageText>> = {
    "IC-12306": {
        text_EN:
            "Welcome, <军衔>!1 Let's get those maimin' muscles warmed up, shall we?",
    },
    "IC-12321": {
        text_EN:
            "I've long awaited this chance,<军衔Lieutenant/Captain><玩家名>!",
    },
};

/**
 * 读取指定路径的csv文件内容
 * @param csvPath
 * @returns
 */
const getCsvFileContent = async (csvPath: string) => {
    const fileContent: any[] = [];
    await new Promise((resolve, reject) => {
        fs.createReadStream(csvPath)
            .pipe(csv())
            .on("data", (data: any) => fileContent.push(data))
            .on("end", resolve)
            .on("error", reject);
    });
    return fileContent;
};

/**
 * 获取某一前缀、某一语言下的最新版本文件路径。
 * @param prefix
 * @param lang
 * @returns
 */
const getLatestFilePath = (prefix: string, lang: Languages) => {
    let filePath = "";
    for (let version of versions) {
        filePath = `./input/${prefix}${version}${lang}.csv`;
        if (fs.existsSync(filePath)) {
            const filename = `${prefix}${version}${lang}.csv`;
            latestFiles.push({ lang, version, prefix, filename });
            return filePath;
        }
    }
    console.error(chalk.red(`语言 ${lang}下的${prefix}文件不存在`));
    return "";
};

// 统一输出表格（可根据需要调整排序规则）
const printLatestFilesTable = () => {
    const prefixOrder: Record<string, number> = {
        Balloon: 0,
        InstanceContentTextData: 1,
        NpcYell: 2,
    };
    const sorted = [...latestFiles].sort((a, b) => {
        const byLang = a.lang.localeCompare(b.lang);
        if (byLang !== 0) return byLang;
        const byPrefix =
            (prefixOrder[a.prefix] ?? 99) - (prefixOrder[b.prefix] ?? 99);
        if (byPrefix !== 0) return byPrefix;
        // 版本按字符串比较（已为同语言同前缀的最新版本）
        return a.version.localeCompare(b.version);
    });
    console.log("以下是各语言的最新版本文件：");
    const LANG_W = 6;
    const VERSION_W = 8;
    const PREFIX_W = 28;
    const pad = (s: string, w: number) => String(s).padEnd(w);
    const maxFilenameLen = Math.max(
        "Filename".length,
        ...sorted.map((i) => i.filename.length)
    );
    // 打印表头与分隔线
    console.log(
        `${pad("Lang", LANG_W)}| ${pad("Version", VERSION_W)}| ${pad(
            "Prefix",
            PREFIX_W
        )}| Filename`
    );
    console.log(
        `${"-".repeat(LANG_W - 1)} | ${"-".repeat(
            VERSION_W - 1
        )} | ${"-".repeat(PREFIX_W - 1)} | ${"-".repeat(maxFilenameLen)}`
    );
    for (const item of sorted) {
        const langCol = pad(item.lang, LANG_W);
        const versionCol = pad(item.version, VERSION_W);
        const prefixCol = pad(item.prefix, PREFIX_W);
        console.log(
            `${chalk.green(langCol)}| ${chalk.green(versionCol)}| ${chalk.green(
                prefixCol
            )}| ${chalk.green(item.filename)}`
        );
    }
};

/** 用于标签统计的Map */
const startTags = new Map<string, Set<string>>();
const endTags = new Map<string, Set<string>>();
const selfCloseTags = new Map<string, Set<string>>();

/** 用于处理语言数据 */
const purify = (text: string) => {
    let output = text;
    const startTagRegex = /<(\w+)(\([^<>]*\))?>/g;
    const endTagRegex = /<\/(\w+)>/g;
    const selfCloseTagRegex = /<(\w+)(\([^)]*\))?\/>/g;
    const processMatches = (regex: RegExp, map: Map<string, Set<string>>) => {
        const matches = [...text.matchAll(regex)];
        matches.forEach((match) => {
            const tagName = match[1];
            const matchedValue = match[0];
            if (!map.has(tagName)) {
                map.set(
                    tagName,
                    (() => {
                        return new Set<string>().add(matchedValue);
                    })()
                );
            } else {
                map.get(tagName)!.add(matchedValue);
            }
        });
    };
    processMatches(startTagRegex, startTags);
    processMatches(endTagRegex, endTags);
    processMatches(selfCloseTagRegex, selfCloseTags);

    /** 实际处理工序 */
    output = text.replace(/\t/g, "").trim();
    output = output.replace(/\r\n/g, "<br />").replace(/\n/g, "<br />");
    output = output
        .replace(/<Emphasis>/g, "<i>")
        .replace(/<\/Emphasis>/g, "</i>");
    output = output
        .replace(/<Emphasis2>/g, "<i>")
        .replace(/<\/Emphasis2>/g, "</i>");
    output = output
        .replace(/<Highlight>/g, "<b>")
        .replace(/<\/Highlight>/g, "</b>");
    // 新增替换：压缩特殊占位以降低长度
    // IntegerParameter(x) -> IntParam(x)
    output = output.replace(/IntegerParameter\(([^)]*)\)/g, "IntParam($1)");
    // 去除 <Value> 标签但保留内部内容
    output = output.replace(/<\/?.?Value>/g, "");
    // 去除 <TwoDigitValue> 标签但保留内部内容
    output = output.replace(/<\/?TwoDigitValue>/g, "");
    output = output.replace(/<UIForeground>([^<>]+)<\/UIForeground>/g, "");
    output = output.replace(/<UIGlow>([^<>]+)<\/UIGlow>/g, "");
    output = output.replace(/<SoftHyphen\/>/g, "");
    output = output.replace(/<Indent\/>/g, " ");
    output = output.replace(/ObjectParameter\(1\)/g, "<玩家名称>");
    output = output.replace(/ObjectParameter\(56\)/g, "<副本名称>");
    output = output.replace(
        /<If\(PlayerParameter\(4\)\)>/g,
        "<If(玩家为女性)>"
    );
    output = output.replace(/PlayerParameter\(71\)/g, "<玩家种族>");
    output = output.replace(
        /<If\(Equal\(PlayerParameter\(80\),0\)\)>/g,
        "<If(使用键盘)>"
    );
    output = output.replace(/PlayerParameter\(11\)/g, "<当前时间>");

    const sample =
        "<Sheet(PlaceName,IntegerParameter(1),0)/><br /><Switch(IntegerParameter(2))><Case(1)>Rank B</Case><Case(2)>Rank A</Case><Case(3)>Rank S</Case></Switch><br /><Switch(IntegerParameter(3))><Case(1)>Activating in: <Value>IntegerParameter(4)</Value>:<TwoDigitValue>IntegerParameter(5)</TwoDigitValue></Case><Case(2)>Unclaimed</Case><Case(3)>Claimed <Gui(51)/></Case><Case(4)>Claimed <Gui(52)/></Case><Case(5)>Claimed <Gui(53)/></Case></Switch>";



    output = output.trim();
    return output;
};

(async () => {
    const result = new Map<string, UnifiedBalloon>();
    for (let lang of languages) {
        // balloon文件
        const balloonCsvPath = getLatestFilePath("Balloon", lang);
        const fileContent = await getCsvFileContent(balloonCsvPath);
        for (let i = 2; i < fileContent.length; i++) {
            const row = fileContent[i];
            /**
             * 这里的大坑：虽然csv-parser读取到了ID列的表头为“key”，但是用字符串'key'访问不到这一列的值。
             * 其中可能有零宽字符。因此使用Object.keys(row)[2]来获取第三列。下略。
             */
            const key = row[Object.keys(row)[2]];
            const uid = `BA-${key}`;
            if (result.has(uid)) {
                result.get(uid)![`text_${lang}` as keyof UnifiedLanguageText] =
                    purify(row["1"]);
            } else {
                result.set(uid, {
                    data_type: "unified_npc_balloon",
                    uid,
                    id: Number(key),
                    source: "BA",
                    [`text_${lang}`]: purify(row["1"]),
                });
            }
        }

        // InstanceContentText文件
        const instanceContentTextCsvPath = getLatestFilePath(
            "InstanceContentTextData",
            lang
        );
        const instanceContentTextFileContent = await getCsvFileContent(
            instanceContentTextCsvPath
        );
        for (let i = 2; i < instanceContentTextFileContent.length; i++) {
            const row = instanceContentTextFileContent[i];
            const key = row[Object.keys(row)[1]];
            const uid = `IC-${key}`;
            if (result.has(uid)) {
                result.get(uid)![`text_${lang}` as keyof UnifiedLanguageText] =
                    purify(row["0"]);
            } else {
                result.set(uid, {
                    data_type: "unified_npc_balloon",
                    uid,
                    id: Number(key),
                    source: "IC",
                    [`text_${lang}`]: purify(row["0"]),
                });
            }
        }

        // Yell文件
        const yellCsvPath = getLatestFilePath("NpcYell", lang);
        const yellFileContent = await getCsvFileContent(yellCsvPath);
        // 决定第几列是正文

        const findMainTextColumnIndex = () => {
            const line2 = yellFileContent[0];
            let textColIndex: number | undefined = undefined;
            for (let [key, value] of Object.entries(line2)) {
                if (value === "Text") {
                    textColIndex = Number(key);
                    break;
                }
            }
            if (textColIndex === undefined) {
                console.error(
                    chalk.red("无法找到Yell文件中的Text列:" + yellCsvPath)
                );

                process.exit(1);
            }
            // find the first "str" after(included) textColIndex in line 3
            let strColIndex: string | undefined = undefined;
            const line3 = yellFileContent[1];

            for (let [key, value] of Object.entries(line3)) {
                if (Number(key) >= textColIndex && value === "str") {
                    strColIndex = key;
                    break;
                }
            }
            if (strColIndex === undefined) {
                console.error(
                    chalk.red("无法找到Yell文件中的str列:" + yellCsvPath)
                );
                process.exit(1);
            }

            return strColIndex;
        };

        const textColIndex = findMainTextColumnIndex();
        for (let i = 2; i < yellFileContent.length; i++) {
            const row = yellFileContent[i];
            const key = row[Object.keys(row)[Object.keys(row).length - 1]];
            const uid = `YE-${key}`;
            if (result.has(uid)) {
                result.get(uid)![`text_${lang}` as keyof UnifiedLanguageText] =
                    purify(row[textColIndex]);
            } else {
                result.set(uid, {
                    data_type: "unified_npc_balloon",
                    uid,
                    id: Number(key),
                    source: "YE",
                    [`text_${lang}`]: purify(row[textColIndex]),
                });
            }
        }
    }

    // 收集完成后统一输出表格
    printLatestFilesTable();

    // 筛选和统计
    const getStats = () => {
        const stats = { BA: 0, IC: 0, YE: 0, total: 0 };
        for (let [key, value] of result) {
            stats.total++;
            if (value.source === "BA") {
                stats.BA++;
            } else if (value.source === "IC") {
                stats.IC++;
            } else if (value.source === "YE") {
                stats.YE++;
            }
        }
        console.log(
            `BA条目: ${stats.BA}, IC条目: ${stats.IC}, YE条目: ${stats.YE}, 总条目: ${stats.total}`
        );
    };

    const checkTextStarter = (text: string) => {
        const falseTextStarts = [
            "未使用",
            "×未使用",
            "●未使用",
            "●000",
            "●不要",
            "●仮設定",
            "●削除",
        ];
        for (let falseTextStart of falseTextStarts) {
            if (text.startsWith(falseTextStart)) {
                return false;
            }
        }
        return true;
    };
    const checkAllHiragana = (entry: UnifiedBalloon) => {
        const texts: Partial<Record<string, string>> = {
            text_KO: entry.text_KO,
            text_EN: entry.text_EN,
            text_JA: entry.text_JA,
            text_CHS: entry.text_CHS,
            text_FR: entry.text_FR,
            text_DE: entry.text_DE,
        };
        for (let key in texts) {
            if (
                texts[key] == undefined ||
                !checkTextStarter(texts[key] as string)
            ) {
                delete texts[key];
            }
        }
        // check if all texts are same
        let allSame = false;
        const values = Object.values(texts);
        if (values.length === 0) {
            allSame = true;
        }
        const firstValue = values[0];
        allSame = values.every((value) => value === firstValue);

        if (allSame && firstValue) {
            // if allSame contains hiragana or katakana, return true
            const containsKanaRegex = /[\u3040-\u30FF]/;
            if (containsKanaRegex.test(firstValue)) {
                console.log(
                    chalk.yellow("已删除内容相同的假名条目:"),
                    `uid: ${entry.uid}, content: ${firstValue}`
                );
                return true;
            }
        }
    };

    // 删除需要跳过的条目
    for (let uid of SKIP_UIDS) {
        if (result.has(uid)) {
            console.log(chalk.yellow("已删除要求跳过的UID条目:"), uid);
            result.delete(uid);
        }
    }

    console.log("删除无效的条目前:");
    getStats();
    for (let [key, value] of result) {
        // 合并人工维护的条目
        if (MANUAL_REPLACER[key]) {
            Object.assign(value, MANUAL_REPLACER[key]);
            console.log(chalk.yellow("已合并人工维护的UID条目:"), key);
        }
        if (checkAllHiragana(value)) {
            result.delete(key);
            continue;
        }
        let hasText = false;
        for (let lang of languages) {
            const text = value[`text_${lang}`];
            if (text && text !== "0" && checkTextStarter(text)) {
                hasText = true;
                break;
            }
        }
        if (!hasText) {
            result.delete(key);
        }
    }

    console.log("删除未使用的条目后:");
    getStats();

    // 检查是否有超长的条目
    const oversizedEntries: Record<string, UnifiedBalloon> = {};
    for (let [key, value] of result) {
        for (let lang of languages) {
            if (!value[`text_${lang}`]) {
                continue;
            }
            if (value[`text_${lang}`]!.length >= 400) {
                oversizedEntries[key] = value;
                break;
            }
        }
    }
    console.log(chalk.yellow("以下条目内容长度超过400字(以UID标记):"));
    for (let key in oversizedEntries) {
        console.log(key);
    }
    console.log(chalk.yellow("超长的条目已输出到output/oversizedEntries.json"));
    fs.writeFileSync(
        "./output/oversizedEntries.json",
        JSON.stringify(oversizedEntries, null, 4)
    );
    fs.writeFileSync(
        "./output/unified_npc_balloon_allentries.json",
        JSON.stringify([...result.values()], null, 4)
    );

    function SetMapToRecord(
        map: Map<string, Set<string>>
    ): Record<string, string[]> {
        const record: Record<string, string[]> = {};
        map.forEach((value, key) => {
            record[key] = [...value.values()];
        });
        return record;
    }
    const tags = {
        startTags: SetMapToRecord(startTags),
        endTags: SetMapToRecord(endTags),
        selfCloseTags: SetMapToRecord(selfCloseTags),
    };
    fs.writeFileSync("./output/tags.json", JSON.stringify(tags, null, 4));
})();
