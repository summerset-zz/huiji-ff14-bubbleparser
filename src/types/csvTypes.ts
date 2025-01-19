/**
 * 以下三条是csv文件导入后根据表头定义的类型。其中忽略了一些可能无意义的字段。
 */

export type NPCBallonCsv = {
    id: number;
    Slowly: boolean;
    Dialogue: string;
}

export type NPCYellCsv = {
    id: number;
    OutputType: number; // 原始类型为byte，感觉像掩码,这是什么？
    BallonTime: number; // 原始类型为single
    isBalloonSlow: boolean;
    BattleTalkTime: boolean;
    Text: string;
}
export type NPCInstanceContentTextCsv = {
    id: number;
    Text: string;
}

export type Languages = 'KO' | 'EN' | 'JA' | 'CHS' | 'FR' | 'DE';

/**
 * 以下是计划中合并后的数据结构。
 */
export type UnifiedLanguageText = {
    text_KO?: string;
    text_EN?: string;
    text_JA?: string;
    text_CHS?: string;
    text_FR?: string;
    text_DE?: string;
}

export type UnifiedBalloon = {
    //用于与其他wiki数据区分
    data_type: 'unified_npc_balloon';
    // UID由原始表加上原始ID组成。
    // Balloon表前缀为BA，Yell表前缀为YE，InstanceContentText表前缀为IC
    uid: string;
    id: number; // 原始ID。BA、YE、IC三种表各自独立。
    source: 'BA' | 'YE' | 'IC'; // 表示来源表，冗余数据
    // 由于最终的结果是tabx因此这里无法嵌套object，只能用多个字段。

} & UnifiedLanguageText;