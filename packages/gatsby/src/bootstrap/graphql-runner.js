const { graphql } = require(`graphql`)
const stackTrace = require(`stack-trace`)
const withResolverContext = require(`../schema/context`)
const errorParser = require(`../query/error-parser`).default

const createGraphqlRunner = (store, reporter) => (query, context = {}) => {
  const { schema, schemaCustomization } = store.getState()

  return graphql(
    schema,
    query,
    context,
    withResolverContext(context, schema, schemaCustomization.context),
    context
  ).then(result => {
    if (result.errors) {
      const structuredErrors = result.errors
        .map(e => {
          // Find the file where graphql was called.
          const file = stackTrace
            .parse(e)
            .find(file => /createPages/.test(file.functionName))

          if (file) {
            const structuredError = errorParser({
              message: e.message,
              location: {
                start: { line: file.lineNumber, column: file.columnNumber },
              },
              filePath: file.fileName,
            })
            structuredError.context = {
              ...structuredError.context,
              fromGraphQLFunction: true,
            }
            return structuredError
          }

          return null
        })
        .filter(Boolean)

      if (structuredErrors.length) {
        // panic on build exits the process
        reporter.panicOnBuild(structuredErrors)
      }
    }

    return result
  })
}

module.exports = createGraphqlRunner
