import { HuijiWiki } from 'huijiwiki-api';
import * as fs from 'fs';
import chalk from 'chalk';
import { config } from 'dotenv';
config();
const WIKI_USERNAME = process.env.WIKI_USERNAME;
const WIKI_PASSWORD = process.env.WIKI_PASSWORD;
const WIKI_API_AUTH_KEY = process.env.WIKI_API_AUTH_KEY;
if (!WIKI_USERNAME || !WIKI_PASSWORD || !WIKI_API_AUTH_KEY) {
    console.error(chalk.red('请设置环境变量WIKI_USERNAME, WIKI_PASSWORD, WIKI_API_AUTH_KEY'));
    process.exit(1);
}
(async () => {
    console.log(`正在以${WIKI_USERNAME}的身份登录到灰机wiki...`);
    const wiki = new HuijiWiki('ff14', WIKI_API_AUTH_KEY);
    if (!(await wiki.apiLogin(WIKI_USERNAME, WIKI_PASSWORD))) {
        console.error(chalk.red('登录失败。'));
        process.exit(1);
    }
    console.log(chalk.green('登录成功。'));

    const csrfToken = await wiki.apiQueryCsrfToken();


    const chunkFileNames: string[] = [];
    // find all files starts with 'unified_npc_balloon_chunk' in ./output, and save them to chunkFileNames.
    fs.readdirSync('./output').forEach(file => {
        if (file.startsWith('unified_npc_balloon_chunk') && file.endsWith('.json')) {
            chunkFileNames.push(file);
        }
    });

    // the filenames are like 'unified_npc_balloon_chunk_0.json', 'unified_npc_balloon_chunk_1.json', etc. sort them by the number after 'chunk_' in the filename.
    chunkFileNames.sort((a, b) => {
        const aNum = parseInt(a.split('_')[4].split('.')[0]);
        const bNum = parseInt(b.split('_')[4].split('.')[0]);
        return aNum - bNum;
    });
    console.log(`共有${chunkFileNames.length}个分段。即将开始上传`);

    const stats = {
        success: 0,
        failed: 0
    }
    for (let i = 0; i < chunkFileNames.length; i++) {
        const fileName = chunkFileNames[i];
        const fileContent = fs.readFileSync(`./output/${fileName}`, 'utf-8');
        console.log(`正在上传第${i + 1}个分段...(文件名: ${fileName})`);

        const result = await wiki.request({
            action: 'edit',
            title: `Data:${fileName.replace('.json', '')}.tabx`,
            text: fileContent,
            summary: '使用HUIJI-FF14-BUBBLEPARSER上传',
            bot: true,
            token: csrfToken
        })
        if (!result.error) {
            console.log(chalk.green(`第${i + 1}个分段上传成功`));
            stats.success++;
        }
        else {
            console.error(chalk.red(`第${i + 1}个分段上传失败`));
            console.error(chalk.red(result.error.info));
            stats.failed++;
        }
    }
    console.log(chalk.green('所有任务完成。'));
    console.log(`成功上传${stats.success}个分段，失败${stats.failed}个分段。`);
})()

