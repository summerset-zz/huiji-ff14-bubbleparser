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
const startTags = new Map<string, Set<string>>();
const endTags = new Map<string, Set<string>>();
const selfCloseTags = new Map<string, Set<string>>();
const purify = (text: string) => {
    let output = text;
    // if a part matches '<tagName>' or '<tagName(xxxx)>', this is a startTag. set it to startTags.
    // if a part matches '</tagName>', this is an endTag. set it to endTags.
    // if a part matches '<tagName/>' or '<tagName(xxxx)>', this is a selfCloseTag. set it to selfCloseTags.

    const startTagRegex = /<(\w+)(\([^<>]*\))?>/g;
    const endTagRegex = /<\/(\w+)>/g;
    const selfCloseTagRegex = /<(\w+)(\([^)]*\))?\/>/g;

    const processMatches = (regex: RegExp, map: Map<string, Set<string>>) => {
        const matches = [...text.matchAll(regex)];
        matches.forEach(match => {
            const tagName = match[1];
            const matchedValue = match[0];
            if (!map.has(tagName)) {
                map.set(tagName, (() => { return new Set<string>().add(matchedValue) })());
            } else {
                map.get(tagName)!.add(matchedValue);
            }
        });
    };

    processMatches(startTagRegex, startTags);
    processMatches(endTagRegex, endTags);
    processMatches(selfCloseTagRegex, selfCloseTags);

    // remove all tabs, remove spaces at beginning and end of it.
    output = text.replace(/\t/g, '').trim();

    // output = output.replace(/<If(\([^<>]*\))?>/g, '<br />-条件-').replace(/<Case(\([^<>]*\))?>/g, '<br />-条件-').replace('<Indent/>', ' ').replace('<SoftHyphen/>', '-');

    // relace all < > wrapped parts to ''
    // output = output.replace(/<[^<>]*>/g, '');


    // replace all \r\n to '<br />', then replace all \n to '<br />'
    output = output.replace(/\r\n/g, '<br />').replace(/\n/g, '<br />');

    output = output.trim();
    if (output.length > 400) {
        console.log(chalk.yellow('内容过长:'), output);
    }
    return output
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
                result.get(uid)![`text_${lang}` as keyof UnifiedLanguageText] = purify(row['1']);
            }
            else {
                result.set(uid, {
                    data_type: 'unified_npc_balloon',
                    uid,
                    id: Number(key),
                    source: 'BA',
                    [`text_${lang}`]: purify(row['1'])
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
                result.get(uid)![`text_${lang}` as keyof UnifiedLanguageText] = purify(row['0']);
            }
            else {
                result.set(uid, {
                    data_type: 'unified_npc_balloon',
                    uid,
                    id: Number(key),
                    source: 'IC',
                    [`text_${lang}`]: purify(row['0'])
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
                result.get(uid)![`text_${lang}` as keyof UnifiedLanguageText] = purify(row['11']);
            }
            else {
                result.set(uid, {
                    data_type: 'unified_npc_balloon',
                    uid,
                    id: Number(key),
                    source: 'YE',
                    [`text_${lang}`]: purify(row['11'])
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

    const checkTextStarter = (text: string) => {
        const falseTextStarts = ['未使用',
            '×未使用',
            '●未使用',
            '●000',
            '●不要',
            '●仮設定',
            '●削除'];
        for (let falseTextStart of falseTextStarts) {
            if (text.startsWith(falseTextStart)) {
                return false;
            }
        }
        return true;

    }
    const checkAllHiragana = (entry: UnifiedBalloon) => {
        const texts: Partial<Record<string, string>> = {
            text_KO: entry.text_KO,
            text_EN: entry.text_EN,
            text_JA: entry.text_JA,
            text_CHS: entry.text_CHS,
            text_FR: entry.text_FR,
            text_DE: entry.text_DE
        }
        for (let key in texts) {
            if (texts[key] == undefined || !checkTextStarter(texts[key] as string)) {
                delete texts[key];
            }
        }
        // check if all texts are same
        let allSame = false
        const values = Object.values(texts);
        if (values.length === 0) {
            allSame = true;
        }
        const firstValue = values[0];
        allSame = values.every(value => value === firstValue);

        if (allSame && firstValue) {

            // if allSame contains hiragana or katakana, return true
            const containsKanaRegex = /[\u3040-\u30FF]/;
            if (containsKanaRegex.test(firstValue)) {
                console.log(chalk.yellow('内容相同的假名条目:'), `uid: ${entry.uid}, content: ${firstValue}`);
                return true;
            }
        }
    }

    for (let [key, value] of result) {
        if (checkAllHiragana(value)) {
            result.delete(key);
            continue;
        };
        let hasText = false;
        for (let lang of languages) {
            const text = value[`text_${lang}`];
            if (text
                && text !== '0'
                && checkTextStarter(text)

            ) {
                hasText = true;
                break;
            }

        }
        if (!hasText) {
            result.delete(key);
        }
    }
    console.log('删除未使用的条目后:');
    getStats();


    fs.writeFileSync('./output/unified_npc_balloon_allentries.json', JSON.stringify([...result.values()], null, 4));

    function mapToRecord(map: Map<string, Set<string>>): Record<string, string[]> {
        const record: Record<string, string[]> = {}
        map.forEach((value, key) => {
            record[key] = [...value.values()];
        });
        return record;
    }
    const tags = {
        startTags: mapToRecord(startTags),
        endTags: mapToRecord(endTags),
        selfCloseTags: mapToRecord(selfCloseTags)
    }
    fs.writeFileSync('./output/tags.json', JSON.stringify(tags, null, 4))

})()
