
// 用于生成Tabx的json数据的类型
export type TabxType<T extends any[]> = {
    description: {
        zh: string;
    }
    schema: {
        fields: {
            name: string; type: 'string' | 'number' | 'boolean',
            title: {
                en: string;
                zh: string;
            }
        }[]
    }
    data: T[]
}