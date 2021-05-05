// const util = require('util')
const easygraphqlSchemaParser = require('easygraphql-parser')
const PrimitiveTypes = ["Int","Float","String","Boolean","ID"]
const PrimitiveOp= ["Query","Mutation","Subscription"]

export function parse(gql){
    var res = ""
    var attributes = ""
    var link = ""
    try {
        const schema = easygraphqlSchemaParser(gql)
        const keys = Object.keys(schema)
        keys.forEach(type => {
            const typeObject=schema[type]
            if(typeObject["type"] === "ObjectTypeDefinition" &&  !PrimitiveOp.includes(type)){
                attributes += "[" + type + "|"
                typeObject["fields"].forEach(element => {
                    if(PrimitiveTypes.includes(element.type)){
                        attributes += element.name + ": " + element.type + (element.isArray ? "\\[\\]" : "") + ";"
                    }
                    else 
                        link += "[" + type + "]" + (element.isArray ? "->*" : "->") + "[" + element.type + "]\n"
                    
                });
                attributes = attributes.slice(0, -1) + "]\n"
                res +=  attributes + link
            }
        });
        return res
    } catch (error) {
        console.log("bad schema");
        return ""
    }
    // console.log(util.inspect(schema, {showHidden: false, depth: null}));
}