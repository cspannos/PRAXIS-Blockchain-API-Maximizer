import Ajv from "ajv"
import AjvErrors from "ajv-errors"
import AjvKeywords from "ajv-keywords"
import { getLineNumberForPath } from "./shared.js"
import { condenseErrors } from "./condense-errors.js"
import jsonSchema from "./jsonSchema"
const IGNORED_AJV_PARAMS = ["type", "errors"]

export default class JSONSchemaValidator {
  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      jsonPointers: true,
    })

    AjvKeywords(this.ajv, "switch")
    AjvErrors(this.ajv)

    this.addSchema(jsonSchema)
  }

  addSchema(schema, key) {
    this.ajv.addSchema(schema, normalizeKey(key))
  }

  validate({ jsSpec, specStr, schemaPath, source }) {
    this.ajv.validate(normalizeKey(schemaPath), jsSpec)

    if (!this.ajv.errors || !this.ajv.errors.length) {
      return null
    }

    const condensedErrors = condenseErrors(this.ajv.errors)
    try {
      const boundGetLineNumber = getLineNumberForPath.bind(null, specStr)

      return condensedErrors.map(err => {
        let preparedMessage = err.message
        if (err.params) {
          preparedMessage += "\n"
          for (var k in err.params) {
            if (IGNORED_AJV_PARAMS.indexOf(k) === -1) {
              const ori = err.params[k]
              const value = Array.isArray(ori) ? dedupe(ori).join(", ") : ori
              preparedMessage += `${k}: ${value}\n`
            }
          }
        }

        const errorPathArray = jsonPointerStringToArray(err.dataPath)

        return {
          level: "error",
          line: boundGetLineNumber(errorPathArray || []),
          path: errorPathArray,
          message: preparedMessage.trim(),
          source,
          original: err
        }
      })
    }
    catch (err) {
      return {
        level: "error",
        line: err.problem_mark && err.problem_mark.line + 1 || 0,
        message: err.problem,
        source: "parser",
        original: err
      }
    }
  }
}

function dedupe(arr) {
  return arr.filter((val, i) => {
    return arr.indexOf(val) === i
  })
}

function pathToJSONPointer(arr) {
  return arr.map(a => (a + "").replace("~", "~0").replace("/", "~1")).join("/")
}

function jsonPointerStringToArray(str) {
  return str.split("/")
    .map(part => (part + "").replace(/~0/g, "~").replace(/~1/g, "/"))
    .filter(str => str.length > 0)
}

// Convert arrays into a string. Safely, by using the JSONPath spec
function normalizeKey(key) {
  if (!Array.isArray(key)) key = [key]
  return pathToJSONPointer(key)
}
