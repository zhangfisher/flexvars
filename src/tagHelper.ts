import { escapeRegexpStr } from "./utils"

/**
 * 
 *  遍历字符串中的 beginTag和endTag,添加辅助序号
 * 
 *  @remarks
 * 
 * 
 * @param {*} str 
 * @param {*} beginTag 
 * @param {*} endTag 
 * @returns 
 */
export  function addTagFlags(str: string, beginTag = "{", endTag = "}") {
    let i = 0
    let flagIndex = 0
    while (i < str.length) {
        let beginChars = str.slice(i, i + beginTag.length)
        let endChars = str.slice(i, i + endTag.length)
        if (beginChars == beginTag) {
            flagIndex++
            str = str.substring(0, i + beginTag.length) + `${flagIndex}%` + str.substring(i + beginTag.length)
            i += beginTag.length + String(flagIndex).length + 1
            continue
        }
        if (endChars == endTag) {
            if (flagIndex > 0) {
                str = str.substring(0, i) + `%${flagIndex}` + str.substring(i)
            }
            i += endTag.length + String(flagIndex).length + 1
            flagIndex--
            continue
        }
        i++
    }
    return str
}

// 指<div></div>成对标签
export type TagPair = [string, string]
/**
 * 增加标签组辅助标识
 * 
 * @remarks
 * 
 *  addTagHelperFlags("xxxx",["<div>","</div>"]
 *  返回<div>xxx</div>
 *  
 * 
 * @param {*} str 
 * @param  {...any} tags  默认已包括{},[]
 */
export function addTagHelperFlags(str: string, ...tags: TagPair[]) {
    if (tags.length == 0) {
        tags.push(["{", "}"])
        tags.push(["[", "]"])
    }
    tags.forEach(tag => {
        if (str.includes(tag[0]) && str.includes(tag[1])) {
            str = addTagFlags(str, ...tag)
        }
    })
    return str
}

export function removeTagFlags(str: string, beginTag: string, endTag: string) {
    const regexs:([string,RegExp])[] = [
        [beginTag, new RegExp(escapeRegexpStr(beginTag) + "\\d+%")],
        [endTag, new RegExp("%\\d+" + escapeRegexpStr(endTag))]
    ]
    regexs.forEach(([tag, regex]) => {
        let matched
        while ((matched = regex.exec(str)) !== null) {
            if (matched.index === regex.lastIndex) regex.lastIndex++;
            str = str.replace(regex, tag)
        }
    })
    return str
}

export function removeTagHelperFlags(str: string, ...tags: TagPair[]) {
    if (tags.length == 0) {
        tags.push(["{", "}"])
        tags.push(["[", "]"])
    }
    tags.forEach(([beginTag, endTag]) => {
        if (str.includes(beginTag) && str.includes(endTag)) {
            str = removeTagFlags(str, beginTag, endTag)
        }
    })
    return str
}