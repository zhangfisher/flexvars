/**
 * 
 * 解析过滤器
 * 
 * 解析{ varname | formater(...params) }中的params部分
 * 
 * 
 * 
 */


import { escapeRegexpStr } from "./utils"
import { get as getByPath } from "flex-tools/object/get"
import { isNumber } from "flex-tools/typecheck/isNumber"
import { isFunction } from "flex-tools/typecheck/isFunction"
import { isPlainObject } from "flex-tools/typecheck/isPlainObject"
import { safeParseJson } from "flex-tools/object/safeParseJson"
import { assignObject } from "flex-tools/object/assignObject"
import { addTagHelperFlags, removeTagHelperFlags } from "./tagHelper"
import type { FlexVars } from "./flexvars"

export type FilexFilterErrorBehavior = 'throw' | 'ignore' | 'break' 
 

/**
 * 过滤器函数定义
 * 
 * @remarks
 * 
 * 
 * @param value     上一个过滤器的返回值
 * @param args      当前过滤器的参数
 * @param context   上下文字典，用于存储一些共享数据
 * 
 */
export interface FlexFilter{
    (this:FlexVars,value:any,args:any[],context:Record<string,any>):any
    name?:string    
}

export interface FilterDefine {
	// 是否默认启用该过滤器的,none代表不启动
	// before代表每一个插值变量均前置安装面，after代表安装在后面
	use?: "none" | "before" | "after";
	filter: FlexFilter;
}

/**
 * 
使用正则表达式对原始文本内容进行解析匹配后得到的方便处理的数组

@remarks

例如：filters="| aaa(1,1) | bbb "

统一解析为

[
    [aaa,[1,1]],         // [<过滤器名称>,[args,...]]
    [<过滤器名称>,[<参数>,<参数>,...]]
]

filters="| aaa(1,1,"dddd") | bbb "

特别注意：
- 目前对参数采用简单的split(",")来解析，因此如果参数中包括了逗号等会影响解析的字符时，可能导致错误
例如aaa(1,1,"dd,,dd")形式的参数
在此场景下基本够用了，如果需要支持更复杂的参数解析，可以后续考虑使用正则表达式来解析
- 如果参数是{},[]，则尝试解决为对象和数组，但是里面的内容无法支持复杂和嵌套数据类型

@param {String} filters  

@returns  [ [<过滤器名称>,[<参数>,<参数>,...],[<过滤器名称>,[<参数>,<参数>,...]],...]
*/

//@returns  [ [<过滤器名称>,[<参数>,<参数>,...],[<过滤器名称>,[<参数>,<参数>,...]],...]
export type FilterDefineChain = ([string, string[]])[]
export function parseFilters(filtersStr: string): FilterDefineChain {
    if (!filtersStr) return [];
    // 1. 先解析为 ["aaa()","bbb"]形式
    let result = filtersStr.trim().substring(1).trim().split("|").map((r) => r.trim());
    // 2. 解析过滤器参数
    return result.map((filter: string) => {
        if (filter == "") return null;
        let firstIndex = filter.indexOf("(");
        let lastIndex = filter.lastIndexOf(")");
        if (firstIndex !== -1 && lastIndex !== -1) { //参数的过滤器   
            // 带参数的过滤器: 取括号中的参数字符串部分
            const strParams = filter.substring(firstIndex + 1, lastIndex).trim();
            // 解析出过滤器的参数数组
            let params = parseFilterParams(strParams);
            // 返回[<过滤器名称>,[<参数>,<参数>,...]
            return [filter.substring(0, firstIndex), params];
        } else { // 不带参数的过滤器               
            return [filter, []];
        }
    }).filter((filter) => Array.isArray(filter)) as FilterDefineChain
}


/**
 * 生成可以解析指定标签的正则表达式
 * 
 * @remarks
 * 
 * getNestingParamsRegex()     -- 能解析{}和[]
 * getNestingParamsRegex(["<b>","</b>"]),
 * 
 * @param  {...any} tags 
 * @returns 
 */
function getNestingParamsRegex(...tags: ([string, string])[]) {
    if (tags.length == 0) {
        tags.push(["{", "}"])
        tags.push(["[", "]"])
    }
    const tagsRegexs = tags.map(([beginTag, endTag]) => {
        return `(${escapeRegexpStr(beginTag)}1%.*?%1${escapeRegexpStr(endTag)})`
    })
    return filterNestingParamsRegex.replace("__TAG_REGEXP__", tagsRegexs.length > 0 ? tagsRegexs.join("|") + "|" : "")
}


