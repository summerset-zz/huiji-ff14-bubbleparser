import { UnifiedBalloon } from "./types/csvTypes";
import { TabxType } from "./types/tabxTypes";
import * as fs from 'fs';
import chalk from 'chalk';

type UnifiedBalloonTabxColumns = [string, string, number, string, string, string, string, string, string, string];
const buildTabxChunk = (data: UnifiedBalloon[], chunkSize = 2500): TabxType<UnifiedBalloonTabxColumns>[] => {
    const chunks: TabxType<UnifiedBalloonTabxColumns>[] = [];
    console.log(`共有${data.length}条数据。按照当前的chunkSize=${chunkSize}，将分为${Math.ceil(data.length / chunkSize)}个文件。`);
    for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        chunks.push({
            description: {
                zh: '统一的NPC对话气泡和喊话数据'
            },
            schema: {
                fields: [
                    { name: 'data_type', type: 'string', title: { en: 'data_type', zh: 'data_type' } },
                    { name: 'uid', type: 'string', title: { en: 'uid', zh: 'uid' } },
                    { name: 'id', type: 'number', title: { en: 'id', zh: 'id' } },
                    { name: 'source', type: 'string', title: { en: 'source', zh: 'source' } },
                    { name: 'text_KO', type: 'string', title: { en: 'text_KO', zh: 'text_KO' } },
                    { name: 'text_EN', type: 'string', title: { en: 'text_EN', zh: 'text_EN' } },
                    { name: 'text_JA', type: 'string', title: { en: 'text_JA', zh: 'text_JA' } },
                    { name: 'text_CHS', type: 'string', title: { en: 'text_CHS', zh: 'text_CHS' } },
                    { name: 'text_FR', type: 'string', title: { en: 'text_FR', zh: 'text_FR' } },
                    { name: 'text_DE', type: 'string', title: { en: 'text_DE', zh: 'text_DE' } }
                ]
            },
            data: chunk.map(item => {
                return [
                    item.data_type,
                    item.uid,
                    item.id,
                    item.source,
                    item.text_KO ?? '',
                    item.text_EN ?? '',
                    item.text_JA ?? '',
                    item.text_CHS ?? '',
                    item.text_FR ?? '',
                    item.text_DE ?? ''
                ]
            })
        })
    }
    return chunks;
}

(async () => {
    // read ./output/unified_npc_balloon_allentries.json. if not exists, console.error and return.
    const filePath = './output/unified_npc_balloon_allentries.json';
    if (!fs.existsSync(filePath)) {
        console.error('File not exists');
        return;
    }
    // delete all existed jsonfiles starts with 'unified_npc_balloon_chunk' in ./output
    console.log(chalk.yellow('删除已存在的分段文件...'));
    fs.readdirSync('./output').forEach(file => {
        if (file.startsWith('unified_npc_balloon_chunk') && file.endsWith('.json')) {
            fs.unlinkSync(`./output/${file}`);
        }
    })
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data: UnifiedBalloon[] = JSON.parse(fileContent);

    const chunks = buildTabxChunk(data);

    for (const [index, chunk] of chunks.entries()) {
        fs.writeFileSync(`./output/unified_npc_balloon_chunk_${index}.json`, JSON.stringify(chunk, null, 4));
        // get the file size
        const stats = fs.statSync(`./output/unified_npc_balloon_chunk_${index}.json`);
        console.log(`./output/unified_npc_balloon_chunk_${index}.json 写入成功。文件大小为${stats.size}字节。`);
    }
})()
