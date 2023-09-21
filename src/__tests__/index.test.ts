import { describe,beforeAll,test,beforeEach,expect} from "vitest"
import { FlexVars } from '../flexvars';




describe("基本的变量插值功能", () => {
    let flexvars:FlexVars = new FlexVars({

    })
    beforeEach(() => {
        flexvars = new FlexVars({
        })
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
        expect(flexvars.replace("I am {name}",{name:"tom"})).toBe("I am tom") 
        expect(flexvars.replace("{x}{y}{z}",{x:"a",y:"b",z:"c"})).toBe("abc")
        expect(flexvars.replace("{x}{y}{z}",{x:"a",y:"b"})).toBe("ab")
        expect(flexvars.replace("{x}{y}{z}",{x:"a"})).toBe("a")
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
})