// 提取匹配("a",1,2,'b',{..},[...]),不足：当{}嵌套时无法有效匹配
//  const filterParamsRegex = /((([\'\"])(.*?)\3)|(\{.*?\})|(\[.*?\])|([\d]+\.?[\d]?)|((true|false|null)(?=[,\b\s]))|([\w\.]+)|((?<=,)\s*(?=,)))(?<=\s*[,\)]?\s*)/g;

// 支持解析嵌套的{}和[]参数， 前提是：字符串需要经addTagHelperFlags操作后，会在{}[]等位置添加辅助字符
// 解析嵌套的{}和[]参数基本原理：在{}[]等位置添加辅助字符，然后使用正则表达式匹配，匹配到的字符串中包含辅助字符，然后再去除辅助字符
const filterNestingParamsRegex = String.raw`((([\'\"])(.*?)\3))|__TAG_REGEXP__([\d]+\.?[\d]?)|((true|false|null)(?=[,\b\s]))|([\w\.]+)|((?<=,)\s*(?=,))(?<=\s*[,\)]?\s*)`

/**
 * 解析过滤器的参数
 * 
 * @remarks
 * 
 *  采用正则表达式解析
 *  支持number,boolean,null,String,{},[]的参数，可以识别嵌套的{}和[]
 *  
 * @param {*} strParams    过滤器参数字符串，即filter(<...参数....>)括号里面的参数，使用,分割 
 * @returns {Array}  返回参数值数组 []
 */
function parseFilterParams(strParams: string): any[] {
    let params:any[] = [];
    let matched;
    // 1. 预处理： 处理{}和[]嵌套问题,增加嵌套标识
    strParams = addTagHelperFlags(strParams)
    try {
        let regex = new RegExp(getNestingParamsRegex(), "g")
        while ((matched = regex.exec(strParams)) !== null) {
            // 这对于避免零宽度匹配的无限循环是必要的
            if (matched.index === regex.lastIndex) {
                regex.lastIndex++;
            }
            let value: any = matched[0]
            if (value.trim() == '') {
                value = null
            } else if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
                value = value.substring(1, value.length - 1)
                value = removeTagHelperFlags(value)
            } else if ((value.startsWith("{") && value.endsWith("}")) || (value.startsWith('[') && value.endsWith(']'))) {
                try {
                    value = removeTagHelperFlags(value)
                    value = safeParseJson(value)
                } catch { }
            } else if (["true", "false", "null"].includes(value)) {
                value = JSON.parse(value)
            } else if (isNumber(value)) {
                value = parseFloat(value)
            } else {
                value = removeTagHelperFlags(String(value))
            }
            params.push(value)
        }
    } catch { }
    return params
}


/**
 * 创建过滤器
 * 
 * @remarks 
 * 
 * 过滤器是一个普通的函数，具有以下特点：
 * 
 * - 函数第一个参数是上一上过滤器的输出
 * - 支持0-N个简单类型的入参
 * - 可以是定参，也可以变参
 * - 过滤器可以在过滤器的$config参数指定一个键值来配置不同语言时的参数
 *  
 *   "currency":createFilter((value,prefix,suffix, division ,precision,$config)=>{
 *     // 无论在过滤器入参数是多少个，经过处理后在此得到prefix,suffix, division ,precision参数已经是经过处理后的参数
 *     依次读取过滤器的参数合并：
 *       - 创建过滤器时的defaultParams参数
 *       - 从当前激活过滤器的$config中读取配置参数
 *       - 在t函数后传入参数
  *     比如currency过滤器支持4参数，其入参顺序是prefix,suffix, division ,precision
  *     那么在t函数中可以使用以下五种入参数方式
  *      {value | currency }                                    //prefix=undefined,suffix=undefined, division=undefined ,precision=undefined
  *      {value | currency(prefix) }
  *      {value | currency(prefix,suffix) }
  *      {value | currency(prefix,suffix,division)  }
  *      {value | currency(prefix,suffix,division,precision)}
  *    
  * 经过createFilter处理后，会从当前激活过滤器的$config中读取prefix,suffix, division ,precision参数作为默认参数
  * 然后t函数中的参数会覆盖默认参数，优先级更高
 *      },
 *      {
 *          unit:"$",
 *          prefix,
 *          suffix,
 *          division,
 *          precision
 *      },
 *      {
 *          normalize:value=>{...},
 *          params:["prefix","suffix", "division" ,"precision"]     // 声明参数顺序
 *          configKey:"currency"                                    // 声明特定语言下的配置在$config.currency
 *      }
 *   )
 * 
 * @param {*} fn 
 * @param {*} options               配置参数
 * @param {*} defaultParams         可选默认值
 * @returns 
 */


