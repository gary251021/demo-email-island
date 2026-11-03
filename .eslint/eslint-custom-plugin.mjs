const isPascalCase = (name) => /^[A-Z][A-Za-z0-9]*$/.test(name);

const TYPE_ONLY_DECLARATION_TYPES = new Set([
  "TSDeclareFunction",
  "TSInterfaceDeclaration",
  "TSTypeAliasDeclaration",
]);

const getFunctionName = (node) => {
  if (node.id?.name) {
    return node.id.name;
  }

  if (
    node.parent?.type === "VariableDeclarator" &&
    node.parent.id?.type === "Identifier"
  ) {
    return node.parent.id.name;
  }

  return undefined;
};

const getPatternNames = (pattern) => {
  switch (pattern.type) {
    case "Identifier":
      return [pattern.name];
    case "AssignmentPattern":
      return getPatternNames(pattern.left);
    case "RestElement":
      return getPatternNames(pattern.argument);
    case "ArrayPattern":
      return pattern.elements.flatMap((element) =>
        element ? getPatternNames(element) : [],
      );
    case "ObjectPattern":
      return pattern.properties.flatMap((property) =>
        property.type === "RestElement"
          ? getPatternNames(property.argument)
          : getPatternNames(property.value),
      );
    default:
      return ["<unknown>"];
  }
};

const getDeclarationNames = (declaration) => {
  if (declaration.type === "VariableDeclaration") {
    return declaration.declarations.flatMap(({ id }) => getPatternNames(id));
  }

  if ("id" in declaration && declaration.id?.type === "Identifier") {
    return [declaration.id.name];
  }

  return ["<anonymous>"];
};

const getExportedName = (exported) =>
  exported.type === "Identifier" ? exported.name : String(exported.value);

const getDefaultExportName = (declaration) => {
  if (declaration.type === "Identifier") {
    return declaration.name;
  }

  if (
    (declaration.type === "FunctionDeclaration" ||
      declaration.type === "ClassDeclaration") &&
    declaration.id
  ) {
    return declaration.id.name;
  }

  return undefined;
};

const isTypeOnlyDeclaration = (declaration) =>
  declaration.declare === true ||
  TYPE_ONLY_DECLARATION_TYPES.has(declaration.type);

const getComponentName = (program) => {
  const runtimeExports = [];

  for (const statement of program.body) {
    if (statement.type === "ExportDefaultDeclaration") {
      if (!isTypeOnlyDeclaration(statement.declaration)) {
        runtimeExports.push({
          name: getDefaultExportName(statement.declaration),
          value: statement.declaration,
        });
      }

      continue;
    }

    if (
      statement.type !== "ExportNamedDeclaration" ||
      statement.exportKind === "type"
    ) {
      continue;
    }

    if (statement.declaration) {
      if (isTypeOnlyDeclaration(statement.declaration)) {
        continue;
      }

      for (const name of getDeclarationNames(statement.declaration)) {
        runtimeExports.push({
          name,
          value: getRuntimeExportValue(statement.declaration, name),
        });
      }

      continue;
    }

    for (const specifier of statement.specifiers) {
      if (specifier.exportKind !== "type") {
        runtimeExports.push({
          name: getExportedName(specifier.exported),
          value: undefined,
        });
      }
    }
  }

  if (runtimeExports.length !== 1) {
    return undefined;
  }

  const [runtimeExport] = runtimeExports;

  return runtimeExport.name && isPascalCase(runtimeExport.name)
    ? runtimeExport.name
    : undefined;
};

const getTopLevelTypeDeclarations = (program) => {
  const declarations = new Map();

  for (const statement of program.body) {
    const declaration =
      statement.type === "ExportNamedDeclaration" && statement.declaration
        ? statement.declaration
        : statement;

    if (
      isTypeOnlyDeclaration(declaration) &&
      declaration.id?.type === "Identifier"
    ) {
      declarations.set(declaration.id.name, declaration);
    }
  }

  return declarations;
};

