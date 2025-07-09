import { HuijiWiki } from 'huijiwiki-api';
import type { HuijiRequester } from 'huijiwiki-api/dist/HuijiWiki/HuijiRequester';
import * as fs from 'fs';
import chalk from 'chalk';
import { config } from 'dotenv';
import FormData from 'form-data';
import axios, { AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
config();


const WIKI_USERNAME = process.env.WIKI_USERNAME;
const WIKI_PASSWORD = process.env.WIKI_PASSWORD;
const WIKI_API_AUTH_KEY = process.env.WIKI_API_AUTH_KEY;
const SITE_PREFIX = 'bttd';
const XML_FOLDER = 'C:/Users/huiji-2022-1/Downloads/backtothedawn导出文件/backtothedawn导出XML（1～859）'
if (!WIKI_USERNAME || !WIKI_PASSWORD || !WIKI_API_AUTH_KEY) {
    console.error(chalk.red('请设置环境变量WIKI_USERNAME, WIKI_PASSWORD, WIKI_API_AUTH_KEY'));
    process.exit(1);
}

class HuijiWikiExtended extends HuijiWiki {
    get cookies() {
        // @ts-ignore
        const requester = this.requester as HuijiRequester;
        // @ts-ignore
        const cookies = requester.cookie.cookies as Record<string, string>;
        console.log(cookies);
        return cookies;
    }
}
(
    async () => {
        const wiki = new HuijiWikiExtended(SITE_PREFIX, WIKI_API_AUTH_KEY);
        await wiki.apiLogin(WIKI_USERNAME, WIKI_PASSWORD);
        const csrfToken = await wiki.apiQueryCsrfToken();
        // 使用axios-cookiejar-support来支持cookie
        const jar = new CookieJar();
        // set the wiki.cookies to the jar
        for (const [name, value] of Object.entries(wiki.cookies)) {
            jar.setCookieSync(`${name}=${value}`, `https://${SITE_PREFIX}.huijiwiki.com`);
        }
        const axiosInstance: AxiosInstance = wrapper(axios.create({
            jar,
            withCredentials: true,
        }));
        // 设置请求头
        axiosInstance.defaults.headers.common['x-authkey'] = WIKI_API_AUTH_KEY;

        // 获取XML文件列表
        const xmlFiles = fs.readdirSync(XML_FOLDER).filter(file => file.endsWith('.xml'));
        console.log(`找到 ${xmlFiles.length} 个XML文件，开始上传...`);
        const stats = {
            success: 0,
            failed: 0
        };
        for (const fileName of xmlFiles) {
            const filePath = `${XML_FOLDER}/${fileName}`;
            console.log(`正在上传文件: ${fileName}`);
            const form = new FormData();
            form.append('action', 'import');
            form.append('format', 'json');
            form.append('xml', fs.readFileSync(filePath), { filename: fileName, contentType: 'text/xml' });
            form.append('interwikiprefix', 'bilibili');
            form.append('summary', `导入自 ${fileName}`);
            form.append('token', csrfToken); // 添加CSRF令牌


            const result = await axiosInstance.post(
                `https://${SITE_PREFIX}.huijiwiki.com/api.php`,
                form,
                {
                    headers: {
                        ...form.getHeaders(),
                        "x-authkey": WIKI_API_AUTH_KEY,
                        "Content-Type": `multipart/form-data`,

                    },
                }
            )
            if (result.data && result.data.result === 'OK') {
                console.log(chalk.green(`文件 ${fileName} 上传成功。`));
                stats.success++;
            } else {
                console.error(chalk.red(`文件 ${fileName} 上传失败: ${result.data.error?.info || '未知错误'}`));
                stats.failed++;
                console.log(result.data);
                debugger;

            }
        }

        console.log(chalk.green(`上传完成。成功: ${stats.success}, 失败: ${stats.failed}`));
    })()