export interface CreateFilterOptions {
    normalize?: (value: string) => any          // 对输入值进行规范化处理，如进行时间过滤器时，为了提高更好的兼容性，支持数字时间戳/字符串/Date等，需要对输入值进行处理，如强制类型转换等
    params?: Record<string, any> | null,        // 可选的，声明参数顺序，如果是变参的，则需要传入null
    contextKey?: string                          // 声明该过滤器的参数在context中的路径，支持简单的使用.的路径语法
}

// export function createFilter<Value=any,Args extends any[] = any[]>(fn: FlexFilter, options?: CreateFilterOptions, defaultParams?: Record<string, any>) {
//     let opts = assignObject({
//         normalize: null,                // 对输入值进行规范化处理，如进行时间过滤器时，为了提高更好的兼容性，支持数字时间戳/字符串/Date等，需要对输入值进行处理，如强制类型转换等
//         params: null,                   // 可选的，声明参数顺序，如果是变参的，则需要传入null
//         configKey: null                 // 声明该过滤器在config中的路径，支持简单的使用.的路径语法
//     }, options)

//     // 最后一个参数是传入activeFormatterConfig参数
//     // 并且过滤器的this指向的是activeFormatterConfig
//     const $filter = function (this: any, value: Value, args: Args,config:Record<string,any>):string {
//         let finalValue = value
//         // 1. 输入值规范处理，主要是进行类型转换，确保输入的数据类型及相关格式的正确性，提高数据容错性
//         if (isFunction(opts.normalize)) {
//             try {finalValue = opts.normalize(finalValue)} catch { }
//         }
//         // 2. 读取activeFormatterConfig
//         // 3. 从当前语言的激活语言中读取配置参数
//         const formatterConfig = assignObject({}, defaultParams, getByPath(config, opts.configKey, { defaultValue: {} }))
//         let finalArgs
//         if (opts.params == null) {// 如果过滤器支持变参，则需要指定params=null
//             finalArgs = args
//         } else {  // 具有固定的参数个数
//             finalArgs = opts.params.map((param: string) => {
//                 let paramValue = getByPath(formatterConfig, param, undefined)
//                 return isFunction(paramValue) ? paramValue(finalValue) : paramValue
//             })
//             // 4. 将翻译函数执行过滤器时传入的参数覆盖默认参数     
//             for (let i = 0; i < finalArgs.length; i++) {
//                 if (args[i] !== undefined) finalArgs[i] = args[i]
//             }
//         }
//         return fn.call(this, finalValue, finalArgs, formatterConfig)
//     }
//     $filter.name= options?.configKey
//     $filter.configurable = true
//     return $filter
// }

// /**
//  * 创建支持弹性参数的过滤器
//  * 弹性参数指的是该格式式化器支持两种传参数形式:
//  * - 位置参数： { value | format(a,b,c,d,e) }
//  * - 对象参数： { value | format({a,b,c,e}) }
//  * 
//  *  弹性参数的目的是只需要位置参数中的第N参数时，简化传参
//  *  例： 
//  *  上例中，我们只需要传入e参数，则不得不使用{ value | format(,,,,e) }
//  *  弹性参数允许使用 { value | format({e:<value>}) }       
//  *  
//  *  请参阅currencyFormatter用法
//  *  
//  * @param {*} fn 
//  * @param {*} options 
//  * @param {*} defaultParams 
//  */
// export const createFlexFilter = function<Value=any,Args extends any[]=any[]>(fn: VoerkaI18nFormatter, options: CreateFilterOptions, defaultParams?: Record<string, any>) {
//     const opts = assignObject({
//         params: {}
//     }, options)
//     const $flexFormatter = Formatter<Value,Args>(function (this: any, value: any,args,config:Record<string,any> ) {
//         // 2. 从语言配置中读取默认参数
//         let finalArgs = (options.params || {}).reduce((r: Record<string, any>, name: string) => {
//             r[name] = config[name] == undefined ? (defaultParams || {})[name] : config[name]
//             return r
//         }, {})
//         // 3. 从过滤器中传入的参数具有最高优先级，覆盖默认参数
//         if (args.length == 1 && isPlainObject(args[0])) {       // 一个参数且是{}
//             Object.assign(finalArgs, args[0]) // { format: "custom" },
//         } else {   // 位置参数,如果是空则代表
//             for (let i = 0; i < args.length ; i++) {
//                 if (args[i] !== undefined) finalArgs[opts.params[i]] = args[i]
//             }
//         }
//         return fn.call(this, value, finalArgs, config)
//     }, { ...options, params: null })  // 变参工式化器需要指定params=null
//     return $flexFormatter
// }


// export const Filter = createFilter
// export const FlexFilter = createFlexFilter

