import { describe,beforeAll,test,beforeEach,expect} from "vitest"
import { FilterErrorBehavior, FlexVars } from '../flexvars';




describe("基本的变量插值功能", () => {
    let flexvars:FlexVars  
    beforeEach(() => {
        flexvars = new FlexVars()
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
    let flexvars:FlexVars  
    beforeEach(() => {
        flexvars = new FlexVars()
    })
    
    test("过滤器基础调用方式",()=>{
        const filter =flexvars.addFilter({
            name:"unit",
            args:["prefix","suffix","upper"],
            default:{prefix:"",suffix:"",upper:false},
            handle(value,args,context){
                if(args.upper) value = value.toUpperCase()
                return `${args.prefix}${value}${args.suffix}`
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


    test("过滤器连续调用",()=>{
        const filter =flexvars.addFilter({
            name:"add",
            args:["step"],
            default:{step:1},
            handle(value,args,context){
                return parseInt(value)+args.step
            }
        })
        expect(flexvars.replace("{|add}",0)).toBe("1")        
        expect(flexvars.replace("{|add|add}",0)).toBe("2")        
        expect(flexvars.replace("{|add|add|add}",0)).toBe("3")        
        expect(flexvars.replace("{|add(2)|add(2)|add(2)}",0)).toBe("6")
    })


    test("过滤器出错处理",()=>{
        class MyError extends Error{}
        const filter =flexvars.addFilter({
            name:"add",
            args:["step"],
            default:{step:1},
            handle(value,args,context){
                return parseInt(value)+args.step
            }
        })
        flexvars.addFilter({
            name:"throw",
            handle(value,args,context){
                throw new MyError("出错了")
            }
        })
        // 默认忽略错误
        expect(flexvars.replace("{|throw}",0)).toBe("0")        
        // 抛出错误
        flexvars.options.onError = ()=>FilterErrorBehavior.Throw 
        expect(()=>flexvars.replace("{|add|add|throw|add|add}",0)).toThrow(MyError)

        // 中止后续过滤器
        flexvars.options.onError = ()=>FilterErrorBehavior.Abort
        expect(flexvars.replace("{|add|add|throw|add|add}",0)).toBe("2")
        // 忽略或跳过出错的过滤器
        flexvars.options.onError = ()=>FilterErrorBehavior.Ignore
        expect(flexvars.replace("{|add|add|throw|add|add}",0)).toBe("4")


    })

        
        
})