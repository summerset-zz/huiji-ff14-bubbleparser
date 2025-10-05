import chalk from "chalk";
import { HuijiWiki } from "huijiwiki-api";
import { config } from "dotenv";
import fs from "fs/promises";
config();
const WIKI_USERNAME = process.env.WIKI_USERNAME;
const WIKI_PASSWORD = process.env.WIKI_PASSWORD;
const WIKI_API_AUTH_KEY = process.env.WIKI_API_AUTH_KEY;
const SITE_PREFIX = "pf2";
if (!WIKI_USERNAME || !WIKI_PASSWORD || !WIKI_API_AUTH_KEY) {
    console.error(
        chalk.red(
            "请设置环境变量WIKI_USERNAME, WIKI_PASSWORD, WIKI_API_AUTH_KEY"
        )
    );
    process.exit(1);
}

type WikiAskargsResponse = {
    "query-continue-offset": number;
    query: {
        printrequests: any[];
        results: {
            [key: string]: {
                printouts: Record<string, any[]>;
                fulltext: string;
                fullurl: string;
                namespace: number;
                exists: string;
                displaytitle: string;
            };
        };
    };
};

(async () => {
    const wiki = new HuijiWiki(SITE_PREFIX, WIKI_API_AUTH_KEY);
    await wiki.apiLogin(WIKI_USERNAME, WIKI_PASSWORD);

    const PAGE_SIZE = 500;
    let offset = 0;
    let lastOffset = -1;
    let lastPageSize = PAGE_SIZE;
    const results = [] as {
        printouts: Record<string, any[]>;
        fulltext: string;
        fullurl: string;
        namespace: number;
        exists: string;
        displaytitle: string;
    }[];

    while (true) {
        const params = {
            action: "askargs",
            format: "json",
            conditions: "原文::+", // 查询条件
            printouts: "原文", // 需要获取的属性
            parameters: `limit=${PAGE_SIZE}|offset=${offset}`, // 分页参数
            utf8: 1,
        };
        const result = (await wiki.get(params)) as WikiAskargsResponse;
        const pageResults =
            result.query && result.query.results
                ? Object.values(result.query.results)
                : [];
        results.push(...pageResults);

        lastPageSize = pageResults.length;
        const nextOffset = result["query-continue-offset"];

        console.log(
            chalk.green(
                `已获取 ${results.length} 条数据，offset=${
                    nextOffset || "结束"
                }`
            )
        );

        // Stop if less than PAGE_SIZE results returned (last page)
        if (lastPageSize < PAGE_SIZE) break;

        // Stop if nextOffset is not greater than current offset (loop detected)
        if (!nextOffset || nextOffset <= offset) break;

        lastOffset = offset;
        offset = nextOffset;
    }

    const finalResults = [] as {
        title: string;
        en: string[];
    }[];

    for (const item of results) {
        finalResults.push({
            title: item.fulltext,
            en: item.printouts["原文"] || [],
        });
    }

    await fs.writeFile(
        "./smwResults.json",
        JSON.stringify(finalResults, null, 2),
        "utf-8"
    );
    console.log(
        chalk.green(`已保存 ${finalResults.length} 条数据到 smwResults.json`)
    );
})();
