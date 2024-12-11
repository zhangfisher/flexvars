import { describe,test,beforeEach,expect,vi} from "vitest"
import {  FlexVars } from '../flexvars';
import { FlexFilterEmptyError, FlexFilterAbortError, FlexFilterIgnoreError } from '../errors';
import { FilterBehaviors, FlexFilter, FlexFilterContext } from '../types';
import { assignObject } from "flex-tools/object/assignObject";


const AddFilter = {
    name:"add",
    args:["step"],
    default:{step:1},
    next(value,args,context){
        return parseInt(value)+args.step
    }
} 
// 返回空值的过滤器
const NullFilter =  {
    name:"null",
    next(value:any,args:Record<string,any>,context:FlexFilterContext){
        return null!        // 虽然类型约束为null，但是实际上返回的是undefined
    }        
}

describe("基本的变量插值功能", () => {
    let flexvars:FlexVars  
    beforeEach(() => {
        flexvars = new FlexVars<{
            count:1
        }>()
    })

    test("位置变量插值", () => {        
        expect(flexvars.replace("I am {}","tom")).toBe("I am tom")
        expect(flexvars.replace("{}{}{}","a","b","c")).toBe("abc")
        expect(flexvars.replace("{}{}{}",["a","b","c"])).toBe("abc")
        expect(flexvars.replace("{}{}{}",()=>["a","b","c"])).toBe("abc")
        expect(flexvars.replace("{x}{y}{z}","a","b","c")).toBe("abc")
        expect(flexvars.replace("{x}{y}{z}",["a","b","c"])).toBe("abc")
        expect(flexvars.replace("{}{}",()=>["a","b","c"])).toBe("ab") 
    })

    
    test("指定前缀和后缀", () => {         
        // 如果为空值时，不会显示前缀和后缀
        expect(flexvars.replace("I am {( name )}")).toBe("I am ")
        expect(flexvars.replace("I am {(  )}","tom")).toBe("I am (tom)")
        expect(flexvars.replace("I am {( name )}","tom")).toBe("I am (tom)")        
        expect(flexvars.replace("{, }{, }{, }","a","b","c")).toBe(",a,b,c")
        expect(flexvars.replace("{, }{, }{, }","a","b","c")).toBe(",a,b,c")
    })


    test("位置变量插值丢失变量时的处理", () => {       
        // 默认显示为空
        flexvars.options.missing ='default'
        expect(flexvars.replace("I am {}")).toBe("I am ")
        expect(flexvars.replace("{}{}{}","a","b")).toBe("ab")
        expect(flexvars.replace("{}{}{}",["a"])).toBe("a")

        flexvars.options.missing='ignore'
        expect(flexvars.replace("I am {}")).toBe("I am {}")
        expect(flexvars.replace("{}{}{}","a","b")).toBe("ab{}")
        expect(flexvars.replace("{}{}{}",["a"])).toBe("a{}{}")

        flexvars.options.missing=()=>'*'
        expect(flexvars.replace("I am {}")).toBe("I am *")
        expect(flexvars.replace("{}{}{}","a","b")).toBe("ab*")
        expect(flexvars.replace("{}{}{}",["a"])).toBe("a**")

    })

    test("字典变量插值", () => {        
        // 默认显示为空
        flexvars.options.missing ='default'
        expect(flexvars.replace("I am {name}")).toBe("I am ") 
        expect(flexvars.replace("{x}{y}{z}",{x:"a",y:"b"})).toBe("ab")
        expect(flexvars.replace("{x}{y}{z}",{x:"a"})).toBe("a")
        expect(flexvars.replace("{x}{y}{z}")).toBe("")

        flexvars.options.missing='ignore'
        expect(flexvars.replace("I am {name}")).toBe("I am {name}") 
        expect(flexvars.replace("{x}{y}{z}",{x:"a",y:"b"})).toBe("ab{z}")
        expect(flexvars.replace("{x}{y}{z}",{x:"a"})).toBe("a{y}{z}")
        expect(flexvars.replace("{x}{y}{z}")).toBe("{x}{y}{z}")

        flexvars.options.missing=()=>'*'
        expect(flexvars.replace("I am {name}")).toBe("I am *") 
        expect(flexvars.replace("{x}{y}{z}",{x:"a",y:"b"})).toBe("ab*")
        expect(flexvars.replace("{x}{y}{z}",{x:"a"})).toBe("a**")
        expect(flexvars.replace("{x}{y}{z}")).toBe("***")
    })

    test("多个同名字典变量插值", () => {        
        // 默认显示为空
        flexvars.options.missing ='default'
        expect(flexvars.replace("{x}{y}{z}{x}{y}{z}",{x:"a",y:"b"})).toBe("abab")
        expect(flexvars.replace("{x}{y}{z}{x}{y}{z}",{x:"a"})).toBe("aa")
        expect(flexvars.replace("{x}{y}{z}{x}{y}{z}")).toBe("")

        flexvars.options.missing='ignore'
        expect(flexvars.replace("{x}{y}{z}{x}{y}{z}",{x:"a",y:"b"})).toBe("ab{z}ab{z}")
        expect(flexvars.replace("{x}{y}{z}{x}{y}{z}",{x:"a"})).toBe("a{y}{z}a{y}{z}")
        expect(flexvars.replace("{x}{y}{z}{x}{y}{z}")).toBe("{x}{y}{z}{x}{y}{z}")

        flexvars.options.missing=()=>'*'
        expect(flexvars.replace("{x}{y}{z}{x}{y}{z}",{x:"a",y:"b"})).toBe("ab*ab*")
        expect(flexvars.replace("{x}{y}{z}{x}{y}{z}",{x:"a"})).toBe("a**a**")
        expect(flexvars.replace("{x}{y}{z}{x}{y}{z}")).toBe("******")
    })
})