const getExportedTypeEntries = (program) => {
  const declarations = getTopLevelTypeDeclarations(program);
  const typeExports = [];
  const typeStarExports = [];

  for (const statement of program.body) {
    if (statement.type === "ExportAllDeclaration") {
      if (statement.exportKind === "type") {
        typeStarExports.push(statement);
      }

      continue;
    }

    if (statement.type !== "ExportNamedDeclaration") {
      continue;
    }

    if (
      statement.declaration &&
      (statement.exportKind === "type" ||
        isTypeOnlyDeclaration(statement.declaration))
    ) {
      for (const name of getDeclarationNames(statement.declaration)) {
        typeExports.push({
          name,
          node: statement,
          declaration: statement.declaration,
        });
      }

      continue;
    }

    for (const specifier of statement.specifiers) {
      if (statement.exportKind !== "type" && specifier.exportKind !== "type") {
        continue;
      }

      const name = getExportedName(specifier.exported);
      const localName =
        specifier.local.type === "Identifier" ? specifier.local.name : name;

      typeExports.push({
        name,
        node: specifier,
        declaration: declarations.get(localName),
      });
    }
  }

  return { typeExports, typeStarExports };
};

const collectTypeReferences = (node, references = new Set()) => {
  if (!node || typeof node !== "object") {
    return references;
  }

  if (node.type === "TSTypeReference" && node.typeName.type === "Identifier") {
    references.add(node.typeName.name);
  }

  for (const [key, value] of Object.entries(node)) {
    if (
      key === "parent" ||
      key === "loc" ||
      key === "range" ||
      key === "tokens" ||
      key === "comments"
    ) {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((child) => collectTypeReferences(child, references));
    } else {
      collectTypeReferences(value, references);
    }
  }

  return references;
};

const getComponentPropsTypeName = (component) => `${component}Props`;

const isFunctionNode = (node) =>
  node?.type === "ArrowFunctionExpression" ||
  node?.type === "FunctionDeclaration" ||
  node?.type === "FunctionExpression";

const isJsxExpression = (node) => {
  if (!node) {
    return false;
  }

  if (node.type === "JSXElement" || node.type === "JSXFragment") {
    return true;
  }

  if (node.type === "ConditionalExpression") {
    return isJsxExpression(node.consequent) || isJsxExpression(node.alternate);
  }

  if (node.type === "LogicalExpression") {
    return isJsxExpression(node.left) || isJsxExpression(node.right);
  }

  return false;
};

const getReturnedExpressions = (functionNode) => {
  if (functionNode.body.type !== "BlockStatement") {
    return [functionNode.body];
  }

  const returnedExpressions = [];

  const visitStatement = (statement) => {
    switch (statement.type) {
      case "ReturnStatement":
        if (statement.argument) {
          returnedExpressions.push(statement.argument);
        }
        break;
      case "BlockStatement":
        statement.body.forEach(visitStatement);
        break;
      case "IfStatement":
        visitStatement(statement.consequent);
        if (statement.alternate) {
          visitStatement(statement.alternate);
        }
        break;
      case "SwitchStatement":
        statement.cases.forEach((switchCase) => {
          switchCase.consequent.forEach(visitStatement);
        });
        break;
      case "TryStatement":
        visitStatement(statement.block);
        if (statement.handler) {
          visitStatement(statement.handler.body);
        }
        if (statement.finalizer) {
          visitStatement(statement.finalizer);
        }
        break;
      case "ForInStatement":
      case "ForOfStatement":
      case "ForStatement":
      case "LabeledStatement":
      case "WhileStatement":
      case "DoWhileStatement":
        visitStatement(statement.body);
        break;
    }
  };

  functionNode.body.body.forEach(visitStatement);

  return returnedExpressions;
};

const classifyReactExport = (node) => {
  if (!isFunctionNode(node)) {
    return "unknown";
  }

  const returnedExpressions = getReturnedExpressions(node);

  if (returnedExpressions.some(isJsxExpression)) {
    return "component";
  }

  if (
    returnedExpressions.some(
      (expression) =>
        isFunctionNode(expression) &&
        getReturnedExpressions(expression).some(isJsxExpression),
    )
  ) {
    return "component-factory";
  }

  return "unknown";
};

