import { getByPath } from "flex-tools";
import { assignObject } from "flex-tools/object/assignObject";
import { isPlainObject } from "flex-tools/typecheck/isPlainObject";
import {  FlexFilter } from "./filter";
import { executeFilter, forEachInterpolatedVars, FlexFilterContext } from './parser'; 



// 当过滤器执行出错时的处理方式
export enum FilterErrorBehavior {
    Abort,Throw,Ignore
}
// 当过滤器返回空值时的出错方式
export enum FilterEmptyBehavior {
    Empty,              // 返回空字符串
    Ignore,             // 忽略，保持原始值
}

export interface FlexVarsOptions {
	debug?: boolean; // 是否启用调试模式,启用后会在控制台输出调试信息
	// 预定义的过滤器列表
    filters?: Record<string, FlexFilter | FlexFilter['handle'] >;                
    // 动态过滤器，当预定义的过滤器列表中没有找到对应的过滤器时，会调用此函数来获取过滤器
	getFilter?(name: string,context:FlexFilterContext): FlexFilter['handle'] | undefined;                   
	log?(message, ...args: any[]): void;                                // 日志输出函数
    // 当没有对应的插值变量为空时，如何处理?
    // default: 使用空字符代表
    // ignore: 忽略，输出原始{}
    // (name)=>any  自定义函数的返回值替代
    missing?: 'default' | 'ignore' |  ((nameOrIndex:string|number)=>any) 
    // 用来保存配置数据,主要用于供过滤器使用，每一个过滤器均可以在配置中读取到
	config?: Record<string, any>; 
    // 当执行过滤器时出错时的处理函数, BREAK:中止后续过滤器执行, THROW:抛出异常, IGNORE:忽略继续执行后续过滤器
    onError:(this:FlexVars,error:Error,value:any,args:any[],context:FlexFilterContext)=>FilterErrorBehavior | string;     
    // 当过滤器执行返回空值时的处理函数,空值是指null,undefined
    // 可以返回一个字符串用于替换空值，或者返回一个''表示空值
    onEmpty:(this:FlexVars,value:any,args:any[],context:FlexFilterContext)=>FilterEmptyBehavior | string               
    // 判断一个值是否为空值的函数
    isEmpty:(value:any)=>boolean;                                      
}

export type RequiredFlexVarsOptions = Omit<Required<FlexVarsOptions>,"filters"> & { filters: Record<string, FlexFilter> };


export class FlexVars {
	options: RequiredFlexVarsOptions;
    private _commonFilters:{before:string[],after:string[],error:[],empty:[]} = {before:[],after:[],error:[],empty:[]}         // 特定用途的过滤器列表
	constructor(options?: FlexVarsOptions) {
		this.options = assignObject(
			{
				log: console.log,
				getFilter: () => (value) => value,
				filters: {},
                missing:'default'
			},
			options
		);
        this.addDefaultHandlers()
		this.normalizeFilters();
        this.addBuildinFilters();		
	}
    get filters(){return this.options.filters};
    get commonFilters(){return this._commonFilters};                 // 通用过滤器,用于执行过滤之前之后以及出错时执行的过滤器
    get context(){return this.options.config}

    /**
     * 增加默认的处理函数
     */
    private addDefaultHandlers(){
        this.options.onError = (error,value,args,context)=>{
            return FilterErrorBehavior.Ignore
        }
        // 默认空值处理函数
        this.options.onEmpty = (value,args,context)=>{
            return  ''
        }
        this.options.isEmpty = (value)=>value===null  
    }
    /**
     * 增加一个过滤器
     * @param define 
     */
    addFilter(filter:FlexFilter){
        if(!filter.name) throw new Error("")
        if(typeof(filter.handle)!=="function")  throw new Error()
        this.filters[filter.name]= filter
    }

    removeFilter(){    

    }
    getFilter(name: string,context:FlexFilterContext): FlexFilter['handle'] | undefined {
        if(name in this.options.filters){
            return this.options.filters[name].handle
        }else{
            return this.options.getFilter(name,context)
        }
    }

	private addBuildinFilters() {
        
    }

    private buildFilterContext({name,value,template,match}):FlexFilterContext{
        if(name in this.filters){
            const filter = this.filters[name]
            return {
                name,value,template,match,
                config: filter.configKey ?  getByPath(this.options.config,filter.configKey) : this.options.config
            }
        }else{
            return undefined
        }
    }
	/**
	 * 对传入过滤器进行规范化处理
	 *
	 * @remarks
	 *
	 * 将过滤器中的use参数指定的beforeFilters和afterFilters保存起来，方便后续执行
	 *
	 */
	private normalizeFilters() {
		Object.entries(this.options.filters).forEach(([name, filter]) => {
            let normalizedFilter= assignObject({                
                name,
                type: 'default',
                args:null,
                filter: (value) => value
            },typeof(filter)=='function' ? {filter} : filter) as FlexFilter                  

            if(["before",'after'].includes(filter.type!)){
                this._commonFilters[filter.type!].push(name)
            }
            this.options.filters[name] = normalizedFilter
		});
	}
    /**
     * 
     * 获取缺失的插值变量的值
     * 
     * @param nameOrIndex 
     * @param match  原始模板字符串中的插值变量模板，如"I am {name}"中的{name}
     * @returns 
     */
    private getMissingValue(nameOrIndex:string|number,match:string){
        let missing =this.options.missing
        if(missing=='default'){
            return ''
        }else if(missing=='ignore'){
            return match
        }else if(typeof(missing)=='function'){
            return missing.call(this,nameOrIndex)
        }
    }
	/**
	 * 执行字符串插值替换
	 *
	 * @remarks
	 *
	 * const flexvars = new FlexVars({})
	 * flexvars.replace("I am { value | upper }",{value:"hello"}) --> "I am HELLO" 
	 */
	replace(template: string, ...args: any[]) {
        if(args.length === 1 && typeof(args[0])=='function') args[0] = args[0].call(this)
		// ****************************变量插值****************************
		if (args.length === 1 && isPlainObject(args[0])) {
			// 读取模板字符串中的插值变量列表
			// [[var1,[filter,filter,...],match],[var2,[filter,filter,...],match],...}
			let varValues = args[0];
			return forEachInterpolatedVars(template,(name: string, filters, match) => {
					let value = name in varValues ? varValues[name] : this.getMissingValue(name,match);
                    if(typeof(value)=='function') value = value.call(this)
                    if(filters.length==0) return value               
                    const filterContext =this.buildFilterContext({name,value,template,match})
					return executeFilter.call(this, filters,filterContext);
				}
			);
		} else {
			// ****************************位置插值****************************
			// 如果只有一个Array参数，则认为是位置变量列表，进行展开
			const params = args.length === 1 && Array.isArray(args[0]) ? [...args[0]] : args;            

			//if (params.length === 0) return template; // 没有变量则不需要进行插值处理，返回原字符串
			let i = 0;
			return forEachInterpolatedVars(template,(name, filters, match) => {
                    let value = params.length > i ? (params[i++]) : this.getMissingValue(i,match)
                    if(typeof(value)=='function') value = value.call(this)     
                    if(filters.length==0) return value               
                    const filterContext =this.buildFilterContext({name,value,template,match})
					return executeFilter.call(this,filters,filterContext);
				},{ replaceAll: false }
			);
		}
	}
    /**
     * 打印日志
     * @param message 
     * @param args 
     */
    log(message, ...args: any[]): void {
        if(!this.options.debug) return
        this.options.log(message,...args)
    }
}
