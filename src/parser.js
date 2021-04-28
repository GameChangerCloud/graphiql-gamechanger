// const util = require('util')
const easygraphqlSchemaParser = require('easygraphql-parser')
const PrimitiveTypes = ["Int","Float","String","Boolean","ID"]

export function parse(gql){
    var res = ""
    try {
        const schema = easygraphqlSchemaParser(gql)
        const keys = Object.keys(schema)
        keys.forEach(type => {
            const typeObject=schema[type]
            if(typeObject["type"] === "ObjectTypeDefinition"){
                typeObject["fields"].forEach(element => {
                    if(!PrimitiveTypes.includes(element.type)){
                        res += "[" + type + "]" + (element.isArray ? "->*" : "->") + "[" + element.type + "]\n"
                    }
                });
            }
        });
        return res
    } catch (error) {
        console.log("mauvais gql");
        return ""
    }
    // console.log(util.inspect(schema, {showHidden: false, depth: null}));
}