const getRuntimeExportValue = (declaration, name) => {
  if (declaration.type !== "VariableDeclaration") {
    return declaration;
  }

  const declarator = declaration.declarations.find(({ id }) =>
    getPatternNames(id).includes(name),
  );

  return declarator?.init;
};

const getInlineObjectType = (param) => {
  const typeAnnotation = param.typeAnnotation?.typeAnnotation;

  if (typeAnnotation?.type === "TSTypeLiteral") {
    return typeAnnotation;
  }

  return undefined;
};

const isExportedNode = (node) => {
  let current = node;

  while (current?.parent) {
    current = current.parent;

    if (
      current.type === "ExportNamedDeclaration" ||
      current.type === "ExportDefaultDeclaration"
    ) {
      return true;
    }

    if (
      current.type !== "VariableDeclarator" &&
      current.type !== "VariableDeclaration"
    ) {
      return false;
    }
  }

  return false;
};

const getSingleReturnedCall = (node) => {
  if (node.body.type === "CallExpression") {
    return node.body;
  }

  if (node.body.type !== "BlockStatement" || node.body.body.length !== 1) {
    return undefined;
  }

  const [statement] = node.body.body;

  if (statement.type !== "ReturnStatement") {
    return undefined;
  }

  return statement.argument?.type === "CallExpression"
    ? statement.argument
    : undefined;
};

const isSimpleForwardedCall = (node, call) => {
  if (call.callee.type !== "Identifier") {
    return false;
  }

  if (node.params.length !== call.arguments.length) {
    return false;
  }

  return node.params.every((param, index) => {
    const argument = call.arguments[index];

    return (
      param.type === "Identifier" &&
      argument?.type === "Identifier" &&
      param.name === argument.name
    );
  });
};

