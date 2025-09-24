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

type WikiRedirectsResponse = {
    batchcomplete: string;
    continue?: { garcontinue: string; continue: string };
    query: {
        redirects: { from: string; to: string; tofragment?: string }[];
        pages: Record<
            string,
            {
                pageid: number;
                ns: number;
                title: string;
                redirects?: any[];
            }
        >;
    };
};

(async () => {
    const wiki = new HuijiWiki(SITE_PREFIX, WIKI_API_AUTH_KEY);
    await wiki.apiLogin(WIKI_USERNAME, WIKI_PASSWORD);
    const redirectList = [] as {
        from: string;
        to: string;
        tofragment?: string;
    }[];

    let garcontinue = undefined as string | undefined;
    let count = 0;
    do {
        const params = {
            action: "query",
            format: "json",
            generator: "allredirects",
            redirects: 1,
            utf8: 1,
            garprop: "title|ids",
            garlimit: "500",
        };

        const result = (await wiki.get({
            ...params,
            ...(garcontinue ? { garcontinue } : {}),
        })) as WikiRedirectsResponse;
        if (result.query.redirects) {
            redirectList.push(...result.query.redirects);
        }
        garcontinue = result.continue?.garcontinue;
        count++;
        if (garcontinue) {
            console.log(`第${count}次：从${garcontinue}继续获取重定向...`);
            garcontinue = garcontinue;
        } else {
            console.log("重定向获取完毕。");
        }
    } while (garcontinue);

    // 保存到redirects.json
    await fs.writeFile(
        "redirects.json",
        JSON.stringify(redirectList, null, 2),
        "utf-8"
    );
    console.log(
        chalk.green(
            `共获取到${redirectList.length}个重定向，已保存到redirects.json`
        )
    );
})();