describe("过滤器", () => {
    let flexvars:FlexVars<{
        count:number
    }>
    beforeEach(() => {
        flexvars = new FlexVars<{
            count:number
        }>()
    })
    
    test("过滤器基础调用方式",()=>{
        const filter =flexvars.addFilter({
            name:"unit",
            args:["prefix","suffix","upper"],
            default:{prefix:"",suffix:"",upper:false},
            next(value,args,context){
                if(args.upper) value = value.toUpperCase()
                return `${args.prefix}${value}${args.suffix}`
                context.count
            }
        })
        // 不传参
        expect(flexvars.replace("I am { name | unit}",{name:"fisher"})).toBe("I am fisher")        
        // 字典传参给过滤器
        expect(flexvars.replace("I am { name | unit({prefix:'$',suffix:'元'})}",{name:"fisher"})).toBe("I am $fisher元")
        expect(flexvars.replace("I am { name | unit({prefix:'$',suffix:'元',upper:true})}",{name:"fisher"})).toBe("I am $FISHER元")
        // 位置传参给过滤器
        expect(flexvars.replace("I am { name | unit('$')}",{name:"fisher"})).toBe("I am $fisher")
        expect(flexvars.replace("I am { name | unit('$','元')}",{name:"fisher"})).toBe("I am $fisher元")
        expect(flexvars.replace("I am { name | unit('$','元',true)}",{name:"fisher"})).toBe("I am $FISHER元")
        expect(flexvars.replace("I am { name | unit('$',,true)}",{name:"fisher"})).toBe("I am $FISHER")

        // *** 以下无变量名称，只能采用位置传参方式传入
        // 不传参
        expect(flexvars.replace("I am { | unit}","fisher")).toBe("I am fisher")        
        // 字典传参给过滤器
        expect(flexvars.replace("I am { | unit({prefix:'$',suffix:'元'})}","fisher")).toBe("I am $fisher元")
        expect(flexvars.replace("I am { | unit({prefix:'$',suffix:'元',upper:true})}","fisher")).toBe("I am $FISHER元")
        // 位置传参给过滤器
        expect(flexvars.replace("I am { | unit('$')}","fisher")).toBe("I am $fisher")
        expect(flexvars.replace("I am { | unit('$','元')}","fisher")).toBe("I am $fisher元")
        expect(flexvars.replace("I am { | unit('$','元',true)}","fisher")).toBe("I am $FISHER元")
        expect(flexvars.replace("I am { | unit('$',,true)}","fisher")).toBe("I am $FISHER")



    })    


    test("过滤器链式调用",()=>{
        const filter =flexvars.addFilter(AddFilter)
        expect(flexvars.replace("{|add}",0)).toBe("1")        
        expect(flexvars.replace("{|add|add}",0)).toBe("2")        
        expect(flexvars.replace("{|add|add|add}",0)).toBe("3")        
        expect(flexvars.replace("{|add(2)|add(2)|add(2)}",0)).toBe("6")
    })


    test("过滤器默认出错处理",()=>{
        class MyError extends Error{}
        const filter =flexvars.addFilter(AddFilter)
        flexvars.addFilter({
            name:"throw",
            next(value,args,context){
                throw new MyError("出错了")
            }
        })
        // 默认忽略错误
        expect(flexvars.replace("{|throw}",0)).toBe("0")    
        expect(flexvars.replace("{|add|add|throw|add|add}",0)).toBe("4")
    
        // 抛出错误
        flexvars.options.onError = ()=>FilterBehaviors.Throw 
        expect(()=>flexvars.replace("{|add|add|throw|add|add}",0)).toThrow(MyError)

        // 中止后续过滤器
        flexvars.options.onError = ()=>FilterBehaviors.Abort
        expect(flexvars.replace("{|add|add|throw|add|add}",0)).toBe("2")
        // 忽略或跳过出错的过滤器
        flexvars.options.onError = ()=>FilterBehaviors.Ignore
        expect(flexvars.replace("{|add|add|throw|add|add}",0)).toBe("4") 
    })
    test("过滤器出错时使用指定值替换并中止",()=>{
        class MyError extends Error{}
        const filter =flexvars.addFilter(AddFilter)
        flexvars.addFilter({
            name:"throw",
            next(value,args,context){
                throw new MyError("出错了")
            }
        })
        // 默认忽略错误
        flexvars.options.onError = ()=>"8"
        expect(flexvars.replace("{|add|add|throw|add|add}",0)).toBe("8") 
    })

    test("过滤器默认出错处理时返回值",()=>{
        class MyError extends Error{}
        const filter =flexvars.addFilter(AddFilter)
        flexvars.addFilter({
            name:"throw",
            next(value,args,context){
                throw new MyError("出错了")
            }
        })       

        // 返回个默认值
        flexvars.options.onError = ()=>{
            return "999"
        }
        expect(flexvars.replace("{|add|add|throw|add}",0)).toBe("999")

        flexvars.options.onError = ()=>{
            throw new FlexFilterIgnoreError("999")
        }
        expect(flexvars.replace("{|add|add|throw|add}",0)).toBe("1000")

        flexvars.options.onError = ()=>{
            throw new FlexFilterAbortError("999")
        }
        expect(flexvars.replace("{|add|add|throw|add}",0)).toBe("999") 
 
    })

    test("过滤器指定出错处理逻辑",()=>{
        class MyError extends Error{}
        let fn = vi.fn()
        flexvars.options.onError = ()=>{
            fn()
            return FilterBehaviors.Ignore
        }
        const addFilter = flexvars.addFilter(AddFilter)      
        const throwFilter = flexvars.addFilter({
            name:"throw",
            next(value,args,context){
                throw new MyError("出错了")
            }
        })
        throwFilter.onError = ()=>FilterBehaviors.Ignore
        expect(flexvars.replace("{|throw}",0)).toBe("0")        
        throwFilter.onError = ()=>FilterBehaviors.Abort
        expect(flexvars.replace("{|add|add|throw|add|add}",0)).toBe("2")        
        throwFilter.onError = ()=>FilterBehaviors.Throw
        expect(()=>flexvars.replace("{|add|add|throw|add|add}",0)).toThrow(MyError)
        // 返回空值，然后中止后续过滤器
        throwFilter.onError = ()=>"(空)"
        expect(flexvars.replace("{|add|add|throw|add|add}",0)).toBe("(空)")        

        expect(fn).not.toBeCalled()
        throwFilter.onError = undefined
        expect(flexvars.replace("{|throw}",0)).toBe("0")   
        expect(fn).toBeCalled()
    })



    test("在过滤器调用时指定出错逻辑",()=>{
        class MyError extends Error{}
        let fn = vi.fn()
        flexvars.options.onError = ()=>{
            fn()
            return FilterBehaviors.Ignore
        }        
        const addFilter = flexvars.addFilter(AddFilter)              
        let throwErrFn = vi.fn()
        const throwFilter = flexvars.addFilter({
            name:"throw",
            next(value,args,context){
                throw new MyError("出错了")
            },
            onError: ()=>{
                throwErrFn()
                return FilterBehaviors.Ignore
            }        
        })
        // error过滤器的出错逻辑优先级高于全局出错逻辑
        // 默认忽略错误
        expect(flexvars.replace("{|error|add|add|throw|add|add}",0)).toBe("4")        
        expect(flexvars.replace("{|add|error|add|throw|add|add}",0)).toBe("4")        
        expect(flexvars.replace("{|add|add|error|throw|add|add}",0)).toBe("4")        
        expect(flexvars.replace("{|add|add|throw|error|add|add}",0)).toBe("4")        
        expect(flexvars.replace("{|add|add|throw|add|error|add}",0)).toBe("4")        
        expect(flexvars.replace("{|add|add|throw|add|add|error}",0)).toBe("4")        
        // 指定abort参数
        expect(flexvars.replace("{|error('abort')|add|add|throw|add|add}",0)).toBe("2")        
        expect(flexvars.replace("{|add|error('abort')|add|throw|add|add}",0)).toBe("2")        
        expect(flexvars.replace("{|add|add|error('abort')|throw|add|add}",0)).toBe("2")        
        expect(flexvars.replace("{|add|add|throw|error('abort')|add|add}",0)).toBe("2")        
        expect(flexvars.replace("{|add|add|throw|add|error('abort')|add}",0)).toBe("2")        
        expect(flexvars.replace("{|add|add|throw|add|add|error('abort')}",0)).toBe("2")     
        // 指定throw参数
        expect(()=>flexvars.replace("{|error('throw')|add|add|throw|add|add}",0)).toThrow(MyError)      
        expect(()=>flexvars.replace("{|add|error('throw')|add|throw|add|add}",0)).toThrow(MyError)
        expect(()=>flexvars.replace("{|add|add|error('throw')|throw|add|add}",0)).toThrow(MyError)
        expect(()=>flexvars.replace("{|add|add|throw|error('throw')|add|add}",0)).toThrow(MyError)
        expect(()=>flexvars.replace("{|add|add|throw|add|error('throw')|add}",0)).toThrow(MyError)
        expect(()=>flexvars.replace("{|add|add|throw|add|add|error('throw')}",0)).toThrow(MyError)
        expect(fn).not.toBeCalled()
        expect(throwErrFn).not.toBeCalled()        
    })

    test("默认空值处理",()=>{
        const addFilter = flexvars.addFilter(AddFilter)              
        const nullFilter = flexvars.addFilter(NullFilter)              
        
        // 默认返回空字符串并中止后续过滤器的执行
        expect(flexvars.replace("X{|null}",0)).toBe("X")
        expect(flexvars.replace("X{add|null|add}",0)).toBe("X")
        expect(flexvars.replace("X{add|add|null|add}",0)).toBe("X")
        // 忽略空值，继续执行后续过滤器
        flexvars.options.onEmpty = ()=>FilterBehaviors.Ignore
        expect(flexvars.replace("X{|null}",0)).toBe("X0")
        expect(flexvars.replace("X{|add|null|add}",0)).toBe("X2")
        expect(flexvars.replace("X{|add|add|null|add}",0)).toBe("X3")

        //中止后续过滤器
        flexvars.options.onEmpty = ()=>FilterBehaviors.Abort
        expect(flexvars.replace("X{|null}",0)).toBe("X0")
        expect(flexvars.replace("X{|add|null|add}",0)).toBe("X1")
        expect(flexvars.replace("X{|add|add|null|add}",0)).toBe("X2")
      
        // 触发错误
        flexvars.options.onEmpty = ()=>FilterBehaviors.Throw
        expect(()=>flexvars.replace("X{|null}",0)).toThrow(FlexFilterEmptyError)
        expect(()=>flexvars.replace("X{|add|null|add}",0)).toThrow(FlexFilterEmptyError)
        expect(()=>flexvars.replace("X{|add|add|null|add}",0)).toThrow(FlexFilterEmptyError)

        // 使用指定值替换
        flexvars.options.onEmpty = ()=>"(空)"
        expect(flexvars.replace("X{|null}",0)).toBe("X(空)")
        expect(flexvars.replace("X{|add|null|add}",0)).toBe("X(空)")
        expect(flexvars.replace("X{|add|add|null|add}",0)).toBe("X(空)")


    })
    test("默认空值处理时指定返回值",()=>{ 
        const addFilter = flexvars.addFilter(AddFilter)              
        const nullFilter = flexvars.addFilter(NullFilter)  
        // 默认返回空字符串并中止后续过滤器的执行
        expect(flexvars.replace("X{|null}",0)).toBe("X")
        expect(flexvars.replace("X{add|null|add}",0)).toBe("X")
        expect(flexvars.replace("X{add|add|null|add}",0)).toBe("X")
        // 忽略空值，继续执行后续过滤器
        flexvars.options.onEmpty = ()=>FilterBehaviors.Ignore
        expect(flexvars.replace("X{|null}",0)).toBe("X0")
        expect(flexvars.replace("X{|add|null|add}",0)).toBe("X2")
        expect(flexvars.replace("X{|add|add|null|add}",0)).toBe("X3")

        //中止后续过滤器
        flexvars.options.onEmpty = ()=>FilterBehaviors.Abort
        expect(flexvars.replace("X{|null}",0)).toBe("X0")
        expect(flexvars.replace("X{|add|null|add}",0)).toBe("X1")
        expect(flexvars.replace("X{|add|add|null|add}",0)).toBe("X2")
      
        // 触发错误
        flexvars.options.onEmpty = ()=>FilterBehaviors.Throw
        expect(()=>flexvars.replace("X{|null}",0)).toThrow(FlexFilterEmptyError)
        expect(()=>flexvars.replace("X{|add|null|add}",0)).toThrow(FlexFilterEmptyError)
        expect(()=>flexvars.replace("X{|add|add|null|add}",0)).toThrow(FlexFilterEmptyError)

        // 使用指定值替换
        flexvars.options.onEmpty = ()=>"(空)"
        expect(flexvars.replace("X{|null}",0)).toBe("X(空)")
        expect(flexvars.replace("X{|add|null|add}",0)).toBe("X(空)")
        expect(flexvars.replace("X{|add|add|null|add}",0)).toBe("X(空)")
    })


    test("调用过滤器时传入空值处理",()=>{ 
        flexvars.addFilter(AddFilter)              
        flexvars.addFilter(NullFilter)   

        // empty放在任意位置均可以

        // // 默认是中止执行返回空字符串      
        expect(flexvars.replace("X{|null|empty}",0)).toBe("X")
        expect(flexvars.replace("X{|null|empty()}",0)).toBe("X")
        expect(flexvars.replace("X{|add|null|add|empty}",0)).toBe("X")
        expect(flexvars.replace("X{|add|empty|add|null|add}",0)).toBe("X")
        
        // // 默认是中止执行返回指定值     
        expect(flexvars.replace("X{|null|empty('空')}",0)).toBe("X空")
        expect(flexvars.replace("X{|null|empty('空')}",0)).toBe("X空")
        expect(flexvars.replace("X{|add|null|add|empty('空')}",0)).toBe("X空")
        expect(flexvars.replace("X{|add|empty('空')|add|null|add}",0)).toBe("X空")

        // // 中止执行并返回指定值
        expect(flexvars.replace("X{|null|empty('abort','*')}",0)).toBe("X*")
        expect(flexvars.replace("X{|null|empty('abort','*')}",0)).toBe("X*")
        expect(flexvars.replace("X{|add|null|add|empty('abort','*')}",0)).toBe("X*")
        expect(flexvars.replace("X{|add|empty('abort','*')|add|null|add}",0)).toBe("X*")

        
        // 忽略空值，跳过执行后续过滤器
        expect(flexvars.replace("X{|null|empty('ignore')}",0)).toBe("X0")
        expect(flexvars.replace("X{|add|null|add|empty('ignore')}",0)).toBe("X2")
        expect(flexvars.replace("X{|add|empty('ignore')|add|null|add}",0)).toBe("X3")
        // empty=ignore时,第二个参数*无效
        expect(flexvars.replace("X{|null|empty('ignore','*')}",0)).toBe("X0")
        expect(flexvars.replace("X{|add|null|add|empty('ignore','*')}",0)).toBe("X2")
        expect(flexvars.replace("X{|add|empty('ignore','*')|add|null|add}",0)).toBe("X3")

        // 触发错误，当检测到空值时，抛出异常
        expect(()=>flexvars.replace("X{|null|empty('throw')}",0)).toThrow(FlexFilterEmptyError)
        expect(()=>flexvars.replace("X{|null|empty('throw')}",0)).toThrow(FlexFilterEmptyError)
        expect(()=>flexvars.replace("X{|add|null|add|empty('throw')}",0)).toThrow(FlexFilterEmptyError)
        expect(()=>flexvars.replace("X{|add|empty('throw')|add|null|add}",0)).toThrow(FlexFilterEmptyError)

    })

    
    test("过滤器执行后配套指定前缀和后缀", () => {         
        flexvars.addFilter(AddFilter)              
        flexvars.addFilter(NullFilter)   

        // 如果为空值时，不会显示前缀和后缀
        expect(flexvars.replace("X{, |null|empty}",0)).toBe("X")
        expect(flexvars.replace("X{|null|empty() ,}",0)).toBe("X")
        expect(flexvars.replace("X{, |add|null|add|empty}",0)).toBe("X")
        expect(flexvars.replace("X{$: |add|empty|add|null|add}",0)).toBe("X")
        
        // // 默认是中止执行返回指定值     
        expect(flexvars.replace("X{: |null|empty('空')}",0)).toBe("X:空")
        expect(flexvars.replace("X{: |null|empty('空')}",0)).toBe("X:空")
        expect(flexvars.replace("X{=( |add|null|add|empty('空') )}",0)).toBe("X=(空)")
        expect(flexvars.replace("X{=( |add|empty('空')|add|null|add )}",0)).toBe("X=(空)")
    })

    test("获取动态过滤器", () => {         
        const fn = vi.fn()
        flexvars.options.getFilter = function(name:string){
            expect(this).toBeInstanceOf(FlexVars)
            fn()
            return (value:any)=>value
        }
        expect(flexvars.replace("{value|add|dec}",{value:"fisher"})).toBe("fisher")
        expect(fn).toBeCalled()
        expect(fn).toBeCalledTimes(2)
        flexvars.replace("我每月收入{value 元}",0)

    })
    test("可配置过滤器示例", () => {      
        flexvars.options.config.currency={
            prefix:"RMB",
            sign:"￥",
            suffix:"元"  
        }
        flexvars.addFilter({
            name:"currency",
            args:["prefix","suffix","sign"],    
            // 指定该过滤器的配置数据在config的路径
            configKey:"currency",            
            next(value:any,args,context){
                // 获取配置数据
                const cfgs = context.getConfig() 
                // 优先使用参数值，其次使用配置值
                args = assignObject(cfgs,args)
                return `${args.prefix}${args.sign}${value}${args.suffix}`
            }
        })
        expect(flexvars.replace("{ value | currency}",100)).toBe("RMB￥100元")
        // 传入参数值，优先级更高
        expect(flexvars.replace("{ value | currency('人民币')}",100)).toBe("人民币￥100元")
        flexvars.options.config.currency={
            prefix:"USD",
            sign:"$",
            suffix:""  
        }
        expect(flexvars.replace("{ value | currency}",100)).toBe("USD$100")

    })
    test("调用原型方法进行过滤", () => {      
        expect(flexvars.replace("{ | toUpperCase }","flexvars")).toBe("FLEXVARS")
        expect(flexvars.replace("{ | toLowerCase }","flexvars")).toBe("flexvars")
        expect(flexvars.replace("{ | slice(4) | toUpperCase  }","flexvars")).toBe("VARS")
    })
})
 

