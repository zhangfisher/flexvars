import { assignObject } from "flex-tools/object/assignObject";
import { isPlainObject } from "flex-tools/typecheck/isPlainObject";
import { executeFilters, forEachInterpolatedVars  } from './parser'; 
import { defaultEmptyFilter, defaultErrorFilter } from './filters';
import { FlexFilter,FilterBehaviors, FilterEmptyHandler, FilterErrorHandler } from "./types";


export interface FlexVarsOptions {
	debug?: boolean; // 是否启用调试模式,启用后会在控制台输出调试信息
	// 预定义的过滤器列表
    filters?: Record<string, FlexFilter | FlexFilter['next'] >;                
    // 动态过滤器，当预定义的过滤器列表中没有找到对应的过滤器时，会调用此函数来获取过滤器
	getFilter?(this:FlexVars,name: string): FlexFilter | FlexFilter['next'] | null;                   
	log?(message:string, ...args: any[]): void;                                // 日志输出函数
    // 当没有对应的插值变量为空时，如何处理?
    // default: 使用空字符代表
    // ignore: 忽略，输出原始{}
    // (name)=>any  自定义函数的返回值替代
    missing?: 'default' | 'ignore' |  ((nameOrIndex:string|number)=>any) 
    // 用来保存配置数据,主要用于供过滤器使用，每一个过滤器均可以在配置中读取到
	config?: Record<string, any>; 
    // 当执行过滤器时出错时的处理函数, BREAK:中止后续过滤器执行, THROW:抛出异常, IGNORE:忽略继续执行后续过滤器
    onError?:FilterErrorHandler
    // 当过滤器执行返回空值时的处理函数,空值是指null,undefined
    // 可以返回一个字符串用于替换空值，或者返回一个''表示空值
    onEmpty?:FilterEmptyHandler               
    // 判断一个值是否为空值的函数
    isEmpty?:(value:any)=>boolean;          
}

export type RequiredFlexVarsOptions = Omit<Required<FlexVarsOptions>,"filters"> & { filters: Record<string, FlexFilter<any>> };


export class FlexVars {
	options: RequiredFlexVarsOptions;
	constructor(options?: FlexVarsOptions) {
		this.options = assignObject(
			{
				log: console.log,
				filters: {},
                missing:'default',
                config:{}
			},
			options
		);
        this.addDefaultHandlers()
		this.addBuildinFilters();	
        this.normalizeFilters();        	
	}
    get filters(){return this.options.filters}

    /**
     * 增加默认的处理函数
     */
    private addDefaultHandlers(){
        this.options.onError = (error,value,args,context)=>FilterBehaviors.Ignore
        this.options.onEmpty = (value,args,context)=>''
        this.options.isEmpty = (value)=>value===null  || value ===''
    }
    /**
     * 增加一个过滤器
     * @param filter   过滤器声明数据
     */
    addFilter<Args extends Record<string,any>>(filter:FlexFilter<Args>){
        if(!filter.name) throw new Error("Filter name cannot be empty")
        if(typeof(filter.next)!=="function")  throw new Error("The filter must provide a next function")
        filter = assignObject({            
            priority:'normal' 
        },filter)
        return this.filters[filter.name!]= filter as FlexFilter<Args>
    }
    /**
     * 移除过滤器
     * @param name 
     */
    removeFilter(name:string){    
        delete this.filters[name] 
    }
    getFilter<Args extends Record<string,any>>(name: string): FlexFilter<Args> | null {
        if(name in this.options.filters){
            return this.options.filters[name]
        }else{
            let r =  this.options.getFilter?.call(this,name)
            if(typeof(r)=='function'){
                return {name,next:r}
            }else if(name in String.prototype){
                return {
                    name,
                    next:(value,args,context)=>{
                        return (value as any)[name](...context.args)
                    }
                }
            }else{
                return r as FlexFilter<Args>
            }
        }
    }
    /**
     * 新增内置过滤器
     */
	private addBuildinFilters() {
        this.addFilter(defaultErrorFilter)
        this.addFilter(defaultEmptyFilter)        
    } 
	/**
	 * 对传入过滤器进行规范化处理
	 *
	 * @remarks
	 *
	 *
	 */
	private normalizeFilters() {
		Object.entries(this.options.filters).forEach(([name, filter]) => {
            let normalizedFilter= assignObject({                
                name,
                priority: 'normal',
                args:null,
                next: (value:any) => value
            },typeof(filter)=='function' ? {filter} : filter) as FlexFilter
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
			return forEachInterpolatedVars.call(this,template,(name: string, prefix, suffix, filters, match) => {
					let value = name in varValues ? varValues[name] : this.getMissingValue(name,match);
                    if(typeof(value)=='function') value = value.call(this)
					return executeFilters.call(this, filters,{name,value,prefix, suffix,template,match});
				}
			);
		} else {
			// ****************************位置插值****************************
			// 如果只有一个Array参数，则认为是位置变量列表，进行展开
			const params = args.length === 1 && Array.isArray(args[0]) ? [...args[0]] : args;                        
			//if (params.length === 0) return template; // 没有变量则不需要进行插值处理，返回原字符串
			let i = 0;
			return forEachInterpolatedVars.call(this,template,(name, prefix, suffix,filters, match) => {
                    let value = params.length > i ? (params[i++]) : this.getMissingValue(i,match)
                    if(typeof(value)=='function') value = value.call(this)     
					return executeFilters.call(this,filters,{name,value,prefix, suffix,template,match});
				},{ replaceAll: false }
			);
		}
	}
    /**
     * 打印日志
     * @param message 
     * @param args 
     */
    log(message:string, ...args: any[]): void {
        if(!this.options.debug) return
        this.options.log(message,...args)
    }
}

 