# Get started

## Install


<!-- tabs:start -->

#### **pnpm**


```bash
pnpm add flexvars 
```

#### **yarn**


```bash 
yarn add flexvars 
```

#### **npm**


```bash 
npm install flexvars
```

<!-- tabs:end -->

## Initial


```ts
import { FlexVars } from 'flexvars';

// 创建一个FlexVars实例
const flexvars = new FlexVars();

// Hello, FlexVars!
console.log(flexvars.replace('Hello, {name}!', { name: 'FlexVars' })) 

```

## Use filter

The filter uses a pipeline like approach to chain process variable values.


```ts
flexvars.addFilter({
    name:"add",
    args:["suffix"],
    default:{suffix:"!"},
    next: (value,args) => {
            return value + args.suffix;
        }
});
// Hello, FlexVars!!!*
console.log(flexvars.replace("Hello, {name|add|add|add|add('*')}", { name: 'FlexVars' })) 
// Hello, FlexVars!!!*
console.log(flexvars.replace("Hello, {name|add|add|add|add({suffix:'*'})}", { name: 'FlexVars' })) 
```

- The above creates a filter named `add`, which provides a parameter `suffix` with a default value of `!`,  The function of this filter is to add the value of the `suffix` parameter after the variable value.

- In the above example, the `add` filter was called 4 times in a row,  with 3 times using default parameters and the last time using custom parameter `*`. Therefore, the final result is `Hello, FlexVars!!!*`.

- A filter is essentially a function that supports positional and dictionary parameters,  where `add ("!")` and `add ({suffix: "!"})` are equivalent.


## Prefix and Suffix

Support specifying prefixes and suffixes for interpolation variables, which can be one or more characters


```ts

// Hello, (FlexVars)
console.log(flexvars.replace("Hello, {( name )}", { name: 'FlexVars' })) 

// Hello, 
console.log(flexvars.replace("Hello, {( name )}")) 
//Location: 
console.log(flexvars.replace("Location: {, module }{, function }{, line }")) 
//Location: module=x
console.log(flexvars.replace("Location: {module= module }{,func= function }{,line= line }", {module:"x"})) 
//Location: module=x,func=main
console.log(flexvars.replace("Location: {module= module }{,func= function }{,line= line }", {module:"x",function:"main"})) 
//Location: module=x,func=main,line=120
console.log(flexvars.replace("Location: {module= module }{,func= function }{,line= line }", {module:"x",function:"main",line:120})) 
```
 
