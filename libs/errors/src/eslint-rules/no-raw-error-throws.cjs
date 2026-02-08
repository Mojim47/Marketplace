/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ESLint Rule: no-raw-error-throws
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * INV-ERR-004: No Raw Error Throws
 *
 * Prevents throwing raw Error objects or string literals.
 * All errors must be AppError subclasses for consistent error handling.
 *
 * ❌ Bad:
 *   throw new Error('Something went wrong');
 *   throw 'Something went wrong';
 *   throw new TypeError('Invalid type');
 *
 * ✅ Good:
 *   throw ValidationError.invalidInput('field', 'reason');
 *   throw NotFoundError.resource('User', 'user@example.com');
 *   throw InternalError.unknown('context');
 *
 * Configuration in .eslintrc.js:
 *   rules: {
 *     '@nextgen/no-raw-error-throws': 'error'
 *   }
 */

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow throwing raw Error objects or string literals',
      category: 'Best Practices',
      recommended: true,
      url: 'https://docs.nextgen.ir/errors/no-raw-error-throws',
    },
    fixable: null,
    hasSuggestions: true,
    schema: [
      {
        type: 'object',
        properties: {
          allowedErrorClasses: {
            type: 'array',
            items: { type: 'string' },
            default: [
              'ValidationError',
              'AuthenticationError',
              'AuthorizationError',
              'NotFoundError',
              'ConflictError',
              'BusinessRuleError',
              'RateLimitError',
              'InternalError',
              'UnavailableError',
              'AppError',
            ],
          },
          allowKillSwitch: {
            type: 'boolean',
            default: true,
            description: 'Allow raw Error for kill-switch conditions (must contain KILL_SWITCH)',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noRawError:
        'Do not throw raw Error. Use AppError subclasses: ValidationError, NotFoundError, BusinessRuleError, etc.',
      noStringThrow: 'Do not throw string literals. Use AppError subclasses instead.',
      noBuiltinError:
        'Do not throw built-in error types ({{errorType}}). Use AppError subclasses instead.',
      suggestValidationError: 'Replace with ValidationError',
      suggestInternalError: 'Replace with InternalError.unknown()',
      suggestNotFoundError: 'Replace with NotFoundError',
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const allowedErrorClasses = options.allowedErrorClasses || [
      'ValidationError',
      'AuthenticationError',
      'AuthorizationError',
      'NotFoundError',
      'ConflictError',
      'BusinessRuleError',
      'RateLimitError',
      'InternalError',
      'UnavailableError',
      'AppError',
    ];
    const allowKillSwitch = options.allowKillSwitch !== false;

    // Built-in error types that should not be thrown
    const builtinErrorTypes = [
      'Error',
      'TypeError',
      'RangeError',
      'ReferenceError',
      'SyntaxError',
      'URIError',
      'EvalError',
      'AggregateError',
    ];

    /**
     * Check if the error message contains KILL_SWITCH (allowed exception)
     */
    function isKillSwitchError(node) {
      if (!allowKillSwitch) return false;

      if (node.type === 'NewExpression' && node.arguments.length > 0) {
        const firstArg = node.arguments[0];
        if (firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
          return firstArg.value.includes('KILL_SWITCH');
        }
        if (firstArg.type === 'TemplateLiteral') {
          const raw = firstArg.quasis.map((q) => q.value.raw).join('');
          return raw.includes('KILL_SWITCH');
        }
      }
      return false;
    }

    /**
     * Get the class name from a NewExpression
     */
    function getClassName(node) {
      if (node.callee.type === 'Identifier') {
        return node.callee.name;
      }
      if (node.callee.type === 'MemberExpression' && node.callee.property.type === 'Identifier') {
        return node.callee.property.name;
      }
      return null;
    }

    /**
     * Check if the class is an allowed error class
     */
    function isAllowedErrorClass(className) {
      return allowedErrorClasses.includes(className);
    }

    /**
     * Generate suggestions based on error message content
     */
    function getSuggestions(node) {
      const suggestions = [];

      // Try to extract the error message
      let errorMessage = '';
      if (node.type === 'NewExpression' && node.arguments.length > 0) {
        const firstArg = node.arguments[0];
        if (firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
          errorMessage = firstArg.value.toLowerCase();
        }
      }

      // Suggest based on message content
      if (
        errorMessage.includes('not found') ||
        errorMessage.includes('does not exist') ||
        errorMessage.includes('missing')
      ) {
        suggestions.push({
          messageId: 'suggestNotFoundError',
          fix: null, // Complex fix, manual intervention needed
        });
      } else if (
        errorMessage.includes('invalid') ||
        errorMessage.includes('validation') ||
        errorMessage.includes('required')
      ) {
        suggestions.push({
          messageId: 'suggestValidationError',
          fix: null,
        });
      } else {
        suggestions.push({
          messageId: 'suggestInternalError',
          fix: null,
        });
      }

      return suggestions;
    }

    return {
      ThrowStatement(node) {
        const argument = node.argument;

        // Check for string literal throws: throw 'error'
        if (argument.type === 'Literal' && typeof argument.value === 'string') {
          context.report({
            node,
            messageId: 'noStringThrow',
            suggest: [
              {
                messageId: 'suggestInternalError',
                fix: null,
              },
            ],
          });
          return;
        }

        // Check for template literal throws: throw `error ${msg}`
        if (argument.type === 'TemplateLiteral') {
          context.report({
            node,
            messageId: 'noStringThrow',
            suggest: [
              {
                messageId: 'suggestInternalError',
                fix: null,
              },
            ],
          });
          return;
        }

        // Check for new Error() throws
        if (argument.type === 'NewExpression') {
          const className = getClassName(argument);

          // Skip if it's an allowed error class
          if (className && isAllowedErrorClass(className)) {
            return;
          }

          // Allow KILL_SWITCH errors
          if (isKillSwitchError(argument)) {
            return;
          }

          // Check for built-in error types
          if (className && builtinErrorTypes.includes(className)) {
            context.report({
              node,
              messageId: className === 'Error' ? 'noRawError' : 'noBuiltinError',
              data: { errorType: className },
              suggest: getSuggestions(argument),
            });
            return;
          }
        }

        // Check for Error() without new (rare but possible)
        if (argument.type === 'CallExpression') {
          const calleeName =
            argument.callee.type === 'Identifier' ? argument.callee.name : null;

          if (calleeName && builtinErrorTypes.includes(calleeName)) {
            context.report({
              node,
              messageId: calleeName === 'Error' ? 'noRawError' : 'noBuiltinError',
              data: { errorType: calleeName },
              suggest: getSuggestions(argument),
            });
          }
        }
      },
    };
  },
};
