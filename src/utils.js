const resWordsList = [
    "abstract","arguments","await","boolean",
    "break","byte","case","catch",
    "char","class","const","continue",
    "debugger","default","delete","do","double",
    "else","enum","eval","export","extends","false",
    "final","finally","float","for","function",
    "goto","if","implements","import",
    "in","instanceof","int","interface",
    "let","long","native","new",
    "null","package","private","protected",
    "public","return","short","static",
    "super","switch","synchronized","this",
    "throw","throws","transient","true",
    "try","typeof","var","void",
    "volatile","while","with","yield"];

/** Return true if the schema contains reserved words */
export default function checkReservedWords (schema) {
    let res = false
    console.log(schema);
    resWordsList.forEach(element => {
        res = res || new RegExp(" "+element+":","g").test(schema)           
    });
    return res
}