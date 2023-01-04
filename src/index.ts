import { XMLParser } from "fast-xml-parser";

function random_str(length: number) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

export const mewoCompile = (source: string) => {
    let stack: string[] = [];
    let codeStack: string[] = [];
    let writeToStack = false;
    let couldBeComponent: string[] = [];

    const options = {
        ignoreAttributes: false,
        alwaysCreateTextNode: true,
        preserveOrder: true,
        attributeNamePrefix : "",
        trimValues: true,
        textNodeName: "innerText"
    }

    const parser = new XMLParser(options);
    const obj = parser.parse(source);

    let code = ["const component = (target) => {"];
    
    let generated: string[] = [];
    let mounts: string[] = [];

    const traverse = (node: any) => {
        for (const element of node) {
            const bruh = Object.keys(element);
            for (let i = 0; i < bruh.length; i++) {
                const el = bruh[i];
    
                if (bruh.length > i + 1) {
                    const next = bruh[i + 1];
                    if (next == ":@") {
                        element[el].push({":@": element[next]});
                        delete element[":@"];
                        bruh.length--;
                    }
                }
                
                if (el == "script") {
                    const text = element[el][0].innerText;
                    const lines = text.split("\n");
                    for (const line of lines) {
                        if (line.match(/(import|require|from)/)) {
                            code.splice(0, 0, `${line}\n`);
                            couldBeComponent.push(line.replace(/(import|require|from)/g, "").replace(/\".+\"/, "").replace(";", "").trim());
                        } else
                            code.push(`\n${line}`);
                    }
                    continue;
                }
    
                if (el == "template") writeToStack = true;
    
                if (el == "innerText") {
                    let text = element[el];
                    const matches = text.match(/{.+}/g);
                    if (matches) {
                        let vars: string[] = [];
                        matches.forEach((part: string) => {
                            const variable = part.replace("{", "").replace("}", "").trim();
                            text = text.replaceAll(part, `$\{ ${ variable }.value }`);
                            vars.push(variable);
                        });
    
                        const fun_name = random_str(8);
                        code.push(`\nfunction func_${fun_name}() { this.text(\`${text}\`) }`)
    
                        for (const name of vars) {
                            codeStack[codeStack.length - 1] += `.bind(${name}, func_${fun_name})`;
                        }
                    } else {
                        codeStack[codeStack.length - 1] += `.text(\"${text}\")`;
                    }
                }
    
                if (el == ":@") {
                    for (const attr in element[el]) {
                        if (attr.startsWith("!")) {
                            codeStack[codeStack.length - 1] += `.on("${attr.replace("!", "")}", ${element[el][attr]})`;
                        } else if (attr == "class") {
                            let strArr = "[";
                            const classes = element[el][attr].split(" ");
                            classes.forEach((element: string) => {
                                strArr += `"${element}", `;
                            });
                            strArr += "]";
                            codeStack[codeStack.length - 1] += `.addClass(${strArr})`;
                        } else {
                            codeStack[codeStack.length - 1] += `.attr("${attr}", "${element[el][attr]}")`;
                        }
                    }
                }
    
                if (element[el].constructor == [].constructor) {
                    if (writeToStack) {
                        const varName = `_${random_str(8)}`;
                        stack.push(`${varName} ${el}`);
                        if (el != "template") code.push(`\nlet ${varName};`);
                        if (couldBeComponent.includes(el))
                            codeStack.push(`${el}(`);
                        else
                            codeStack.push(`${varName} = Mewo("${el}", true)`);
                    }
                    traverse(element[el]);
                }
            }
        }
        if (writeToStack) {
            const child = stack.pop();
            const parent = stack[stack.length - 1];
            const line = codeStack.pop();
            let isCustom = false;
            for (const test of couldBeComponent) {
                if (line?.includes(test)) {
                    isCustom = true;
                }
            }
            if (parent && isCustom) {
                if (parent.includes("template"))
                    mounts.push(`${line}target);\n`);
                else {
                    mounts.push(`${line}${parent.split(" ")[0]});\n`);
                }
            }
            if (parent && !isCustom) {
                if (parent.includes("template")) {
                    generated.push(`${line};\n`);
                    mounts.push(`${child?.split(" ")[0]}.mount(target);\n`);
                } else {
                    generated.push(`${line};\n`);
                    mounts.push(`${child?.split(" ")[0]}.mount(${parent.split(" ")[0]});\n`);
                }
            }
        }
    }

    traverse(obj);

    code.push("\n", ...generated);
    code.push("\n", ...mounts);
    code.push("\n}\nexport default component;");
    code.splice(0, 0, "import { Mewo } from \"@mewo-js/core\";\n");

    return {
        js: code.join(""),
        ast: obj
    }
}