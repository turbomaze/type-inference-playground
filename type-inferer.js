var util = require('util');

module.exports = {};

console.logv = (a) => {
  console.log(util.inspect(a, false, null));
  console.log();
};

// classes to help with types
class AbstractType {
  constructor(type) {
    this.type = type;
  }
}

class TypeVariable extends AbstractType {
  constructor() {
    super(null);
    this.name = 'T' + TypeVariable.index;
    TypeVariable.index++;
  }
}
TypeVariable.index = 0; // static property

// classes to help with the syntactic structure
class Func {
  constructor(name, signature) {
    this.name = name;
    this.signature = signature;
  }
}

class Variable {
  constructor(name) {
    this.name = name;
    this.type = new TypeVariable();
  }
}

class Call {
  constructor(f, args) {
    this.func = f;
    this.args = args;
    this.type = new TypeVariable();
  }
}

function getObjectSyntax(variables, signatures, statement) {
  if (typeof statement === 'number') {
    return statement; // primitive numbers
  } else if (typeof statement === 'boolean') {
    return statement; // primitive booleans
  } else if (typeof statement === 'string') {
    var variable = new Variable(statement);
    variables[statement] = variable;
    return variable;
  } else { // function
    var name = statement[0];
    var f = new Func(name, signatures[name]);
    var args = [];
    for (var i = 1; i < statement.length; i++) {
      args.push(getObjectSyntax(variables, signatures, statement[i]));
    }
    return new Call(f, args);
  }
}

function getConstraints(typeMap, expression) {
  var constraints = [];

  typeMap[expression.type.name] = expression.type;

  if (expression.constructor.name === 'Call') {
    // map arguments to argument types; the expression has the type of its return value type
    var signature = expression.func.signature;
    var argTypes = [];
    for (var arg of expression.args) {
      argTypes.push(arg.type);
      constraints = [...constraints, ...getConstraints(typeMap, arg)];
    }
    constraints.push([[...argTypes, expression.type], signature]);
  }
  return constraints;
}

function matchesPattern(signature, constraint) {
  if (signature.length !== constraint.length) {
    return false;
  }

  for (var ci = 0; ci < constraint.length; ci++) {
    if (constraint[ci].type !== null && signature[ci].type !== constraint[ci].type[0]) {
      return false;
    }
  }

  return true;
}

function unify(typeMap, constraint) {
  // imposes the type constraint
  console.log('Applying');
  console.logv(constraint);
  console.logv(typeMap);
  if (constraint[1].length === 1) {
    // with only one viable signature, these types must be present
    for (var ti = 0; ti < constraint[0].length; ti++) {
      var typeId = constraint[0][ti].name;
      var type = constraint[1][0][ti].type;
      typeMap[typeId].type = [type];
    }

    return false;
  } else {
    // filter out impossible signatures
    var signatures = constraint[1];
    constraint[1] = signatures.filter((signature) => {
      return matchesPattern(signature, constraint[0]);
    });

    // record all options for this expression's type
    var allNull = constraint[0].reduce((a, typeVar) => {return a && typeVar.type === null;}, true);
    if (allNull) {
      for (var s = 0; s < signatures.length; s++) {
        for (var c = 0; c < constraint[0].length; c++) {
          if (constraint[0][c].type === null) constraint[0][c].type = [];
          constraint[0][c].type.push(signatures[s][c].type);
        }
      }
    }
  
    return true;
  }
}

function infer(signatures, statements) {
  console.logv(statements);

  // keep track of the variables' types
  var variables = {};
  var typeMap = {};

  // construct object AST from array form
  var expressions = statements.map((statement) => {
    return getObjectSyntax(variables, signatures, statement);
  });
  
  // get constraints
  var constraints = [];
  for (var expression of expressions) {
    constraints = [...constraints, ...getConstraints(typeMap, expression)]
  }
  constraints.sort((a, b) => {
    var diff = a[1].length - b[1].length;
    if (diff > 0) return diff;
    else return a[0].length - b[0].length;
  });

  // unify
  var substitutions = [];
  for (var i = 0; i < 2; i++) {
    constraints = constraints.filter((constraint) => {
      return unify(typeMap, constraint);
    });
  }
  console.logv(constraints);

  // console.logv(constraints);
  console.logv(variables);

  return variables;
}

function populateTypeDict(typeDict, functionSignatures, statement) {
  if (typeof statement === 'string') {
    // parameter
    return false;
  } else {
    var name = statement[0];
    var signatures = functionSignatures[name];

    // get the type restrictions imposed by previous function calls
    var callArity = statement.length - 1; // the arity of this specific call
    var typeRestrictions = null; // null if no restrictions; otherwise, array of valid types 
    if (name in typeDict) {
      typeRestrictions = Object.keys(typeDict[name]);
    }

    // filter out the signatures of this function by 1) arity and 2) type restrictions
    var viableSignatures = signatures;
    if (typeRestrictions !== null) {
      viableSignatures = signatures.filter(function(signature) {
        // compare arity
        if (callArity !== signature.length - 1) return false;

        // the signature's return type must be in the typeRestrictions array
        var returnType = signature[signature.length - 1].type;
        return typeRestrictions.indexOf(returnType) !== -1;
      });
    }
    
    // record the viable signatures in the typeDict entries for each child
    for (var c = 1, st = 0; c < statement.length; c++, st++) {
      var child = statement[c];
      var childName = typeof child === 'string' ? child : child[0];

      if (c === 1) { // first child is special
        typeDict[childName] = {};
        for (var signature of viableSignatures) {
          // add type signature[st] to the types of the first child
          typeDict[childName][signature[st].type] = [];
        }
      } else {
         // add signature[j] where signature is from annotation of child i to the type dict of child j, indexed by previous children types in signature
        typeDict[childName] = {};
        for (var signature of viableSignatures) {
          // add type signature[st] to the types of the first child
          var key = signature[st - 1].type; // the previous child's value for this signature
          if (key in typeDict[childName]) {
            typeDict[childName][key].push(signature[st].type);
          } else {
            typeDict[childName][key] = [signature[st].type];
          }
        }
      }

      // recurse on this child
      populateTypeDict(typeDict, functionSignatures, child);
    }
  }
}

function infer2(functionSignatures, statements) {
  var typeDict = {};
  populateTypeDict(typeDict, functionSignatures, statements[0]);
  console.logv(typeDict);
  return typeDict;
}

module.exports = {
  infer: infer,
  infer2: infer2,
  AbstractType: AbstractType,
  TypeVariable: TypeVariable
};

