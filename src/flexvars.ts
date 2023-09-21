import { assignObject } from "flex-tools/object/assignObject";
import { isPlainObject } from "flex-tools/typecheck/isPlainObject";
import { FilexFilterErrorBehavior, FilterDefine, FlexFilter } from "./filter";
import {executeFilter,forEachInterpolatedVars,hasInterpolation} from "./parser";
 

export interface FlexVarsOptions {
	debug?: boolean; // 是否启用调试模式,启用后会在控制台输出调试信息
	filters?: Record<string, FlexFilter | FilterDefine>; // 过滤器定义
	getFilter?(name: string): FlexFilter | undefined; // 返回指定名称的过滤器
	onError?(error: Error, value: any): FilexFilterErrorBehavior | any; // 当过滤器执行出错时调用,如果返回true则忽略错误，否则抛出异常
	context?: Record<string, any>; // 上下文对象,用于在过滤器中共享数据
	log?(message, ...args: any[]): void; // 日志输出函数
    // 当没有对应的插值变量为空时，如何处理?
    // default: 使用空字符代表
    // ignore: 忽略，输出原始{}
    // (name)=>any  自定义函数的返回值替代
    missing?: 'default' | 'ignore' |  ((nameOrIndex:string|number)=>any) 
}

export class FlexVars {
	options: Required<FlexVarsOptions> & {
		filters: Record<string, FlexFilter>;
	};
	private _beforeFilters: Record<string, FlexFilter> = {};
	private _afterFilters: Record<string, FlexFilter> = {};
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
		this.addPresetFilters();
		this.handleFilters();
	}
    get beforeFilters(){return this._beforeFilters};
	get afterFilters(){ return this._afterFilters};
    get context(){return this.options.context}
    getFilter(name: string): FlexFilter | undefined {
        if(name in this.options.filters){
            return (this.options.filters[name] as Function).call(this,name)
        }else{
            return this.options.getFilter(name)
        }
    }
	private addPresetFilters() {}
	/**
	 * 预处理过滤器
	 *
	 * @remarks
	 *
	 * 将过滤器中的use参数指定的beforeFilters和afterFilters保存起来，方便后续执行
	 *
	 */
	private handleFilters() {
		Object.entries(this.options.filters).forEach(([name, filterDefine]) => {
			if (typeof filterDefine !== "function") {
				const fdefine = filterDefine as FilterDefine;
				if (typeof fdefine.filter == "function") {
					if (fdefine.use == "before") {
						this._beforeFilters[name] = fdefine.filter;
					} else if (fdefine.use == "after") {
						this._afterFilters[name] = fdefine.filter;
					}
				}
			}
		});
	}

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
			return forEachInterpolatedVars(template,(varname: string, filters, match) => {
					let value = varname in varValues ? varValues[varname] : this.getMissingValue(varname,match);
                    if(typeof(value)=='function') value = value.call(this)
					return executeFilter.call(this, filters, value, template);
				}
			);
		} else {
			// ****************************位置插值****************************
			// 如果只有一个Array参数，则认为是位置变量列表，进行展开
			const params = args.length === 1 && Array.isArray(args[0]) ? [...args[0]] : args;            

			//if (params.length === 0) return template; // 没有变量则不需要进行插值处理，返回原字符串
			let i = 0;
			return forEachInterpolatedVars(template,(varname: string, filters, match) => {
                    let value = params.length > i ? (params[i++]) : this.getMissingValue(i,match)
                    if(typeof(value)=='function') value = value.call(this)
					return executeFilter.call(this,filters,value,template);
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
        this.options.log(message,...args)
    }
}
