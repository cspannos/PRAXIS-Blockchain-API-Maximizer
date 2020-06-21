/* eslint-env mocha */
import expect from "expect"
import validateHelper, { expectNoErrors } from "./validate-helper.js"

describe("validation plugin - semantic - form data", function(){
  this.timeout(10 * 1000)

  describe("/parameters/...", function(){
    describe("typo in formdata", function(){
      it("should warn about formdata ( typo )", function(){

        const spec = {
          swagger: "2.0",
          parameters: {
            CoolParam: [
              { in: "formdata" },
            ]
          },
          paths: {
            "/some": {
              post: {
                parameters: [
                  { in: "formdata" },
                ]
              }
            }
          }
        }

        return validateHelper(spec)
          .then( system => {
            const allErrors = system.errSelectors.allErrors().toJS()
            const firstError = allErrors[0]
            expect(allErrors.length).toEqual(1)
            expect(firstError.message).toEqual(`Parameter "in: formdata" is invalid, did you mean "in: formData"?`)
            expect(firstError.path).toEqual(["paths", "/some", "post", "parameters", "0"])
          })
      })
    })
  })

  describe("missing consumes", function(){
    it("should complain if 'type:file` and no 'in: formData", function(){
      const spec = {
        swagger: "2.0",
        paths: {
          "/some": {
            post: {
              consumes: ["multipart/form-data"],
              parameters: [
                {
                  type: "file",
                },
              ]
            }
          }
        }
      }
      return validateHelper(spec)
        .then( system => {
          const allErrors = system.errSelectors.allErrors().toJS()
          const firstError = allErrors[0]
          expect(allErrors.length).toEqual(1)
          expect(firstError.message).toEqual(`Parameters with "type: file" must have "in: formData"`)
          expect(firstError.path).toEqual(["paths", "/some", "post", "parameters", "0"])
        })
    })
    it("should complain if 'type:file` and no consumes - 'multipart/form-data'", function(){
      const spec = {
        swagger: "2.0",
        paths: {
          "/some": {
            post: {
              parameters: [
                {
                    in: "formData",
                    type: "file",
                },
              ]
            }
          }
        }
      }

      return validateHelper(spec)
        .then( system => {
          const allErrors = system.errSelectors.allErrors().toJS()
          const firstError = allErrors[0]
          expect(allErrors.length).toEqual(1)
          expect(firstError.message).toEqual(`Operations with parameters of "type: file" must include "multipart/form-data" in their "consumes" property`)
          expect(firstError.path).toEqual(["paths", "/some", "post"])
        })
    })
    it("should complain if 'in:formData` and no consumes - 'multipart/form-data' or 'application/x-www-form-urlencoded'", function(){
      const spec = {
        swagger: "2.0",
        paths: {
          "/some": {
            post: {
              parameters: [
                {
                    in: "formData",
                },
              ]
            }
          }
        }
      }

      return validateHelper(spec)
        .then(system => {
          const allErrors = system.errSelectors.allErrors().toJS()
          const firstError = allErrors[0]
          expect(allErrors.length).toEqual(1)
          expect(firstError.message).toEqual(`Operations with parameters of "in: formData" must include "application/x-www-form-urlencoded" or "multipart/form-data" in their "consumes" property`)
          expect(firstError.path).toEqual(["paths", "/some", "post"])
        })
    })

    it("should not complain if 'in:formData` and consumes is set globally", function(){
      const spec = {
        swagger: "2.0",
        consumes: [
          "multipart/form-data"
        ],
        paths: {
          "/some": {
            post: {
              parameters: [
                {
                    in: "formData",
                },
              ]
            }
          }
        }
      }

      return expectNoErrors(spec)
    })

  })

  describe("/pathitems/...", function(){
    it("should complain about having both in the same parameter", function(){
      const spec = {
        swagger: "2.0",
        paths: {
          "/": {
            consumes: ["multipart/form-data"],
            parameters: [
              { in: "formData" },
              { in: "body" },
            ]
          }
        }
      }

      return validateHelper(spec)
        .then(system => {
          const allErrors = system.errSelectors.allErrors().toJS()
          const firstError = allErrors[0]
          expect(allErrors.length).toEqual(1)
          expect(firstError.message).toEqual(`Parameters cannot have both a "in: body" and "in: formData", as "formData" _will_ be the body`)
          expect(firstError.path).toEqual(["paths", "/", "parameters"])
        })
    })
    it("should complain if 'type:file` and no 'in: formData", function(){
      const spec = {
        swagger: "2.0",
        paths: {
          "/": {
            consumes: ["multipart/form-data"],
            parameters: [
              { type: "file" }
            ]
          }
        }
      }

      return validateHelper(spec)
        .then(system => {
          const allErrors = system.errSelectors.allErrors().toJS()
          const firstError = allErrors[0]
          expect(allErrors.length).toEqual(1)
          expect(firstError.message).toEqual(`Parameters with "type: file" must have "in: formData"`)
          expect(firstError.path).toEqual(["paths", "/", "parameters", "0"])
        })
    })
    
    describe("Path-level form parameters and operation-level consumes", function(){
      describe("`in: formData` + `type: file`", function() {
        it("should report an error for missing consumes with a path-level parameter", function(){
          const spec = {
            swagger: "2.0",
            paths: {
              "/foo": {
                parameters: [
                  {
                    name: "param",
                    in: "formData",
                    required: true,
                    type: "file"
                  }
                ],
                post: {
                  responses: {
                    "200": {
                      description: "ok"
                    }
                  }
                }
              }
            }
          }

          return validateHelper(spec)
            .then(system => {
              const allErrors = system.errSelectors.allErrors().toJS()  
              expect(allErrors.length).toEqual(1)
              const firstError = allErrors[0]
              expect(firstError.message).toEqual(`Operations with parameters of "type: file" must include "multipart/form-data" in their "consumes" property`)
              expect(firstError.path).toEqual(["paths", "/foo", "post"])
            })
        })

        it("should report an error for incorrect global consumes with a path-level parameter", function(){
          const spec = {
            swagger: "2.0",
            consumes: ["application/json"],
            paths: {
              "/foo": {
                parameters: [
                  {
                    name: "param",
                    in: "formData",
                    required: true,
                    type: "file"
                  }
                ],
                post: {
                  responses: {
                    "200": {
                      description: "ok"
                    }
                  }
                }
              }
            }
          }

          return validateHelper(spec)
            .then(system => {
              const allErrors = system.errSelectors.allErrors().toJS()  
              expect(allErrors.length).toEqual(1)
              const firstError = allErrors[0]
              expect(firstError.message).toEqual(`Operations with parameters of "type: file" must include "multipart/form-data" in their "consumes" property`)
              expect(firstError.path).toEqual(["paths", "/foo", "post"])
            })
        })

        it("should report an error for incorrect operation-level consumes with a path-level parameter", function(){
          const spec = {
            swagger: "2.0",
            paths: {
              "/foo": {
                parameters: [
                  {
                    name: "param",
                    in: "formData",
                    required: true,
                    type: "file"
                  }
                ],
                post: {
                  consumes: ["application/json"],
                  responses: {
                    "200": {
                      description: "ok"
                    }
                  }
                }
              }
            }
          }

          return validateHelper(spec)
            .then(system => {
              const allErrors = system.errSelectors.allErrors().toJS()  
              expect(allErrors.length).toEqual(1)
              const firstError = allErrors[0]
              expect(firstError.message).toEqual(`Operations with parameters of "type: file" must include "multipart/form-data" in their "consumes" property`)
              expect(firstError.path).toEqual(["paths", "/foo", "post"])
            })
        })

        it("should not report an error for correct global consumes with a path-level parameter", function(){
          const spec = {
            swagger: "2.0",
            consumes: ["multipart/form-data"],
            paths: {
              "/foo": {
                parameters: [
                  {
                    name: "param",
                    in: "formData",
                    required: true,
                    type: "file"
                  }
                ],
                post: {
                  responses: {
                    "200": {
                      description: "ok"
                    }
                  }
                }
              }
            }
          }

          return validateHelper(spec)
            .then(system => {
              const allErrors = system.errSelectors.allErrors().toJS()  
              expect(allErrors.length).toEqual(0)
            })
        })

        it("should not report an error for correct operation consumes with a path-level parameter", function(){
          const spec = {
            swagger: "2.0",
            paths: {
              "/foo": {
                parameters: [
                  {
                    name: "param",
                    in: "formData",
                    required: true,
                    type: "file"
                  }
                ],
                post: {
                  consumes: ["multipart/form-data"],
                  responses: {
                    "200": {
                      description: "ok"
                    }
                  }
                }
              }
            }
          }

          return validateHelper(spec)
            .then(system => {
              const allErrors = system.errSelectors.allErrors().toJS()  
              expect(allErrors.length).toEqual(0)
            })
        })
      })
    describe("`in: formData`", function() {
        it("should report an error for missing consumes with a path-level formData parameter", function(){
          const spec = {
            swagger: "2.0",
            paths: {
              "/foo": {
                parameters: [
                  {
                    name: "param",
                    in: "formData",
                    required: true,
                    type: "string"
                  }
                ],
                post: {
                  responses: {
                    "200": {
                      description: "ok"
                    }
                  }
                }
              }
            }
          }

          return validateHelper(spec)
            .then(system => {
              const allErrors = system.errSelectors.allErrors().toJS()  
              expect(allErrors.length).toEqual(1)
              const firstError = allErrors[0]
              expect(firstError.message).toEqual(`Operations with parameters of "in: formData" must include "application/x-www-form-urlencoded" or "multipart/form-data" in their "consumes" property`)
              expect(firstError.path).toEqual(["paths", "/foo", "post"])
            })
        })

        it("should report an error for incorrect global consumes with a path-level formData parameter", function(){
          const spec = {
            swagger: "2.0",
            consumes: ["application/json"],
            paths: {
              "/foo": {
                parameters: [
                  {
                    name: "param",
                    in: "formData",
                    required: true,
                    type: "string"
                  }
                ],
                post: {
                  responses: {
                    "200": {
                      description: "ok"
                    }
                  }
                }
              }
            }
          }

          return validateHelper(spec)
            .then(system => {
              const allErrors = system.errSelectors.allErrors().toJS()  
              expect(allErrors.length).toEqual(1)
              const firstError = allErrors[0]
              expect(firstError.message).toEqual(`Operations with parameters of "in: formData" must include "application/x-www-form-urlencoded" or "multipart/form-data" in their "consumes" property`)
              expect(firstError.path).toEqual(["paths", "/foo", "post"])
            })
        })

        it("should report an error for incorrect operation-level consumes with a path-level formData parameter", function(){
          const spec = {
            swagger: "2.0",
            paths: {
              "/foo": {
                parameters: [
                  {
                    name: "param",
                    in: "formData",
                    required: true,
                    type: "string"
                  }
                ],
                post: {
                  consumes: ["application/json"],
                  responses: {
                    "200": {
                      description: "ok"
                    }
                  }
                }
              }
            }
          }

          return validateHelper(spec)
            .then(system => {
              const allErrors = system.errSelectors.allErrors().toJS()  
              expect(allErrors.length).toEqual(1)
              const firstError = allErrors[0]
              expect(firstError.message).toEqual(`Operations with parameters of "in: formData" must include "application/x-www-form-urlencoded" or "multipart/form-data" in their "consumes" property`)
              expect(firstError.path).toEqual(["paths", "/foo", "post"])
            })
        })

        it("should not report an error for correct global consumes with a path-level parameter", function(){
          const spec = {
            swagger: "2.0",
            consumes: ["multipart/form-data"],
            paths: {
              "/foo": {
                parameters: [
                  {
                    name: "param",
                    in: "formData",
                    required: true,
                    type: "string"
                  }
                ],
                post: {
                  responses: {
                    "200": {
                      description: "ok"
                    }
                  }
                }
              }
            }
          }

          return validateHelper(spec)
            .then(system => {
              const allErrors = system.errSelectors.allErrors().toJS()  
              expect(allErrors.length).toEqual(0)
            })
        })

        it("should not report an error for correct operation consumes with a path-level parameter", function(){
          const spec = {
            swagger: "2.0",
            paths: {
              "/foo": {
                parameters: [
                  {
                    name: "param",
                    in: "formData",
                    required: true,
                    type: "string"
                  }
                ],
                post: {
                  consumes: ["multipart/form-data"],
                  responses: {
                    "200": {
                      description: "ok"
                    }
                  }
                }
              }
            }
          }

          return validateHelper(spec)
            .then(system => {
              const allErrors = system.errSelectors.allErrors().toJS()  
              expect(allErrors.length).toEqual(0)
            })
        })
      })
    })
  })
})
