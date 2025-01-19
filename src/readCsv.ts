import * as fs from 'fs';
import * as path from 'path';
import type { NPCBallonCsv, NPCYellCsv, NPCInstanceContentTextCsv, UnifiedBalloon, UnifiedLanguageText, Languages } from './types/csvTypes';
import csv from 'csv-parser';
import chalk from 'chalk'


const getCsvFileContent = async (csvPath: string) => {
    const fileContent: any[] = [];
    await new Promise((resolve, reject) => {
        fs.createReadStream(csvPath).pipe(csv())
            .on('data', (data: any) => fileContent.push(data))
            .on('end', resolve)
            .on('error', reject);
    });
    return fileContent;
}

const getLatestFilePath = (prefix: string, lang: Languages) => {
    const versions: string[] = ['7.15', '7.05'];
    let filePath = '';
    for (let version of versions) {
        filePath = `./input/${prefix}${version}${lang}.csv`;
        if (fs.existsSync(filePath)) {
            console.log(chalk.green(`语言 ${lang}下的${prefix}文件: ${filePath}`));
            return filePath;
        }
    }
    console.error(chalk.red(`语言 ${lang}下的${prefix}文件不存在`));
    return '';
}



(async () => {
    const languages = ['KO', 'EN', 'JA', 'CHS', 'FR', 'DE'] as Languages[];
    const versions: string[] = ['7.15', '7.05'];
    const result = new Map<string, UnifiedBalloon>();




    for (let lang of languages) {
        // ballon文件
        const balloonCsvPath = getLatestFilePath('Balloon', lang);
        const fileContent = await getCsvFileContent(balloonCsvPath);

        for (let i = 2; i < fileContent.length; i++) {
            const row = fileContent[i];
            const key = row[Object.keys(row)[2]];
            const uid = `BA${key}`;
            if (result.has(uid)) {
                result.get(uid)![`text_${lang}` as keyof UnifiedLanguageText] = row['1'];
            }
            else {
                result.set(uid, {
                    data_type: 'unified_npc_balloon',
                    uid,
                    id: Number(key),
                    source: 'BA',
                    [`text_${lang}`]: row['1']
                })
            }
        }
        // InstanceContentText文件
        const instanceContentTextCsvPath = getLatestFilePath('InstanceContentTextData', lang);
        const instanceContentTextFileContent = await getCsvFileContent(instanceContentTextCsvPath);
        for (let i = 2; i < instanceContentTextFileContent.length; i++) {
            const row = instanceContentTextFileContent[i];
            const key = row[Object.keys(row)[1]];
            const uid = `IC${key}`;
            if (result.has(uid)) {
                result.get(uid)![`text_${lang}` as keyof UnifiedLanguageText] = row['0'];
            }
            else {
                result.set(uid, {
                    data_type: 'unified_npc_balloon',
                    uid,
                    id: Number(key),
                    source: 'IC',
                    [`text_${lang}`]: row['0']
                })
            }
        }


        // Yell文件
        const yellCsvPath = getLatestFilePath('NpcYell', lang);
        const yellFileContent = await getCsvFileContent(yellCsvPath);

        for (let i = 2; i < yellFileContent.length; i++) {
            const row = yellFileContent[i];

            const key = row[Object.keys(row)[Object.keys(row).length - 1]];
            const uid = `YE${key}`;
            if (result.has(uid)) {
                result.get(uid)![`text_${lang}` as keyof UnifiedLanguageText] = row['11'];
            }
            else {
                result.set(uid, {
                    data_type: 'unified_npc_balloon',
                    uid,
                    id: Number(key),
                    source: 'YE',
                    [`text_${lang}`]: row['11']
                })
            }
        }

    }

    // 做一道筛选

    const getStats = () => {
        const stats = {
            BA: 0,
            IC: 0,
            YE: 0,
            total: 0
        }
        for (let [key, value] of result) {
            stats.total++;
            if (value.source === 'BA') {
                stats.BA++;
            }
            else if (value.source === 'IC') {
                stats.IC++;
            }
            else if (value.source === 'YE') {
                stats.YE++;
            }
        };
        console.log(`BA条目: ${stats.BA}, IC条目: ${stats.IC}, YE条目: ${stats.YE}, 总条目: ${stats.total}`);
    };
    console.log('删除未使用的条目前:');
    getStats();
    for (let [key, value] of result) {
        // if all text_{language} is empty or undefined, delete this entry
        let hasText = false;
        for (let lang of languages) {
            const text = value[`text_${lang}`];
            if (text
                && text !== '0'
                && !text.startsWith('未使用')
                && !text.startsWith('×未使用')
                && !text.startsWith('●未使用')) {
                hasText = true;
            }

        }
        if (!hasText) {
            result.delete(key);
        }
    }
    console.log('删除未使用的条目后:');
    getStats();


    fs.writeFileSync('./output/unified_npc_balloon_debugger.json', JSON.stringify([...result.values()], null, 4));


})()
