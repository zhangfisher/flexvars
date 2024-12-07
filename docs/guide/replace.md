# 插值替换

## 创建实例 

`FlexVars`是一个类，可以通过`new`关键字创建实例。

```ts
import { FlexVars } from 'flexvars';
// 创建一个FlexVars实例
const flexvars = new FlexVars(options);
// Hello, FlexVars!
console.log(flexvars.replace('Hello, {name}!', { name: 'FlexVars' })) 

```

## 配置选项

`options`参数是一个可选参数，用于配置实例的行为, 完整的配置项如下：

```ts
export interface FlexVarsOptions {
    // 是否启用调试模式,启用后会在控制台输出调试信息
	debug?: boolean; 
	// 预定义的过滤器列表
    filters?: Record<string, FlexFilter | FlexFilter['next'] >;                
    // 动态过滤器，当预定义的过滤器列表中没有找到对应的过滤器时，会调用此函数来获取过滤器
	getFilter?(this:FlexVars,name: string): FlexFilter | FlexFilter['next'] | null;                   
    // 可以指定日志输出函数
	log?(message:string, ...args: any[]): void;                                
    // 当没有对应的插值变量为空时，如何处理?
    // default: 使用空字符代表
    // ignore: 忽略，输出原始{}
    // (name)=>any  自定义函数的返回值替代
    missing?: 'default' | 'ignore' |  ((nameOrIndex:string|number)=>any) 
    // 用来保存配置数据,主要用于供过滤器使用，每一个过滤器均可以在配置中读取到配置
	config?: Record<string, any>; 
    // 当执行过滤器时出错时的处理函数
    onError?:FilterErrorHandler
    // 当过滤器执行返回空值时的处理函数
    onEmpty?:FilterEmptyHandler               
    // 判断一个值是否为空值的函数
    isEmpty?:(value:any)=>boolean;          
}
```
## 插值方法

对字符串执行插值操作，可以使用`FlexVars.replace`方法，返回处理后的字符串。

```ts
import { FlexVars } from 'flexvars';
const flexvars = new FlexVars();

// 参数与插值变量按顺序一一对应
flexvars.replace("Hello, {}{}{}", 1,2,3); // Hello, 123
// 当第一个参数是数组且只有一个参数时，数组的每一项与插值变量按顺序一一对应
flexvars.replace("Hello, {}{}{}",[1,2,3]); // Hello, 123
 
// I am fisher, I am 24 years old.
flexvars.replace("I am {name}, I am {age} years old.",{name:'fisher',age:24}); 
// 命名插值变量，也 可以使用字典传入变量值
flexvars.replace("I am {name}, I am {age} years old.",'fisher',24); 

``` 