const noUselessAliasWrapperRule = {
  meta: {
    type: "suggestion",
    schema: [
      {
        type: "object",
        properties: {
          allowExported: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      uselessAliasWrapper:
        "'{{wrapper}}' only forwards to '{{target}}' with the same arguments. Call '{{target}}' directly or add the missing boundary behavior.",
    },
  },
  create(context) {
    const [{ allowExported = true } = {}] = context.options;

    const checkFunction = (node) => {
      const wrapperName = getFunctionName(node);

      if (!wrapperName || (allowExported && isExportedNode(node))) {
        return;
      }

      const call = getSingleReturnedCall(node);

      if (!call || !isSimpleForwardedCall(node, call)) {
        return;
      }

      const targetName = call.callee.name;

      if (targetName === wrapperName) {
        return;
      }

      context.report({
        node,
        messageId: "uselessAliasWrapper",
        data: {
          wrapper: wrapperName,
          target: targetName,
        },
      });
    };

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
    };
  },
};

const RESPONSIBILITY_BUDGET_THRESHOLD = 10;

const isFunctionValue = (node) =>
  node?.type === "ArrowFunctionExpression" ||
  node?.type === "FunctionExpression";

const getModuleFunctionCount = (program) =>
  program.body.reduce((count, statement) => {
    const declaration =
      statement.type === "ExportNamedDeclaration" ||
      statement.type === "ExportDefaultDeclaration"
        ? statement.declaration
        : statement;

    if (declaration?.type === "FunctionDeclaration") {
      return count + 1;
    }

    if (declaration?.type === "VariableDeclaration") {
      return (
        count +
        declaration.declarations.filter(({ init }) => isFunctionValue(init))
          .length
      );
    }

    return count + (isFunctionValue(declaration) ? 1 : 0);
  }, 0);

const getClassMethodCount = (node) =>
  node.body.body.filter(
    (member) =>
      (member.type === "MethodDefinition" &&
        member.kind !== "constructor" &&
        member.value.body) ||
      (member.type === "PropertyDefinition" && isFunctionValue(member.value)),
  ).length;

const responsibilityBudgetRule = {
  meta: {
    type: "suggestion",
    schema: [],
    messages: {
      moduleOverBudget:
        "Module responsibility budget exceeded: {{count}} module-level functions; target: at most {{max}}. You should refactor according to the codebase-design skill (SKILL.md). Use its guidance to choose module interfaces and seams that meet these targets while preserving public interfaces and behavior. Rerun affected tests and ESLint. If a target cannot be met without weakening cohesion, state the concrete reason for review.",
      classOverBudget:
        "Class '{{name}}' exceeds its responsibility budget: {{count}} executable members; target: at most {{max}}. You should refactor according to the codebase-design skill (SKILL.md). Use its guidance to choose module interfaces and seams that meet these targets while preserving public interfaces and behavior. Rerun affected tests and ESLint. If a target cannot be met without weakening cohesion, state the concrete reason for review.",
    },
  },
  create(context) {
    const reportClass = (node) => {
      const count = getClassMethodCount(node);

      if (count < RESPONSIBILITY_BUDGET_THRESHOLD) {
        return;
      }

      context.report({
        node,
        messageId: "classOverBudget",
        data: {
          name: getFunctionName(node) ?? "<anonymous>",
          count,
          max: RESPONSIBILITY_BUDGET_THRESHOLD - 1,
        },
      });
    };

    return {
      Program(program) {
        const count = getModuleFunctionCount(program);

        if (count < RESPONSIBILITY_BUDGET_THRESHOLD) {
          return;
        }

        context.report({
          node: program,
          messageId: "moduleOverBudget",
          data: {
            count,
            max: RESPONSIBILITY_BUDGET_THRESHOLD - 1,
          },
        });
      },
      ClassDeclaration: reportClass,
      ClassExpression: reportClass,
    };
  },
};

const maxInlineParamPropertiesRule = {
  meta: {
    type: "suggestion",
    schema: [
      {
        type: "object",
        properties: {
          maxProperties: { type: "integer", minimum: 0 },
          reactMaxProperties: { type: "integer", minimum: 0 },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      tooManyProperties:
        "Inline object parameter has {{count}} properties. Extract a named type when there are more than {{max}} properties.",
    },
  },
  create(context) {
    const [{ maxProperties = 3, reactMaxProperties = 5 } = {}] =
      context.options;

    const checkFunction = (node) => {
      const functionName = getFunctionName(node);
      const isLikelyReactComponent =
        context.filename.endsWith(".tsx") &&
        functionName !== undefined &&
        isPascalCase(functionName);
      const max = isLikelyReactComponent ? reactMaxProperties : maxProperties;

      for (const param of node.params) {
        const inlineObjectType = getInlineObjectType(param);

        if (!inlineObjectType) {
          continue;
        }

        const count = inlineObjectType.members.length;

        if (count > max) {
          context.report({
            node: param,
            messageId: "tooManyProperties",
            data: {
              count,
              max,
            },
          });
        }
      }
    };

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
    };
  },
};

const reactComponentMaxParamsRule = {
  meta: {
    type: "suggestion",
    schema: [
      {
        type: "object",
        properties: {
          max: { type: "integer", minimum: 0 },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      tooManyParams:
        "React component '{{name}}' has {{count}} parameters. Components should accept at most {{max}} props parameter.",
    },
  },
  create(context) {
    const [{ max = 1 } = {}] = context.options;

    const checkFunction = (node) => {
      if (!context.filename.endsWith(".tsx")) {
        return;
      }

      const functionName = getFunctionName(node);

      if (!functionName || !isPascalCase(functionName)) {
        return;
      }

      const count = node.params.length;

      if (count > max) {
        context.report({
          node,
          messageId: "tooManyParams",
          data: {
            name: functionName,
            count,
            max,
          },
        });
      }
    };

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
    };
  },
};

const componentModuleContractRule = {
  meta: {
    type: "suggestion",
    schema: [],
    messages: {
      invalidRuntimeExportName:
        "Runtime export '{{name}}' does not look like a React component. Component modules should export one PascalCase component.",
      runtimeStarExport:
        'Runtime "export *" is not allowed in a component module because its public runtime API cannot be verified.',
      tooManyRuntimeExports:
        "Component modules may export at most one runtime export. Found: {{exports}}.",
    },
  },
  create(context) {
    return {
      Program(program) {
        const runtimeExports = [];

        for (const statement of program.body) {
          if (statement.type === "ExportDefaultDeclaration") {
            if (!isTypeOnlyDeclaration(statement.declaration)) {
              runtimeExports.push({
                name: getDefaultExportName(statement.declaration),
                displayName: "default",
                node: statement,
                value: statement.declaration,
              });
            }

            continue;
          }

          if (statement.type === "ExportAllDeclaration") {
            if (statement.exportKind !== "type") {
              context.report({
                node: statement,
                messageId: "runtimeStarExport",
              });
            }

            continue;
          }

          if (statement.type !== "ExportNamedDeclaration") {
            continue;
          }

          if (statement.declaration) {
            const names = getDeclarationNames(statement.declaration);

            if (
              statement.exportKind !== "type" &&
              !isTypeOnlyDeclaration(statement.declaration)
            ) {
              runtimeExports.push(
                ...names.map((name) => ({
                  name,
                  displayName: name,
                  node: statement,
                  value: getRuntimeExportValue(statement.declaration, name),
                })),
              );
            }

            continue;
          }

          for (const specifier of statement.specifiers) {
            const name = getExportedName(specifier.exported);

            if (
              statement.exportKind !== "type" &&
              specifier.exportKind !== "type"
            ) {
              runtimeExports.push({
                name,
                displayName: name,
                node: specifier,
              });
            }
          }
        }

        if (runtimeExports.length > 1) {
          context.report({
            node: runtimeExports[1].node,
            messageId: "tooManyRuntimeExports",
            data: {
              exports: runtimeExports
                .map(({ displayName }) => displayName)
                .join(", "),
            },
          });
          return;
        }

        const [runtimeExport] = runtimeExports;
        const componentName = runtimeExport?.name;

        if (!componentName) {
          return;
        }

        if (!isPascalCase(componentName)) {
          if (classifyReactExport(runtimeExport.value) !== "component") {
            return;
          }

          context.report({
            node: runtimeExport.node,
            messageId: "invalidRuntimeExportName",
            data: {
              name: componentName,
            },
          });
          return;
        }
      },
    };
  },
};

const componentPropsNameRule = {
  meta: {
    type: "suggestion",
    schema: [],
    messages: {
      invalidPropsTypeName:
        "Component '{{component}}' should use '{{expected}}' for its props type instead of '{{actual}}'.",
    },
  },
  create(context) {
    return {
      Program(program) {
        const componentName = getComponentName(program);

        if (!componentName) {
          return;
        }

        const expected = getComponentPropsTypeName(componentName);

        for (const statement of program.body) {
          if (
            statement.type !== "ExportNamedDeclaration" ||
            !statement.declaration
          ) {
            continue;
          }

          const exportedName = getDeclarationNames(statement.declaration)[0];
          const component = getRuntimeExportValue(
            statement.declaration,
            exportedName,
          );

          if (!isFunctionNode(component) || exportedName !== componentName) {
            continue;
          }

          const [propsParameter] = component.params;
          const propsType = propsParameter?.typeAnnotation?.typeAnnotation;

          if (propsType?.type !== "TSTypeReference") {
            return;
          }

          if (
            propsType.typeName.type === "Identifier" &&
            propsType.typeName.name !== expected
          ) {
            context.report({
              node: propsType,
              messageId: "invalidPropsTypeName",
              data: {
                component: componentName,
                expected,
                actual: propsType.typeName.name,
              },
            });
          }

          return;
        }
      },
    };
  },
};

const componentPropsTypeExportsRule = {
  meta: {
    type: "suggestion",
    schema: [],
    messages: {
      typeStarExport:
        'Type "export *" is not allowed because the component props type contract cannot be verified.',
      unrelatedTypeExport:
        "Type '{{name}}' is not part of '{{component}}Props'. Export only the props type itself or a type directly referenced by it.",
    },
  },
  create(context) {
    return {
      Program(program) {
        const componentName = getComponentName(program);

        if (!componentName) {
          return;
        }

        const { typeExports, typeStarExports } =
          getExportedTypeEntries(program);
        const propsTypeName = getComponentPropsTypeName(componentName);
        const propsType =
          getTopLevelTypeDeclarations(program).get(propsTypeName);
        const allowedTypeNames = new Set([propsTypeName]);

        if (propsType) {
          collectTypeReferences(propsType, allowedTypeNames);
        }

        for (const typeStarExport of typeStarExports) {
          context.report({
            node: typeStarExport,
            messageId: "typeStarExport",
          });
        }

        for (const typeExport of typeExports) {
          if (allowedTypeNames.has(typeExport.name)) {
            continue;
          }

          context.report({
            node: typeExport.node,
            messageId: "unrelatedTypeExport",
            data: {
              name: typeExport.name,
              component: componentName,
            },
          });
        }
      },
    };
  },
};

const DEFAULT_COMPONENT_RESPONSIBILITY_BUDGET = {
  maxEffectiveLines: 120,
  maxTopLevelHooks: 8,
  maxStateHooks: 4,
  maxEffects: 2,
  maxLocalFunctions: 6,
  maxSubstantialLocalFunctions: 4,
  maxJsxDepth: 5,
};

const EFFECT_HOOK_NAMES = new Set([
  "useEffect",
  "useInsertionEffect",
  "useLayoutEffect",
]);
const STATE_HOOK_NAMES = new Set(["useReducer", "useState"]);
const LOOP_NODE_TYPES = new Set([
  "DoWhileStatement",
  "ForInStatement",
  "ForOfStatement",
  "ForStatement",
  "WhileStatement",
]);

const getHookName = (callee) => {
  if (callee.type === "Identifier") {
    return callee.name === "use" || /^use[A-Z0-9]/.test(callee.name)
      ? callee.name
      : undefined;
  }

  if (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    callee.object.name === "React" &&
    callee.property.type === "Identifier"
  ) {
    const { name } = callee.property;

    return name === "use" || /^use[A-Z0-9]/.test(name) ? name : undefined;
  }

  return undefined;
};

const isDirectLocalFunction = (node, parentFunction) => {
  if (!parentFunction || parentFunction.body.type !== "BlockStatement") {
    return false;
  }

  if (node.type === "FunctionDeclaration") {
    return node.parent === parentFunction.body;
  }

  const declarator = node.parent;
  const declaration = declarator?.parent;

  return (
    declarator?.type === "VariableDeclarator" &&
    declaration?.type === "VariableDeclaration" &&
    declaration.parent === parentFunction.body
  );
};

const isSingleStateWriterCall = (node, stateWriters) => {
  let expression;

  if (node.body.type === "CallExpression") {
    expression = node.body;
  } else if (
    node.body.type === "BlockStatement" &&
    node.body.body.length === 1 &&
    node.body.body[0].type === "ExpressionStatement" &&
    node.body.body[0].expression.type === "CallExpression"
  ) {
    expression = node.body.body[0].expression;
  }

  return (
    expression?.callee.type === "Identifier" &&
    stateWriters.has(expression.callee.name)
  );
};

const isJsxOnlyRenderHelper = (node, statementCount) => {
  const returnedExpressions = getReturnedExpressions(node);

  if (
    returnedExpressions.length === 0 ||
    !returnedExpressions.every(isJsxExpression)
  ) {
    return false;
  }

  return (
    node.body.type !== "BlockStatement" ||
    statementCount === returnedExpressions.length
  );
};

const getEffectiveLineCount = (sourceCode, node) => {
  const lines = new Set();

  for (const token of sourceCode.getTokens(node)) {
    for (
      let line = token.loc.start.line;
      line <= token.loc.end.line;
      line += 1
    ) {
      lines.add(line);
    }
  }

  return lines.size;
};

const getResponsibilitySignalText = (signals) =>
  signals
    .map(({ label, count, max }) => `${label}: ${count}, target at most ${max}`)
    .join(", ");

const componentResponsibilityBudgetRule = {
  meta: {
    type: "suggestion",
    schema: [
      {
        type: "object",
        properties: Object.fromEntries(
          Object.keys(DEFAULT_COMPONENT_RESPONSIBILITY_BUDGET).map((key) => [
            key,
            { type: "integer", minimum: 0 },
          ]),
        ),
        additionalProperties: false,
      },
    ],
    messages: {
      overBudgetWithReact:
        "Component '{{name}}' exceeds its responsibility budget. Primary limits: {{hardSignals}}. Supporting targets: {{supportingSignals}}. You should refactor according to the codebase-design skill (SKILL.md). Use its guidance to choose module interfaces and seams that meet these targets while preserving public interfaces and behavior. Rerun affected tests and ESLint. If a target cannot be met without weakening cohesion, state the concrete reason for review.",
      overBudgetWithoutReact:
        "Component '{{name}}' exceeds its responsibility budget. Primary limits: {{hardSignals}}. Supporting targets: {{supportingSignals}}. You should refactor according to the codebase-design skill (SKILL.md). Use its guidance to choose module interfaces and seams that meet these targets while preserving public interfaces and behavior. Rerun affected tests and ESLint. If a target cannot be met without weakening cohesion, state the concrete reason for review.",
    },
  },
  create(context) {
    const budget = {
      ...DEFAULT_COMPONENT_RESPONSIBILITY_BUDGET,
      ...(context.options[0] ?? {}),
    };
    const functionStack = [];

    const getCurrentFrame = () => functionStack.at(-1);

    const enterFunction = (node) => {
      const parentFrame = getCurrentFrame();

      functionStack.push({
        node,
        name: getFunctionName(node),
        isDirectLocal: isDirectLocalFunction(node, parentFrame?.node),
        statementCount: 0,
        cyclomaticComplexity: 1,
        hasAwait: false,
        hasTry: false,
        hasLoop: false,
        topLevelHooks: 0,
        stateHooks: 0,
        effects: 0,
        stateWriters: new Set(),
        localFunctions: 0,
        substantialLocalFunctions: 0,
        currentJsxDepth: 0,
        maxJsxDepth: 0,
      });
    };

    const exitFunction = (node) => {
      const frame = functionStack.pop();
      const parentFrame = getCurrentFrame();

      if (!frame || frame.node !== node) {
        return;
      }

      if (frame.isDirectLocal && parentFrame) {
        const isIgnoredLocalFunction =
          isJsxOnlyRenderHelper(node, frame.statementCount) ||
          isSingleStateWriterCall(node, parentFrame.stateWriters);
        const isSubstantial =
          frame.statementCount >= 4 ||
          frame.cyclomaticComplexity >= 3 ||
          frame.hasAwait ||
          frame.hasTry ||
          frame.hasLoop;

        if (!isIgnoredLocalFunction) {
          parentFrame.localFunctions += 1;
        }

        if (!isIgnoredLocalFunction && isSubstantial) {
          parentFrame.substantialLocalFunctions += 1;
        }
      }

      const isComponent =
        frame.name &&
        isPascalCase(frame.name) &&
        getReturnedExpressions(node).some(isJsxExpression);

      if (!isComponent) {
        return;
      }

      const effectiveLines = getEffectiveLineCount(context.sourceCode, node);
      const hardSignals = [
        {
          label: "state Hooks",
          count: frame.stateHooks,
          max: budget.maxStateHooks,
        },
        {
          label: "Effect Hooks",
          count: frame.effects,
          max: budget.maxEffects,
        },
        {
          label: "local functions",
          count: frame.localFunctions,
          max: budget.maxLocalFunctions,
        },
        {
          label: "substantial local functions",
          count: frame.substantialLocalFunctions,
          max: budget.maxSubstantialLocalFunctions,
        },
      ].filter(({ count, max }) => count > max);
      const supportingSignals = [
        {
          label: "effective lines",
          count: effectiveLines,
          max: budget.maxEffectiveLines,
        },
        {
          label: "top-level Hooks",
          count: frame.topLevelHooks,
          max: budget.maxTopLevelHooks,
        },
        {
          label: "JSX depth",
          count: frame.maxJsxDepth,
          max: budget.maxJsxDepth,
        },
      ].filter(({ count, max }) => count > max);

      if (hardSignals.length === 0 || supportingSignals.length === 0) {
        return;
      }

      context.report({
        node,
        messageId:
          frame.stateHooks > 0 || frame.effects > 0
            ? "overBudgetWithReact"
            : "overBudgetWithoutReact",
        data: {
          name: frame.name,
          hardSignals: getResponsibilitySignalText(hardSignals),
          supportingSignals: getResponsibilitySignalText(supportingSignals),
        },
      });
    };

    const countStatement = () => {
      const frame = getCurrentFrame();

      if (frame) {
        frame.statementCount += 1;
      }
    };

    const countBranch = () => {
      const frame = getCurrentFrame();

      if (frame) {
        frame.cyclomaticComplexity += 1;
      }
    };

    const enterLoop = () => {
      const frame = getCurrentFrame();

      if (frame) {
        frame.hasLoop = true;
        frame.cyclomaticComplexity += 1;
        frame.statementCount += 1;
      }
    };

    const enterJsx = () => {
      const frame = getCurrentFrame();

      if (!frame) {
        return;
      }

      frame.currentJsxDepth += 1;
      frame.maxJsxDepth = Math.max(frame.maxJsxDepth, frame.currentJsxDepth);
    };

    const exitJsx = () => {
      const frame = getCurrentFrame();

      if (frame) {
        frame.currentJsxDepth -= 1;
      }
    };

    const visitors = {
      FunctionDeclaration: enterFunction,
      "FunctionDeclaration:exit": exitFunction,
      FunctionExpression: enterFunction,
      "FunctionExpression:exit": exitFunction,
      ArrowFunctionExpression: enterFunction,
      "ArrowFunctionExpression:exit": exitFunction,
      CallExpression(node) {
        const frame = getCurrentFrame();
        const hookName = getHookName(node.callee);

        if (!frame || !hookName) {
          return;
        }

        frame.topLevelHooks += 1;

        if (STATE_HOOK_NAMES.has(hookName)) {
          frame.stateHooks += 1;
        }

        if (EFFECT_HOOK_NAMES.has(hookName)) {
          frame.effects += 1;
        }
      },
      VariableDeclarator(node) {
        const frame = getCurrentFrame();

        if (
          !frame ||
          node.id.type !== "ArrayPattern" ||
          node.init?.type !== "CallExpression"
        ) {
          return;
        }

        const hookName = getHookName(node.init.callee);

        if (!STATE_HOOK_NAMES.has(hookName)) {
          return;
        }

        const stateWriter = node.id.elements[1];

        if (stateWriter?.type === "Identifier") {
          frame.stateWriters.add(stateWriter.name);
        }
      },
      AwaitExpression() {
        const frame = getCurrentFrame();

        if (frame) {
          frame.hasAwait = true;
        }
      },
      TryStatement() {
        const frame = getCurrentFrame();

        if (frame) {
          frame.hasTry = true;
          frame.statementCount += 1;
        }
      },
      IfStatement() {
        countStatement();
        countBranch();
      },
      ConditionalExpression: countBranch,
      LogicalExpression(node) {
        if (node.operator === "&&" || node.operator === "||") {
          countBranch();
        }
      },
      CatchClause: countBranch,
      SwitchCase(node) {
        if (node.test) {
          countBranch();
        }
      },
      JSXElement: enterJsx,
      "JSXElement:exit": exitJsx,
      JSXFragment: enterJsx,
      "JSXFragment:exit": exitJsx,
    };

    for (const nodeType of LOOP_NODE_TYPES) {
      visitors[nodeType] = enterLoop;
    }

    for (const nodeType of [
      "BreakStatement",
      "ContinueStatement",
      "DebuggerStatement",
      "ExpressionStatement",
      "LabeledStatement",
      "ReturnStatement",
      "SwitchStatement",
      "ThrowStatement",
      "VariableDeclaration",
      "WithStatement",
    ]) {
      visitors[nodeType] = countStatement;
    }

    return visitors;
  },
};

const localReadabilityPlugin = {
  rules: {
    "component-module-contract": componentModuleContractRule,
    "component-props-name": componentPropsNameRule,
    "component-props-type-exports": componentPropsTypeExportsRule,
    "component-responsibility-budget": componentResponsibilityBudgetRule,
    "max-inline-param-properties": maxInlineParamPropertiesRule,
    "no-useless-alias-wrapper": noUselessAliasWrapperRule,
    "react-component-max-params": reactComponentMaxParamsRule,
    "responsibility-budget": responsibilityBudgetRule,
  },
};

export default localReadabilityPlugin;
